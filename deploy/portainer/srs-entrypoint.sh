#!/bin/sh
# Append an ingest vhost block when RTMPS/SRT publishers land on the public hostname
# (SRS selects vhost from the connection hostname). Without this block, HLS is not
# generated and web embeds 404 on .m3u8 while FLV may still work.
#
# When SRS_WEBHOOK_SECRET is set, hook URLs include ?secret= because SRS http_hooks
# POST JSON only and cannot send x-srs-secret headers.
set -e

CONF_SRC=/usr/local/srs/conf/srs.conf
CONF=/tmp/srs.conf
VHOST="${SRS_INGEST_VHOST:-}"
HOOK_BASE='http://control-api:3001/api/webhooks/srs'
FORWARD_BASE='http://control-api:3001/api/webhooks/srs/forward'

urlencode() {
  printf '%s' "$1" | awk '
    BEGIN {
      for (i = 0; i <= 255; i++) {
        ord[sprintf("%c", i)] = i
      }
    }
    {
      line = $0
      for (i = 1; i <= length(line); i++) {
        c = substr(line, i, 1)
        if (c ~ /[-_.~a-zA-Z0-9]/) {
          printf "%s", c
        } else {
          printf "%%%02X", ord[c]
        }
      }
    }
  '
}

if [ -n "$SRS_WEBHOOK_SECRET" ]; then
  ENC_SECRET=$(urlencode "$SRS_WEBHOOK_SECRET")
  HOOK_URL="${HOOK_BASE}?secret=${ENC_SECRET}"
  FORWARD_URL="${FORWARD_BASE}?secret=${ENC_SECRET}"
else
  HOOK_URL="$HOOK_BASE"
  FORWARD_URL="$FORWARD_BASE"
fi

if [ -z "$VHOST" ] && [ -n "$PUBLIC_APP_URL" ]; then
  VHOST=$(printf '%s' "$PUBLIC_APP_URL" | sed -E 's#^[a-zA-Z]+://##' | cut -d/ -f1 | cut -d: -f1)
fi

cp "$CONF_SRC" "$CONF"

if [ -n "$SRS_WEBHOOK_SECRET" ]; then
  sed -i "s|${HOOK_BASE}|${HOOK_URL}|g" "$CONF"
  sed -i "s|${FORWARD_BASE}|${FORWARD_URL}|g" "$CONF"
fi

if [ -n "$VHOST" ]; then
  echo "[hydrofoil-srs] ingest vhost target: ${VHOST}"
else
  echo "[hydrofoil-srs] warning: no SRS_INGEST_VHOST or PUBLIC_APP_URL — RTMPS embed HLS may 404"
fi

if [ -n "$VHOST" ] && [ "$VHOST" != "localhost" ] && [ "$VHOST" != "__defaultVhost__" ]; then
  if ! grep -q "vhost ${VHOST} {" "$CONF"; then
    cat >>"$CONF" <<EOF

vhost ${VHOST} {
    http_hooks {
        enabled         on;
        on_publish      ${HOOK_URL};
        on_unpublish    ${HOOK_URL};
    }
    forward {
        enabled         on;
        backend         ${FORWARD_URL};
    }
    hls {
        enabled             on;
        hls_path            ./objs/nginx/html;
        hls_fragment        2;
        hls_window          10;
        hls_wait_keyframe   on;
        hls_dispose         3;
    }
    http_remux {
        enabled     on;
        mount       [app]/[stream].flv;
    }
    dvr {
        enabled             on;
        dvr_path            ./objs/nginx/html/dvr/[app]/[stream].[timestamp].flv;
        dvr_plan            session;
        dvr_wait_keyframe   on;
    }
    rtc {
        enabled         on;
        rtmp_to_rtc     on;
        rtc_to_rtmp     on;
    }
    srt {
        enabled         on;
        srt_to_rtmp     on;
    }
}
EOF
  fi
fi

exec /usr/local/srs/objs/srs -c "$CONF"

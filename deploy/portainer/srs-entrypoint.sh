#!/bin/sh
# Append an ingest vhost block when RTMPS/SRT publishers land on the public hostname
# (SRS selects vhost from the connection hostname). Without this block, HLS is not
# generated and web embeds 404 on .m3u8 while FLV may still work.
set -e

CONF_SRC=/usr/local/srs/conf/srs.conf
CONF=/tmp/srs.conf
VHOST="${SRS_INGEST_VHOST:-}"

cp "$CONF_SRC" "$CONF"

if [ -n "$VHOST" ] && [ "$VHOST" != "localhost" ] && [ "$VHOST" != "__defaultVhost__" ]; then
  if ! grep -q "vhost ${VHOST} {" "$CONF"; then
    cat >>"$CONF" <<EOF

vhost ${VHOST} {
    http_hooks {
        enabled         on;
        on_publish      http://control-api:3001/api/webhooks/srs;
        on_unpublish    http://control-api:3001/api/webhooks/srs;
    }
    forward {
        enabled         on;
        backend         http://control-api:3001/api/webhooks/srs/forward;
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

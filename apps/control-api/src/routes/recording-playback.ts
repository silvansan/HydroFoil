import { Router } from 'express';

import type { AppContext } from '../context';

import { BadRequestError, NotFoundError } from '../errors';

import { asyncHandler } from '../middleware/async-handler';

import {
  hlsManifestKey,
  resolveStorageObject,
  signedPlaybackUrl,
} from '../services/recording-playback';

function inferAudioContentType(asset: { codec?: unknown; objectKey?: unknown }): string {
  const objectKey = typeof asset.objectKey === 'string' ? asset.objectKey.toLowerCase() : '';
  const codec = typeof asset.codec === 'string' ? asset.codec.toLowerCase() : '';

  if (objectKey.endsWith('.aac') || codec === 'aac') return 'audio/aac';
  if (objectKey.endsWith('.ogg') || codec === 'opus') return 'audio/ogg';
  return 'audio/mpeg';
}



function recordingRef(asset: {

  storageLocation: unknown;

  objectKey: unknown;

  metadata?: unknown;

}) {

  return {

    storageLocation: String(asset.storageLocation),

    objectKey: String(asset.objectKey),

    metadata:

      asset.metadata && typeof asset.metadata === 'object'

        ? (asset.metadata as Record<string, unknown>)

        : undefined,

  };

}



export function createRecordingPlaybackRouter(ctx: AppContext): Router {

  const router = Router({ mergeParams: true });



  router.get(

    '/playback-url',

    asyncHandler(async (req, res) => {

      const asset = await ctx.repos.recordingAssets.findById(ctx.organizationId, req.params.id);

      if (!asset) throw new NotFoundError('Recording not found');

      if (asset.status !== 'ready') {

        throw new BadRequestError(

          asset.status === 'finalizing'

            ? 'Recording is still uploading to storage'

            : `Recording is not playable (status: ${asset.status})`

        );

      }



      const ref = recordingRef(asset);

      const manifestKey = hlsManifestKey(ref);

      const format = manifestKey ? 'hls' : 'flv';

      const previewUrl = manifestKey

        ? `/api/recordings/${String(asset.id)}/media?format=hls`

        : `/api/recordings/${String(asset.id)}/media`;



      const shareUrl = await signedPlaybackUrl(ref, ref.objectKey, 7 * 24 * 60 * 60, ctx.repos);
      const generatedAudioAssets = await ctx.repos.generatedAudioAssets.listReadyByRecordingAssetId(
        ctx.organizationId,
        String(asset.id)
      );



      res.json({

        format,

        previewUrl,

        shareUrl,

        audioAssets: generatedAudioAssets.map((audioAsset: {
          id: string;
          codec: string;
          duration: number;
          fileSize: number;
        }) => ({
          id: String(audioAsset.id),
          codec: String(audioAsset.codec),
          duration: Number(audioAsset.duration),
          fileSize: Number(audioAsset.fileSize),
          previewUrl: `/api/recordings/${String(asset.id)}/audio-assets/${String(audioAsset.id)}/media`,
        })),

        expiresInSeconds: 7 * 24 * 60 * 60,

      });

    })

  );



  router.get(

    '/audio-assets/:audioAssetId/media',

    asyncHandler(async (req, res) => {

      const asset = await ctx.repos.recordingAssets.findById(ctx.organizationId, req.params.id);

      if (!asset) throw new NotFoundError('Recording not found');

      const audioAsset = await ctx.repos.generatedAudioAssets.findById(
        ctx.organizationId,
        req.params.audioAssetId
      );
      if (!audioAsset || String(audioAsset.recordingAssetId) !== String(asset.id)) {
        throw new NotFoundError('Generated audio asset not found');
      }
      if (audioAsset.status !== 'ready') {
        throw new BadRequestError('Generated audio is not available yet');
      }

      const { storage, bucket, objectKey } = await resolveStorageObject(
        String(audioAsset.storageLocation),
        String(audioAsset.objectKey),
        ctx.repos
      );
      const stream = await storage.getObjectStream(bucket, objectKey);
      res.setHeader('Content-Type', inferAudioContentType(audioAsset));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    })

  );



  router.get(

    '/media',

    asyncHandler(async (req, res) => {

      const asset = await ctx.repos.recordingAssets.findById(ctx.organizationId, req.params.id);

      if (!asset) throw new NotFoundError('Recording not found');

      if (asset.status !== 'ready') {

        throw new BadRequestError('Recording media is not available yet');

      }



      const ref = recordingRef(asset);

      const format = typeof req.query.format === 'string' ? req.query.format : 'flv';

      const manifestKey = hlsManifestKey(ref);



      if (format === 'hls') {

        if (!manifestKey) throw new BadRequestError('HLS is not available for this recording');



        const { storage, bucket, objectKey } = await resolveStorageObject(
          ref.storageLocation,
          manifestKey,
          ctx.repos
        );

        const stream = await storage.getObjectStream(bucket, objectKey);

        const chunks: Buffer[] = [];

        for await (const chunk of stream) {

          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

        }

        const playlist = Buffer.concat(chunks).toString('utf8');

        const base = `/api/recordings/${String(asset.id)}/hls/`;

        const rewritten = playlist

          .split('\n')

          .map((line) => {

            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#')) return line;

            if (trimmed.startsWith('http')) return line;

            return `${base}${encodeURIComponent(trimmed)}`;

          })

          .join('\n');



        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

        res.setHeader('Cache-Control', 'private, max-age=60');

        res.send(rewritten);

        return;

      }



      const { storage, bucket, objectKey } = await resolveStorageObject(
        ref.storageLocation,
        ref.objectKey,
        ctx.repos
      );

      const stream = await storage.getObjectStream(bucket, objectKey);

      res.setHeader('Content-Type', 'video/x-flv');

      res.setHeader('Cache-Control', 'private, max-age=3600');

      stream.on('error', () => {

        if (!res.headersSent) res.status(500).end();

      });

      stream.pipe(res);

    })

  );



  router.get(

    '/hls/:segment',

    asyncHandler(async (req, res) => {

      const asset = await ctx.repos.recordingAssets.findById(ctx.organizationId, req.params.id);

      if (!asset) throw new NotFoundError('Recording not found');



      const ref = recordingRef(asset);

      const manifestKey = hlsManifestKey(ref);

      if (!manifestKey) throw new NotFoundError('HLS segment not found');



      const segment = decodeURIComponent(req.params.segment);

      if (segment.includes('..') || segment.includes('/')) {

        throw new BadRequestError('Invalid segment name');

      }



      const dirKey = manifestKey.replace(/index\.m3u8$/i, '');

      const segmentKey = `${dirKey}${segment}`;

      const { storage, bucket, objectKey } = await resolveStorageObject(
        ref.storageLocation,
        segmentKey,
        ctx.repos
      );

      const stream = await storage.getObjectStream(bucket, objectKey);

      res.setHeader('Content-Type', 'video/mp2t');

      res.setHeader('Cache-Control', 'private, max-age=3600');

      stream.on('error', () => {

        if (!res.headersSent) res.status(500).end();

      });

      stream.pipe(res);

    })

  );



  return router;

}



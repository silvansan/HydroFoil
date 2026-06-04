import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pino from 'pino';
import pinoHttp from 'pino-http';

import type { AppContext } from './context';
import { HttpError } from './errors';
import { authMiddleware } from './middleware/auth';
import { createAccessScopeMiddleware } from './middleware/access-scope';
import { createDomainBlocksRouter } from './routes/domain-blocks';
import { createGatewayRouter } from './routes/gateway';
import { createHealthRouter } from './routes/health';
import { createApplicationsRouter } from './routes/applications';
import { createUsersRouter } from './routes/users';
import { createAuthRouter } from './routes/auth';
import { createDvrWatchlistRouter } from './routes/dvr-watchlist';
import { createInputsRouter } from './routes/inputs';
import { createInputRecordingRouter } from './routes/input-recording';
import { createRecordingPlaybackRouter } from './routes/recording-playback';
import { createRecordingPoliciesRouter } from './routes/recording-policies';
import { createStreamProfilesRouter } from './routes/stream-profiles';
import { createAudioFeedProfilesRouter } from './routes/audio-feed-profiles';
import { createPlaybackRouter } from './routes/playback';
import { createLiveSessionsRouter, createRecordingsRouter } from './routes/sessions';
import { createOutputsRouter } from './routes/outputs';
import { createRoutesRouter } from './routes/routes';
import { createRestreamsRouter } from './routes/restreams';
import { createStorageLocationsRouter } from './routes/storage-locations';
import { createSystemRouter } from './routes/system';
import { createSrsMediaProxyRouter } from './routes/srs-media-proxy';
import { createVodPublicPlaybackRouter, createVodRoutesRouter } from './routes/vod-routes';
import { createWebhooksRouter } from './routes/webhooks';

export function createApp(ctx: AppContext) {
  const app = express();
  const logger = pino();

  app.use(cors());
  app.use(bodyParser.json());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/health', createHealthRouter(ctx));
  app.use('/api/auth', createAuthRouter(ctx));
  app.use('/srs-media', createSrsMediaProxyRouter());
  app.use('/api', authMiddleware);
  app.use('/api', createAccessScopeMiddleware(ctx));
  app.use('/api/system', createSystemRouter(ctx));
  app.use('/api/applications', createApplicationsRouter(ctx));
  app.use('/api/users', createUsersRouter(ctx));
  app.use('/api/dvr-watchlist', createDvrWatchlistRouter(ctx));
  app.use('/api/inputs', createInputsRouter(ctx));
  app.use('/api/inputs/:id/recording', createInputRecordingRouter(ctx));
  app.use('/api/outputs', createOutputsRouter(ctx));
  app.use('/api/routes', createRoutesRouter(ctx));
  app.use('/api/restreams', createRestreamsRouter(ctx));
  app.use('/api/domain-blocks', createDomainBlocksRouter(ctx));
  app.use('/api/storage-locations', createStorageLocationsRouter(ctx));
  app.use('/api/vod-routes', createVodRoutesRouter(ctx));
  app.use('/api/live-sessions', createLiveSessionsRouter(ctx));
  app.use('/api/recording-policies', createRecordingPoliciesRouter(ctx));
  app.use('/api/stream-profiles', createStreamProfilesRouter(ctx));
  app.use('/api/audio-feed-profiles', createAudioFeedProfilesRouter(ctx));
  app.use('/api/recordings/:id', createRecordingPlaybackRouter(ctx));
  app.use('/api/recordings', createRecordingsRouter(ctx));
  app.use('/api/playback', createPlaybackRouter(ctx));
  app.use('/api/gateway', createGatewayRouter(ctx));
  app.use('/api/webhooks', createWebhooksRouter(ctx));

  app.get('/api/ome/status', (_req, res) => {
    res.redirect(307, '/api/gateway/status');
  });

  app.use('/', createVodPublicPlaybackRouter(ctx));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message, timestamp: new Date().toISOString() });
      return;
    }

    logger.error(err, 'Unhandled error');
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

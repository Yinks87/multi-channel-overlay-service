import express from 'express';
import cors from 'cors';

import config from './config.js';
import { openDb } from './db/index.js';
import baseRouter from './router/base-router.js';
import {
  overlayDispatcher,
  registerOverlay,
} from './overlays/overlays-registry.js';
import { getActiveOverlays } from './db/services/overlayService.js';
import {
  connectToTwitchEventSubs,
  initAppToken,
} from './router/api-v1/twitch/connect-eventsubs.js';
import { getAllStreamersAccessTokens } from './db/services/userService.js';
import { startUserTokenValidationSchedule } from './twitch/tokenValidator.js';

const app = express();

app.use(cors());
// rawBody is needed for Twitch EventSub HMAC signature verification
app.use(
  express.json({
    verify: (_req, _res, buf) => {
      _req.rawBody = buf;
    },
  }),
);

app.use('/', baseRouter);

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status ?? 500;
  res
    .status(status)
    .json({ success: false, error: err.message ?? 'Internal server error' });
});

const host = config.BACKEND_HOST || 'localhost';
const port = config.BACKEND_PORT || 3000;

async function startService() {
  try {
    await openDb(config.MODE !== 'development' ? config.DB_PATH : undefined);
    const server = app.listen(port, () => {
      console.log(`Server is running on http://${host}:${port}`);
    });

    // Load and register active overlays from the database
    const activeOverlays = await getActiveOverlays();
    for (const overlay of activeOverlays) {
      registerOverlay({
        routePath: overlay.route_path,
        folderPath: overlay.folder_path,
        entryFile: overlay.entry_file,
      });
    }

    const accessTokens = await getAllStreamersAccessTokens();

    // Fetch a fresh app access token and persist it to app_settings
    await initAppToken();

    // Starts/ensures one EventSub websocket loop per streamer token.
    // connectToTwitchEventSubs returns after loops are scheduled in background.
    if (accessTokens.length > 0) {
      await connectToTwitchEventSubs({ access_tokens: accessTokens });
    } else {
      console.warn(
        'No streamer access tokens found, skipping EventSub connection.',
      );
    }

    // Validate all user access tokens now and every 60 minutes
    startUserTokenValidationSchedule();
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

startService();

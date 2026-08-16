import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  createUser,
  getUserById,
  getUserByNormalizedUserName,
} from '../../db/services/userService.js';
import userRouter from './user/v1.js';
import overlayRouter from './overlay/v1.js';
import customTablesRouter from './custom-tables/v1.js';
import { twitchAuthRouter } from './twitch/auth.js';
import webhookRouter from './twitch/eventsub-webhook.js';
import registeredStreamersRouter from './registered-streamers/v1.js';
import adminsRouter from './admins/v1.js';
import twitchEventRouter from './twitch/v1.js';

const api_v1_router = express.Router();

api_v1_router.use('/user', userRouter);
api_v1_router.use('/overlay', overlayRouter);
api_v1_router.use('/custom-tables', customTablesRouter);
api_v1_router.use('/twitch', twitchAuthRouter);
api_v1_router.use('/twitch/event', twitchEventRouter);
api_v1_router.use('/twitch/eventsub-webhook', webhookRouter);
api_v1_router.use('/registered-streamers', registeredStreamersRouter);
api_v1_router.use('/admins', adminsRouter);

export default api_v1_router;

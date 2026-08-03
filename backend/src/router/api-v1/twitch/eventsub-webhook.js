import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';
import config from '../../../config.js';
import { handleEventSub } from './eventsub-message-handler.js';

const webhookRouter = express.Router();

const HDR_MSG_ID = 'twitch-eventsub-message-id';
const HDR_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const HDR_SIGNATURE = 'twitch-eventsub-message-signature';
const HDR_MSG_TYPE = 'twitch-eventsub-message-type';

function verifySignature(req) {
  const secret = config.EVENTSUB_WEBHOOK_SECRET;
  if (!secret) return false;

  const msgId = req.headers[HDR_MSG_ID];
  const timestamp = req.headers[HDR_TIMESTAMP];
  const signature = req.headers[HDR_SIGNATURE];

  if (!msgId || !timestamp || !signature || !req.rawBody) return false;

  const expected =
    'sha256=' +
    createHmac('sha256', secret)
      .update(msgId + timestamp + req.rawBody)
      .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

webhookRouter.post('/', (req, res) => {
  if (!verifySignature(req)) {
    return res.status(403).end();
  }

  const msgType = req.headers[HDR_MSG_TYPE];
  const body = req.body;

  if (msgType === 'webhook_callback_verification') {
    return res.status(200).send(body.challenge);
  }

  if (msgType === 'notification') {
    handleEventSub(body);
    return res.status(204).end();
  }

  if (msgType === 'revocation') {
    console.warn(
      `[EventSub] Subscription revoked: ${body.subscription?.type} — reason: ${body.subscription?.status}`,
    );
    return res.status(204).end();
  }

  res.status(204).end();
});

export default webhookRouter;

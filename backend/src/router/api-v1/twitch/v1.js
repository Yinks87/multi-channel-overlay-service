import express from 'express';
import { getUserByTwitchId } from '../../../db/services/userService.js';
import { sendChatMessage } from '../../../twitch/api.js';

const twitchEventRouter = express.Router();

twitchEventRouter.post('/message/send', async (req, res, next) => {
  const { message_id, broadcaster_id, message } = req.body;

  const user = await getUserByTwitchId({ twitchId: broadcaster_id });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const access_token = JSON.parse(user?.twitch).access_token;

  try {
    const msgRes = await sendChatMessage({
      access_token: access_token,
      broadcaster_id,
      sender_id: broadcaster_id,
      message,
    });

    if (msgRes[0] && msgRes[0].is_sent) {
      console.log('Message sent successfully');
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default twitchEventRouter;

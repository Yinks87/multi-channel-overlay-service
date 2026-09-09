import express from 'express';
import {
  addRoleToUser,
  removeRoleFromUser,
  isModeratorOfAnyRegisteredStreamer,
} from '../../../db/services/userService.js';
import { requireRole } from '../../../middleware/auth.js';
import { getUsers } from '../../../twitch/api.js';
import {
  addStreamerEventSub,
  removeStreamerEventSub,
} from '../twitch/connect-eventsubs.js';
import { fetchUserEmotes } from '../../../twitch/twitch-emotes/fetch-user-emotes.js';
import { deleteUserEmotes } from '../../../db/services/emoteService.js';
import UsersModel from '../../../db/schemas/users.js';

const registeredStreamersRouter = express.Router();

registeredStreamersRouter.get('/', async (req, res, next) => {
  try {
    const streamers = await UsersModel.find({ roles: { $in: ['streamer'] } });
    const safeTwitchData = streamers.map((streamer) => {
      const twitchData = streamer.twitch || {};
      return {
        ...streamer,
        twitch: {
          id: twitchData.id || null,
          login: twitchData.login || null,
          display_name: twitchData.display_name || null,
          profile_image_url: twitchData.profile_image_url || null,
          hasAccessToken: !!twitchData.access_token,
        },
      };
    });
    const safeStreamers = streamers.map(
      ({ id, userName, normalizedUserName, roles, connected }) => ({
        id,
        userName,
        normalizedUserName,
        roles,
        connected: !!connected,
      }),
    );

    res.json({
      success: true,
      data: safeStreamers.map((streamer, index) => ({
        ...streamer,
        ...safeTwitchData[index],
      })),
    });
  } catch (error) {
    next(error);
  }
});

registeredStreamersRouter.post(
  '/',
  requireRole('owner', 'admin'),
  async (req, res, next) => {
    try {
      const { userName, requesterId } = req.body;
      if (!userName?.trim()) {
        return res
          .status(400)
          .json({ success: false, error: 'userName is required' });
      }

      const normalizedUserName = userName.trim().toLowerCase();
      let user = await UsersModel.findOne({ normalizedUserName });

      if (!user) {
        // use app access_token instead of user access_token
        let requesterUser = await UsersModel.findOne({ id: requesterId });

        const { access_token } = requesterUser?.twitch || {};

        const twitchData = await getUsers({
          access_token,
          login: normalizedUserName,
        });

        if (!twitchData || twitchData.length === 0) {
          return res.status(404).json({
            success: false,
            error:
              'User not found on Twitch. Please ensure the user has a Twitch account.',
          });
        }

        await UsersModel.create({
          id: twitchData.id,
          userName: userName.trim(),
          normalizedUserName,
          twitch: twitchData,
          roles: ['streamer', 'overlay:read'],
        });

        return res.status(201).json({
          success: true,
          data: { userId: twitchData.id, twitch: twitchData },
        });
      }

      await addRoleToUser({ userId: user.id, role: 'streamer' });
      await addRoleToUser({ userId: user.id, role: 'overlay:read' });

      // Connect EventSub and fetch emotes immediately if the user already has a stored token
      const twitchData = user.twitch || {};
      const token = twitchData.access_token;
      if (token) {
        addStreamerEventSub({ access_token: token }).catch((err) =>
          console.error(
            `[EventSub] Failed to subscribe on streamer add: ${err.message}`,
          ),
        );
        console.log(`[EventSub] Subscribing for streamer with token: ${token}`);
        await fetchUserEmotes({ twitchId: twitchData.id });
      }

      res.json({ success: true, data: { userId: user.id } });
    } catch (error) {
      next(error);
    }
  },
);

registeredStreamersRouter.delete(
  '/:id',
  requireRole('owner', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await UsersModel.findOne({ id });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: 'User not found' });
      }

      await removeRoleFromUser({ userId: id, role: 'streamer' });
      await deleteUserEmotes({ id: user.twitch.id });
      // Unsubscribe EventSub if the streamer had a connected token
      const token = user.twitch.access_token;
      if (token) {
        removeStreamerEventSub({ access_token: token }).catch((err) =>
          console.error(
            `[EventSub] Failed to unsubscribe on streamer remove: ${err.message}`,
          ),
        );
      }

      // If the user still moderates a registered streamer's channel, keep their
      // overlay access and promote them to moderator instead of revoking all.
      const isMod = await isModeratorOfAnyRegisteredStreamer({
        moderatedChannels: user.moderatedChannels,
      });

      if (isMod) {
        await addRoleToUser({ userId: id, role: 'moderator' });
        // overlay:read is intentionally kept
      } else {
        await removeRoleFromUser({ userId: id, role: 'overlay:read' });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

registeredStreamersRouter.patch(
  '/:id/connected',
  requireRole('owner', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { connected } = req.body;

      if (typeof connected !== 'boolean') {
        return res
          .status(400)
          .json({ success: false, error: 'connected must be a boolean' });
      }

      const user = await UsersModel.findOne({ id });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: 'User not found' });
      }

      await UsersModel.findOneAndUpdate(
        { id },
        { $set: { connected: connected ? true : false } },
      );

      const token = user.twitch.access_token;
      if (token) {
        if (connected) {
          addStreamerEventSub({ access_token: token }).catch((err) =>
            console.error(
              `[EventSub] Failed to subscribe on connect: ${err.message}`,
            ),
          );
        } else {
          removeStreamerEventSub({ access_token: token }).catch((err) =>
            console.error(
              `[EventSub] Failed to unsubscribe on disconnect: ${err.message}`,
            ),
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

registeredStreamersRouter.patch(
  '/:id',
  requireRole('owner', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      const user = await UsersModel.findOne({ id });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: 'User not found' });
      }

      // Keep base roles, replace permission roles
      const baseRoles = user.roles.filter((r) => !r.includes(':'));
      const safePermissions = Array.isArray(permissions)
        ? permissions.filter((p) => typeof p === 'string' && p.includes(':'))
        : [];
      const newRoles = [...baseRoles, ...safePermissions];

      await UsersModel.findOneAndUpdate({ id }, { $set: { roles: newRoles } });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default registeredStreamersRouter;

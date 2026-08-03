import express from 'express';
import {
  getUsersByRole,
  getUserById,
  addRoleToUser,
  removeRoleFromUser,
  getUserByNormalizedUserName,
  createUser,
  updateUser,
  isModeratorOfAnyRegisteredStreamer,
} from '../../../db/services/userService.js';
import { requireRole } from '../../../middleware/auth.js';
import { getUsers } from '../../../twitch/api.js';
import { addStreamerEventSub, removeStreamerEventSub } from '../twitch/connect-eventsubs.js';

const registeredStreamersRouter = express.Router();

registeredStreamersRouter.get('/', async (req, res, next) => {
  try {
    const streamers = await getUsersByRole({ role: 'streamer' });
    const safeTwitchData = streamers.map((streamer) => {
      const twitchData = JSON.parse(streamer.twitch || '{}');
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
        connected: connected !== 0,
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
      let user = await getUserByNormalizedUserName({ normalizedUserName });

      if (!user) {
        const requesterUser = await getUserById({ userId: requesterId });
        const { access_token } = JSON.parse(requesterUser?.twitch);

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

        const userId = await createUser({
          user: {
            userName: userName.trim(),
            normalizedUserName,
            twitch: JSON.stringify(twitchData),
            roles: JSON.stringify(['streamer', 'overlay:read']),
          },
        });
        return res
          .status(201)
          .json({ success: true, data: { userId, twitch: twitchData } });
      }

      await addRoleToUser({ userId: user.id, role: 'streamer' });
      await addRoleToUser({ userId: user.id, role: 'overlay:read' });

      // Connect EventSub immediately if the user already has a stored token
      const token = JSON.parse(user.twitch || '{}').access_token;
      if (token) {
        addStreamerEventSub({ access_token: token }).catch((err) =>
          console.error(`[EventSub] Failed to subscribe on streamer add: ${err.message}`),
        );
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
      const user = await getUserById({ userId: id });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: 'User not found' });
      }

      await removeRoleFromUser({ userId: id, role: 'streamer' });

      // Unsubscribe EventSub if the streamer had a connected token
      const token = JSON.parse(user.twitch || '{}').access_token;
      if (token) {
        removeStreamerEventSub({ access_token: token }).catch((err) =>
          console.error(`[EventSub] Failed to unsubscribe on streamer remove: ${err.message}`),
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
        return res.status(400).json({ success: false, error: 'connected must be a boolean' });
      }

      const user = await getUserById({ userId: id });
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await updateUser({ key: 'id', keyValue: id, updateData: { connected: connected ? 1 : 0 } });

      const token = JSON.parse(user.twitch || '{}').access_token;
      if (token) {
        if (connected) {
          addStreamerEventSub({ access_token: token }).catch((err) =>
            console.error(`[EventSub] Failed to subscribe on connect: ${err.message}`),
          );
        } else {
          removeStreamerEventSub({ access_token: token }).catch((err) =>
            console.error(`[EventSub] Failed to unsubscribe on disconnect: ${err.message}`),
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

      const user = await getUserById({ userId: id });
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

      await updateUser({
        key: 'id',
        keyValue: id,
        updateData: { roles: JSON.stringify(newRoles) },
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default registeredStreamersRouter;

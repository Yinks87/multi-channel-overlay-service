import express from 'express';
import {
  addRoleToUser,
  isModeratorOfAnyRegisteredStreamer,
} from '../../../db/services/userService.js';
import { requireRole } from '../../../middleware/auth.js';
import { getUsers } from '../../../twitch/api.js';
import UsersModel from '../../../db/schemas/users.js';

const adminsRouter = express.Router();

adminsRouter.get(
  '/',
  requireRole('owner', 'admin:manage'),
  async (req, res, next) => {
    try {
      const admins = await UsersModel.find({ roles: { $in: ['admin'] } });
      const safeTwitchData = admins.map((admin) => {
        const twitchData = admin.twitch;
        return {
          ...admin,
          twitch: {
            id: twitchData.id || null,
            login: twitchData.login || null,
            display_name: twitchData.display_name || null,
            profile_image_url: twitchData.profile_image_url || null,
          },
        };
      });
      const safeAdmins = admins.map(
        ({ id, userName, normalizedUserName, roles }) => ({
          id,
          userName,
          normalizedUserName,
          roles,
        }),
      );
      res.json({
        success: true,
        data: safeAdmins.map((admin, index) => ({
          ...admin,
          ...safeTwitchData[index],
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

adminsRouter.post(
  '/',
  requireRole('owner', 'admin:manage'),
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
        const requesterUser = await UsersModel.findOne({ id: requesterId });
        const { access_token } = requesterUser?.twitch;

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
          roles: ['admin'],
        });

        return res.status(201).json({
          success: true,
          data: { userId: twitchData.id, twitch: twitchData },
        });
      }

      // admin:manage cannot promote the owner
      if (
        user.roles.includes('owner') &&
        !req.currentUser.roles.includes('owner')
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Cannot modify the owner account' });
      }

      await addRoleToUser({ userId: user.id, role: 'admin' });
      res.json({ success: true, data: { userId: user.id } });
    } catch (error) {
      next(error);
    }
  },
);

adminsRouter.delete(
  '/:id',
  requireRole('owner', 'admin:manage'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // admin:manage cannot demote the owner
      const target = await UsersModel.findOne({ id });
      if (
        target?.roles.includes('owner') &&
        !req.currentUser.roles.includes('owner')
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Cannot modify the owner account' });
      }

      const adminRoles = [
        'admin',
        'overlay:manage',
        'db:manage',
        'admin:manage',
      ];
      let newRoles = target.roles.filter((r) => !adminRoles.includes(r));

      if (target.roles.includes('streamer')) {
        // Also a streamer — keep all streamer-related roles untouched
      } else {
        // Not a streamer — decide based on channel moderation
        const isMod = await isModeratorOfAnyRegisteredStreamer({
          moderatedChannels: target.moderatedChannels,
        });

        if (isMod) {
          // Retain / ensure moderator access via channel moderation
          if (!newRoles.includes('moderator')) newRoles.push('moderator');
          if (!newRoles.includes('overlay:read')) newRoles.push('overlay:read');
        } else {
          // No streamer role and no mod channels — revoke all overlay access
          newRoles = newRoles.filter(
            (r) => r !== 'moderator' && r !== 'overlay:read',
          );
        }
      }

      await UsersModel.findOneAndUpdate(
        { id },
        { roles: newRoles },
        { upsert: true },
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/v1/admins/:id — update permission roles (owner or admin:manage)
// Body: { permissions: ['overlay:manage', 'db:manage', 'admin:manage'] }
adminsRouter.patch(
  '/:id',
  requireRole('owner', 'admin:manage'),
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

      // admin:manage cannot modify the owner account
      if (
        user.roles.includes('owner') &&
        !req.currentUser.roles.includes('owner')
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Cannot modify the owner account' });
      }

      // Keep all non-permission roles (roles without ':') and replace permission roles
      const baseRoles = user.roles.filter((r) => !r.includes(':'));
      const safePermissions = Array.isArray(permissions)
        ? permissions.filter((p) => typeof p === 'string' && p.includes(':'))
        : [];
      const newRoles = [...baseRoles, ...safePermissions];

      await UsersModel.findOneAndUpdate(
        { id },
        { roles: newRoles },
        { upsert: true },
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default adminsRouter;

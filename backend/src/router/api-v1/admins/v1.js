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

const adminsRouter = express.Router();

adminsRouter.get(
  '/',
  requireRole('owner', 'admin:manage'),
  async (req, res, next) => {
    try {
      const admins = await getUsersByRole({ role: 'admin' });
      const safeTwitchData = admins.map((admin) => {
        const twitchData = JSON.parse(admin.twitch || '{}');
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
            roles: JSON.stringify(['admin']),
          },
        });
        return res
          .status(201)
          .json({ success: true, data: { userId, twitch: twitchData } });
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
      const target = await getUserById({ userId: id });
      if (
        target?.roles.includes('owner') &&
        !req.currentUser.roles.includes('owner')
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Cannot modify the owner account' });
      }

      const adminRoles = ['admin', 'overlay:manage', 'db:manage', 'admin:manage'];
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

// PATCH /api/v1/admins/:id — update permission roles (owner or admin:manage)
// Body: { permissions: ['overlay:manage', 'db:manage', 'admin:manage'] }
adminsRouter.patch(
  '/:id',
  requireRole('owner', 'admin:manage'),
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

export default adminsRouter;

import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  createUser,
  getAllUsers,
  getUserById,
  getUserByNormalizedUserName,
} from '../../../db/services/userService.js';
import { requireRole } from '../../../middleware/auth.js';

const userRouter = express.Router();

userRouter.get('/', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const userId = req.query.id;
    const userName = req.query.userName.toLocaleLowerCase();

    if (!userId && !userName) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user ID or userName' });
    }

    let user;
    if (userId) {
      user = await getUserById({ userId });
    } else if (userName) {
      user = await getUserByNormalizedUserName({
        normalizedUserName: userName,
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/user/all — list all safely parsed users (owner or admin)
userRouter.get('/all', async (req, res, next) => {
  try {
    const users = await getAllUsers();

    const safeUsers = users.map((user) => {
      // Parse the twitch JSON data and only include safe fields
      const twitchData = JSON.parse(user.twitch || '{}');
      return {
        ...user,
        twitch: {
          id: twitchData.id || null,
          login: twitchData.login || null,
          display_name: twitchData.display_name || null,
          profile_image_url: twitchData.profile_image_url || null,
        },
      };
    });

    res.json({ success: true, data: safeUsers });
  } catch (err) {
    next(err);
  }
});

userRouter.post('/', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { userName, normalizedUserName, roles } = req.body;
    if (!userName || !normalizedUserName) {
      return res.status(400).json({
        success: false,
        error: 'Missing userName or normalizedUserName',
      });
    }

    const newUser = {
      userName,
      normalizedUserName,
      roles: JSON.stringify(Array.isArray(roles) ? roles : ['user']),
    };
    const newUserId = await createUser({ user: newUser });
    res.status(201).json({ success: true, data: newUserId });
  } catch (err) {
    next(err);
  }
});

export default userRouter;

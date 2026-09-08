import express from 'express';
import { requireRole } from '../../../middleware/auth.js';
import UsersModel from '../../../db/schemas/users.js';
import AppSettingsModel from '../../../db/schemas/app-settings.js';
import { getUsers } from '../../../twitch/api.js';

const userRouter = express.Router();

userRouter.get('/', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const userId = req.query.id;
    const userName = req.query?.userName?.toLowerCase();

    if (!userId && !userName) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing user ID or userName' });
    }

    let user;
    if (userId) {
      user = await UsersModel.findOne({ id: userId });
    } else if (userName) {
      user = await UsersModel.findOne({ normalizedUserName: userName });
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
    const users = await UsersModel.find();

    const safeUsers = users.map((user) => {
      // Parse the twitch JSON data and only include safe fields
      const twitchData = user.twitch;
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

userRouter.post('/', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { userName, normalizedUserName, roles } = req.body;
    if (!userName || !normalizedUserName) {
      return res.status(400).json({
        success: false,
        error: 'Missing userName or normalizedUserName',
      });
    }

    const appCredentials = await AppSettingsModel.find();
    const userData = await getUsers({
      access_token: appCredentials[0].access_token,
      login: normalizedUserName,
    });

    await UsersModel.create({
      id: userData.id || null,
      userName,
      normalizedUserName,
      roles: Array.isArray(roles) ? roles : ['user'],
    });

    res.status(201).json({ success: true, data: userData.id });
  } catch (err) {
    next(err);
  }
});

export default userRouter;

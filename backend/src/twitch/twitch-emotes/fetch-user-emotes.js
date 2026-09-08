import axios from 'axios';

import {
  getAllUsersWithTwitchTokens,
} from '../../db/services/userService.js';

import { getChannelEmotes } from '../api.js';
import {
  process7TVEmotes,
  processBTTVEmotes,
  processFFZEmotes,
  processTwitchEmotes,
} from './utils.js';
import UserEmotesModel from '../../db/schemas/user-emotes.js';
import UsersModel from '../../db/schemas/users.js';

export const fetchUserEmotes = async ({ twitchId }) => {
  try {
    const user = await UsersModel.findOne({ 'twitch.id': twitchId });
    const twitchData = user?.twitch;

    if (!user.roles.includes('streamer')) {
      return {
        success: false,
        message: `User with Twitch ID ${twitchId} is not a streamer`,
      };
    }

    if (!twitchData) {
      return {
        success: false,
        message: `Twitch data not found for user with Twitch ID ${twitchId}`,
      };
    }

    const { id, login, access_token } = twitchData;
    const [
      bttvEmotes = {},
      ffzEmotes = {},
      sevenTvEmotes = {},
      twitchEmotes = {},
    ] = await Promise.all([
      getUserBttvEmotes(id, login),
      getUserFfzEmotes(id, login),
      getUser7tvEmotes(id, login),
      getUserTwitchEmotes(id, access_token),
    ]);

    await UserEmotesModel.findOneAndUpdate(
      { id },
      {
        id,
        twitch: twitchEmotes,
        bttv: bttvEmotes,
        ffz: ffzEmotes,
        '7tv': sevenTvEmotes,
      },
      { upsert: true },
    );

    return {
      success: true,
      message: 'User emotes fetched and saved successfully.',
    };
  } catch (error) {
    return {
      success: false,
      message: `Error fetching user emotes for Twitch ID ${twitchId}: ${error.message}`,
    };
  }
};

export async function getUserBttvEmotes(id, login) {
  try {
    const response = await axios.get(
      `https://api.betterttv.net/3/cached/users/twitch/${id}`,
    );

    if (response.status === 200) {
      const bttvEmotes = processBTTVEmotes(response.data);
      return bttvEmotes;
    }

    return {};
  } catch (error) {
    console.error({
      message: 'Error fetching user BTTV emotes',
      login: login,
      id: id,
      status: error.status,
      response_message: error.response?.statusText,
    });
    return {};
  }
}

export async function getUserFfzEmotes(id, login) {
  try {
    const response = await axios.get(
      `https://api.frankerfacez.com/v1/room/${login}`,
    );

    if (response.status === 200) {
      const ffzEmotes = processFFZEmotes(response.data);
      return ffzEmotes;
    }
    return {};
  } catch (error) {
    console.error({
      message: 'Error fetching user FFZ emotes',
      login: login,
      id: id,
      status: error.status,
      response_message: error.response?.statusText,
    });
    return {};
  }
}

export async function getUser7tvEmotes(id, login) {
  try {
    const response = await axios.get(`https://7tv.io/v3/users/twitch/${id}`);

    if (response.status === 200) {
      const sevenTvEmotes = process7TVEmotes(response.data, 'channel');
      return sevenTvEmotes;
    }

    return {};
  } catch (error) {
    console.error({
      message: 'Error fetching user 7TV emotes',
      login: login,
      id: id,
      status: error.status,
      response_message: error.response?.statusText,
    });
    return {};
  }
}

export async function getUserTwitchEmotes(broadcaster_id, access_token) {
  try {
    const response = await getChannelEmotes({ broadcaster_id, access_token });
    const twitchEmotes = processTwitchEmotes(response.data);
    return twitchEmotes;
  } catch (error) {
    console.error({
      message: 'Error fetching user twitch emotes',
      broadcaster_id,
      status: error?.response?.status || error?.status,
      response_message: error?.response?.statusText || error?.message,
    });
    return {};
  }
}

// --- Scheduling (user emotes every 24h) ---
let _userInterval = null;
const DAY_MS = 24 * 60 * 60 * 1000;
// const DAY_MS = 60 * 1000;

export async function scheduleUserEmotes(intervalMs = DAY_MS) {
  if (_userInterval) return;

  _userInterval = setInterval(async () => {
    try {
      const tokens = await getAllUsersWithTwitchTokens();

      for (const token of tokens) {
        const user = await UsersModel.findOne({ 'twitch.access_token': token });
        if (!user?.twitch) continue;
        await fetchUserEmotes({ twitchId: user.twitch.id });
      }
    } catch (err) {
      console.error('[emotes] User emote scheduler error:', err);
    }
  }, intervalMs);
  _userInterval.unref?.();
  console.log('[emotes] User emote scheduler started. Interval:', intervalMs);
}

export function stopUserEmoteScheduler() {
  if (_userInterval) {
    clearInterval(_userInterval);
    _userInterval = null;
    console.log('[emotes] User emote scheduler stopped.');
  }
}

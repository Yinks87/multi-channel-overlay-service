import axios from 'axios';
import { helixAPI, authAPI } from '../router/api-v1/twitch/auth.js';
import config from '../config.js';
import {
  getUserById,
  getUserByToken,
  getUserByTwitchAccessToken,
  updateUser,
} from '../db/services/userService.js';

const CLIENT_ID = config.TWITCH_CLIENT_ID;
const CLIENT_SECRET = config.TWITCH_CLIENT_SECRET;

/**
 * @param {string} access_token Requires an app access token or user access token.
 * @return {object} Twitch user data
 */
export async function userAuthorization({ access_token }) {
  const {
    data: { data },
  } = await helixAPI.get(`/users`, {
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${access_token}`,
    },
  });
  return data[0] || null;
}

/**
 *
 * @param {string} access_token Requires an app access token or user access token.
 * @param {string} user_id The Twitch user ID of the user whose moderated channels you want to retrieve.
 * @returns {Array} List of moderated channels
 */

export async function getModeratedChannels({ access_token, user_id }) {
  const qs = new URLSearchParams({
    user_id,
  });

  const res = await helixAPI.get(`/moderation/channels?${qs}`, {
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${access_token}`,
    },
  });

  return res.data.data;
}

/**
 * @typedef getUsers
 * @prop {string} id
 * @prop {string} login
 * @prop {string} display_name
 * @prop {string} type
 * @prop {string} broadcaster_type
 * @prop {string} description
 * @prop {string} profile_image_url
 * @prop {string} offline_image_url
 * @prop {string} view_count
 * @prop {string} email
 * @prop {string} created_at
 */

/**
 * @param {string} access_token Requires an app access token or user access token.
 * @param {string} user_id OR login The Twitch user ID or login name of the user you want to retrieve.
 * @return {getUsers} Data[]
 */

export async function getUsers({ access_token, user_id, login }) {
  return validateAndProceed(access_token, async (validToken) => {
    let qs;
    if (user_id) {
      qs = new URLSearchParams({ id: user_id });
    } else if (login) {
      qs = new URLSearchParams({ login });
    } else {
      throw new Error('Either user_id or login must be provided');
    }

    const {
      data: { data },
    } = await helixAPI.get(`/users?${qs}`, {
      headers: {
        'Client-ID': CLIENT_ID,
        Authorization: `Bearer ${validToken}`,
      },
    });
    return data[0] || null;
  });
}

export async function doTokenValidationProcess({ access_token }) {
  const user = await getUserByTwitchAccessToken({ access_token });

  if (!user) {
    throw new Error('User not found for the provided access token.');
  }

  const refresh_token = JSON.parse(user.twitch).refresh_token;

  const validAccessToken = await validateAccessToken(access_token);
  if (!validAccessToken) {
    const newAccessToken = await getAccessToken(refresh_token);
    if (newAccessToken) {
      console.log(
        `Successfully refreshed Twitch access token for user ${JSON.parse(user.twitch).display_name}`,
      );

      const updateTwitchData = {
        ...JSON.parse(user.twitch),
        access_token: newAccessToken.access_token,
        refresh_token: newAccessToken.refresh_token,
      };

      await updateUser({
        key: 'id',
        keyValue: user.id,
        updateData: {
          twitch: JSON.stringify(updateTwitchData),
        },
      });

      console.log(
        `Successfully updated Twitch data in the database for user ${JSON.parse(user.twitch).display_name}`,
      );

      return { access_token: newAccessToken.access_token, success: true };
    } else {
      throw new Error('Failed to refresh Twitch access token.');
    }
  }
  return { access_token: access_token, success: true };
}

export async function validateAndProceed(access_token, callback) {
  console.log('Validating access token:', access_token);
  const { access_token: validToken, success } = await doTokenValidationProcess({
    access_token,
  });
  if (!success) {
    throw new Error('Unable to validate Twitch or refresh access token.');
  }
  return await callback(validToken);
}

/**
 * @typedef validateAccessToken
 * @prop {string} client_id
 * @prop {string} login
 * @prop {array} scopes
 * @prop {string} user_id
 * @prop {number} expires_in
 */

/**
 *
 * @param {string} access_token
 * @returns {validateAccessToken} data[]
 */
export async function validateAccessToken(access_token) {
  try {
    const { data } = await authAPI.get('/validate', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    return data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return null; // Token is invalid or expired
    } else {
      console.error('Error validating access token:', error);
    }
    return null;
  }
}

/**
 * @typedef getAccessToken
 * @prop {string} access_token The new access token.
 * @prop {string} refresh_token The new refresh token.
 * @prop {string} scope An array of used scopes.
 * @prop {string} token_type The token type.
 */

/**
 * @param {string} refresh_token Requires an app access token or user access token.
 * @return {getAccessToken}
 */

export async function getAccessToken(refresh_token) {
  console.log('Refreshing access token with refresh token:', refresh_token);
  try {
    const qs = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const { data } = await authAPI.post(`/token?${qs}`);
    return data;
  } catch (error) {
    throw new Error(
      `Failed to refresh access token: ${error.response ? JSON.stringify(error.response.data) : error.message}`,
    );
  }
}

/**
 *
 * @param {string} access_token Requires an app access token or user access token.
 * @param {string} broadcaster_id The ID of the broadcaster to send the message to.
 * @param {string} sender_id The ID of the user sending the message.
 * @param {string} message The message to send.
 * @param {string|null} reply_parent_message_id Optional. The ID of the parent message to reply to.
 * @returns {Promise<any>}
 */
export async function sendChatMessage({
  access_token,
  broadcaster_id,
  sender_id,
  message,
  reply_parent_message_id = null,
}) {
  return validateAndProceed(access_token, async (validToken) => {
    const body = {
      broadcaster_id,
      sender_id,
      message,
      reply_parent_message_id,
    };

    try {
      const {
        data: { data },
      } = await helixAPI.post(`/chat/messages`, body, {
        headers: {
          'Client-ID': CLIENT_ID,
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      });

      return data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw new Error(
        `Failed to send chat message: ${error.response ? JSON.stringify(error.response.data) : error.message}`,
      );
    }
  });
}

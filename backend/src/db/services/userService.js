import { getDb } from '../index.js';
import UsersModel from '../schemas/users.js';

function parseUser(user) {
  if (!user) return null;
  return {
    ...user,
    roles: JSON.parse(user.roles || '[]'),
    moderatedChannels: user.moderatedChannels,
  };
}

export async function getUserByNormalizedUserName({ normalizedUserName }) {
  const db = await getDb();
  const user = await db.get(
    'SELECT * FROM users WHERE normalizedUserName = ?',
    normalizedUserName,
  );
  return parseUser(user);
}

export async function getUserById({ userId }) {
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
  return parseUser(user);
}

export async function getUserByTwitchAccessToken({ access_token }) {
  const db = await getDb();

  const user = await db.get(
    'SELECT * FROM users WHERE json_extract(twitch, "$.access_token") = ?',
    access_token,
  );
  return parseUser(user);
}

export async function getAllStreamersAccessTokens() {
  const usersWithTokens = await UsersModel.find({
    'twitch.access_token': { $exists: true },
    roles: { $in: ['streamer'] },
  });

  // const db = await getDb();
  // const streamers = await db.all(
  //   `SELECT json_extract(twitch, '$.access_token') AS access_token
  //    FROM users, json_each(users.roles) j
  //    WHERE j.value = 'streamer'
  //      AND users.connected = 1
  //      AND json_extract(users.twitch, '$.access_token') IS NOT NULL`,
  // );

  return usersWithTokens.map((s) => s.twitch.access_token);
}

export async function getAllUsersWithTwitchTokens() {
  const rows = await UsersModel.find({
    'twitch.access_token': { $exists: true },
  });

  return rows.map((r) => r.twitch.access_token);
}

export async function getAllUsers() {
  const db = await getDb();
  const users = await db.all('SELECT * FROM users');
  return users.map(parseUser);
}

export async function getUsersByRole({ role }) {
  const db = await getDb();
  const users = await db.all(
    `SELECT DISTINCT u.* FROM users u, json_each(u.roles) j WHERE j.value = ?`,
    role,
  );
  return users.map(parseUser);
}

export async function getUserByTwitchId({ twitchId }) {
  const db = await getDb();
  const user = await db.get(
    `SELECT * FROM users WHERE json_extract(twitch, '$.id') = ?`,
    twitchId,
  );
  return parseUser(user);
}

export async function getUserByToken({ token }) {
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE token = ?', token);
  return parseUser(user);
}

export async function addRoleToUser({ userId, role }) {
  if (!userId) throw new Error('Missing userId');
  const user = await UsersModel.findOne({ id: userId });
  if (!user) throw new Error(`User with ID ${userId} not found`);
  const roles = user.roles;
  if (roles.includes(role)) return true;
  roles.push(role);

  await UsersModel.findOneAndUpdate(
    { id: userId },
    { roles: roles },
    { upsert: true },
  );
  return true;
}

export async function removeRoleFromUser({ userId, role }) {
  if (!userId) throw new Error('Missing userId');
  const user = await UsersModel.findOne({ id: userId });
  if (!user) throw new Error(`User with ID ${userId} not found`);
  const roles = user.roles.filter((r) => r !== role);
  await UsersModel.findOneAndUpdate(
    { id: userId },
    { roles: roles },
    { upsert: true },
  );
  return true;
}

export async function getModeratedChannelsForUser({ userId }) {
  const db = await getDb();
  const user = await db.get(
    'SELECT moderatedChannels FROM users WHERE id = ?',
    userId,
  );
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }
  return JSON.parse(user.moderatedChannels);
}

export async function updateModeratedChannelsForUser({
  userId,
  moderatedChannels,
}) {
  const db = await getDb();
  if (typeof moderatedChannels !== 'string') {
    moderatedChannels = JSON.stringify(moderatedChannels);
  }
  const result = await db.run(
    'UPDATE users SET moderatedChannels = ? WHERE id = ?',
    moderatedChannels,
    userId,
  );
  return result.changes > 0;
}

export async function removeUser({ userId }) {
  if (!userId) throw new Error('Missing userId');
  await UsersModel.deleteOne({ id: userId });

  return true;
}

/**
 * Returns true if the given moderatedChannels array contains at least one
 * channel that belongs to a user with the 'streamer' role in the DB.
 *
 * @param {{ moderatedChannels: Array<{ broadcaster_id: string }> }} param
 */
export async function isModeratorOfAnyRegisteredStreamer({
  moderatedChannels,
}) {
  if (!Array.isArray(moderatedChannels) || moderatedChannels.length === 0) {
    return false;
  }

  const rows = await UsersModel.find({
    roles: {
      $in: ['streamer'],
    },
  });

  const streamerTwitchIds = new Set(rows.map((r) => r.twitch.id));
  return moderatedChannels.some((ch) =>
    streamerTwitchIds.has(String(ch.broadcaster_id)),
  );
}

import { randomUUID } from 'node:crypto';
import { getDb } from '../index.js';

function parseUser(user) {
  if (!user) return null;
  return {
    ...user,
    roles: JSON.parse(user.roles || '[]'),
    moderatedChannels: user.moderatedChannels,
  };
}

export async function createUser({ user }) {
  const db = await getDb();

  const setters = Object.keys(user).join(', ');
  const placeholders = Object.keys(user)
    .map(() => '?')
    .join(', ');
  const values = Object.values(user);
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, ${setters}, created_at) VALUES (?, ${placeholders}, ?)`,
    id,
    ...values,
    now,
  );
  return id;
}

export async function updateUser({ key, keyValue, updateData }) {
  const db = await getDb();

  const setter = Object.keys(updateData)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(updateData);

  const result = await db.run(
    `UPDATE users SET ${setter} WHERE ${key} = ?`,
    ...values,
    keyValue,
  );
  return result.changes > 0;
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
  const db = await getDb();
  const streamers = await db.all(
    `SELECT json_extract(twitch, '$.access_token') AS access_token
     FROM users, json_each(users.roles) j
     WHERE j.value = 'streamer'
       AND users.connected = 1
       AND json_extract(users.twitch, '$.access_token') IS NOT NULL`,
  );
  return streamers.map((s) => s.access_token);
}

export async function getAllUsersWithTwitchTokens() {
  const db = await getDb();
  const rows = await db.all(
    `SELECT json_extract(twitch, '$.access_token') AS access_token
     FROM users
     WHERE json_extract(twitch, '$.access_token') IS NOT NULL`,
  );
  return rows.map((r) => r.access_token);
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
  const user = await getUserById({ userId });
  if (!user) throw new Error(`User with ID ${userId} not found`);
  const roles = user.roles;
  if (roles.includes(role)) return true;
  roles.push(role);
  const db = await getDb();
  const result = await db.run(
    'UPDATE users SET roles = ? WHERE id = ?',
    JSON.stringify(roles),
    userId,
  );
  return result.changes > 0;
}

export async function removeRoleFromUser({ userId, role }) {
  const user = await getUserById({ userId });
  if (!user) throw new Error(`User with ID ${userId} not found`);
  const roles = user.roles.filter((r) => r !== role);
  const db = await getDb();
  const result = await db.run(
    'UPDATE users SET roles = ? WHERE id = ?',
    JSON.stringify(roles),
    userId,
  );
  return result.changes > 0;
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
  const db = await getDb();
  const result = await db.run('DELETE FROM users WHERE id = ?', userId);
  return result.changes > 0;
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
  const db = await getDb();
  const rows = await db.all(
    `SELECT DISTINCT json_extract(users.twitch, '$.id') AS twitch_id
     FROM users, json_each(users.roles) j
     WHERE j.value = 'streamer'
       AND json_extract(users.twitch, '$.id') IS NOT NULL`,
  );
  const streamerTwitchIds = new Set(rows.map((r) => r.twitch_id));
  return moderatedChannels.some((ch) =>
    streamerTwitchIds.has(String(ch.broadcaster_id)),
  );
}

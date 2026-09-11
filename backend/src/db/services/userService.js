import UsersModel from '../schemas/users.js';

export async function getAllStreamersAccessTokens() {
  const usersWithTokens = await UsersModel.find({
    'twitch.access_token': { $exists: true },
    roles: { $in: ['streamer'] },
    connected: { $ne: false },
  });

  return usersWithTokens.map((s) => s.twitch.access_token);
}

export async function getAllUsersWithTwitchTokens() {
  const rows = await UsersModel.find({
    'twitch.access_token': { $exists: true },
  });

  return rows.map((r) => r.twitch.access_token);
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

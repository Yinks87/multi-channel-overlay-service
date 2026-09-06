import { getDb } from '../../db/index.js';

export async function getEmotesByTwitchId({ twitchId }) {
  const db = await getDb();
  const emotes = await db.get(
    `SELECT * FROM user_emotes WHERE id = ?`,
    twitchId,
  );
  return emotes;
}

export async function upsertUserEmotes({ id, twitch, bttv, ffz, sevenTv }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_emotes (id, twitch, bttv, ffz, '7tv') VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET twitch = excluded.twitch, bttv = excluded.bttv, ffz = excluded.ffz, '7tv' = excluded.'7tv'`,
    id,
    JSON.stringify(twitch || {}),
    JSON.stringify(bttv || {}),
    JSON.stringify(ffz || {}),
    JSON.stringify(sevenTv || {}),
  );
}

export async function insertUserEmotes({ id, twitch, bttv, ffz, sevenTv }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_emotes (id, twitch, bttv, ffz, '7tv') VALUES (?, ?, ?, ?, ?)`,
    id,
    JSON.stringify(twitch || {}),
    JSON.stringify(bttv || {}),
    JSON.stringify(ffz || {}),
    JSON.stringify(sevenTv || {}),
  );
}

export async function deleteUserEmotes({ id }) {
  const db = await getDb();
  await db.run(`DELETE FROM user_emotes WHERE id = ?`, id);
}

export async function getGlobalEmotes() {
  const db = await getDb();
  const emotes = await db.get(`SELECT * FROM global_emotes`);
  return emotes;
}

export async function deleteGlobalEmotes() {
  const db = await getDb();
  await db.run(`DELETE FROM global_emotes`);
}

export async function insertGlobalEmotes({ bttv, ffz, sevenTv }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO global_emotes (bttv, ffz, '7tv') VALUES (?, ?, ?)`,
    JSON.stringify(bttv || {}),
    JSON.stringify(ffz || {}),
    JSON.stringify(sevenTv || {}),
  );
}

export async function upsertGlobalEmotes({ bttv, ffz, sevenTv }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO global_emotes (bttv, ffz, '7tv', ROWID) VALUES (?, ?, ?, 1)
     ON CONFLICT(ROWID) DO UPDATE SET bttv = excluded.bttv, ffz = excluded.ffz, '7tv' = excluded.'7tv'`,
    JSON.stringify(bttv || {}),
    JSON.stringify(ffz || {}),
    JSON.stringify(sevenTv || {}),
  );
}

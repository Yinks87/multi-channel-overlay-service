import { getDb } from '../index.js';

const APP_SETTINGS_ID = 'app';

export async function getAppAccessTokenFromDb() {
  const db = await getDb();
  const row = await db.get(
    'SELECT access_token FROM app_settings WHERE id = ?',
    APP_SETTINGS_ID,
  );
  return row?.access_token ?? null;
}

export async function saveAppAccessToken({ access_token }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO app_settings (id, access_token, refresh_token, scope)
     VALUES (?, ?, '', '')
     ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token`,
    APP_SETTINGS_ID,
    access_token,
  );
}

import AppSettingsModel from '../schemas/app-settings.js';

const APP_SETTINGS_ID = 'app';

export async function getAppAccessTokenFromDb() {
  const row = await AppSettingsModel.findOne({ id: APP_SETTINGS_ID });
  return row?.access_token ?? null;
}

export async function saveAppAccessToken({ access_token }) {
  await AppSettingsModel.updateOne(
    { id: APP_SETTINGS_ID },
    { access_token },
    { upsert: true },
  );
}

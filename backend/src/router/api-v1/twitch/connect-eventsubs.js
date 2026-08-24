import config from '../../../config.js';
import {
  getUserByTwitchAccessToken,
  getUserByTwitchId,
} from '../../../db/services/userService.js';
import { saveAppAccessToken } from '../../../db/services/appSettingsService.js';
import { getUsers } from '../../../twitch/api.js';
import { getEventTypes } from './event-types.js';
import { authAPI, helixAPI } from './auth.js';

const CLIENT_ID = config.TWITCH_CLIENT_ID;
const CLIENT_SECRET = config.TWITCH_CLIENT_SECRET;

const SUBSCRIPTIONS_ENDPOINT =
  'https://api.twitch.tv/helix/eventsub/subscriptions';

const SUBSCRIBE_RETRY_ATTEMPTS = 3;

// Registered streamer tokens — used to re-subscribe and to clean up on removal.
const streamerTokens = new Set();

let appTokenCache = null;

async function fetchAndCacheAppToken() {
  const qs = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  const response = await authAPI.post(`/token?${qs}`);

  console.log('[AppToken] Fetched new app access token from Twitch.');

  const { access_token, expires_in } = response.data;
  // Refresh 60 s before actual expiry
  appTokenCache = {
    token: access_token,
    expiresAt: Date.now() + (expires_in - 60) * 1000,
  };
  await saveAppAccessToken({ access_token }).catch((err) =>
    console.error('[AppToken] Failed to persist to DB:', err.message),
  );
  return access_token;
}

/** Fetches a fresh app access token, persists it to DB, and seeds the cache. */
export async function initAppToken() {
  const token = await fetchAndCacheAppToken();
  console.log('[AppToken] App access token fetched and stored.');
  return token;
}

async function getAppAccessToken() {
  if (appTokenCache && appTokenCache.expiresAt > Date.now()) {
    return appTokenCache.token;
  }
  return fetchAndCacheAppToken();
}

function getWebhookUrl() {
  const origin = config.TWITCH_WEBHOOK_ORIGIN?.replace(/\/$/, '');
  if (!origin) {
    throw new Error(
      'TWITCH_WEBHOOK_ORIGIN (or BACKEND_PUBLIC_ORIGIN) is required for webhook subscriptions',
    );
  }
  return `${origin}/api/v1/twitch/eventsub-webhook`;
}

export async function connectToTwitchEventSubs({ access_tokens }) {
  if (!Array.isArray(access_tokens) || access_tokens.length === 0) {
    throw new Error('access_tokens (non-empty array) is required');
  }

  const results = await Promise.allSettled(
    access_tokens.map((access_token) => addStreamerEventSub({ access_token })),
  );

  const hadErrors = results.some(
    (r) => r.status === 'rejected' || r.value?.success === false,
  );
  if (hadErrors) {
    console.error('[EventSub] One or more streamers failed to subscribe.');
  }
}

export async function addStreamerEventSub({ access_token }) {
  if (!access_token) throw new Error('access_token is required');
  if (streamerTokens.has(access_token)) return { success: true };

  streamerTokens.add(access_token);
  return subscribeToChannelEvents({ access_token });
}

export async function removeStreamerEventSub({ access_token }) {
  if (!streamerTokens.has(access_token)) return;

  const user = await getUserByTwitchAccessToken({ access_token });
  const channelName = JSON.parse(user?.twitch || '{}').login;

  if (channelName) {
    const broadcaster = await getUsers({
      access_token,
      login: channelName,
    }).catch(() => null);
    if (broadcaster?.id) {
      await deleteStreamerSubscriptions({ broadcasterId: broadcaster.id });
    }
  }

  streamerTokens.delete(access_token);
}

export async function disconnectTwitchEventSubs() {
  await Promise.all(
    Array.from(streamerTokens).map((token) =>
      removeStreamerEventSub({ access_token: token }),
    ),
  );
}

export async function subscribeToChannelEvents({ access_token }) {
  const user = await getUserByTwitchAccessToken({ access_token });
  const channelName = JSON.parse(user?.twitch || '{}').login;

  if (!channelName) {
    console.error('[EventSub] No channel login found for subscription.');
    return { success: false };
  }

  try {
    const broadcaster = await getUsers({ access_token, login: channelName });
    if (!broadcaster?.id) {
      console.error(
        `[EventSub] Unable to resolve broadcaster ID for ${channelName}.`,
      );
      return { success: false };
    }

    const newBcData = await getUserByTwitchId({ twitchId: broadcaster.id });
    const userToken = newBcData?.twitch
      ? JSON.parse(newBcData.twitch).access_token
      : access_token;

    const appToken = await getAppAccessToken();
    const webhookUrl = getWebhookUrl();
    console.log(`[EventSub] Registering webhook callback: ${webhookUrl}`);
    const secret = config.EVENTSUB_WEBHOOK_SECRET;

    if (!secret) throw new Error('EVENTSUB_WEBHOOK_SECRET is not configured');

    const eventTypes = getEventTypes({ broadcasterId: broadcaster.id });

    const results = await Promise.allSettled(
      eventTypes.map(({ type, version, condition, useUserToken }) =>
        subscribeToEvent({
          access_token: useUserToken ? userToken : appToken,
          broadcaster,
          type,
          version,
          condition,
          webhookUrl,
          secret,
        }),
      ),
    );

    const hadErrors = results.some(
      (r) => r.status === 'rejected' || r.value === null,
    );
    if (hadErrors) {
      console.error(
        `[EventSub] One or more subscriptions failed for ${channelName}.`,
      );
    }

    return { success: !hadErrors };
  } catch (err) {
    console.error(
      `[EventSub] Failed to subscribe to ${channelName}: ${err.message}`,
    );
    return { success: false };
  }
}

async function deleteStreamerSubscriptions({ broadcasterId }) {
  try {
    const appToken = await getAppAccessToken();

    const response = await helixAPI.get('/eventsub/subscriptions', {
      headers: {
        Authorization: `Bearer ${appToken}`,
        'Client-ID': CLIENT_ID,
      },
    });

    const { data = [] } = response.data;

    const userSubscriptions = data.filter(
      (subs) => subs.condition.broadcaster_user_id === String(broadcasterId),
    );

    await Promise.allSettled(
      userSubscriptions.map((sub) =>
        helixAPI.delete(`/eventsub/subscriptions?id=${sub.id}`, {
          headers: {
            Authorization: `Bearer ${appToken}`,
            'Client-ID': CLIENT_ID,
          },
        }),
      ),
    );
  } catch (err) {
    console.error(`[EventSub] Error deleting subscriptions: ${err.message}`);
  }
}

async function subscribeToEvent({
  access_token,
  broadcaster,
  type,
  version,
  condition,
  webhookUrl,
  secret,
}) {
  const payload = {
    type,
    version,
    condition,
    transport: {
      method: 'webhook',
      callback: webhookUrl,
      secret,
    },
  };

  for (let attempt = 1; attempt <= SUBSCRIBE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await helixAPI.post('/eventsub/subscriptions', payload, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Client-ID': CLIENT_ID,
        },
      });

      const body = response.data;
      console.log(`Subscribed to ${type} for ${broadcaster.display_name}`);
      return body?.data || [];
    } catch (err) {
      // Already subscribed — axios throws for 409
      if (err.response?.status === 409) {
        console.log(
          `[EventSub] Already subscribed to ${type} for ${broadcaster.display_name}`,
        );
        return [];
      }
      console.error(
        `Error subscribing to ${type} for ${broadcaster.display_name} (attempt ${attempt}/${SUBSCRIBE_RETRY_ATTEMPTS}): ${err.message}`,
        err.response?.data,
      );
      if (attempt === SUBSCRIBE_RETRY_ATTEMPTS) return null;
      await delay(250 * attempt);
    }
  }

  return null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

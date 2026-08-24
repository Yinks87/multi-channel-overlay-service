import axios from 'axios';
import express from 'express';
export const twitchAuthRouter = express.Router();

import config from '../../../config.js';
import { generateToken } from '../../../middleware/auth.js';
import {
  getUserByNormalizedUserName,
  createUser,
  updateUser,
  addRoleToUser,
  removeRoleFromUser,
  isModeratorOfAnyRegisteredStreamer,
  getUserByTwitchId,
  removeUser,
  getUserById,
} from '../../../db/services/userService.js';
import {
  getModeratedChannels,
  revokeTwitchAccessToken,
  userAuthorization,
} from '../../../twitch/api.js';
import { addStreamerEventSub } from './connect-eventsubs.js';

const TWITCH_CLIENT_ID = config.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = config.TWITCH_CLIENT_SECRET;
const HOST = config.BACKEND_HOST;
const PORT = config.BACKEND_PORT;
const TWITCH_REDIRECT_URI = config.TWITCH_REDIRECT_URI;
const TWITCH_AUTH_REDIRECT_URL = config.TWITCH_AUTH_REDIRECT_URL;
const TWITCH_SCOPES = config.TWITCH_SCOPES;
const TWITCH_OWNER_ID = config.TWITCH_OWNER_ID;
const FRONTEND_ORIGIN = config.FRONTEND_ORIGIN || 'http://localhost:5173';
const BACKEND_PUBLIC_ORIGIN = config.BACKEND_PUBLIC_ORIGIN;
const FRONTEND_AUTH_CALLBACK_PATH = '/auth/callback';

/** Twitch ID of the application owner — only this user gets the "owner" role. */
const OWNER_TWITCH_ID = TWITCH_OWNER_ID;

const authBaseUrl = 'https://id.twitch.tv/oauth2';
export const authAPI = axios.create({
  baseURL: authBaseUrl,
});

const helixBaseUrl = 'https://api.twitch.tv/helix';
export const helixAPI = axios.create({
  baseURL: helixBaseUrl,
});

function normalizeReturnTo(returnTo) {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) {
    return '/main';
  }

  return returnTo;
}

function normalizeFrontendOrigin(
  frontendOrigin,
  fallbackOrigin = FRONTEND_ORIGIN,
) {
  try {
    const url = new URL(frontendOrigin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
    return url.origin;
  } catch {
    return fallbackOrigin;
  }
}

function normalizeBackendOrigin(
  backendOrigin,
  fallbackOrigin = `http://${HOST}:${PORT}`,
) {
  try {
    const url = new URL(backendOrigin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
    return url.origin;
  } catch {
    return fallbackOrigin;
  }
}

function normalizeAbsoluteUrl(url, fallbackUrl) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Unsupported protocol');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallbackUrl;
  }
}

function getReferrerOrigin(req) {
  try {
    const referer = req.get('referer');
    return referer ? new URL(referer).origin : undefined;
  } catch {
    return undefined;
  }
}

function getPublicBackendOrigin(req) {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = forwardedHost || req.get('host');

  if (hostHeader) {
    const protocol = forwardedProto || 'http';
    if (['http', 'https'].includes(protocol)) {
      return `${protocol}://${hostHeader}`;
    }
  }

  return normalizeBackendOrigin(BACKEND_PUBLIC_ORIGIN);
}

function getRedirectUri(req) {
  const path = TWITCH_REDIRECT_URI.startsWith('/')
    ? TWITCH_REDIRECT_URI
    : `/${TWITCH_REDIRECT_URI}`;

  if (TWITCH_AUTH_REDIRECT_URL) {
    return normalizeAbsoluteUrl(
      TWITCH_AUTH_REDIRECT_URL,
      `${normalizeBackendOrigin(BACKEND_PUBLIC_ORIGIN)}${path}`,
    );
  }

  return `${getPublicBackendOrigin(req)}${path}`;
}

function createAuthState({ frontendOrigin, returnTo, redirectUri }) {
  return Buffer.from(
    JSON.stringify({ frontendOrigin, returnTo, redirectUri }),
    'utf8',
  ).toString('base64url');
}

function parseAuthState(state, req) {
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    return {
      frontendOrigin: normalizeFrontendOrigin(parsed.frontendOrigin),
      returnTo: normalizeReturnTo(parsed.returnTo),
      redirectUri: parsed.redirectUri || getRedirectUri(req),
    };
  } catch {
    return {
      frontendOrigin: FRONTEND_ORIGIN,
      returnTo: '/main',
      redirectUri: getRedirectUri(req),
    };
  }
}

function buildFrontendCallbackUrl({
  frontendOrigin,
  returnTo,
  jwtToken,
  sessionUser,
  error,
}) {
  const params = new URLSearchParams({
    returnTo: normalizeReturnTo(returnTo),
  });

  if (jwtToken) params.set('jwt', jwtToken);
  if (sessionUser) params.set('user', JSON.stringify(sessionUser));
  if (error) params.set('error', error);

  return `${frontendOrigin}${FRONTEND_AUTH_CALLBACK_PATH}#${params.toString()}`;
}

export function startTwitchAuthorization({ state, redirectUri } = {}) {
  const qs = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: TWITCH_SCOPES,
  });

  if (state) {
    qs.set('state', state);
  }

  return `${authBaseUrl}/authorize?${qs}`;
}

twitchAuthRouter.get('/', (req, res) => {
  res.json({ success: true, message: 'Twitch auth route is working' });
});

twitchAuthRouter.get('/start', (req, res) => {
  const returnTo = normalizeReturnTo(req.query.returnTo);
  const frontendOrigin = normalizeFrontendOrigin(
    req.query.frontendOrigin,
    getReferrerOrigin(req),
  );
  const redirectUri = getRedirectUri(req);
  const authUrl = startTwitchAuthorization({
    state: createAuthState({ frontendOrigin, returnTo, redirectUri }),
    redirectUri,
  });

  res.redirect(authUrl);
});

twitchAuthRouter.get('/auth', async (req, res) => {
  const { code, state } = req.query;
  const { frontendOrigin, returnTo, redirectUri } = parseAuthState(state, req);

  if (!code) {
    return res.redirect(
      buildFrontendCallbackUrl({
        frontendOrigin,
        returnTo,
        error: 'Missing Twitch authorization code',
      }),
    );
  }

  const qs = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  try {
    const {
      data: { access_token, refresh_token, scope: scopes },
    } = await authAPI.post('/token', qs);

    const user = await userAuthorization({ access_token });
    const moderators = await getModeratedChannels({
      access_token,
      user_id: user.id,
    });

    const twitchData = {
      id: user.id,
      login: user.login,
      display_name: user.display_name,
      access_token,
      refresh_token,
      scopes,
      profile_image_url: user.profile_image_url,
    };

    const isOwner = user.id === OWNER_TWITCH_ID;

    const userExists = await getUserByNormalizedUserName({
      normalizedUserName: user.login.toLowerCase(),
    });

    if (!userExists) {
      const initialRoles = isOwner ? ['owner'] : [];
      await createUser({
        user: {
          userName: user.display_name,
          twitch: JSON.stringify(twitchData),
          normalizedUserName: user.login.toLowerCase(),
          roles: JSON.stringify(initialRoles),
          moderatedChannels: JSON.stringify(moderators || []),
        },
      });
    } else {
      const updateData = {
        twitch: JSON.stringify(twitchData),
        moderatedChannels: JSON.stringify(moderators || []),
      };
      // Ensure the owner always has the "owner" role even if it was missing
      if (isOwner && !userExists.roles.includes('owner')) {
        updateData.roles = JSON.stringify(['owner', ...userExists.roles]);
      }
      await updateUser({
        key: 'id',
        keyValue: userExists.id,
        updateData,
      });
    }

    // Fetch the final, up-to-date user record to build the JWT
    const finalUser = await getUserByNormalizedUserName({
      normalizedUserName: user.login.toLowerCase(),
    });

    // ── Moderator role sync ──────────────────────────────────────────────
    // If the user moderates any registered streamer's channel and is NOT a
    // streamer themselves, grant moderator + overlay:read on every login.
    // If they no longer moderate any streamer channel and hold those roles
    // purely via moderation, revoke them.
    const isMod = await isModeratorOfAnyRegisteredStreamer({
      moderatedChannels: moderators || [],
    });

    if (isMod && !finalUser.roles.includes('streamer')) {
      await addRoleToUser({ userId: finalUser.id, role: 'moderator' });
      await addRoleToUser({ userId: finalUser.id, role: 'overlay:read' });
    } else if (
      !isMod &&
      finalUser.roles.includes('moderator') &&
      !finalUser.roles.includes('streamer')
    ) {
      await removeRoleFromUser({ userId: finalUser.id, role: 'moderator' });
      await removeRoleFromUser({ userId: finalUser.id, role: 'overlay:read' });
    }

    // Re-fetch so the JWT reflects any role changes made above
    const updatedUser = await getUserByNormalizedUserName({
      normalizedUserName: user.login.toLowerCase(),
    });

    // ── Access gate ──────────────────────────────────────────────────────
    // A user must hold at least one meaningful role to enter the app.
    // Plain 'user' role alone grants no access.
    const ACCESS_ROLES = new Set([
      'owner',
      'admin',
      'streamer',
      'moderator',
      'overlay:manage',
      'db:manage',
      'admin:manage',
    ]);
    const hasAccess = updatedUser.roles.some((r) => ACCESS_ROLES.has(r));

    if (!hasAccess) {
      return res.redirect(`${frontendOrigin}/no-access`);
    }

    const jwtToken = generateToken({
      sub: updatedUser.id,
      userName: updatedUser.userName,
      normalizedUserName: updatedUser.normalizedUserName,
      roles: updatedUser.roles,
      profileImageUrl: user.profile_image_url,
    });

    // Connect/refresh EventSub if this user is a streamer with connected = 1
    if (updatedUser.roles.includes('streamer') && updatedUser.connected !== 0) {
      addStreamerEventSub({ access_token }).catch((err) =>
        console.error(
          `[EventSub] Failed to subscribe on login: ${err.message}`,
        ),
      );
    }

    // User info sent to the frontend (no token embedded — stored separately)
    const sessionUser = {
      id: updatedUser.id,
      userName: user.display_name,
      normalizedUserName: updatedUser.normalizedUserName,
      roles: updatedUser.roles,
      profileImageUrl: user.profile_image_url,
      login: user.login,
    };

    return res.redirect(
      buildFrontendCallbackUrl({
        frontendOrigin,
        returnTo,
        jwtToken,
        sessionUser,
      }),
    );
  } catch (error) {
    console.error('Error during Twitch authorization:', error);

    return res.redirect(
      buildFrontendCallbackUrl({
        frontendOrigin,
        returnTo,
        error: 'Twitch authorization failed',
      }),
    );
  }
});

twitchAuthRouter.delete('/revoke', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ error: 'Missing userId query parameter' });
    }
    const user = await getUserById({ userId });
    if (!user) {
      return res
        .status(404)
        .json({ error: 'User not found for the provided userId' });
    }

    const access_token = JSON.parse(user.twitch).access_token;
    if (!access_token) {
      return res
        .status(400)
        .json({ error: 'No access token found for the user' });
    }

    const revokeRes = await revokeTwitchAccessToken({ access_token });

    if (revokeRes.status === 200) {
      const remRes = await removeUser({ userId: user.id });
      if (!remRes) {
        console.error(
          `Failed to remove user with ID ${user.id} after revoking Twitch access token`,
        );
      }
      return res.json({
        success: true,
        message: 'Twitch access token revoked successfully',
      });
    } else {
      return res
        .status(revokeRes.status)
        .json({ error: 'Failed to revoke Twitch access token' });
    }
  } catch (error) {
    next(error);
  }
});

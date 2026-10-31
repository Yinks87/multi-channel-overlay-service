import express from 'express';
import fs from 'fs';
import path from 'path';
import UsersModel from '../db/schemas/users.js';
import { verifyOverlayToken } from '../middleware/auth.js';

const registry = new Map();

export function getRegisteredOverlayRoutePath(
  routePath,
  accessKey,
  isProtected = false,
) {
  if (isProtected) return routePath;
  if (!accessKey) {
    throw new Error('Public overlays require an access key');
  }
  return `/${accessKey}${routePath}`;
}

export function registerOverlay({
  routePath,
  accessKey,
  folderPath,
  entryFile,
  overlayId,
  isProtected = false,
}) {
  if (!routePath || !folderPath || !entryFile) {
    throw new Error('Missing required parameters for registering overlay');
  }
  if (isProtected && !overlayId) {
    throw new Error('Protected overlays require an overlay id');
  }
  const registeredRoutePath = getRegisteredOverlayRoutePath(
    routePath,
    accessKey,
    isProtected,
  );

  if (!fs.existsSync(folderPath)) {
    throw new Error(`Overlay folder does not exist: ${folderPath}`);
  }

  const entryFilePath = path.join(folderPath, entryFile);
  if (!fs.existsSync(entryFilePath)) {
    throw new Error(`Entry file does not exist: ${entryFilePath}`);
  }

  const staticMw = express.static(folderPath);
  registry.set(registeredRoutePath, {
    folderPath,
    entryFile,
    staticMw,
    overlayId,
    isProtected: Boolean(isProtected),
  });
}

export function unregisterOverlay(routePath) {
  if (!registry.has(routePath)) {
    throw new Error(`Overlay route not registered: ${routePath}`);
  }
  registry.delete(routePath);
}

export function getAllOverlays() {
  return Array.from(registry.entries()).map(([routePath, v]) => ({
    routePath,
    folderPath: v.folderPath,
  }));
}

function cookieNameFor(overlayId) {
  return `overlay_token_${overlayId}`;
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function userExists(userId) {
  if (!userId) return false;
  return Boolean(await UsersModel.exists({ id: userId }));
}

function denyAccess(res) {
  res
    .status(401)
    .type('text/plain')
    .send('Unauthorized: this overlay is protected.');
}

// Returns true when the request may continue to the static handler.
// Otherwise the response has already been sent (401 or redirect).
async function authorizeProtectedOverlay(req, res, routePath, overlayId) {
  const cookieName = cookieNameFor(overlayId);
  const cookiePath = `${req.baseUrl}${routePath}`;

  const queryToken =
    typeof req.query.token === 'string' ? req.query.token : null;

  if (queryToken) {
    const payload = verifyOverlayToken(queryToken, overlayId);
    if (!payload || !(await userExists(payload.sub))) {
      denyAccess(res);
      return false;
    }

    res.cookie(cookieName, queryToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      path: cookiePath,
      maxAge: Math.max(payload.exp * 1000 - Date.now(), 0),
    });

    // Drop the token from the URL so it does not leak via Referer headers
    const cleanUrl = new URL(req.originalUrl, 'http://localhost');
    cleanUrl.searchParams.delete('token');
    res.redirect(302, `${cleanUrl.pathname}${cleanUrl.search}`);
    return false;
  }

  const payload = verifyOverlayToken(readCookie(req, cookieName), overlayId);
  if (!payload || !(await userExists(payload.sub))) {
    denyAccess(res);
    return false;
  }
  return true;
}

export async function overlayDispatcher(req, res, next) {
  try {
    for (const [
      routePath,
      { staticMw, entryFile, overlayId, isProtected },
    ] of registry) {
      // Exact match without trailing slash → redirect so relative assets resolve correctly
      if (req.path === routePath) {
        const search = req.originalUrl.includes('?')
          ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
          : '';
        return res.redirect(301, `${req.baseUrl}${req.path}/${search}`);
      }
      if (req.path.startsWith(routePath + '/')) {
        if (
          isProtected &&
          !(await authorizeProtectedOverlay(req, res, routePath, overlayId))
        ) {
          return;
        }
        const remaining = req.url.slice(routePath.length);
        req.url =
          remaining === '/' || remaining === '' ? `/${entryFile}` : remaining;
        return staticMw(req, res, next);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

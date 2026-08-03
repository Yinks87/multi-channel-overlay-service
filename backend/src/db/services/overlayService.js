import { randomUUID } from 'crypto';
import { getDb } from '../index.js';

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([key]) => typeof key === 'string' && key.trim()),
  );
}

function normalizeStreamerIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === 'string' && id.trim());
}

const VALID_OVERLAY_TYPES = ['admin', 'streamer', 'moderator'];

function normalizeOverlayType(types) {
  if (!Array.isArray(types)) return ['streamer'];
  const filtered = types.filter((t) => VALID_OVERLAY_TYPES.includes(t));
  return filtered.length > 0 ? filtered : ['streamer'];
}

function mapOverlayRow(row) {
  if (!row) return row;

  let parsedParams = {};
  try {
    parsedParams = normalizeParams(JSON.parse(row.params ?? '{}'));
  } catch {
    parsedParams = {};
  }

  let parsedStreamerIds = [];
  try {
    const raw = JSON.parse(row.streamer_ids ?? '[]');
    parsedStreamerIds = normalizeStreamerIds(Array.isArray(raw) ? raw : []);
  } catch {
    parsedStreamerIds = [];
  }

  let parsedOverlayType = ['streamer'];
  try {
    const raw = JSON.parse(row.overlay_type ?? '["streamer"]');
    parsedOverlayType = normalizeOverlayType(Array.isArray(raw) ? raw : []);
  } catch {
    parsedOverlayType = ['streamer'];
  }

  return {
    ...row,
    params: parsedParams,
    streamer_ids: parsedStreamerIds,
    overlay_type: parsedOverlayType,
  };
}

export async function createOverlay({
  routePath,
  name,
  folderPath,
  entryFile,
  notes = '',
  params = {},
  streamerIds = [],
  overlayType = ['streamer'],
  width = 800,
  height = 600,
}) {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO overlays (id, name, route_path, folder_path, entry_file, notes, params, streamer_ids, overlay_type, width, height, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    name,
    routePath,
    folderPath,
    entryFile,
    notes,
    JSON.stringify(normalizeParams(params)),
    JSON.stringify(normalizeStreamerIds(streamerIds)),
    JSON.stringify(normalizeOverlayType(overlayType)),
    width,
    height,
    1,
    now,
  );
  return id;
}

export async function getOverlaysForStreamer({ userId, roles = [] }) {
  const db = await getDb();
  const overlays = await db.all('SELECT * FROM overlays WHERE active = 1');
  const userType = roles.includes('moderator') ? 'moderator' : 'streamer';

  if (userType === 'streamer') {
    return overlays.map(mapOverlayRow).filter((o) => {
      const ids = o.streamer_ids;
      if (ids.length > 0 && !ids.includes(userId)) return false;
      return o.overlay_type.includes('streamer');
    });
  }

  // Moderator: resolve which registered streamer DB IDs this user moderates
  const userRow = await db.get(
    'SELECT moderatedChannels FROM users WHERE id = ?',
    userId,
  );
  let moderatedChannels = [];
  try {
    moderatedChannels = JSON.parse(userRow?.moderatedChannels || '[]');
  } catch { /* ignore */ }

  const moderatedTwitchIds = new Set(
    moderatedChannels.map((ch) => String(ch.broadcaster_id)),
  );

  const streamerRows = await db.all(
    `SELECT users.id, json_extract(twitch, '$.id') AS twitch_id
     FROM users, json_each(users.roles) j
     WHERE j.value = 'streamer' AND twitch_id IS NOT NULL`,
  );
  const moderatedStreamerDbIds = new Set(
    streamerRows
      .filter((s) => moderatedTwitchIds.has(String(s.twitch_id)))
      .map((s) => s.id),
  );

  return overlays.map(mapOverlayRow).filter((o) => {
    if (!o.overlay_type.includes('moderator')) return false;
    // If the overlay is assigned to specific streamers, the moderator must
    // moderate at least one of those streamers to see it.
    return (
      o.streamer_ids.length === 0 ||
      o.streamer_ids.some((id) => moderatedStreamerDbIds.has(id))
    );
  });
}

export async function getActiveOverlays() {
  const db = await getDb();
  const overlays = await db.all('SELECT * FROM overlays WHERE active = 1');
  return overlays.map(mapOverlayRow);
}

export async function getAllOverlays() {
  const db = await getDb();
  const overlays = await db.all('SELECT * FROM overlays');
  return overlays.map(mapOverlayRow);
}

export async function deleteOverlay(id) {
  const db = await getDb();
  const overlay = await db.get('SELECT * FROM overlays WHERE id = ?', id);
  if (!overlay) return null;
  await db.run('DELETE FROM overlays WHERE id = ?', id);
  return mapOverlayRow(overlay);
}

export async function updateOverlay({
  id,
  routePath,
  name,
  folderPath,
  entryFile,
  notes,
  params,
  streamerIds,
  overlayType,
  width,
  height,
  active,
}) {
  const db = await getDb();
  const overlay = await db.get('SELECT * FROM overlays WHERE id = ?', id);
  if (!overlay) return null;

  const updatedOverlay = {
    ...overlay,
    route_path: routePath ?? overlay.route_path,
    name: name ?? overlay.name,
    folder_path: folderPath ?? overlay.folder_path,
    entry_file: entryFile ?? overlay.entry_file,
    notes: notes !== undefined ? notes : overlay.notes,
    params: params !== undefined ? JSON.stringify(normalizeParams(params)) : overlay.params,
    streamer_ids:
      streamerIds !== undefined
        ? JSON.stringify(normalizeStreamerIds(streamerIds))
        : overlay.streamer_ids,
    overlay_type:
      overlayType !== undefined
        ? JSON.stringify(normalizeOverlayType(overlayType))
        : overlay.overlay_type,
    width: width !== undefined ? Number(width) : overlay.width,
    height: height !== undefined ? Number(height) : overlay.height,
    active: active !== undefined ? active : overlay.active,
  };

  await db.run(
    'UPDATE overlays SET route_path = ?, name = ?, folder_path = ?, entry_file = ?, notes = ?, params = ?, streamer_ids = ?, overlay_type = ?, width = ?, height = ?, active = ? WHERE id = ?',
    updatedOverlay.route_path,
    updatedOverlay.name,
    updatedOverlay.folder_path,
    updatedOverlay.entry_file,
    updatedOverlay.notes,
    updatedOverlay.params,
    updatedOverlay.streamer_ids,
    updatedOverlay.overlay_type,
    updatedOverlay.width,
    updatedOverlay.height,
    updatedOverlay.active,
    id,
  );

  return mapOverlayRow(updatedOverlay);
}

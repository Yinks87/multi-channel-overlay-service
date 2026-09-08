import { randomUUID } from 'crypto';
import OverlaysModel from '../schemas/overlays.js';
import UsersModel from '../schemas/users.js';

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(
      ([key]) => typeof key === 'string' && key.trim(),
    ),
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
  // toObject strips Mongoose internals (_id, __v) when coming from a model instance
  const doc = row.toObject ? row.toObject() : { ...row };
  return {
    ...doc,
    params: normalizeParams(doc.params ?? {}),
    streamer_ids: normalizeStreamerIds(doc.streamer_ids ?? []),
    overlay_type: normalizeOverlayType(doc.overlay_type ?? []),
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
  const id = randomUUID();
  const now = new Date().toISOString();

  await OverlaysModel.create({
    id,
    name,
    route_path: routePath,
    folder_path: folderPath,
    entry_file: entryFile,
    notes,
    params: normalizeParams(params),
    streamer_ids: normalizeStreamerIds(streamerIds),
    overlay_type: normalizeOverlayType(overlayType),
    width,
    height,
    active: true,
    created_at: now,
  });

  return id;
}

export async function getOverlaysForStreamer({ userId, roles = [] }) {
  const overlays = await OverlaysModel.find({ active: true });
  const mapped = overlays.map(mapOverlayRow);

  const isStreamer = roles.includes('streamer');
  const isModerator = roles.includes('moderator');
  // keyed by overlay id to avoid duplicates when a user holds both roles
  const resultMap = new Map();

  if (isStreamer || (!isStreamer && !isModerator)) {
    mapped
      .filter((o) => {
        const ids = o.streamer_ids;
        if (ids.length > 0 && !ids.includes(userId)) return false;
        return o.overlay_type.includes('streamer');
      })
      .forEach((o) => resultMap.set(o.id, o));
  }

  if (isModerator) {
    // Resolve which registered streamer DB IDs this user moderates
    const userRow = await UsersModel.findOne({ id: userId });

    let moderatedChannels = [];
    try {
      moderatedChannels = userRow?.moderatedChannels || [];
    } catch {
      /* ignore */
    }

    const moderatedTwitchIds = new Set(
      moderatedChannels.map((ch) => String(ch.broadcaster_id)),
    );

    const streamerRows = await UsersModel.find({
      roles: { $in: ['streamer'] },
    });

    const moderatedStreamerDbIds = new Set(
      streamerRows
        .filter((s) => moderatedTwitchIds.has(String(s.twitch?.id)))
        .map((s) => s.id),
    );

    mapped
      .filter((o) => {
        if (!o.overlay_type.includes('moderator')) return false;
        return (
          o.streamer_ids.length === 0 ||
          o.streamer_ids.some((id) => moderatedStreamerDbIds.has(id))
        );
      })
      .forEach((o) => resultMap.set(o.id, o));
  }

  return [...resultMap.values()];
}

export async function getActiveOverlays() {
  const overlays = await OverlaysModel.find({ active: true });
  return overlays.map(mapOverlayRow);
}

export async function getAllOverlays() {
  const overlays = await OverlaysModel.find({});
  return overlays.map(mapOverlayRow);
}

export async function deleteOverlay(id) {
  const overlay = await OverlaysModel.findOneAndDelete({ id });
  return overlay ? mapOverlayRow(overlay) : null;
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
  const overlay = await OverlaysModel.findOne({ id });
  if (!overlay) return null;

  const updates = {
    route_path: routePath ?? overlay.route_path,
    name: name ?? overlay.name,
    folder_path: folderPath ?? overlay.folder_path,
    entry_file: entryFile ?? overlay.entry_file,
    notes: notes !== undefined ? notes : overlay.notes,
    params: params !== undefined ? normalizeParams(params) : overlay.params,
    streamer_ids: streamerIds !== undefined ? normalizeStreamerIds(streamerIds) : overlay.streamer_ids,
    overlay_type: overlayType !== undefined ? normalizeOverlayType(overlayType) : overlay.overlay_type,
    width: width !== undefined ? Number(width) : overlay.width,
    height: height !== undefined ? Number(height) : overlay.height,
    active: active !== undefined ? active : overlay.active,
  };

  await OverlaysModel.updateOne({ id }, { $set: updates });

  return mapOverlayRow({ ...overlay.toObject(), ...updates });
}

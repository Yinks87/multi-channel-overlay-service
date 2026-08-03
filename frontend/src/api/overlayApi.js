import api from './api';
import { handleApiError } from './lib';

const BASE = import.meta.env.VITE_BASE_OVERLAY_API_URL;

export async function fetchOverlays() {
  try {
    const res = await api.get(BASE);
    return res.data.data;
  } catch (e) {
    if (e.response?.status === 404) return [];
    handleApiError(e);
  }
}

export async function createOverlay({
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
}) {
  try {
    const res = await api.post(BASE, {
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
    });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function deleteOverlay(id) {
  try {
    const res = await api.delete(`${BASE}/${id}`);
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
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
  try {
    const res = await api.patch(`${BASE}/${id}`, {
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
    });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

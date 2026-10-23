import api from './api';
import { handleApiError } from './lib';

const BASE = import.meta.env.VITE_BASE_FILES_API_URL ?? '/api/v1/files';

export async function listFiles(path = '') {
  try {
    const res = await api.get(BASE, { params: { path } });
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

/**
 * Upload files or whole folders.
 * @param {File[]} files - Files from an <input type="file"> (use webkitdirectory for folders).
 * @param {object} [opts]
 * @param {string} [opts.path] - Destination folder on the server.
 * @param {'reject'|'overwrite'|'replace'} [opts.conflict] - What to do when targets exist.
 * @param {(percent: number) => void} [opts.onProgress]
 */
export async function uploadFiles(
  files,
  { path = '', conflict = 'reject', onProgress } = {},
) {
  const form = new FormData();
  for (const file of files) {
    // webkitRelativePath keeps the folder structure for folder uploads
    form.append('files', file, file.webkitRelativePath || file.name);
  }
  try {
    const res = await api.post(`${BASE}/upload`, form, {
      params: { path, conflict },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function createFolder(path) {
  try {
    const res = await api.post(`${BASE}/folder`, { path });
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function moveFile(from, to, overwrite = false) {
  try {
    const res = await api.post(`${BASE}/move`, { from, to, overwrite });
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function deleteFile(path) {
  try {
    const res = await api.delete(BASE, { params: { path } });
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

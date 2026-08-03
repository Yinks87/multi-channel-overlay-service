import api from './api.js';
import { handleApiError } from './lib.js';

const BASE = import.meta.env.VITE_BASE_ADMIN_API_URL;

export async function fetchAdmins() {
  try {
    const res = await api.get(BASE);
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function addAdmin({ userName, requesterId }) {
  try {
    const res = await api.post(BASE, { userName, requesterId });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function removeAdmin({ userId }) {
  try {
    const res = await api.delete(`${BASE}/${userId}`);
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function updateAdminPermissions({ userId, permissions }) {
  try {
    const res = await api.patch(`${BASE}/${userId}`, { permissions });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

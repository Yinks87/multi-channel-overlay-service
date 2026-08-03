import api from './api.js';
import { handleApiError } from './lib.js';

const BASE = import.meta.env.VITE_BASE_STREAMERS_API_URL;

export async function fetchRegisteredStreamers() {
  try {
    const res = await api.get(BASE);
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function addRegisteredStreamer({ userName, requesterId }) {
  try {
    const res = await api.post(BASE, {
      userName,
      requesterId,
    });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function removeRegisteredStreamer({ userId }) {
  try {
    const res = await api.delete(`${BASE}/${userId}`);
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function updateStreamerPermissions({ userId, permissions }) {
  try {
    const res = await api.patch(`${BASE}/${userId}`, { permissions });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function setStreamerConnected({ userId, connected }) {
  try {
    const res = await api.patch(`${BASE}/${userId}/connected`, { connected });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

// export async function fetchRegisteredStreamers() {
//   try {
//     const res = await api.get(BASE);
//     return res.data.data;
//   } catch (e) {
//     handleApiError(e);
//   }
// }

// export async function addRegisteredStreamer({ userName }) {
//   try {
//     const res = await api.post(BASE, { userName });
//     return res.data;
//   } catch (e) {
//     handleApiError(e);
//   }
// }

// export async function removeRegisteredStreamer({ userId }) {
//   try {
//     const res = await api.delete(`${BASE}/${userId}`);
//     return res.data;
//   } catch (e) {
//     handleApiError(e);
//   }
// }

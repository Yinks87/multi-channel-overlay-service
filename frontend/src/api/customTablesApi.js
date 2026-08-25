import api from './api';
import { handleApiError } from './lib';

const BASE = import.meta.env.VITE_BASE_TABLES_API_URL;

export async function fetchTables() {
  try {
    const res = await api.get(BASE);
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function fetchAllTables() {
  try {
    const res = await api.get(`${BASE}/all`);
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function createTable({ tableName, schema }) {
  try {
    const res = await api.post(`${BASE}/create`, { tableName, schema });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function deleteTable(tableName) {
  try {
    const res = await api.post(`${BASE}/delete/${tableName}`);
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function fetchTableSchema(tableName) {
  try {
    const res = await api.get(`${BASE}/${tableName}/schema`);
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function fetchTableData(tableName) {
  try {
    const res = await api.get(`${BASE}/${tableName}`);
    return res.data.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function insertRow(tableName, data) {
  try {
    const res = await api.post(`${BASE}/${tableName}`, data);
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function deleteRow(tableName, key, keyValue) {
  try {
    const res = await api.delete(`${BASE}/${tableName}`, {
      data: { key, keyValue },
    });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

export async function updateRow(tableName, key, keyValue, data) {
  try {
    const res = await api.patch(`${BASE}/${tableName}`, {
      key,
      keyValue,
      data,
    });
    return res.data;
  } catch (e) {
    handleApiError(e);
  }
}

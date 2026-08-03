import axios from "axios";

const explicitBaseUrl = import.meta.env.VITE_API_BASE_URL;
const host = import.meta.env.VITE_BACKEND_HOST;
const port = import.meta.env.VITE_BACKEND_PORT;
const protocol = import.meta.env.VITE_BACKEND_PROTOCOL || "http";

function normalizeBaseUrl(url) {
  return typeof url === "string" ? url.replace(/\/$/, "") : url;
}

function getBaseUrl() {
  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  if (host) {
    const hostWithPort = port ? `${host}:${port}` : host;
    return `${protocol}://${hostWithPort}`;
  }

  if (!import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

const baseUrl = getBaseUrl();

const api = axios.create({
  baseURL: baseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the stored JWT automatically so protected routes work.
api.interceptors.request.use((config) => {
  try {
    const jwt = localStorage.getItem("jwt");
    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`;
    }
  } catch {
    // Ignore storage errors
  }
  return config;
});

// On 401 (expired / invalid token) clear storage and redirect to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("jwt");
      localStorage.removeItem("currentUser");
      window.location.replace("/");
    }
    return Promise.reject(error);
  },
);

export default api;



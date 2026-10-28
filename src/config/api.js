const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

export const API_ROOT = import.meta.env.DEV
  ? configuredApiUrl || "http://localhost:4000"
  : "/api";

export const API_USERS = `${API_ROOT}/users`;

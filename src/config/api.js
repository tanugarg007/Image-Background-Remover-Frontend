
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL
  ?.trim()
  .replace(/\/+$/, "");

export const API_ROOT =
  configuredApiUrl ||
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : "https://image-background-remover-backend-6wzq.onrender.com");

export const API_USERS = `${API_ROOT}/users`;


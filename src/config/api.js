const PRODUCTION_API_URL =
  "https://image-background-remover-backend-6wzq.onrender.com";
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
const configuredUrlIsLoopback = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/i.test(
  configuredApiUrl || ""
);

export const API_ROOT = import.meta.env.DEV
  ? configuredApiUrl || "http://localhost:4000"
  : configuredUrlIsLoopback || !configuredApiUrl
    ? PRODUCTION_API_URL
    : configuredApiUrl;

export const API_USERS = `${API_ROOT}/users`;

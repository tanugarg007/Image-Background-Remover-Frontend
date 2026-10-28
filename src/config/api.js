
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL
  ?.trim()
  .replace(/\/+$/, "");

// In production, use the same-origin Vercel rewrite so browser requests never
// go directly to Render (where gateway errors cannot carry app CORS headers).
// Keep the override available for local development only.
export const API_ROOT = import.meta.env.DEV
  ? configuredApiUrl || "http://localhost:4000"
  : "/api";

export const API_USERS = `${API_ROOT}/users`;


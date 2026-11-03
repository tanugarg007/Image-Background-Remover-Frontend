
// Vite proxies /api to localhost in development, and Vercel proxies it in
// production. The browser therefore uses the frontend's own origin in both.
export const API_ROOT = "/api";

export const API_USERS = `${API_ROOT}/users`;

let sessionStatusRequest;

export function getSessionStatus() {
  if (!sessionStatusRequest) {
    sessionStatusRequest = fetch(`${API_USERS}/session-status`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Could not check session status.");
        }
        return payload;
      })
      .finally(() => {
        sessionStatusRequest = null;
      });
  }

  return sessionStatusRequest;
}

export async function removeBackgroundInBrowser(file, onStatus) {
  onStatus?.("Loading background-removal model…");

  const { removeBackground: imglyRemoveBackground } = await import(
    "@imgly/background-removal"
  );
  if (typeof imglyRemoveBackground !== "function") {
    throw new Error("The background-removal model did not load correctly.");
  }
  const result = await imglyRemoveBackground(file, {
    model: "isnet_quint8",
    device: "cpu",
    output: { format: "image/png" },
    progress: (key, current, total) => {
      const percent = Number.isFinite(current) && Number.isFinite(total) && total > 0
        ? Math.min(100, Math.max(0, Math.round((current / total) * 100)))
        : 0;
      const stage = typeof key === "string" && key.startsWith("fetch:")
        ? "Downloading model"
        : "Removing background";
      onStatus?.(`${stage}… ${percent}%`);
    },
  });

  if (!(result instanceof Blob) || result.size === 0) {
    throw new Error("Background removal returned an empty image.");
  }

  return result;
}

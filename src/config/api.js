
// Vite proxies /api to localhost in development, and Vercel proxies it in
// production. The browser therefore uses the frontend's own origin in both.
export const API_ROOT = "/api";

export const API_USERS = `${API_ROOT}/users`;

let sessionStatusRequest;
let backgroundRemovalModulePromise;
let backgroundRemovalAssetsPromise;
let backgroundRemovalStatus;

const backgroundRemovalConfig = {
  model: "isnet_quint8",
  device: "gpu",
  output: { format: "image/png" },
  progress: (key, current, total) => {
    if (!backgroundRemovalStatus) return;
    const percent = Number.isFinite(current) && Number.isFinite(total) && total > 0
      ? Math.min(100, Math.max(0, Math.round((current / total) * 100)))
      : 0;
    const stage = typeof key === "string" && key.startsWith("fetch:")
      ? "Downloading model"
      : "Removing background";
    backgroundRemovalStatus(`${stage}… ${percent}%`);
  },
};

function loadBackgroundRemovalModule() {
  if (!backgroundRemovalModulePromise) {
    backgroundRemovalModulePromise = import("@imgly/background-removal")
      .then((library) => {
        if (typeof library.removeBackground !== "function" || typeof library.preload !== "function") {
          throw new Error("The background-removal model did not load correctly.");
        }
        return library;
      })
      .catch((error) => {
        backgroundRemovalModulePromise = null;
        throw error;
      });
  }
  return backgroundRemovalModulePromise;
}

export function prepareBackgroundRemoval(onStatus) {
  if (typeof onStatus === "function") backgroundRemovalStatus = onStatus;
  if (!backgroundRemovalAssetsPromise) {
    backgroundRemovalAssetsPromise = loadBackgroundRemovalModule()
      .then(({ preload }) => preload(backgroundRemovalConfig))
      .catch((error) => {
        backgroundRemovalAssetsPromise = null;
        throw error;
      });
  }
  return backgroundRemovalAssetsPromise;
}

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

  if (typeof onStatus === "function") backgroundRemovalStatus = onStatus;
  await prepareBackgroundRemoval(onStatus);
  const { removeBackground } = await loadBackgroundRemovalModule();
  const result = await removeBackground(file, backgroundRemovalConfig);

  if (!(result instanceof Blob) || result.size === 0) {
    throw new Error("Background removal returned an empty image.");
  }

  return result;
}

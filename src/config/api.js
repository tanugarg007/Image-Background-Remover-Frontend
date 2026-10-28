
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

export async function removeBackgroundInBrowser(file, onStatus) {
  onStatus?.("Loading background-removal model…");

  const { default: imglyRemoveBackground } = await import(
    "@imgly/background-removal"
  );
  const result = await imglyRemoveBackground(file, {
    model: "isnet_quint8",
    device: "cpu",
    output: { format: "image/png" },
    progress: (key, current, total) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      const stage = key.startsWith("fetch:")
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


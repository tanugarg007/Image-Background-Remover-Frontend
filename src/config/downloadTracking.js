import { API_USERS } from "./api.js";

export function trackDownload(tool, fileName, fileSize) {
  if (!fileName) return;
  void fetch(`${API_USERS}/download-activity`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool,
      fileName,
      ...(typeof fileSize === "number" ? { fileSize } : {}),
    }),
  }).catch(() => {});
}


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

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const responseData = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return {};
};

export async function removeBackgroundAndWait(file, onStatus) {
  const formData = new FormData();
  formData.append("image", file);

  const startResponse = await fetch(`${API_USERS}/remove-background`, {
    method: "POST",
    body: formData,
  });
  const startData = await responseData(startResponse);

  if (!startResponse.ok) {
    throw new Error(
      startData.message || `Background removal failed (HTTP ${startResponse.status}).`
    );
  }

  if (startData.filename) return startData.filename;
  if (!startData.jobId) {
    throw new Error("The server did not return a processing job ID.");
  }

  const deadline = Date.now() + 10 * 60 * 1000;
  onStatus?.("Image received. Starting background removal…");

  while (Date.now() < deadline) {
    await sleep(1500);

    const statusResponse = await fetch(
      `${API_USERS}/remove-background/${encodeURIComponent(startData.jobId)}`,
      { cache: "no-store" }
    );
    const statusData = await responseData(statusResponse);

    if (!statusResponse.ok) {
      throw new Error(
        statusData.message || `Could not check processing status (HTTP ${statusResponse.status}).`
      );
    }

    if (statusData.status === "completed" && statusData.filename) {
      return statusData.filename;
    }
    if (statusData.status === "failed") {
      throw new Error(statusData.message || "Background removal failed.");
    }

    onStatus?.("Removing background… please keep this page open.");
  }

  throw new Error("Background removal is taking too long. Please try again.");
}


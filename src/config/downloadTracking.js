import { API_USERS } from "./api.js";

export const GUEST_DOWNLOAD_LIMIT = 3;
let currentQuota = null;
let quotaInitializationPromise = null;
const pendingReservationIds = [];

function publishQuota(quota) {
  currentQuota = quota;
  window.dispatchEvent(new CustomEvent("guest-download-count-change", { detail: quota }));
}

async function quotaRequest(path, options = {}) {
  const response = await fetch(`${API_USERS}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 404
      ? "Download quota API is missing on the backend. Restart the backend or deploy its latest version."
      : payload.message || `Could not check the download limit (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

export function getGuestDownloadCount() {
  return currentQuota?.used ?? 0;
}

export function getGuestDownloadQuota() {
  if (!quotaInitializationPromise) {
    quotaInitializationPromise = quotaRequest("/download-quota")
      .then((quota) => {
        publishQuota(quota);
        return quota;
      })
      .catch((error) => {
        quotaInitializationPromise = null;
        throw error;
      });
  }
  return quotaInitializationPromise;
}

function showLoginPrompt() {
  if (document.getElementById("guest-download-login-prompt")) return;
  const overlay = document.createElement("div");
  overlay.id = "guest-download-login-prompt";
  overlay.setAttribute("role", "presentation");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:rgba(20,16,35,.58);backdrop-filter:blur(6px);font-family:Inter,system-ui,sans-serif";
  const dialog = document.createElement("section");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "guest-download-title");
  dialog.style.cssText = "width:min(100%,440px);padding:32px;border:1px solid #eee9ff;border-radius:24px;background:#fff;box-shadow:0 24px 80px rgba(18,12,35,.28);text-align:center;color:#252137";
  dialog.innerHTML = `
    <div style="width:56px;height:56px;margin:0 auto 18px;border-radius:18px;display:grid;place-items:center;background:#f1edff;color:#7657df;font-size:25px;font-weight:700" aria-hidden="true">+</div>
    <p style="margin:0 0 8px;color:#7657df;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Download limit reached</p>
    <h2 id="guest-download-title" style="margin:0;font-size:25px;line-height:1.25">You've used all 3 free downloads</h2>
    <p style="margin:12px 0 24px;color:#706d7c;font-size:15px;line-height:1.6">Sign in to continue with unlimited downloads.</p>
    <button type="button" data-login style="width:100%;margin-top:12px;border:0;border-radius:12px;background:linear-gradient(100deg,#8062e8,#a16be6);padding:14px 18px;color:white;font-size:15px;font-weight:700;cursor:pointer">Login</button>`;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  dialog.querySelector("[data-login]").addEventListener("click", () => window.location.assign("/login"));
  dialog.querySelector("[data-login]").focus();
}

export async function requireLoginForDownload(imageCount = 1) {
  const count = Number.isFinite(imageCount) ? Math.max(1, Math.floor(imageCount)) : 1;
  try {
    // The status request sets the backend-owned HttpOnly device cookie first.
    await getGuestDownloadQuota();
    const result = await quotaRequest("/download-quota/consume", {
      method: "POST",
      body: JSON.stringify({ count }),
    });
    if (result.authenticated) return true;
    if (result.allowed && result.reservationId) {
      pendingReservationIds.push(result.reservationId);
      return true;
    }
    publishQuota({ ...currentQuota, ...result });
    showLoginPrompt();
    return false;
  } catch (error) {
    console.error("[Download quota] Could not verify download:", error);
    publishQuota({ ...currentQuota, error: error instanceof Error ? error.message : "Could not check the download limit." });
    return false;
  }
}

export async function releaseGuestDownload() {
  const reservationId = pendingReservationIds.shift();
  if (!reservationId) return;
  try {
    await quotaRequest("/download-quota/release", {
      method: "POST",
      body: JSON.stringify({ reservationId }),
    });
  } catch (error) {
    console.warn("[Download quota] Could not release a failed download reservation:", error);
  }
}

export async function trackDownload(tool, fileName, fileSize) {
  if (!fileName) return;
  const reservationId = pendingReservationIds.shift();
  try {
    const response = await fetch(`${API_USERS}/download-activity`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool,
        fileName,
        ...(typeof fileSize === "number" ? { fileSize } : {}),
        ...(reservationId ? { reservationId } : {}),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Could not confirm this download.");
    if (typeof result.used === "number") {
      publishQuota({ ...currentQuota, used: result.used, remaining: result.remaining, error: "" });
    }
  } catch (error) {
    if (reservationId) {
      void quotaRequest("/download-quota/release", {
        method: "POST",
        body: JSON.stringify({ reservationId }),
      }).catch(() => {});
    }
    throw error;
  }
}

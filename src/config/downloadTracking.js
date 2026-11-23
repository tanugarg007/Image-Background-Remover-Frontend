import { API_USERS } from "./api.js";

export const GUEST_DOWNLOAD_LIMIT = 3;
// Rotate once so browser IDs created while the earlier quota logic was
// incorrect don't carry an exhausted (or inflated) balance into this limit.
const DEVICE_ID_KEY = "citc-guest-device-id-v4";
let currentQuota = null;
let quotaInitializationPromise = null;
const pendingReservationIds = [];
let activeLoginPrompt = null;

function getGuestDeviceId() {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return "";
  }
}

function normalizeQuota(quota) {
  const used = Math.max(0, Number(quota.used) || 0);
  const remaining = typeof quota.remaining === "number"
    ? Math.max(0, quota.remaining)
    : Math.max(0, GUEST_DOWNLOAD_LIMIT - used);
  return {
    ...quota,
    limit: GUEST_DOWNLOAD_LIMIT,
    used,
    remaining,
  };
}

function publishQuota(quota) {
  currentQuota = quota;
  window.dispatchEvent(new CustomEvent("guest-download-count-change", { detail: quota }));
}

function waitForQuotaPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function getCurrentToolReturnTo() {
  const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (window.location.pathname !== "/") return currentRoute;

  const focusedTool = document.activeElement?.closest?.(".app-section[id]");
  if (focusedTool?.id) return `/#${encodeURIComponent(focusedTool.id)}`;

  const viewportMiddle = window.innerHeight / 2;
  const visibleTools = [...document.querySelectorAll(".app-section[id]")]
    .map((section) => ({ section, rect: section.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight);
  const currentTool = visibleTools.find(({ rect }) => rect.top <= viewportMiddle && rect.bottom >= viewportMiddle)
    || visibleTools.sort((first, second) => {
      const firstDistance = Math.min(Math.abs(first.rect.top), Math.abs(first.rect.bottom - window.innerHeight));
      const secondDistance = Math.min(Math.abs(second.rect.top), Math.abs(second.rect.bottom - window.innerHeight));
      return firstDistance - secondDistance;
    })[0];

  return currentTool?.section.id
    ? `/#${encodeURIComponent(currentTool.section.id)}`
    : currentRoute;
}

async function quotaRequest(path, options = {}) {
  const response = await fetch(`${API_USERS}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getGuestDeviceId() ? { "X-Guest-Device": getGuestDeviceId() } : {}),
      ...(options.headers || {}),
    },
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
        const mergedQuota = normalizeQuota(quota);
        publishQuota(mergedQuota);
        return mergedQuota;
      })
      .catch((error) => {
        quotaInitializationPromise = null;
        throw error;
      });
  }
  return quotaInitializationPromise;
}

export function refreshGuestDownloadQuota() {
  quotaInitializationPromise = null;
  return getGuestDownloadQuota();
}

function showLoginPrompt(options = {}) {
  if (activeLoginPrompt) return Promise.resolve(false);

  let resolvePrompt;
  const prompt = new Promise((resolve) => { resolvePrompt = resolve; });
  activeLoginPrompt = prompt;

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
    <h2 id="guest-download-title" style="margin:0;font-size:25px;line-height:1.25"></h2>
    <p id="guest-download-description" style="margin:12px 0 24px;color:#706d7c;font-size:15px;line-height:1.6"></p>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button type="button" data-login style="flex:1;border:0;border-radius:12px;background:linear-gradient(100deg,#8062e8,#a16be6);padding:14px 18px;color:white;font-size:15px;font-weight:700;cursor:pointer">Login</button>
      <button type="button" data-close style="flex:1;border:1px solid #dedbe9;border-radius:12px;background:white;padding:14px 18px;color:#51456f;font-size:15px;font-weight:700;cursor:pointer">Close</button>
    </div>`;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  const title = dialog.querySelector("#guest-download-title");
  const description = dialog.querySelector("#guest-download-description");
  title.textContent = "0 free downloads left";
  description.textContent = "Sign in to continue downloading; your current tool will stay open.";
  const loginButton = dialog.querySelector("[data-login]");
  const closeButton = dialog.querySelector("[data-close]");
  const finish = (authenticated) => {
    overlay.remove();
    activeLoginPrompt = null;
    if (authenticated) {
      window.dispatchEvent(new CustomEvent("citc-auth-state-change"));
    }
    resolvePrompt(authenticated);
  };
  loginButton.addEventListener("click", async () => {
    const returnTo = options.returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = `/login?${new URLSearchParams({ returnTo }).toString()}`;
    loginButton.disabled = true;
    try {
      await options.onLogin?.();
    } catch (error) {
      loginButton.disabled = false;
      console.error("Could not save the pending download before login:", error);
      description.textContent = error instanceof Error
        ? error.message
        : "Could not save your image before login. Please try again.";
      return;
    }
    window.location.assign(loginUrl);
  });
  closeButton.addEventListener("click", () => {
    finish(false);
  });
  loginButton.focus();
  return prompt;
}

export async function requireLoginForDownload(imageCount = 1, options = {}) {
  const count = Number.isFinite(imageCount) ? Math.max(1, Math.floor(imageCount)) : 1;
  const returnTo = options.returnTo || getCurrentToolReturnTo();
  const promptOptions = { ...options, returnTo };
  let promptedForLogin = false;
  try {
    // Check the server's latest balance at click time. Reaching 3 of 3 only
    // updates the status; the login prompt opens on the next download click.
    const latestQuota = await refreshGuestDownloadQuota();
    if (latestQuota.authenticated !== true && Number(latestQuota.remaining) <= 0) {
      promptedForLogin = true;
      await waitForQuotaPaint();
      if (!(await showLoginPrompt(promptOptions))) return false;
    }

    let result = await quotaRequest("/download-quota/consume", {
      method: "POST",
      body: JSON.stringify({ count }),
    });
    const availableBeforePrompt = Number(result.remaining ?? currentQuota?.remaining) || 0;
    if (!result.allowed && availableBeforePrompt <= 0 && result.authenticated !== true && !promptedForLogin) {
      publishQuota(normalizeQuota({ ...currentQuota, ...result, error: "" }));
      await waitForQuotaPaint();
      promptedForLogin = true;
      if (!(await showLoginPrompt(promptOptions))) return false;
      result = await quotaRequest("/download-quota/consume", {
        method: "POST",
        body: JSON.stringify({ count }),
      });
    }
    if (result.allowed && result.reservationId) {
      pendingReservationIds.push({ reservationId: result.reservationId, count });
      publishQuota({
        ...currentQuota,
        ...result,
        remaining: Math.max(0, Number(result.remaining) || 0),
        error: "",
      });
      return true;
    }
    if (result.allowed && result.authenticated && !result.reservationId) {
      publishQuota({
        ...currentQuota,
        error: "The backend is outdated. Restart the backend or deploy its latest version to apply the 3-download limit.",
      });
      return false;
    }
    const available = Number(result.remaining ?? currentQuota?.remaining) || 0;
    const authenticated = options.authenticated === true || result.authenticated === true;
    if (available === 0 && !authenticated) {
      publishQuota(normalizeQuota({ ...currentQuota, ...result, error: "" }));
    } else {
      const error = authenticated
        ? "Could not reserve this download for your signed-in account. Please try again."
        : count > available
        ? `This download needs ${count} downloads, but only ${available} remain.`
        : "Could not reserve this download. Your free downloads are still available; please try again.";
      publishQuota(normalizeQuota({ ...currentQuota, ...result, error }));
    }
    return false;
  } catch (error) {
    console.error("[Download quota] Could not verify download:", error);
    publishQuota({ ...currentQuota, error: error instanceof Error ? error.message : "Could not check the download limit." });
    return false;
  }
}

export async function releaseGuestDownload() {
  const reservation = pendingReservationIds.shift();
  if (!reservation) return;
  try {
    await quotaRequest("/download-quota/release", {
      method: "POST",
      body: JSON.stringify({ reservationId: reservation.reservationId }),
    });
    quotaInitializationPromise = null;
    await getGuestDownloadQuota();
  } catch (error) {
    console.warn("[Download quota] Could not release a failed download reservation:", error);
  }
}

export async function trackDownload(tool, fileName, fileSize) {
  if (!fileName) return;
  const reservation = pendingReservationIds.shift();
  const reservationId = reservation?.reservationId;
  try {
    const response = await fetch(`${API_USERS}/download-activity`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(getGuestDeviceId() ? { "X-Guest-Device": getGuestDeviceId() } : {}),
      },
      body: JSON.stringify({
        tool,
        fileName,
        ...(typeof fileSize === "number" ? { fileSize } : {}),
        ...(reservationId ? { reservationId } : {}),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Could not confirm this download.");
    if (reservation || typeof result.used === "number") {
      const used = Math.max(0, Number(result.used) || 0);
      publishQuota(normalizeQuota({
        ...(currentQuota || {}),
        limit: GUEST_DOWNLOAD_LIMIT,
        authenticated: currentQuota?.authenticated === true,
        used,
        remaining: GUEST_DOWNLOAD_LIMIT - used,
        error: "",
      }));
    }
    if (typeof result.used === "number") {
      publishQuota(normalizeQuota({
        ...currentQuota,
        used: result.used,
        remaining: result.remaining,
        error: "",
      }));
    }

    // Re-read the backend-owned quota after a completed download so the badge
    // stays correct across tools and browser sessions.
    quotaInitializationPromise = null;
    try {
      await getGuestDownloadQuota();
    } catch (quotaError) {
      console.warn("[Download quota] Could not refresh the download count:", quotaError);
    }
  } catch (error) {
    if (reservationId) {
      void quotaRequest("/download-quota/release", {
        method: "POST",
        body: JSON.stringify({ reservationId }),
      }).then(async () => {
        quotaInitializationPromise = null;
        await getGuestDownloadQuota();
      }).catch(() => {});
    }
    throw error;
  }
}

export async function trackAuthenticatedDownload(tool, fileName, fileSize) {
  if (!fileName) return;
  const response = await fetch(`${API_USERS}/download-activity`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool,
      fileName,
      ...(typeof fileSize === "number" ? { fileSize } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Could not record download activity.");
}

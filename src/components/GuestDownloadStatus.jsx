import { useEffect, useState } from "react";
import { getGuestDownloadQuota, GUEST_DOWNLOAD_LIMIT } from "../config/downloadTracking.js";

function GuestDownloadStatus() {
  const [quota, setQuota] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getGuestDownloadQuota();
        if (active) setQuota(result);
      } catch (error) {
        if (active) setNotice(error.message || "Could not load download limit.");
      }
    };
    const updateQuota = (event) => {
      setQuota(event.detail);
      setNotice(event.detail?.error || "");
    };
    const refreshOnFocus = () => { void load(); };
    window.addEventListener("guest-download-count-change", updateQuota);
    window.addEventListener("focus", refreshOnFocus);
    void load();
    return () => {
      active = false;
      window.removeEventListener("guest-download-count-change", updateQuota);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  const used = Math.min(GUEST_DOWNLOAD_LIMIT, Math.max(0, quota?.used ?? 0));
  const remaining = Math.min(
    GUEST_DOWNLOAD_LIMIT,
    Math.max(0, Number(quota?.remaining ?? GUEST_DOWNLOAD_LIMIT - used))
  );
  const isAuthenticated = quota?.authenticated === true;
  const guestStatus = remaining === 0
    ? "0 free downloads left"
    : `${used} of ${GUEST_DOWNLOAD_LIMIT} free downloads used`;

  return (
    <div className="guest-download-status" aria-label={isAuthenticated ? "Signed-in download status" : "Free download limit"}>
      <span className="guest-download-status-dot" />
      <span className="guest-download-status-copy" role="status" aria-live="polite">
        <strong>{isAuthenticated ? "Signed in" : quota ? guestStatus : notice ? "Download limit unavailable" : "Checking downloads…"}</strong>
        {isAuthenticated
          ? <small>Signed-in downloads enabled</small>
          : quota && remaining > 0 && <small>{remaining} free download{remaining === 1 ? "" : "s"} left</small>}
      </span>
      {notice && <small className="guest-download-status-error" role="status">{notice}</small>}
    </div>
  );
}

export default GuestDownloadStatus;

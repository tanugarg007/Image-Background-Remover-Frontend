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

  const remaining = quota?.remaining ?? GUEST_DOWNLOAD_LIMIT;
  const isAuthenticated = quota?.authenticated === true;

  return (
    <div className="guest-download-status" aria-label={isAuthenticated ? "Signed-in download status" : "Free download limit"}>
      <span className="guest-download-status-dot" />
      <span className="guest-download-status-copy" role="status" aria-live="polite">
        <strong>{isAuthenticated ? "Signed in" : quota ? `${remaining} free download${remaining === 1 ? "" : "s"} left` : notice ? "Download limit unavailable" : "Checking downloads…"}</strong>
        {isAuthenticated ? <small>Signed-in downloads enabled</small> : quota && <small>{remaining === 0 ? "No free downloads left" : `${GUEST_DOWNLOAD_LIMIT} total`}</small>}
      </span>
      {notice && <small className="guest-download-status-error" role="status">{notice}</small>}
    </div>
  );
}

export default GuestDownloadStatus;

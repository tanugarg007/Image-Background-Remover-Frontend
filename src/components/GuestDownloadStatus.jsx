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
    window.addEventListener("guest-download-count-change", updateQuota);
    void load();
    return () => {
      active = false;
      window.removeEventListener("guest-download-count-change", updateQuota);
    };
  }, []);

  const remaining = quota?.remaining ?? GUEST_DOWNLOAD_LIMIT;

  return (
    <div className="guest-download-status" aria-label="Free download limit">
      <span className="guest-download-status-dot" />
      <span className="guest-download-status-copy" role="status" aria-live="polite">
        <strong>{quota?.authenticated ? "Unlimited downloads" : quota ? `${remaining} free download${remaining === 1 ? "" : "s"} left` : notice ? "Download limit unavailable" : "Checking downloads…"}</strong>
        {!quota?.authenticated && quota && <small>{remaining === 0 ? "Login required for more" : `${GUEST_DOWNLOAD_LIMIT} total`}</small>}
      </span>
      {notice && <small className="guest-download-status-error" role="status">{notice}</small>}
    </div>
  );
}

export default GuestDownloadStatus;

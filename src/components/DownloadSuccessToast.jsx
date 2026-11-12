import { useEffect, useState } from "react";
import { AlertCircle, Check, Info, Sparkles, X } from "lucide-react";
import { APP_TOAST_EVENT } from "../config/toast.js";
import "./DownloadSuccessToast.css";

function DownloadSuccessToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let dismissTimeout;

    const show = (notification) => {
      window.clearTimeout(dismissTimeout);
      setToast(notification);
      dismissTimeout = window.setTimeout(() => setToast(null), 4200);
    };

    const showNotification = (event) => {
      const { type, title, message } = event.detail || {};
      if (typeof message !== "string" || !message) return;

      const normalizedType = ["error", "info"].includes(type)
        ? type
        : "success";

      show({
        type: normalizedType,
        kicker:
          normalizedType === "error"
            ? "ACTION FAILED"
            : normalizedType === "info"
              ? "NOTICE"
              : "SUCCESS",
        title: title || "Done",
        message,
      });
    };

    const showDownloadSuccess = (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[download]");
      if (!link) return;

      show({
        type: "success",
        kicker: "DOWNLOAD STARTED",
        title: "Your download started",
        message: link.getAttribute("download") || "Your file",
      });
    };

    window.addEventListener(APP_TOAST_EVENT, showNotification);
    document.addEventListener("click", showDownloadSuccess, true);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, showNotification);
      document.removeEventListener("click", showDownloadSuccess, true);
      window.clearTimeout(dismissTimeout);
    };
  }, []);

  if (!toast) return null;

  const Icon =
    toast.type === "error"
      ? AlertCircle
      : toast.type === "info"
        ? Info
        : Check;

  return (
    <div className="download-success-layer">
      <div
        className={`download-success-toast is-${toast.type}`}
        role={toast.type === "error" ? "alert" : "status"}
        aria-live={toast.type === "error" ? "assertive" : "polite"}
      >
        <span className="download-success-toast-icon" aria-hidden="true">
          <Icon size={22} strokeWidth={2.6} />
        </span>
        <span className="download-success-toast-copy">
          <span className="download-success-toast-kicker">
            <Sparkles size={12} />
            {toast.kicker}
          </span>
          <strong>{toast.title}</strong>
          <small title={toast.message}>{toast.message}</small>
        </span>
        <button
          className="download-success-toast-close"
          type="button"
          aria-label="Dismiss notification"
          onClick={() => setToast(null)}
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

export default DownloadSuccessToast;

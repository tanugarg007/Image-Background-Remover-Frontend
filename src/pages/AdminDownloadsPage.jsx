import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, Download, RefreshCw, Trash2, X } from "lucide-react";
import { API_USERS } from "../config/api.js";
import { showToast } from "../config/toast.js";

function formatBytes(bytes) {
  if (typeof bytes !== "number") return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AdminDownloadsPage({ reloadKey }) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [downloadToRemove, setDownloadToRemove] = useState(null);
  const downloadedFileCount = downloads.reduce((total, item) => total + (item.totalFiles || 1), 0);
  const downloaderCount = new Set(downloads.map((item) => (item.userEmail || "Guest").toLowerCase())).size;

  useEffect(() => {
    const controller = new AbortController();
    const loadDownloads = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_USERS}/admin/downloads`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not load download activity.");
        setDownloads(data.data || []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load download activity.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadDownloads();
    return () => controller.abort();
  }, [reloadKey]);

  const removeRecord = async (download) => {
    setRemovingId(download._id);
    setError("");
    try {
      const source = download.source || "activity";
      const response = await fetch(`${API_USERS}/admin/downloads/${encodeURIComponent(download._id)}?source=${encodeURIComponent(source)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not remove download activity.");
      setDownloads((current) => current.filter((item) => item._id !== download._id));
      setDownloadToRemove(null);
      showToast("success", "Activity removed", download.fileName);
    } catch (requestError) {
      setError(requestError.message || "Could not remove download activity.");
      showToast(
        "error",
        "Could not remove activity",
        requestError.message || "Could not remove download activity."
      );
    } finally {
      setRemovingId("");
    }
  };

  return (
    <section className="admin-card admin-downloads-card" aria-label="Download activity">
      <div className="admin-downloads-heading">
        <div><span className="matrix-eyebrow"><Download size={13} /> ACTIVITY LOG</span><h2>Download activity</h2><p>All tracked downloads across project tools.</p></div>
        <div className="admin-downloads-stats"><span className="matrix-count">{downloads.length} records</span><span>{downloadedFileCount} files · {downloaderCount} downloaders</span></div>
      </div>
      {error && <p className="admin-error admin-downloads-error" role="alert">{error}</p>}
      {loading ? <p className="admin-downloads-empty"><RefreshCw size={16} className="is-spinning" /> Loading download activity…</p> : downloads.length === 0 ? <p className="admin-downloads-empty">No tracked downloads yet.</p> : (
        <div className="admin-downloads-table-wrap">
          <table className="admin-downloads-table">
            <thead><tr><th>FILE</th><th>TOOL</th><th>CONTENTS</th><th>DOWNLOADED BY</th><th>DATE &amp; TIME</th><th>SIZE</th><th>ACTION</th></tr></thead>
            <tbody>{downloads.map((download) => (
              <tr key={download._id}>
                <td><div className="admin-download-file"><span><Download size={15} /></span><strong title={download.fileName}>{download.fileName}</strong></div></td>
                <td><span className="admin-download-tool">{download.tool}</span></td>
                <td className="admin-download-contents">{Array.isArray(download.files) && download.files.length ? <details>
                  <summary>{download.totalFiles || download.files.length} files in ZIP</summary>
                  <ul>{download.files.map((file, index) => <li key={`${file.fileName}-${index}`} title={file.fileName}>{file.fileName} <small>{formatBytes(file.fileSize)}</small></li>)}</ul>
                </details> : <span>1 file</span>}</td>
                <td><div className="admin-download-user"><strong>{download.userName || download.userEmail || "Guest"}</strong><small>{download.userEmail || "Not signed in"} · {download.userRole || "guest"}</small></div></td>
                <td><span className="admin-download-date"><Clock3 size={13} />{download.downloadedAt ? new Date(download.downloadedAt).toLocaleString() : "—"}</span></td>
                <td className="admin-download-size">{formatBytes(download.fileSize)}</td>
                <td><button className="admin-download-remove" type="button" onClick={() => setDownloadToRemove(download)} disabled={removingId === download._id} aria-label={`Remove activity for ${download.fileName}`}><Trash2 size={14} /><span>Remove</span></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="admin-downloads-footnote">Removing a record only clears activity history. It does not delete the downloaded file.</div>
      {downloadToRemove && (
        <div
          className="image-tool-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !removingId) {
              setDownloadToRemove(null);
            }
          }}
        >
          <section
            className="image-tool-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-download-remove-title"
            aria-describedby="admin-download-remove-description"
          >
            <button
              className="image-tool-confirm-close"
              type="button"
              onClick={() => setDownloadToRemove(null)}
              disabled={Boolean(removingId)}
              aria-label="Close confirmation"
            >
              <X size={17} />
            </button>
            <span className="image-tool-confirm-icon">
              <AlertTriangle size={23} />
            </span>
            <span className="image-tool-confirm-eyebrow">REMOVE ACTIVITY</span>
            <h2 id="admin-download-remove-title">Remove this download record?</h2>
            <p id="admin-download-remove-description">
              <strong>{downloadToRemove.fileName}</strong> will be removed from
              activity history. The downloaded file will not be deleted.
            </p>
            <div className="image-tool-confirm-actions">
              <button
                type="button"
                className="image-tool-confirm-cancel"
                onClick={() => setDownloadToRemove(null)}
                disabled={Boolean(removingId)}
              >
                Keep record
              </button>
              <button
                type="button"
                className="image-tool-confirm-delete"
                onClick={() => removeRecord(downloadToRemove)}
                disabled={Boolean(removingId)}
              >
                <Trash2 size={15} />
                {removingId ? "Removing…" : "Remove activity"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default AdminDownloadsPage;

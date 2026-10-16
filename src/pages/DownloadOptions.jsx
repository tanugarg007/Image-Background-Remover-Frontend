
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  CheckCircle2,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import "./DownloadOptions.css";

const API_BASE = "http://localhost:4000/users";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 20;

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DownloadOptions() {
  const inputRef = useRef(null);
  const urlsRef = useRef(new Set());

  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [history, setHistory] = useState([]);
  const [selectedDownload, setSelectedDownload] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();

    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, []);

  // GET: Fetch download history
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);

      const response = await fetch(`${API_BASE}/getdownload`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to load history.");
      }

      setHistory(result.data || []);
    } catch (err) {
      setError(err.message || "Failed to load download history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Add images to the frontend queue
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const accepted = incoming.filter(
      (file) =>
        file.type.startsWith("image/") &&
        file.size > 0 &&
        file.size <= MAX_FILE_SIZE
    );

    if (incoming.length !== accepted.length) {
      setError("Some files were skipped. Choose images up to 20 MB each.");
    } else {
      setError("");
    }

    setMessage("");

    setFiles((current) => {
      const slots = MAX_FILES - current.length;
      const toAdd = accepted.slice(0, Math.max(0, slots));

      const newEntries = toAdd.map((file) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);

        return {
          id: crypto.randomUUID(),
          file,
          url,
        };
      });

      if (accepted.length > slots) {
        setError(`You can select a maximum of ${MAX_FILES} images.`);
      }

      return [...current, ...newEntries];
    });

    if (inputRef.current) inputRef.current.value = "";
  };

  // Remove one image from the frontend queue only
  const removeFile = (id) => {
    const removed = files.find((entry) => entry.id === id);

    if (removed) {
      URL.revokeObjectURL(removed.url);
      urlsRef.current.delete(removed.url);
    }

    setFiles((current) => current.filter((entry) => entry.id !== id));
    setError("");
    setMessage("");
  };

  // Clear the frontend queue only
  const clearFiles = () => {
    files.forEach(({ url }) => {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    });

    setFiles([]);
    setError("");
    setMessage("");
  };

  // Download a single image locally
  const downloadOne = (entry) => {
    const link = document.createElement("a");
    link.href = entry.url;
    link.download = entry.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // POST: Create ZIP on backend and download it
  const downloadZip = async () => {
    if (!files.length) {
      setError("Please select images first.");
      return;
    }

    try {
      setZipping(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      files.forEach(({ file }) => formData.append("files", file));

      const response = await fetch(`${API_BASE}/downloadzip`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "ZIP download failed.";
        try {
          const result = await response.json();
          errorMessage = result.message || errorMessage;
        } catch {
          // The server may return a non-JSON error.
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The server returned an empty ZIP file.");
      }

      const url = URL.createObjectURL(blob);
      urlsRef.current.add(url);

      const link = document.createElement("a");
      link.href = url;
      link.download = `images-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(url);
      }, 2000);

      setMessage("ZIP download started successfully.");

      // Refresh history after backend creates the record.
      await fetchHistory();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setZipping(false);
    }
  };

  // GET: Fetch details for one MongoDB history record
  const getDownloadDetails = async (id) => {
    try {
      setError("");
      const response = await fetch(`${API_BASE}/getdownload/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to load details.");
      }

      setSelectedDownload(result.data);
    } catch (err) {
      setError(err.message || "Failed to load details.");
    }
  };

  // PUT: Update the saved ZIP history name
  const updateDownload = async (id) => {
    if (!editName.trim()) {
      setError("Please enter a ZIP name.");
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_BASE}/updatedownload/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipName: editName.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Update failed.");
      }

      setEditId(null);
      setEditName("");
      setMessage("Download record updated successfully.");

      await fetchHistory();

      if (selectedDownload?._id === id) {
        setSelectedDownload(result.data);
      }
    } catch (err) {
      setError(err.message || "Update failed.");
    }
  };

  // DELETE: Delete a MongoDB history record
  const deleteDownload = async (id) => {
    if (!window.confirm("Delete this download history record?")) return;

    try {
      setError("");

      const response = await fetch(`${API_BASE}/deleted/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Delete failed.");
      }

      setHistory((current) =>
        current.filter((item) => item._id !== id)
      );

      if (selectedDownload?._id === id) {
        setSelectedDownload(null);
      }

      setMessage("Download history record deleted.");
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  };

  return (
    <main className="download-page" id="download-options">
      <div className="download-page-shell">
        <header className="download-page-heading">
          <span className="download-page-kicker">
            <ArrowDownToLine size={14} /> YOUR FILES, YOUR WAY
          </span>
          <h1>
            Downloads, <span>made simple.</span>
          </h1>
          <p>
            Choose images, download them individually, or bundle them into a ZIP.
          </p>
        </header>

        <section className="download-workspace" aria-label="Download images">
          <div className="download-workspace-top">
            <div className="download-workspace-title">
              <span className="download-workspace-icon">
                <ImagePlus size={18} />
              </span>
              <div>
                <strong>Your download queue</strong>
                <small>Up to 20 MB per image · Maximum 20 images</small>
              </div>
            </div>
            <span className="download-file-count">
              {files.length} {files.length === 1 ? "image" : "images"}
            </span>
          </div>

          <div className="download-workspace-body">
            <section className="download-files-column">
              <button
                type="button"
                className={`download-dropzone ${dragging ? "is-dragging" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
                disabled={zipping}
              >
                <span className="download-upload-icon">
                  <Upload size={18} />
                </span>
                <span className="download-drop-copy">
                  <strong>Choose images</strong>
                  <small>Drop them here or browse your device</small>
                </span>
                <span className="download-browse">
                  <ImagePlus size={14} /> Browse files
                </span>
              </button>

              <input
                ref={inputRef}
                className="download-hidden-input"
                type="file"
                accept="image/*"
                multiple
                disabled={zipping}
                onChange={(event) => addFiles(event.target.files)}
              />

              {files.length ? (
                <div className="download-file-list">
                  {files.map((entry) => (
                    <article className="download-file-row" key={entry.id}>
                      <img src={entry.url} alt="" />
                      <div className="download-file-info">
                        <strong title={entry.file.name}>{entry.file.name}</strong>
                        <small>
                          {formatBytes(entry.file.size)} ·{" "}
                          {entry.file.type.split("/")[1]?.toUpperCase() || "IMAGE"}
                        </small>
                      </div>
                      <button
                        className="download-row-action"
                        type="button"
                        onClick={() => downloadOne(entry)}
                        disabled={zipping}
                        aria-label={`Download ${entry.file.name}`}
                      >
                        <ArrowDownToLine size={16} />
                      </button>
                      <button
                        className="download-row-action remove"
                        type="button"
                        onClick={() => removeFile(entry.id)}
                        disabled={zipping}
                        aria-label={`Remove ${entry.file.name}`}
                      >
                        <X size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="download-empty">
                  <FileImage size={25} />
                  <strong>Your images will appear here</strong>
                  <span>Add one or more images to get started.</span>
                </div>
              )}

              {error && <p className="download-error" role="alert">{error}</p>}
              {message && <p className="download-success" role="status">{message}</p>}
            </section>

            <aside className="download-choice-card">
              <span className="download-choice-kicker">BULK DOWNLOAD</span>
              <span className="download-archive-mark"><Archive size={22} /></span>
              <h2>Everything,<br />together.</h2>
              <p>
                Bundle {files.length || "your"}{" "}
                {files.length ? (files.length === 1 ? "image" : "images") : "images"} into one ZIP file.
              </p>
              <button
                className="download-zip-button"
                type="button"
                onClick={downloadZip}
                disabled={!files.length || zipping}
              >
                {zipping ? (
                  <LoaderCircle className="download-spin" size={16} />
                ) : (
                  <Archive size={16} />
                )}
                <span>{zipping ? "Preparing your ZIP…" : "Download as ZIP"}</span>
                {!zipping && files.length > 0 && (
                  <span className="download-zip-count">{files.length}</span>
                )}
              </button>
              <div className="download-choice-footnote">
                <CheckCircle2 size={13} /> Original filenames preserved
              </div>
              {files.length > 0 && (
                <button
                  className="download-clear"
                  type="button"
                  onClick={clearFiles}
                  disabled={zipping}
                >
                  <Trash2 size={14} /> Clear queue
                </button>
              )}
            </aside>
          </div>
        </section>

        {/* Download history: GET, PUT, DELETE APIs */}
        <section className="download-history">
          <h2>Download History</h2>

          {historyLoading && <p>Loading history...</p>}

          {!historyLoading && history.length === 0 && (
            <p>No download history found.</p>
          )}

          {history.map((item) => (
            <article className="download-history-item" key={item._id}>
              <div>
                <strong>{item.zipName}</strong>
                <p>
                  {item.totalFiles} files · {formatBytes(item.totalSize)}
                </p>
              </div>

              <button type="button" onClick={() => getDownloadDetails(item._id)}>
                Details
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditId(item._id);
                  setEditName(item.zipName);
                  setSelectedDownload(null);
                  setError("");
                }}
              >
                Edit
              </button>

              <button type="button" onClick={() => deleteDownload(item._id)}>
                Delete
              </button>

              {editId === item._id && (
                <div className="download-history-edit-form">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    placeholder="Enter ZIP name"
                  />
                  <button className="download-history-save" type="button" onClick={() => updateDownload(item._id)}>
                    Save
                  </button>
                  <button
                    className="download-history-cancel"
                    type="button"
                    onClick={() => {
                      setEditId(null);
                      setEditName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </article>
          ))}

          {selectedDownload && (
            <div className="download-history-details">
              <h3>Download Details</h3>
              <p>ZIP: {selectedDownload.zipName}</p>
              <p>Total files: {selectedDownload.totalFiles}</p>
              <p>Total size: {formatBytes(selectedDownload.totalSize)}</p>

              <ul>
                {selectedDownload.files?.map((file, index) => (
                  <li key={`${file.fileName}-${index}`}>
                    {file.fileName} — {formatBytes(file.fileSize)}
                  </li>
                ))}
              </ul>

              <button type="button" onClick={() => setSelectedDownload(null)}>
                Close Details
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default DownloadOptions;

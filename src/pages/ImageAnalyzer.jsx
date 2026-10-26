
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Aperture,
  ArrowUpRight,
  CalendarDays,
  Check,
  Copy,
  FileImage,
  HardDrive,
  ImagePlus,
  Maximize2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import "./ImageAnalyzer.css";

const API_BASE = `${
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : "https://image-background-remover-backend-wa3j.onrender.com")
}/users/analyze-image`;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

const ratioLabel = (width, height) => {
  if (!width || !height) return "Unknown";

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const divisor = gcd(width, height);

  return `${width / divisor}:${height / divisor}`;
};

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status}).`);
  }

  return {};
}

function ImageAnalyzer() {
  const inputRef = useRef(null);
  const urlsRef = useRef(new Set());

  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const selected =
    images.find((image) => image.id === selectedId) || images[0];

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, []);

  const makeImageEntry = (file, data, serverId = null) => {
    const previewUrl = URL.createObjectURL(file);
    urlsRef.current.add(previewUrl);

    const width = Number(data.width) || 0;
    const height = Number(data.height) || 0;

    return {
      id: serverId || crypto.randomUUID(),
      file,
      previewUrl,
      width,
      height,
      format:
        data.format ||
        file.type.replace("image/", "").toUpperCase() ||
        "Unknown",
      megapixels: (
        Number(data.megapixels) ||
        (width * height) / 1_000_000
      ).toFixed(2),
      colorSpace: data.colorSpace || "Unknown",
      channels: data.channels ?? "Unknown",
      colorDepth: data.colorDepth || "Unknown",
      hasAlpha: data.hasAlpha ?? false,
      orientation:
        width >= height ? "Landscape" : "Portrait",
      lastModified: file.lastModified
        ? new Date(file.lastModified).toISOString()
        : null,
      ratio: ratioLabel(width, height),
      serverId,
    };
  };

  // POST: Analyze and save image metadata on backend
  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);

    const validFiles = incoming.filter(
      (file) =>
        file.type.startsWith("image/") &&
        file.size > 0 &&
        file.size <= MAX_FILE_SIZE
    );

    if (!validFiles.length) {
      setError("Please choose valid images up to 25 MB each.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (validFiles.length !== incoming.length) {
      setError(
        "Some files were skipped. Choose valid images up to 25 MB each."
      );
    } else {
      setError("");
    }

    setAnalyzing(true);

    try {
      const analyzed = await Promise.all(
        validFiles.map(async (file) => {
          const formData = new FormData();
          formData.append("image", file);

          const response = await fetch(API_BASE, {
            method: "POST",
            body: formData,
          });

          const result = await readResponse(response);

          if (!response.ok || !result.success || !result.data) {
            throw new Error(
              result.message || `Could not analyze ${file.name}`
            );
          }

          const data = result.data;

          return makeImageEntry(file, data, data._id || null);
        })
      );

      setImages((current) => [...current, ...analyzed]);

      if (analyzed.length) {
        setSelectedId(analyzed[0].id);
        setEditName(analyzed[0].file.name);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Image analysis failed."
      );
    } finally {
      setAnalyzing(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  // GET: Load saved image records from MongoDB
  const getAnalyzedImages = async () => {
    const response = await fetch(API_BASE);
    const result = await readResponse(response);

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to fetch saved images.");
    }

    return result.data || [];
  };

  const loadSavedImages = async () => {
    try {
      setLoadingSaved(true);
      setError("");

      const records = await getAnalyzedImages();

      if (!records.length) {
        setError("No saved images found in the database.");
        return;
      }

      const restored = records
        .filter((record) => record._id)
        .map((record) => {
          // The API must return an accessible image URL for restoring
          // the original preview from the backend.
          const imageUrl =
            record.imageUrl || record.url || record.originalUrl;

          return {
            record,
            imageUrl,
          };
        });

      const restoredEntries = await Promise.all(
        restored.map(async ({ record, imageUrl }) => {
          const width = Number(record.width) || 0;
          const height = Number(record.height) || 0;

          let file;

          if (imageUrl) {
            const imageResponse = await fetch(imageUrl);

            if (!imageResponse.ok) {
              throw new Error(
                `Could not load saved image: ${record.name || record._id}`
              );
            }

            const blob = await imageResponse.blob();

            file = new File(
              [blob],
              record.name || record.originalName || "saved-image",
              {
                type:
                  blob.type ||
                  record.mimeType ||
                  "application/octet-stream",
                lastModified: record.lastModified
                  ? new Date(record.lastModified).getTime()
                  : Date.now(),
              }
            );
          } else {
            // Metadata can still be shown, but a real preview/download
            // needs an accessible image URL or file endpoint.
            file = new File([], record.name || "saved-image", {
              type: record.mimeType || "image/unknown",
            });
          }

          const entry = makeImageEntry(file, record, record._id);

          return {
            ...entry,
            width,
            height,
            format: record.format || entry.format,
            megapixels: Number(record.megapixels || entry.megapixels).toFixed(2),
            colorSpace: record.colorSpace || "Unknown",
            channels: record.channels ?? "Unknown",
            colorDepth: record.colorDepth || "Unknown",
            hasAlpha: record.hasAlpha ?? false,
            ratio: ratioLabel(width, height),
            orientation:
              width >= height ? "Landscape" : "Portrait",
            serverId: record._id,
            id: record._id,
          };
        })
      );

      setImages((current) => {
        const existingIds = new Set(
          current.map((image) => image.serverId).filter(Boolean)
        );

        const uniqueEntries = restoredEntries.filter(
          (image) => !existingIds.has(image.serverId)
        );

        return [...current, ...uniqueEntries];
      });

      const first = restoredEntries[0];

      if (first) {
        setSelectedId(first.id);
        setEditName(first.file.name);
      }

      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to load saved images."
      );
    } finally {
      setLoadingSaved(false);
    }
  };

  // DELETE: Delete a saved image record
  const deleteAnalyzedImage = async (serverId) => {
    if (!serverId) {
      setError("This image has no saved database record.");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/${serverId}`, {
        method: "DELETE",
      });

      const result = await readResponse(response);

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Delete failed.");
      }

      setError("");
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Delete failed."
      );
      return false;
    }
  };

  const removeImage = async (id) => {
    const removed = images.find((image) => image.id === id);
    if (!removed) return;

    if (removed.serverId) {
      const deleted = await deleteAnalyzedImage(removed.serverId);
      if (!deleted) return;
    }

    URL.revokeObjectURL(removed.previewUrl);
    urlsRef.current.delete(removed.previewUrl);

    const remaining = images.filter((image) => image.id !== id);
    setImages(remaining);

    if (selectedId === id) {
      setSelectedId(remaining[0]?.id || "");
      setEditName(remaining[0]?.file.name || "");
    }
  };

  const clearAll = async () => {
    setError("");

    for (const image of images) {
      if (image.serverId) {
        const deleted = await deleteAnalyzedImage(image.serverId);
        if (!deleted) return;
      }
    }

    images.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
      urlsRef.current.delete(image.previewUrl);
    });

    setImages([]);
    setSelectedId("");
    setEditName("");
  };

  // PATCH: Update saved image name
  const updateAnalyzedImage = async (id, updates) => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    const result = await readResponse(response);

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Update failed.");
    }

    return result.data;
  };

  const handleUpdateImage = async () => {
    if (!selected?.serverId) {
      setError("Please select an image saved in the database.");
      return;
    }

    if (!editName.trim()) {
      setError("Please enter an image name.");
      return;
    }

    try {
      setUpdating(true);
      setError("");

      const updated = await updateAnalyzedImage(selected.serverId, {
        name: editName.trim(),
      });

      const newName =
        updated?.name || editName.trim();

      setImages((current) =>
        current.map((image) => {
          if (image.id !== selected.id) return image;

          const renamedFile = new File(
            [image.file],
            newName,
            {
              type: image.file.type,
              lastModified: image.file.lastModified,
            }
          );

          return {
            ...image,
            file: renamedFile,
          };
        })
      );

      setEditName(newName);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Update failed."
      );
    } finally {
      setUpdating(false);
    }
  };

  const metadata = selected
    ? {
        name: selected.file.name,
        format:
          selected.format ||
          selected.file.type.replace("image/", "").toUpperCase() ||
          "Unknown",
        size: formatSize(selected.file.size),
        dimensions: `${selected.width} × ${selected.height} px`,
        aspectRatio: selected.ratio,
        megapixels: `${selected.megapixels} MP`,
        colorSpace: selected.colorSpace,
        colorDepth: selected.colorDepth,
        channels: selected.channels,
        hasAlpha: selected.hasAlpha,
        exifOrientation: selected.exifOrientation,
        orientation: selected.orientation,
        lastModified: selected.lastModified
          ? new Date(selected.lastModified).toLocaleString()
          : "Unknown",
      }
    : null;

  const copyMetadata = async () => {
    if (!metadata) return;

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(metadata, null, 2)
      );

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy metadata to clipboard.");
    }
  };

  return (
    <main className="analyzer-page" id="analyzer">
      <div className="analyzer-shell">
        <header className="analyzer-hero">
          <span className="analyzer-eyebrow">
            <Sparkles size={14} /> IMAGE INTELLIGENCE
          </span>

          <h1>
            Know every detail.
            <br />
            <span>At a glance.</span>
          </h1>

          <p>
            A clear, complete readout of your image files.
          </p>
        </header>

        <section
          className="analyzer-workspace"
          aria-label="Image format and size analyzer"
        >
          <div className="analyzer-toolbar">
            <div className="analyzer-tool-title">
              <span>
                <ScanLine size={18} />
              </span>

              <div>
                <strong>Image analyzer</strong>
                <small>Format, dimensions &amp; file properties</small>
              </div>
            </div>

            <button
              type="button"
              onClick={loadSavedImages}
              disabled={loadingSaved}
            >
              {loadingSaved ? "Loading..." : "Load saved images"}
            </button>

            <div className="analyzer-private">
              <ShieldCheck size={15} /> Analysis &amp; saved records
            </div>
          </div>

          {!images.length ? (
            <button
              className={`analyzer-dropzone ${
                dragging ? "is-dragging" : ""
              }`}
              type="button"
              disabled={analyzing}
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
            >
              <span className="analyzer-upload-icon">
                <ImagePlus size={23} />
              </span>

              <strong>
                {analyzing
                  ? "Analyzing your images…"
                  : "Drop your images here"}
              </strong>

              <span className="analyzer-drop-hint">
                {analyzing
                  ? "Reading dimensions and file properties"
                  : "or browse files from your device"}
              </span>

              <span className="analyzer-browse">
                <Upload size={15} /> Choose images
              </span>

              <small>
                JPG, PNG, WEBP, GIF, BMP, SVG · Multiple files supported
              </small>
            </button>
          ) : (
            <div className="analyzer-content">
              <aside className="analyzer-sidebar">
                <div className="analyzer-list-head">
                  <span>
                    YOUR FILES <b>{images.length}</b>
                  </span>

                  <button type="button" onClick={clearAll}>
                    Clear all
                  </button>
                </div>

                <div className="analyzer-file-list">
                  {images.map((image) => (
                    <button
                      type="button"
                      key={image.id}
                      className={`analyzer-file ${
                        selected?.id === image.id ? "is-selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedId(image.id);
                        setEditName(image.file.name);
                      }}
                    >
                      {image.previewUrl && (
                        <img src={image.previewUrl} alt="" />
                      )}

                      <span className="analyzer-file-copy">
                        <strong title={image.file.name}>
                          {image.file.name}
                        </strong>

                        <small>
                          {formatSize(image.file.size)} · {image.width} ×{" "}
                          {image.height}
                        </small>
                      </span>

                      <span className="analyzer-file-format">
                        {image.format}
                      </span>

                      <span
                        className="analyzer-remove"
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${image.file.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeImage(image.id);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            removeImage(image.id);
                          }
                        }}
                      >
                        <X size={13} />
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  className="analyzer-add-more"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImagePlus size={15} /> Add more images
                </button>
              </aside>

              {selected && (
                <section className="analyzer-details">
                  <div className="analyzer-preview">
                    <span className="preview-chip">
                      <Activity size={13} /> ANALYZED
                    </span>

                    {selected.previewUrl && (
                      <img
                        src={selected.previewUrl}
                        alt={selected.file.name}
                      />
                    )}

                    <div className="preview-caption">
                      <strong>{selected.file.name}</strong>
                      <span>
                        {selected.width} × {selected.height} px
                      </span>
                    </div>
                  </div>

                  <div className="analyzer-report">
                    <div className="analyzer-rename">
                      <input
                        type="text"
                        placeholder="Enter new image name"
                        value={editName}
                        onChange={(event) =>
                          setEditName(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        onClick={handleUpdateImage}
                        disabled={updating || !selected.serverId}
                      >
                        {updating ? "Updating..." : "Update image name"}
                      </button>
                    </div>

                    <div className="report-heading">
                      <div>
                        <span className="report-kicker">FILE REPORT</span>
                        <h2>Image properties</h2>
                      </div>

                      <button
                        className="copy-report"
                        type="button"
                        onClick={copyMetadata}
                      >
                        {copied ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}

                        {copied ? "Copied" : "Copy details"}
                      </button>
                    </div>

                    <div className="analyzer-stat-grid">
                      <div className="analyzer-stat stat-size">
                        <span>
                          <HardDrive size={15} /> FILE SIZE
                        </span>
                        <strong>{formatSize(selected.file.size)}</strong>
                        <small>Original file</small>
                      </div>

                      <div className="analyzer-stat stat-dimensions">
                        <span>
                          <Maximize2 size={15} /> DIMENSIONS
                        </span>
                        <strong>
                          {selected.width} <i>×</i> {selected.height}
                        </strong>
                        <small>
                          Pixels · {selected.megapixels} megapixels
                        </small>
                      </div>

                      <div className="analyzer-stat">
                        <span>
                          <FileImage size={15} /> FORMAT
                        </span>
                        <strong>{metadata.format}</strong>
                        <small>{selected.file.type || "Image file"}</small>
                      </div>

                      <div className="analyzer-stat">
                        <span>
                          <Aperture size={15} /> ASPECT RATIO
                        </span>
                        <strong>{selected.ratio}</strong>
                        <small>{selected.orientation} image</small>
                      </div>
                    </div>

                    <div className="analyzer-meta">
                      <div className="meta-title">
                        <span>MORE DETAILS</span>
                        <ArrowUpRight size={15} />
                      </div>

                      <div>
                        <span>Color space</span>
                        <strong>{selected.colorSpace}</strong>
                      </div>

                      <div>
                        <span>Color depth</span>
                        <strong>{selected.colorDepth}</strong>
                      </div>

                      <div>
                        <span>Color channels</span>
                        <strong>
                          {selected.channels}
                          {selected.hasAlpha ? " · Alpha" : ""}
                        </strong>
                      </div>

                      <div>
                        <span>Orientation</span>
                        <strong>{selected.orientation}</strong>
                      </div>

                      <div>
                        <span>Last modified</span>
                        <strong>
                          <CalendarDays size={13} /> {metadata.lastModified}
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {error && (
            <p className="analyzer-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <footer className="analyzer-footnote">
          <ShieldCheck size={15} />
          <span>
            Images uploaded for analysis may be stored by your backend.
            Avoid uploading sensitive files.
          </span>
        </footer>
      </div>
    </main>
  );
}

export default ImageAnalyzer;

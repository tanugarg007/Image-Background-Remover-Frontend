import { useRef, useState } from "react";
import { Activity, Aperture, ArrowUpRight, CalendarDays, Check, Copy, FileImage, HardDrive, ImagePlus, Maximize2, ScanLine, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import "./ImageAnalyzer.css";
const API_BASE = "http://localhost:4000/users/analyze-image";
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

const ratioLabel = (width, height) => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

function ImageAnalyzer() {
  const inputRef = useRef(null);
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [editName, setEditName] = useState("");
const [updating, setUpdating] = useState(false);
  const selected = images.find((image) => image.id === selectedId) || images[0];
const loadSavedImages = async () => {
  const records = await getAnalyzedImages();
  console.log("MongoDB saved images:", records);
};
const addFiles = async (fileList) => {
  const files = Array.from(fileList || []).filter(
    (file) =>
      file.type.startsWith("image/") &&
      file.size > 0 &&
      file.size <= 25 * 1024 * 1024
  );

  setError("");
  setAnalyzing(true);

  try {
    const analyzed = await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(API_BASE, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.data) {
          throw new Error(
            result.message || `Could not analyze ${file.name}`
          );
        }

        const data = result.data;

        return {
          id: data._id || crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          width: data.width,
          height: data.height,
          format: data.format,
          megapixels: Number(data.megapixels).toFixed(2),
          colorSpace: data.colorSpace || "Unknown",
          channels: data.channels ?? "Unknown",
          colorDepth: data.colorDepth || "Unknown",
          hasAlpha: data.hasAlpha ?? false,
          orientation:
            data.width >= data.height ? "Landscape" : "Portrait",
          lastModified: file.lastModified
            ? new Date(file.lastModified).toISOString()
            : null,
          ratio: ratioLabel(data.width, data.height),
          serverId: data._id || null,
        };
      })
    );

    setImages((current) => [...current, ...analyzed]);

    if (analyzed.length) {
      setSelectedId(analyzed[0].id);
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

const getAnalyzedImages = async () => {
  try {
    const response = await fetch(API_BASE);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to fetch images");
    }

    return result.data;
  } catch (error) {
    setError(
      error instanceof Error ? error.message : "Failed to fetch images"
    );
    return [];
  }
};

 const removeImage = async (id) => {
  const removed = images.find((image) => image.id === id);
  if (!removed) return;

  // Delete the MongoDB record first
  if (removed.serverId) {
    const deleted = await deleteAnalyzedImage(removed.serverId);

    if (!deleted) return;
  }

  URL.revokeObjectURL(removed.previewUrl);

  const remaining = images.filter((image) => image.id !== id);
  setImages(remaining);

  if (selectedId === id) {
    setSelectedId(remaining[0]?.id || "");
  }
};

const clearAll = async () => {
  setError("");

  for (const image of [...images]) {
    if (image.serverId) {
      const deleted = await deleteAnalyzedImage(image.serverId);

      if (!deleted) return;
    }
  }

  images.forEach((image) => {
    URL.revokeObjectURL(image.previewUrl);
  });

  setImages([]);
  setSelectedId("");
};

const deleteAnalyzedImage = async (serverId) => {
  if (!serverId) {
    setError("This image has no saved database record.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/${serverId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Delete failed");
    }

    setError("");
    return true;
  } catch (error) {
    setError(
      error instanceof Error ? error.message : "Delete failed"
    );
    return false;
  }
};


const updateAnalyzedImage = async (id, updates) => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Update failed");
  }

  return result.data;
};

// ADD THIS FUNCTION HERE
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

    const updated = await updateAnalyzedImage(
      selected.serverId,
      { name: editName.trim() }
    );

    setImages((current) =>
      current.map((image) =>
        image.id === selected.id
          ? {
              ...image,
              file: new File(
                [image.file],
                updated.name || editName.trim(),
                { type: image.file.type }
              ),
            }
          : image
      )
    );

    setEditName(updated.name || editName.trim());
  } catch (error) {
    setError(error instanceof Error ? error.message : "Update failed");
  } finally {
    setUpdating(false);
  }
};




  const metadata = selected ? {
    name: selected.file.name,
    format: selected.format || selected.file.type.replace("image/", "").toUpperCase() || "Unknown",
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
    lastModified: selected.lastModified ? new Date(selected.lastModified).toLocaleString() : "Unknown",
  } : null;

  const copyMetadata = async () => {
    if (!metadata) return;
    await navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="analyzer-page" id="analyzer">
      <div className="analyzer-shell">
        <header className="analyzer-hero">
          <span className="analyzer-eyebrow"><Sparkles size={14} /> IMAGE INTELLIGENCE</span>
          <h1>Know every detail.<br /><span>At a glance.</span></h1>
          <p>A clear, complete readout of your image files. Analyzed securely and never saved to the server.</p>
        </header>

        <section className="analyzer-workspace" aria-label="Image format and size analyzer">
          <div className="analyzer-toolbar">
            <div className="analyzer-tool-title"><span><ScanLine size={18} /></span><div><strong>Image analyzer</strong><small>Format, dimensions & file properties</small></div></div>
             <button type="button" onClick={loadSavedImages}>
    Load saved images
  </button>
            <div className="analyzer-private"><ShieldCheck size={15} /> Temporary analysis · not stored</div>
          </div>

          {!images.length ? (
            <button className={`analyzer-dropzone ${dragging ? "is-dragging" : ""}`} type="button" disabled={analyzing}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
              <span className="analyzer-upload-icon"><ImagePlus size={23} /></span>
              <strong>{analyzing ? "Analyzing your images…" : "Drop your images here"}</strong>
              <span className="analyzer-drop-hint">{analyzing ? "Reading dimensions and file properties" : "or browse files from your device"}</span>
              <span className="analyzer-browse"><Upload size={15} /> Choose images</span>
              <small>JPG, PNG, WEBP, GIF, BMP, SVG · Multiple files supported</small>
            </button>
          ) : (
            <div className="analyzer-content">
              <aside className="analyzer-sidebar">
                <div className="analyzer-list-head"><span>YOUR FILES <b>{images.length}</b></span><button type="button" onClick={clearAll}>Clear all</button></div>
                <div className="analyzer-file-list">
                  {images.map((image) => <button type="button" key={image.id} className={`analyzer-file ${selected?.id === image.id ? "is-selected" : ""}`} onClick={() => setSelectedId(image.id)}>
                    <img src={image.previewUrl} alt="" />
                    <span className="analyzer-file-copy"><strong title={image.file.name}>{image.file.name}</strong><small>{formatSize(image.file.size)} · {image.width} × {image.height}</small></span>
                    <span className="analyzer-file-format">{image.file.type.split("/")[1]?.toUpperCase()}</span>
                    <span className="analyzer-remove" role="button" tabIndex={0} aria-label={`Remove ${image.file.name}`} onClick={(event) => { event.stopPropagation(); removeImage(image.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.stopPropagation(); removeImage(image.id); } }}><X size={13} /></span>
                  </button>)}
                </div>
                <button className="analyzer-add-more" type="button" onClick={() => inputRef.current?.click()}><ImagePlus size={15} /> Add more images</button>
              </aside>

              {selected && <section className="analyzer-details">
                <div className="analyzer-preview">
                  <span className="preview-chip"><Activity size={13} /> ANALYZED</span>
                  <img src={selected.previewUrl} alt={selected.file.name} />
                  <div className="preview-caption"><strong>{selected.file.name}</strong><span>{selected.width} × {selected.height} px</span></div>
                </div>
             
<div className="analyzer-report">

  {/* ADD RENAME CODE HERE */}
  <div className="analyzer-rename">
    <input
      type="text"
      placeholder="Enter new image name"
      value={editName}
      onChange={(event) => setEditName(event.target.value)}
    />

    <button
      type="button"
      onClick={handleUpdateImage}
      disabled={updating || !selected?.serverId}
    >
      {updating ? "Updating..." : "Update image name"}
    </button>
  </div>

  {/* YOUR EXISTING CODE */}
  <div className="report-heading">
    <div>
      <span className="report-kicker">FILE REPORT</span>
      <h2>Image properties</h2>
    </div>

    <button className="copy-report" type="button" onClick={copyMetadata}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copied" : "Copy details"}
    </button>
  </div>

  <div className="analyzer-stat-grid">
    <div className="analyzer-stat stat-size"><span><HardDrive size={15} /> FILE SIZE</span><strong>{formatSize(selected.file.size)}</strong><small>Original file</small></div>
    <div className="analyzer-stat stat-dimensions"><span><Maximize2 size={15} /> DIMENSIONS</span><strong>{selected.width} <i>×</i> {selected.height}</strong><small>Pixels · {selected.megapixels} megapixels</small></div>
    <div className="analyzer-stat"><span><FileImage size={15} /> FORMAT</span><strong>{metadata.format}</strong><small>{selected.file.type || "Image file"}</small></div>
    <div className="analyzer-stat"><span><Aperture size={15} /> ASPECT RATIO</span><strong>{selected.ratio}</strong><small>{selected.orientation} image</small></div>
  </div>

  <div className="analyzer-meta">
    <div className="meta-title"><span>MORE DETAILS</span><ArrowUpRight size={15} /></div>
    <div><span>Color space</span><strong>{selected.colorSpace}</strong></div>
    <div><span>Color depth</span><strong>{selected.colorDepth}</strong></div>
    <div><span>Color channels</span><strong>{selected.channels}{selected.hasAlpha ? " · Alpha" : ""}</strong></div>
    <div><span>Orientation</span><strong>{selected.orientation}</strong></div>
    <div><span>Last modified</span><strong><CalendarDays size={13} /> {metadata.lastModified}</strong></div>
  </div>

</div>

              </section>}
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => addFiles(event.target.files)} />
          {error && <p className="analyzer-error" role="alert">{error}</p>}
        </section>
        <footer className="analyzer-footnote"><ShieldCheck size={15} /><span>Images are analyzed in memory and are not saved by the server.</span></footer>
      </div>
    </main>
  );
}

export default ImageAnalyzer;

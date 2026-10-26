
import { useEffect, useRef, useState } from "react";
import {
  Crop,
  Download,
  ImagePlus,
  RotateCcw,
  Scan,
  Upload,
} from "lucide-react";

import "./ImageCropper.css";

const API_BASE = `${
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : "https://image-background-remover-backend-wa3j.onrender.com")
}/users`;

const aspectOptions = [
  { label: "Free", value: "free" },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
];

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

function centeredCrop(stage, aspect) {
  const padding = 0.84;

  if (!stage.width || !stage.height) return null;

  let width = stage.width * padding;
  let height = stage.height * padding;

  if (aspect !== "free") {
    if (width / height > aspect) {
      width = height * aspect;
    } else {
      height = width / aspect;
    }
  }

  return {
    x: (stage.width - width) / 2,
    y: (stage.height - height) / 2,
    width,
    height,
  };
}

function ImageCropper() {
  const inputRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [image, setImage] = useState(null);
  const [stage, setStage] = useState({
    width: 0,
    height: 0,
  });
  const [crop, setCrop] = useState(null);
  const [aspect, setAspect] = useState("free");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cropId, setCropId] = useState("");

  // Load uploaded image.
  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return undefined;
    }

    let cancelled = false;
    const preview = new Image();

    preview.onload = () => {
      if (!cancelled) setImage(preview);
    };

    preview.onerror = () => {
      if (!cancelled) {
        setError("Unable to load this image.");
      }
    };

    preview.src = imageUrl;

    return () => {
      cancelled = true;
      preview.onload = null;
      preview.onerror = null;
    };
  }, [imageUrl]);

  // Measure the workspace and fit the image inside it.
  useEffect(() => {
    const workspace = stageRef.current;

    if (!image || !workspace) return undefined;

    const updateStage = () => {
      const maxWidth = Math.max(240, workspace.clientWidth);
      const scale = Math.min(
        maxWidth / image.naturalWidth,
        480 / image.naturalHeight,
        1
      );

      const nextStage = {
        width: Math.max(
          1,
          Math.round(image.naturalWidth * scale)
        ),
        height: Math.max(
          1,
          Math.round(image.naturalHeight * scale)
        ),
      };

      setStage(nextStage);
      setCrop(centeredCrop(nextStage, aspect));
    };

    updateStage();

    const observer = new ResizeObserver(updateStage);
    observer.observe(workspace);

    return () => observer.disconnect();
  }, [image, aspect]);

  // Clean up object URLs.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const loadFile = (nextFile) => {
    if (!nextFile) return;

    if (!nextFile.type.startsWith("image/")) {
      setError("Choose a valid image file.");
      return;
    }

    if (nextFile.size > 25 * 1024 * 1024) {
      setError("Image size must be 25 MB or less.");
      return;
    }

    setError("");
    setFile(nextFile);
    setImage(null);
    setImageUrl(URL.createObjectURL(nextFile));
    setResultUrl("");
    setCropId("");
    setCrop(null);
    setStage({ width: 0, height: 0 });
  };

  const changeAspect = (nextAspect) => {
    setAspect(nextAspect);
    setCrop(centeredCrop(stage, nextAspect));
    setResultUrl("");
    setCropId("");
    setError("");
  };

  const getPoint = (event) => {
    const stageElement =
      stageRef.current?.querySelector(".crop-stage");

    if (!stageElement) {
      return { x: 0, y: 0 };
    }

    const bounds = stageElement.getBoundingClientRect();

    return {
      x: clamp(event.clientX - bounds.left, 0, stage.width),
      y: clamp(event.clientY - bounds.top, 0, stage.height),
    };
  };

  const startCropInteraction = (event, mode) => {
    if (!crop) return;

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    dragRef.current = {
      mode,
      start: getPoint(event),
      initial: { ...crop },
    };
  };

  const moveCropInteraction = (event) => {
    if (!dragRef.current) return;

    const point = getPoint(event);
    const { mode, start, initial } = dragRef.current;

    if (mode === "move") {
      setCrop({
        ...initial,
        x: clamp(
          initial.x + point.x - start.x,
          0,
          Math.max(0, stage.width - initial.width)
        ),
        y: clamp(
          initial.y + point.y - start.y,
          0,
          Math.max(0, stage.height - initial.height)
        ),
      });

      return;
    }

    let width = Math.max(35, initial.width + point.x - start.x);
    let height = Math.max(35, initial.height + point.y - start.y);

    if (aspect !== "free") {
      if (width / height > aspect) {
        width = height * aspect;
      } else {
        height = width / aspect;
      }
    }

    width = Math.min(width, stage.width - initial.x);
    height = Math.min(height, stage.height - initial.y);

    if (aspect !== "free") {
      if (width / height > aspect) {
        width = height * aspect;
      } else {
        height = width / aspect;
      }
    }

    setCrop({
      ...initial,
      width: Math.max(1, width),
      height: Math.max(1, height),
    });
  };

  const finishCropInteraction = () => {
    dragRef.current = null;
  };

  const exportCrop = async () => {
    if (!image || !crop || !file || !stage.width || !stage.height) {
      setError("Please upload an image and select a crop area.");
      return;
    }

    const scaleX = image.naturalWidth / stage.width;
    const scaleY = image.naturalHeight / stage.height;

    const sourceX = clamp(
      Math.round(crop.x * scaleX),
      0,
      image.naturalWidth - 1
    );

    const sourceY = clamp(
      Math.round(crop.y * scaleY),
      0,
      image.naturalHeight - 1
    );

    const sourceWidth = clamp(
      Math.round(crop.width * scaleX),
      1,
      image.naturalWidth - sourceX
    );

    const sourceHeight = clamp(
      Math.round(crop.height * scaleY),
      1,
      image.naturalHeight - sourceY
    );

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Your browser could not create the cropped image.");
      return;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    setSaving(true);
    setError("");
    setResultUrl("");
    setCropId("");

    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Could not export the cropped image."));
          },
          "image/png"
        );
      });

      const body = new FormData();

      body.append("image", blob, "crop.png");
      body.append("originalFileName", file.name);
      body.append("originalFormat", file.type || "image/png");
      body.append("originalSize", String(file.size));
      body.append("width", String(sourceWidth));
      body.append("height", String(sourceHeight));
      body.append("cropX", String(sourceX));
      body.append("cropY", String(sourceY));
      body.append("cropWidth", String(sourceWidth));
      body.append("cropHeight", String(sourceHeight));

      body.append(
        "aspectRatio",
        aspectOptions.find((option) => option.value === aspect)?.label ||
          "Free"
      );

      // Save the cropped image on the Render backend.
      const response = await fetch(
        `${API_BASE}/image-cropper`,
        {
          method: "POST",
          body,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Could not save the cropped image."
        );
      }

      const id = data?.data?._id || data?.data?.id;

      if (!id) {
        throw new Error(
          "The backend did not return a cropped image ID."
        );
      }

      setResultUrl(URL.createObjectURL(blob));
      setCropId(id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the cropped image."
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadCrop = async () => {
    if (!cropId || !file) {
      setError("Please apply the crop before downloading.");
      return;
    }

    try {
      setDownloading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/downloadcropper/${cropId}`
      );

      if (!response.ok) {
        throw new Error("Could not download the cropped image.");
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The downloaded image is empty.");
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `${
        file.name.replace(/\.[^.]+$/, "") || "image"
      }-cropped.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not download the cropped image."
      );
    } finally {
      setDownloading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setImage(null);
    setImageUrl("");
    setResultUrl("");
    setCropId("");
    setCrop(null);
    setStage({ width: 0, height: 0 });
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <main className="crop-page">
      <header className="crop-hero">
        <span className="crop-eyebrow">
          <Scan size={15} /> PRECISION IMAGE TOOLS
        </span>

        <h1>
          Frame it <span>your way.</span>
        </h1>

        <p>
          Make every crop feel intentional with a clean, precise
          workspace.
        </p>
      </header>

      <section className="crop-editor" aria-label="Image cropper">
        <div className="crop-toolbar">
          <div className="crop-tool-title">
            <span>
              <Crop size={17} />
            </span>

            <div>
              <strong>Image cropper</strong>
              <small>Drag the frame to refine your composition</small>
            </div>
          </div>

          {file && (
            <button
              className="crop-reset"
              type="button"
              onClick={reset}
            >
              <RotateCcw size={14} /> Start over
            </button>
          )}
        </div>

        <div className="crop-layout">
          <div
            className="crop-workspace"
            ref={stageRef}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              loadFile(event.dataTransfer.files?.[0]);
            }}
          >
            {image ? (
              <div
                className="crop-stage"
                style={{
                  width: stage.width,
                  height: stage.height,
                  backgroundImage: `url("${imageUrl}")`,
                }}
                onPointerMove={moveCropInteraction}
                onPointerUp={finishCropInteraction}
                onPointerCancel={finishCropInteraction}
              >
                {crop && (
                  <>
                    <div
                      className="crop-dim"
                      style={{
                        left: 0,
                        top: 0,
                        width: "100%",
                        height: `${crop.y}px`,
                      }}
                    />

                    <div
                      className="crop-dim"
                      style={{
                        left: 0,
                        top: `${crop.y + crop.height}px`,
                        width: "100%",
                        bottom: 0,
                      }}
                    />

                    <div
                      className="crop-dim"
                      style={{
                        left: 0,
                        top: `${crop.y}px`,
                        width: `${crop.x}px`,
                        height: `${crop.height}px`,
                      }}
                    />

                    <div
                      className="crop-dim"
                      style={{
                        left: `${crop.x + crop.width}px`,
                        top: `${crop.y}px`,
                        right: 0,
                        height: `${crop.height}px`,
                      }}
                    />

                    <div
                      className="crop-selection"
                      style={{
                        left: crop.x,
                        top: crop.y,
                        width: crop.width,
                        height: crop.height,
                      }}
                      onPointerDown={(event) =>
                        startCropInteraction(event, "move")
                      }
                    >
                      <i className="crop-grid-v crop-grid-v1" />
                      <i className="crop-grid-v crop-grid-v2" />
                      <i className="crop-grid-h crop-grid-h1" />
                      <i className="crop-grid-h crop-grid-h2" />

                      <span className="crop-handle crop-handle-tl" />
                      <span className="crop-handle crop-handle-tr" />
                      <span className="crop-handle crop-handle-bl" />

                      <span
                        className="crop-handle crop-handle-br"
                        onPointerDown={(event) =>
                          startCropInteraction(event, "resize")
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                className="crop-upload"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <span className="crop-upload-icon">
                  <ImagePlus size={24} />
                </span>

                <strong>Drop an image to begin</strong>
                <span>or choose a file from your device</span>

                <span className="crop-upload-action">
                  <Upload size={15} /> Choose image
                </span>

                <small>JPG, PNG, WebP · Up to 25 MB</small>
              </button>
            )}
          </div>

          <aside className="crop-controls">
            <div className="crop-control-heading">
              <strong>Crop settings</strong>
              <small>Choose a frame or make it freeform</small>
            </div>

            <div
              className="crop-ratios"
              role="group"
              aria-label="Crop aspect ratio"
            >
              {aspectOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={
                    aspect === option.value ? "active" : ""
                  }
                  onClick={() => changeAspect(option.value)}
                  disabled={!image}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {file && (
              <div className="crop-file-card">
                <div className="crop-file-icon">
                  <ImagePlus size={16} />
                </div>

                <div>
                  <strong title={file.name}>{file.name}</strong>
                  <small>
                    {image
                      ? `${image.naturalWidth} × ${image.naturalHeight}`
                      : "Loading image…"}
                  </small>
                </div>
              </div>
            )}

            <div className="crop-hint">
              <span>✦</span>
              <p>
                <strong>Fine-tune your frame</strong>
                <small>
                  Drag inside the crop area to reposition. Pull the
                  corner handle to resize.
                </small>
              </p>
            </div>

            {error && (
              <p className="crop-error" role="alert">
                {error}
              </p>
            )}

            <div className="crop-actions">
              {!file ? (
                <button
                  className="crop-primary"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={16} /> Upload an image
                </button>
              ) : (
                <button
                  className="crop-primary"
                  type="button"
                  onClick={resultUrl ? downloadCrop : exportCrop}
                  disabled={
                    saving ||
                    downloading ||
                    !image ||
                    !crop
                  }
                >
                  {saving ? (
                    <RotateCcw
                      className="crop-working"
                      size={16}
                    />
                  ) : resultUrl ? (
                    <Download size={16} />
                  ) : (
                    <Crop size={16} />
                  )}

                  {saving
                    ? "Saving crop…"
                    : downloading
                    ? "Downloading…"
                    : resultUrl
                    ? "Download cropped image"
                    : "Apply crop"}
                </button>
              )}

              {file && (
                <button
                  className="crop-secondary"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  Choose another image
                </button>
              )}
            </div>

            <p className="crop-private">
              Cropping happens on your device; saving and downloading
              use your backend.
            </p>
          </aside>
        </div>
      </section>

      {resultUrl && (
        <section className="crop-result">
          <h2>Cropped image preview</h2>
          <img src={resultUrl} alt="Cropped result" />
        </section>
      )}

      <input
        ref={inputRef}
        className="crop-file-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          loadFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </main>
  );
}

export default ImageCropper;

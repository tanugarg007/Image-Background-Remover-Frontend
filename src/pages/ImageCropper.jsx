
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
import { API_USERS } from "../config/api.js";
import { releaseGuestDownload, requireLoginForDownload, trackDownload } from "../config/downloadTracking.js";

const API_BASE = API_USERS;
const aspectOptions = [
  { label: "Full image", value: "full" },
  { label: "Free", value: "free" },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
];
const resizeHandles = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

function centeredCrop(stage, aspect) {
  if (aspect === "full") {
    return { x: 0, y: 0, width: stage.width, height: stage.height };
  }

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

function getImageLayout(stage, crop, imageScale, fitWholeImage, imageOffset) {
  const fitScale = Math.min(
    crop.width / stage.width,
    crop.height / stage.height
  );
  const coverScale = Math.max(
    crop.width / stage.width,
    crop.height / stage.height
  );
  const scale = (fitWholeImage ? fitScale : coverScale) * (imageScale / 100);
  const width = stage.width * scale;
  const height = stage.height * scale;
  return {
    width,
    height,
    left: crop.x + (crop.width - width) / 2 + imageOffset.x,
    top: crop.y + (crop.height - height) / 2 + imageOffset.y,
  };
}

function ImageCropper() {
  const inputRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const editorRef = useRef(null);

  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [image, setImage] = useState(null);
  const [stage, setStage] = useState({
    width: 0,
    height: 0,
  });
  const [crop, setCrop] = useState(null);
  const [aspect, setAspect] = useState("full");
  const [fitWholeImage, setFitWholeImage] = useState(true);
  const [imageScale, setImageScale] = useState(100);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cropId, setCropId] = useState("");

  // Load uploaded image.
  useEffect(() => {
    if (!imageUrl) return undefined;

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
      const workspaceStyle = window.getComputedStyle(workspace);
      const horizontalPadding =
        parseFloat(workspaceStyle.paddingLeft) +
        parseFloat(workspaceStyle.paddingRight);
      const verticalPadding =
        parseFloat(workspaceStyle.paddingTop) +
        parseFloat(workspaceStyle.paddingBottom);
      const maxWidth = Math.max(1, workspace.clientWidth - horizontalPadding);
      const maxHeight = Math.max(
        1,
        Math.min(480, workspace.clientHeight - verticalPadding)
      );
      const scale = Math.min(
        maxWidth / image.naturalWidth,
        maxHeight / image.naturalHeight,
        1
      );

      const nextStage = {
        width: Math.max(1, image.naturalWidth * scale),
        height: Math.max(1, image.naturalHeight * scale),
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
    setFitWholeImage(true);
    setImageScale(100);
    setImageOffset({ x: 0, y: 0 });
    setStage({ width: 0, height: 0 });
  };

  const changeAspect = (nextAspect) => {
    setAspect(nextAspect);
    setCrop(centeredCrop(stage, nextAspect));
    setResultUrl("");
    setCropId("");
    setError("");
    setImageOffset({ x: 0, y: 0 });
  };

  const getPoint = (event) => {
    const stageElement =
      stageRef.current?.querySelector(".crop-stage");

    if (!stageElement) {
      return { x: 0, y: 0 };
    }

    const bounds = stageElement.getBoundingClientRect();

    return {
      x: clamp(
        (event.clientX - bounds.left) * (stage.width / bounds.width),
        0,
        stage.width
      ),
      y: clamp(
        (event.clientY - bounds.top) * (stage.height / bounds.height),
        0,
        stage.height
      ),
    };
  };

  const startCropInteraction = (event, mode) => {
    if (!crop) return;

    event.preventDefault();
    event.stopPropagation();

    stageRef.current
      ?.querySelector(".crop-stage")
      ?.setPointerCapture?.(event.pointerId);

    dragRef.current = {
      mode,
      start: getPoint(event),
      initial: { ...crop },
      initialOffset: { ...imageOffset },
    };
  };

  const moveCropInteraction = (event) => {
    if (!dragRef.current) return;

    const point = getPoint(event);
    const { mode, start, initial } = dragRef.current;

    if (mode === "move") {
      const deltaX = point.x - start.x;
      const deltaY = point.y - start.y;
      const nextCrop = {
        ...initial,
        x: clamp(
          initial.x + deltaX,
          0,
          Math.max(0, stage.width - initial.width)
        ),
        y: clamp(
          initial.y + deltaY,
          0,
          Math.max(0, stage.height - initial.height)
        ),
      };
      setCrop(nextCrop);
      setImageOffset({
        x: dragRef.current.initialOffset.x - (nextCrop.x - initial.x),
        y: dragRef.current.initialOffset.y - (nextCrop.y - initial.y),
      });
      return;
    }

    const handle = mode.slice("resize-".length);
    const resizeLeft = handle.includes("w");
    const resizeRight = handle.includes("e");
    const resizeTop = handle.includes("n");
    const resizeBottom = handle.includes("s");
    const hasHorizontal = resizeLeft || resizeRight;
    const hasVertical = resizeTop || resizeBottom;
    const centerX = initial.x + initial.width / 2;
    const centerY = initial.y + initial.height / 2;
    const anchorX = resizeLeft
      ? initial.x + initial.width
      : resizeRight
      ? initial.x
      : centerX;
    const anchorY = resizeTop
      ? initial.y + initial.height
      : resizeBottom
      ? initial.y
      : centerY;
    const maxWidth = hasHorizontal
      ? resizeLeft
        ? anchorX
        : stage.width - anchorX
      : 2 * Math.min(centerX, stage.width - centerX);
    const maxHeight = hasVertical
      ? resizeTop
        ? anchorY
        : stage.height - anchorY
      : 2 * Math.min(centerY, stage.height - centerY);
    const widthDelta = point.x - start.x;
    const heightDelta = point.y - start.y;
    let width = initial.width + (resizeLeft ? -widthDelta : resizeRight ? widthDelta : 0);
    let height = initial.height + (resizeTop ? -heightDelta : resizeBottom ? heightDelta : 0);
    const ratio = typeof aspect === "number"
      ? aspect
      : aspect === "full" && image
      ? image.naturalWidth / image.naturalHeight
      : null;

    if (ratio) {
      const boundedWidth = Math.min(maxWidth, maxHeight * ratio);
      let desiredWidth;
      if (hasHorizontal && !hasVertical) {
        desiredWidth = width;
      } else if (!hasHorizontal && hasVertical) {
        desiredWidth = height * ratio;
      } else {
        desiredWidth = Math.abs(width - initial.width) >=
          Math.abs(height - initial.height) * ratio
          ? width
          : height * ratio;
      }
      width = clamp(desiredWidth, Math.min(35, boundedWidth), boundedWidth);
      height = width / ratio;
    } else {
      width = hasHorizontal
        ? clamp(width, Math.min(35, maxWidth), maxWidth)
        : initial.width;
      height = hasVertical
        ? clamp(height, Math.min(35, maxHeight), maxHeight)
        : initial.height;
    }

    setCrop({
      x: hasHorizontal
        ? resizeLeft
          ? anchorX - width
          : anchorX
        : centerX - width / 2,
      y: hasVertical
        ? resizeTop
          ? anchorY - height
          : anchorY
        : centerY - height / 2,
      width,
      height,
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

    const layout = getImageLayout(
      stage,
      crop,
      imageScale,
      fitWholeImage,
      imageOffset
    );
    const scaleX = image.naturalWidth / layout.width;
    const scaleY = image.naturalHeight / layout.height;
    const selectedX = (crop.x - layout.left) * scaleX;
    const selectedY = (crop.y - layout.top) * scaleY;
    const selectedWidth = crop.width * scaleX;
    const selectedHeight = crop.height * scaleY;
    const canvasWidth = Math.max(1, Math.round(selectedWidth));
    const canvasHeight = Math.max(1, Math.round(selectedHeight));
    const sourceX = clamp(selectedX, 0, image.naturalWidth);
    const sourceY = clamp(selectedY, 0, image.naturalHeight);
    const sourceRight = clamp(selectedX + selectedWidth, 0, image.naturalWidth);
    const sourceBottom = clamp(selectedY + selectedHeight, 0, image.naturalHeight);
    const sourceWidth = Math.max(0, sourceRight - sourceX);
    const sourceHeight = Math.max(0, sourceBottom - sourceY);
    if (sourceWidth === 0 || sourceHeight === 0) {
      setError("The crop frame must overlap the image.");
      return;
    }

    const destinationX = (sourceX - selectedX) / scaleX;
    const destinationY = (sourceY - selectedY) / scaleY;
    const destinationWidth = sourceWidth / scaleX;
    const destinationHeight = sourceHeight / scaleY;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Your browser could not create the cropped image.");
      return;
    }

    if (sourceWidth > 0 && sourceHeight > 0) {
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight
      );
    }

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
      body.append("width", String(canvasWidth));
      body.append("height", String(canvasHeight));
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
      window.requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (cause) {
      await releaseGuestDownload();
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
    if (!(await requireLoginForDownload())) return;

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
      await trackDownload("Image cropper", link.download, blob.size);

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

  const imageLayout = image && crop && stage.width
    ? getImageLayout(stage, crop, imageScale, fitWholeImage, imageOffset)
    : null;

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

      <section className="crop-editor" aria-label="Image cropper" ref={editorRef}>
        <div className="crop-toolbar">
          <div className="crop-tool-title">
            <span>
              <Crop size={17} />
            </span>

            <div>
              <strong>Image cropper</strong>
              <small>Drag inside the frame to move it; use any handle to resize</small>
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
            {resultUrl ? (
              <div className="crop-result-preview">
                <h2>Crop applied</h2>
                <p className="crop-result-description">
                  {`Selected area · ${aspectOptions.find((option) => option.value === aspect)?.label || "Free"} frame`}
                </p>
                <img src={resultUrl} alt="Cropped result" />
                <button
                  type="button"
                  className="crop-secondary"
                  onClick={() => {
                    setResultUrl("");
                    setCropId("");
                    setFitWholeImage(true);
                    setImageScale(100);
                    setImageOffset({ x: 0, y: 0 });
                  }}
                >
                  Adjust crop
                </button>
              </div>
            ) : image ? (
              <div
                className="crop-stage"
                style={{
                  width: stage.width,
                  height: stage.height,
                  backgroundImage: `url("${imageUrl}")`,
                  backgroundSize: imageLayout
                    ? `${imageLayout.width}px ${imageLayout.height}px`
                    : "100% 100%",
                  backgroundPosition: imageLayout
                    ? `${imageLayout.left}px ${imageLayout.top}px`
                    : "0 0",
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

                      {resizeHandles.map((handle) => (
                        <span
                          key={handle}
                          className={`crop-handle crop-handle-${handle}`}
                          onPointerDown={(event) =>
                            startCropInteraction(event, `resize-${handle}`)
                          }
                        />
                      ))}
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

            <label className="crop-fit-option">
              <input
                type="checkbox"
                checked={fitWholeImage}
                disabled={!image}
                onChange={(event) => {
                  setFitWholeImage(event.target.checked);
                  setImageScale(100);
                  setImageOffset({ x: 0, y: 0 });
                  setResultUrl("");
                  setCropId("");
                }}
              />
              <span>
                <strong>Fit whole image</strong>
                <small>Fit the photo inside the crop frame; resizing the frame scales the photo too.</small>
              </span>
            </label>

            {image && (
              <label className="crop-image-scale" htmlFor="crop-image-scale">
                <span><strong>Image size</strong><output>{imageScale}%</output></span>
                <input
                  id="crop-image-scale"
                  type="range"
                  min={fitWholeImage ? "30" : "100"}
                  max={fitWholeImage ? "100" : "300"}
                  step="5"
                  value={imageScale}
                  onChange={(event) => {
                    setImageScale(Number(event.target.value));
                    setResultUrl("");
                    setCropId("");
                  }}
                />
                <small>{fitWholeImage
                  ? "The complete photo stays fitted inside the frame as you resize it."
                  : "Zoom into the frame; resizing it also adjusts the photo scale."}</small>
              </label>
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
                    <RotateCcw className="crop-working" size={16} />
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
                <strong>{fitWholeImage ? "Full image fit" : "Cover fit"}</strong>
                <small>
                  {fitWholeImage
                    ? "The full photo scales with the crop frame."
                    : "The photo covers the frame and scales with it; use Image Size to zoom further."}
                </small>
              </p>
            </div>

            {error && (
              <p className="crop-error" role="alert">
                {error}
              </p>
            )}

            <p className="crop-private">
              Cropping happens on your device; saving and downloading
              use your backend.
            </p>
          </aside>
        </div>
      </section>

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


import { useEffect, useState } from "react";
import {
  Upload,
  Download,
  RefreshCw,
  Image as ImageIcon,
  FileImage,
} from "lucide-react";

import "./ImageConverter.css";
import { API_ROOT } from "../config/api.js";

const API_BASE = `${API_ROOT}/users`;

const formats = {
  PNG: "image/png",
  JPG: "image/jpeg",
  WEBP: "image/webp",
  AVIF: "image/avif",
};

function ImageConverter() {
  const [original, setOriginal] = useState(null);
  const [originalPreview, setOriginalPreview] = useState("");
  const [converted, setConverted] = useState("");
  const [format, setFormat] = useState("WEBP");
  const [quality, setQuality] = useState(90);
  const [conversionId, setConversionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Release preview URLs when they are replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (originalPreview) {
        URL.revokeObjectURL(originalPreview);
      }
    };
  }, [originalPreview]);

  useEffect(() => {
    return () => {
      if (converted) {
        URL.revokeObjectURL(converted);
      }
    };
  }, [converted]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      e.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Image size must be 20 MB or less.");
      e.target.value = "";
      return;
    }

    setOriginal(file);
    setOriginalPreview(URL.createObjectURL(file));
    setConverted("");
    setConversionId("");
  };

  const convertImage = async () => {
    if (!original) {
      setError("Please upload an image first.");
      return;
    }

    let imageBitmap;

    try {
      setLoading(true);
      setError("");
      setConverted("");
      setConversionId("");

      imageBitmap = await createImageBitmap(original);

      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to process this image.");
      }

      // JPG does not support transparency, so use a white background.
      if (format === "JPG") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(imageBitmap, 0, 0);

      const mimeType = formats[format];

      // Convert the image to the selected output format.
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result || result.size === 0) {
              reject(new Error("Image conversion failed."));
              return;
            }

            if (result.type !== mimeType) {
              reject(
                new Error(
                  `${format} conversion is not supported by your browser. Please choose another format.`
                )
              );
              return;
            }

            resolve(result);
          },
          mimeType,
          format === "PNG" ? undefined : quality / 100
        );
      });

      const name = original.name.replace(/\.[^/.]+$/, "");
      const convertedFileName = `${name}.${format.toLowerCase()}`;

      const formData = new FormData();

      formData.append("image", blob, convertedFileName);
      formData.append("originalFileName", original.name);
      formData.append("convertedFileName", convertedFileName);
      formData.append("originalFormat", original.type);
      formData.append("convertedFormat", format);
      formData.append("originalSize", String(original.size));
      formData.append("convertedSize", String(blob.size));
      formData.append("width", String(imageBitmap.width));
      formData.append("height", String(imageBitmap.height));
      formData.append("quality", String(quality));

      // Save the converted image through the configured backend.
      const response = await fetch(
        `${API_BASE}/image-converter`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Image conversion failed."
        );
      }

      const id = data?.data?._id || data?.data?.id;

      if (!id) {
        throw new Error(
          "Image was processed, but the backend did not return a conversion ID."
        );
      }

      // Retrieve the saved converted image for the preview.
      const previewResponse = await fetch(
        `${API_BASE}/downloadconverter/${id}`
      );

      if (!previewResponse.ok) {
        throw new Error(
          "Image was saved, but its preview could not be loaded."
        );
      }

      const previewBlob = await previewResponse.blob();

      if (!previewBlob.size) {
        throw new Error("The converted image is empty.");
      }

      setConverted(URL.createObjectURL(previewBlob));
      setConversionId(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Image conversion failed."
      );
    } finally {
      if (imageBitmap) {
        imageBitmap.close();
      }

      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!conversionId) {
      setError("Please convert the image first.");
      return;
    }

    try {
      setDownloading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/downloadconverter/${conversionId}`
      );

      if (!response.ok) {
        throw new Error("Unable to download the converted image.");
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The downloaded image is empty.");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const name = original
        ? original.name.replace(/\.[^/.]+$/, "")
        : "converted-image";

      link.href = url;
      link.download = `${name}.${format.toLowerCase()}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Download failed."
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleFormatChange = (e) => {
    setFormat(e.target.value);
    setConverted("");
    setConversionId("");
    setError("");
  };

  const handleQualityChange = (e) => {
    setQuality(Number(e.target.value));
    setConverted("");
    setConversionId("");
  };

  return (
    <main className="converter-page">
      <section className="converter-hero">
        <h1>
          Image <span>Converter</span>
        </h1>

        <p>
          Convert your images to PNG, JPG, WebP, or AVIF.
        </p>
      </section>

      <section className="converter-card">
        <label className="converter-upload">
          <Upload size={28} />

          <h2>Upload your image</h2>

          <p>Choose an image up to 20 MB.</p>

          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            hidden
          />

          <span className="converter-primary-btn">
            Choose Image
          </span>
        </label>

        {original && (
          <>
            <div className="converter-image-grid">
              <div className="converter-image-panel">
                <h3>Original Image</h3>

                <div className="converter-preview">
                  {originalPreview && (
                    <img
                      src={originalPreview}
                      alt="Original"
                    />
                  )}
                </div>

                <p>{original.name}</p>

                <p>
                  {(original.size / 1024).toFixed(2)} KB
                </p>
              </div>

              <div className="converter-image-panel">
                <h3>Converted Image</h3>

                <div className="converter-preview">
                  {converted ? (
                    <img
                      src={converted}
                      alt="Converted"
                    />
                  ) : (
                    <div className="converter-empty-preview">
                      <FileImage size={36} />
                      <span>Preview will appear here</span>
                    </div>
                  )}
                </div>

                {converted && (
                  <p>
                    {format} · {quality}% quality
                  </p>
                )}
              </div>
            </div>

            <div className="converter-settings">
              <div className="converter-setting-group">
                <label htmlFor="output-format">
                  Output Format
                </label>

                <select
                  id="output-format"
                  value={format}
                  onChange={handleFormatChange}
                  disabled={loading}
                >
                  <option value="PNG">PNG</option>
                  <option value="JPG">JPG</option>
                  <option value="WEBP">WebP</option>
                  <option value="AVIF">AVIF</option>
                </select>
              </div>

              {format !== "PNG" && (
                <div className="converter-setting-group">
                  <label htmlFor="quality">
                    Quality: {quality}%
                  </label>

                  <input
                    id="quality"
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={handleQualityChange}
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="converter-error" role="alert">
                {error}
              </p>
            )}

            <div className="converter-actions">
              <button
                type="button"
                className="converter-primary-btn"
                onClick={convertImage}
                disabled={loading || downloading}
              >
                <RefreshCw size={18} />
                {loading ? "Converting..." : "Convert Image"}
              </button>

              {converted && (
                <button
                  type="button"
                  className="converter-download-btn"
                  onClick={downloadImage}
                  disabled={loading || downloading}
                >
                  <Download size={18} />
                  {downloading
                    ? "Downloading..."
                    : `Download ${format}`}
                </button>
              )}
            </div>
          </>
        )}

        {error && !original && (
          <p className="converter-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <footer className="converter-footer">
        <ImageIcon size={16} />
        <span>
          Images are processed in your browser and saved through
          the backend.
        </span>
      </footer>
    </main>
  );
}

export default ImageConverter;

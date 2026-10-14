
import { useState } from "react";
import {
  Upload,
  Download,
  RefreshCw,
  Image as ImageIcon,
  FileImage,
} from "lucide-react";
import "./ImageConverter.css";

const formats = {
  PNG: "image/png",
  JPG: "image/jpeg",
  WEBP: "image/webp",
  AVIF: "image/avif",
};

function ImageConverter() {
  const [original, setOriginal] = useState(null);
  const [converted, setConverted] = useState("");
  const [format, setFormat] = useState("WEBP");
  const [quality, setQuality] = useState(90);
  const [error, setError] = useState("");
const [conversionId, setConversionId] = useState("");
  const handleUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Image size must be 20 MB or less.");
      return;
    }

    setOriginal(file);
    setConverted("");
    setError("");
  };

 
const convertImage = async () => {
  if (!original) {
    setError("Please upload an image first.");
    return;
  }

  try {
    setError("");

    const image = await createImageBitmap(original);
    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const width = image.width;
    const height = image.height;

    const context = canvas.getContext("2d");

    if (!context) {
      image.close();
      throw new Error("Unable to process this image.");
    }

    if (format === "JPG") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, 0, 0);
    image.close();

   const blob = format === "AVIF" ? original : await new Promise((resolve, reject) => {
  canvas.toBlob(
    (result) => {
      if (!result) {
        reject(new Error("Image conversion failed."));
        return;
      }

      if (result.type !== formats[format]) {
        reject(
          new Error(
            `${format} format is not supported by your browser. Please select PNG, JPG, or WebP.`
          )
        );
        return;
      }

      resolve(result);
    },
    formats[format],
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
formData.append("width", String(width));
formData.append("height", String(height));
formData.append("quality", String(quality));

   const response = await fetch(
  "http://localhost:4000/users/image-converter",
  {
    method: "POST",
    body: formData,
  }
);

const data = await response.json();

if (!response.ok) {
  throw new Error(data.message || "Image conversion failed.");
}

const previewResponse = await fetch(
  `http://localhost:4000/users/downloadconverter/${data.data._id}`
);
if (!previewResponse.ok) {
  throw new Error("Image converted, but its preview could not be loaded.");
}
setConverted(URL.createObjectURL(await previewResponse.blob()));
setConversionId(data.data._id);
  } catch (err) {
    setError(err.message || "Image conversion failed.");
  }
};


 
const downloadImage = async () => {
  if (!conversionId) {
    setError("Please convert and save the image first.");
    return;
  }

  try {
    setError("");

    const response = await fetch(
  `http://localhost:4000/users/downloadconverter/${conversionId}`
);
    if (!response.ok) {
      throw new Error("Unable to download image.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `converted.${format.toLowerCase()}`;
    link.click();

    URL.revokeObjectURL(url);
  } catch (err) {
    setError(err.message || "Download failed.");
  }
};


  return (
    <main className="converter-page">
      <section className="converter-hero">
        <h1>
          Image <span>Converter</span>
        </h1>
        <p>Convert your images to PNG, JPG, WebP, or AVIF.</p>
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
                  <img
                    src={URL.createObjectURL(original)}
                    alt="Original"
                  />
                </div>
                <p>{original.name}</p>
              </div>

              <div className="converter-image-panel">
                <h3>Converted Image</h3>
                <div className="converter-preview">
                  {converted ? (
                    <img src={converted} alt="Converted" />
                  ) : (
                    <div className="converter-empty-preview">
                      <FileImage size={36} />
                      <span>Preview will appear here</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="converter-settings">
              <div className="converter-setting-group">
                <label htmlFor="output-format">Output Format</label>
                <select
                  id="output-format"
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value);
                    setConverted("");
                  }}
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
                    onChange={(e) => {
                      setQuality(Number(e.target.value));
                      setConverted("");
                    }}
                  />
                </div>
              )}
            </div>

            {error && <p className="converter-error">{error}</p>}

            <div className="converter-actions">
              <button
                className="converter-primary-btn"
                onClick={convertImage}
              >
                <RefreshCw size={18} />
                Convert Image
              </button>

              {converted && (
                <button
                  className="converter-download-btn"
                  onClick={downloadImage}
                >
                  <Download size={18} />
                  Download {format}
                </button>
              )}
            </div>
          </>
        )}

        {error && !original && (
          <p className="converter-error">{error}</p>
        )}
      </section>

      <footer className="converter-footer">
        <ImageIcon size={16} />
        <span>Images are processed in your browser.</span>
      </footer>
    </main>
  );
}

export default ImageConverter;

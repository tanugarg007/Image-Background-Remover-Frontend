
import { useState } from "react";
import { X } from "lucide-react";
import { API_USERS } from "../config/api.js";

const IMAGE_TOOLS_URL = `${API_USERS}/admin/imagetools`;

async function saveImageTool(tool, id) {
  const response = await fetch(
    id ? `${IMAGE_TOOLS_URL}/${encodeURIComponent(id)}` : IMAGE_TOOLS_URL,
    {
      method: id ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tool),
    }
  );

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: "" };

  if (!response.ok) {
    const message = response.status === 404
      ? "Image tools API route was not found. Restart the backend so it loads the latest routes."
      : payload.message || `Could not save image tool (${response.status}).`;
    throw new Error(message);
  }

  return payload.data;
}

const emptyForm = {
  title: "",
  description: "",
  icon: "ImageIcon",
  route: "",
  status: "active",
};

function AddEditImageToolModal({
  initialData,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          title: initialData.title,
          description: initialData.description,
          icon: initialData.icon,
          route: initialData.route,
          status: initialData.status,
        }
      : { ...emptyForm }
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setSaveError("");
      const savedTool = await saveImageTool({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        route: form.route.trim(),
      }, initialData?._id);
      await onSave(savedTool);
    } catch (error) {
      setSaveError(error.message || "Could not save image tool.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="image-tool-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <div className="image-tool-modal">
        <div className="image-tool-modal-header">
          <div>
            <h2>
              {initialData ? "Edit Tool" : "Add New Tool"}
            </h2>

            <p>
              Enter the details for your image processing tool.
            </p>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={21} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Tool Name

            <input
              type="text"
              name="title"
              placeholder="e.g. Image Editor"
              value={form.title}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Description

            <textarea
              name="description"
              placeholder="Write a short description..."
              value={form.description}
              onChange={handleChange}
              required
              rows={3}
            />
          </label>

          <label>
            Icon name

            <input
              type="text"
              name="icon"
              placeholder="e.g. ImageIcon, Palette, Crop"
              value={form.icon}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Status

            <select
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {saveError && <p className="action-message-error" role="alert">{saveError}</p>}

          <div className="image-tool-modal-actions">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="modal-save-btn"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : initialData
                ? "Update Tool"
                : "Save Tool"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditImageToolModal;

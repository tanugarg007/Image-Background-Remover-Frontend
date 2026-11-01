
import { useEffect, useMemo, useState } from "react";
import {
  Aperture,
  Image as ImageIcon,
  Palette,
  ScanSearch,
  Archive,
  Layers,
  FileImage,
  Minimize2,
  Crop,
  SlidersHorizontal,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Power,
  Wrench,
} from "lucide-react";

import AddEditImageToolModal from "./AddEditImageToolModal";
import { API_USERS } from "../config/api.js";
import { toolCatalog } from "./Navbar.jsx";

const IMAGE_TOOLS_URL = `${API_USERS}/admin/imagetools`;

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: "" };

  if (!response.ok) {
    const message = response.status === 404
      ? "Image tools API route was not found. Restart the backend so it loads the latest routes."
      : payload.message || `Image tools request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

const iconOptions = {
  Aperture,
  ImageIcon,
  Palette,
  ScanSearch,
  Archive,
  Layers,
  FileImage,
  Minimize2,
  Crop,
  SlidersHorizontal,
};

function AdminImageToolsPage() {
  const [tools, setTools] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // GET all image tools
  const fetchTools = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(IMAGE_TOOLS_URL, { credentials: "include" });
      const payload = await readApiResponse(response);
      const allStoredTools = Array.isArray(payload.data) ? payload.data : [];
      let loadedTools = allStoredTools.filter((tool) => !tool.isDeleted);
      const knownRoutes = new Set(allStoredTools.map((tool) => tool.route));
      const missingTools = toolCatalog.filter((tool) => !knownRoutes.has(tool.route));

      if (missingTools.length > 0) {
        await Promise.all(missingTools.map(async (tool) => {
          const createResponse = await fetch(IMAGE_TOOLS_URL, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: tool.title,
              description: tool.description,
              icon: tool.icon,
              route: tool.route,
              status: "active",
              isBuiltIn: true,
            }),
          });
          await readApiResponse(createResponse);
        }));

        const refreshedResponse = await fetch(IMAGE_TOOLS_URL, { credentials: "include" });
        const refreshedPayload = await readApiResponse(refreshedResponse);
        loadedTools = Array.isArray(refreshedPayload.data)
          ? refreshedPayload.data.filter((tool) => !tool.isDeleted)
          : [];
      }

      setTools(loadedTools);
    } catch (error) {
      console.error("Fetch image tools error:", error);
      setLoadError(error.message || "Could not load image tools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) =>
      `${tool.title} ${tool.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [tools, search]);

  const activeCount = tools.filter(
    (tool) => tool.status === "active"
  ).length;

  const inactiveCount = tools.length - activeCount;

  // Open Edit Tool Modal
  const openEditModal = (tool) => {
    setEditingTool(tool);
    setModalOpen(true);
  };

  // Close Modal
  const closeModal = () => {
    setModalOpen(false);
    setEditingTool(null);
  };

  // The modal persists the record and returns the saved API document.
  const handleModalSave = (savedTool) => {
    setTools((previous) => editingTool
      ? previous.map((tool) => tool._id === savedTool._id ? savedTool : tool)
      : [savedTool, ...previous]
    );
    closeModal();
};

  // DELETE image tool
  const handleDelete = async (id) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this tool?"
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`${IMAGE_TOOLS_URL}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await readApiResponse(response);

    setTools((previous) =>
      previous.filter((tool) => tool._id !== id)
    );
  } catch (error) {
    console.error("Delete image tool error:", error);
    alert(error.message);
  }
};

  // PATCH active / inactive status
  const toggleStatus = async (tool) => {
  const newStatus =
    tool.status === "active" ? "inactive" : "active";

  try {
    const response = await fetch(
      `${IMAGE_TOOLS_URL}/${encodeURIComponent(tool._id)}/status`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    const payload = await readApiResponse(response);
    const updatedTool = payload.data;

    setTools((previous) =>
      previous.map((item) =>
        item._id === tool._id
          ? { ...item, ...updatedTool, status: newStatus }
          : item
      )
    );
  } catch (error) {
    console.error("Update status error:", error);
    alert(error.message);
  }
};

  return (
    <div className="image-tools-page">
      {/* Page Header */}
      <div className="image-tools-header">
        <div>
          <h1>Image Tools</h1>
          <p>
            Manage all image processing tools from one place.
          </p>
        </div>
        <button
          type="button"
          className="refresh-button"
          onClick={fetchTools}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
          Refresh tools
        </button>
      </div>

      {/* Statistics */}
      <div className="image-tools-stats">
        <div className="image-tool-stat-card">
          <div className="stat-icon">
            <Wrench size={21} />
          </div>

          <div>
            <p>Total Tools</p>
            <h2>{tools.length}</h2>
          </div>
        </div>

        <div className="image-tool-stat-card">
          <div className="stat-icon active-stat-icon">
            <Power size={21} />
          </div>

          <div>
            <p>Active Tools</p>
            <h2>{activeCount}</h2>
          </div>
        </div>

        <div className="image-tool-stat-card">
          <div className="stat-icon inactive-stat-icon">
            <Power size={21} />
          </div>

          <div>
            <p>Inactive Tools</p>
            <h2>{inactiveCount}</h2>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="image-tools-toolbar">
        <div className="image-tools-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search image tools..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <span className="tools-count">
          Showing {filteredTools.length} of {tools.length} tools
        </span>
      </div>

      {/* Tools Grid */}
      <div className="image-tools-grid">
        {loading ? (
          <div className="image-tools-empty">
            <p>Loading image tools...</p>
          </div>
        ) : loadError ? (
          <div className="image-tools-empty" role="alert">
            <h3>Could not load image tools</h3>
            <p>{loadError}</p>
            <button type="button" onClick={fetchTools}>Try again</button>
          </div>
        ) : filteredTools.length > 0 ? (
          filteredTools.map((tool) => {
            const ToolIcon =
              iconOptions[tool.icon] || ImageIcon;

            return (
              <div className="image-tool-card" key={tool._id}>
                <div className="image-tool-card-top">
                  <div className="image-tool-icon">
                    <ToolIcon size={25} />
                  </div>

                  <span
                    className={`tool-status ${
                      tool.status === "active"
                        ? "status-active"
                        : "status-inactive"
                    }`}
                  >
                    {tool.status}
                  </span>
                </div>

                <h3>{tool.title}</h3>

                <p className="image-tool-description">
                  {tool.description}
                </p>

                <div className="image-tool-actions">
                  <button
                    type="button"
                    className="edit-tool-btn"
                    onClick={() => openEditModal(tool)}
                  >
                    <Pencil size={15} />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="toggle-tool-btn"
                    onClick={() => toggleStatus(tool)}
                    title={
                      tool.status === "active"
                        ? "Deactivate"
                        : "Activate"
                    }
                  >
                    <Power size={16} />
                  </button>

                  <button
                    type="button"
                    className="delete-tool-btn"
                    onClick={() => handleDelete(tool._id)}
                    title="Delete tool"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="image-tools-empty">
            <Search size={30} />
            <h3>No tools found</h3>
            <p>Try searching with another tool name.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <AddEditImageToolModal
          initialData={editingTool}
          onClose={closeModal}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}

export default AdminImageToolsPage;

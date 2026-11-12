
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar, { toolCatalog } from "./pages/Navbar.jsx";
import { API_USERS } from "./config/api.js";
import GuestDownloadStatus from "./components/GuestDownloadStatus.jsx";

function App() {
  const [showAllTools, setShowAllTools] = useState(false);
  const [availableTools, setAvailableTools] = useState(toolCatalog);
  const location = useLocation();
  const [activeHash, setActiveHash] = useState(() => window.location.hash);

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadToolStatuses = async () => {
      try {
        const response = await fetch(`${API_USERS}/admin/imagetools`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (!mounted || !Array.isArray(payload.data)) return;

        const recordsByRoute = new Map(payload.data.map((tool) => [tool.route, tool]));
        setAvailableTools(toolCatalog.filter((tool) => {
          const record = recordsByRoute.get(tool.route);
          return !record || (record.status === "active" && !record.isDeleted);
        }));
      } catch (error) {
        console.error("Could not load image tool statuses:", error);
      }
    };

    loadToolStatuses();
    window.addEventListener("focus", loadToolStatuses);
    return () => {
      mounted = false;
      window.removeEventListener("focus", loadToolStatuses);
    };
  }, []);

  const visibleTools = showAllTools ? availableTools : availableTools.slice(0, 4);
  const isAdminRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/superadmin");
  const requestedId = location.pathname !== "/"
    ? location.pathname.replace(/^\/+|\/+$/g, "")
    : activeHash.slice(1);
  const requestedTool = availableTools.find((tool) => tool.route.slice(1) === requestedId);
  // When a tool is selected from the navigation, render that tool on its own.
  // Keeping the home page's other tools mounted above it makes every tool
  // appear much farther down the page and forces unnecessary scrolling.
  const renderedTools = requestedTool ? [requestedTool] : visibleTools;

  useEffect(() => {
    if (!requestedTool) return;
    window.requestAnimationFrame(() => {
      document.getElementById(requestedId)?.scrollIntoView({ block: "start" });
    });
  }, [requestedId, requestedTool]);

  return (
    <>
      {!isAdminRoute && <GuestDownloadStatus />}
      <Navbar
        showAllTools={showAllTools}
        tools={availableTools}
        onToggleTools={() => setShowAllTools((shown) => !shown)}
      />
      {renderedTools.map(({ route, Component }) => (
          <section key={route} id={route.slice(1)} className="app-section">
            <Component />
          </section>
      ))}
    </>
  );
}

export default App;

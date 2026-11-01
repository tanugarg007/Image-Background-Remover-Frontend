
import { useEffect, useState } from "react";
import Navbar, { toolCatalog } from "./pages/Navbar.jsx";
import { API_USERS } from "./config/api.js";

function App() {
  const [showAllTools, setShowAllTools] = useState(false);
  const [availableTools, setAvailableTools] = useState(toolCatalog);

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

  return (
    <>
      <Navbar
        showAllTools={showAllTools}
        tools={availableTools}
        onToggleTools={() => setShowAllTools((shown) => !shown)}
      />
      {visibleTools.map(({ route, Component }) => (
          <section key={route} id={route.slice(1)} className="app-section">
            <Component />
          </section>
      ))}
    </>
  );
}

export default App;

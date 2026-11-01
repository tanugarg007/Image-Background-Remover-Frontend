import { Link } from "react-router-dom";
import {
  Download,
  LogOut,
  ShieldCheck,
  Sparkles,
  Users,
  Image,
} from "lucide-react";

function AdminSidebar({
  activeSection,
  onSectionChange,
  adminUser,
  superAdmin,
  onSignOut,
  permissions = {},
}) {
  const canViewUsers = superAdmin || permissions.viewUsers;
  const canViewRoles = superAdmin || permissions.viewRolePermissions;
  const canViewDownloads = superAdmin || permissions.viewDownloads;

  const hasManagementAccess =
    canViewUsers || canViewRoles || canViewDownloads;

  return (
    <aside className="admin-sidebar">
      {/* Brand */}
      <Link to="/" className="admin-brand">
        <span className="admin-brand-icon">
          <Sparkles size={18} />
        </span>

        <span>
          pixel<span>{superAdmin ? "platform" : "craft"}</span>
        </span>
      </Link>

      {/* Workspace */}
      <div className="admin-workspace">
        <div className="workspace-avatar">PC</div>

        <div className="workspace-copy">
          <strong>
            {superAdmin ? "Platform Console" : "Studio Console"}
          </strong>
          <span>
            {superAdmin ? "Super admin" : "Admin workspace"}
          </span>
        </div>
      </div>

   {/* Image Tools */}
<div className="admin-nav-group">
  <span className="admin-nav-label">IMAGE TOOLS</span>

  <nav className="admin-nav" aria-label="Image tools">
    <button
      type="button"
      className={activeSection === "image-tools" ? "active" : ""}
      onClick={() => onSectionChange("image-tools")}
    >
      <Image size={17} />
      <span>All Image Tools</span>
    </button>
  </nav>
</div>
      {/* Management */}
      {hasManagementAccess && (
        <div className="admin-nav-group">
          <span className="admin-nav-label">MANAGEMENT</span>

          <nav className="admin-nav" aria-label="Admin management">
            {canViewUsers && (
              <button
                type="button"
                className={activeSection === "users" ? "active" : ""}
                onClick={() => onSectionChange("users")}
              >
                <Users size={17} />
                <span>Users</span>
              </button>
            )}

            {canViewRoles && (
              <button
                type="button"
                className={activeSection === "roles" ? "active" : ""}
                onClick={() => onSectionChange("roles")}
              >
                <ShieldCheck size={17} />
                <span>Roles & Permissions</span>
              </button>
            )}

            {canViewDownloads && (
              <button
                type="button"
                className={activeSection === "downloads" ? "active" : ""}
                onClick={() => onSectionChange("downloads")}
              >
                <Download size={17} />
                <span>Downloads</span>
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Profile / Logout */}
      <button
        type="button"
        className="admin-profile"
        onClick={onSignOut}
      >
        <span className="workspace-avatar">
          {adminUser?.name?.charAt(0)?.toUpperCase() || "A"}
        </span>

        <span className="workspace-copy">
          <strong>{adminUser?.name || "Admin"}</strong>
          <span>Sign out</span>
        </span>

        <LogOut size={17} />
      </button>
    </aside>
  );
}

export default AdminSidebar;
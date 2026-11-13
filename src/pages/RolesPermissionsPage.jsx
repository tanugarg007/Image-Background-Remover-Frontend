import { useEffect, useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldCheck, Sparkles, Trash2, UserRound, Users } from "lucide-react";
import { API_USERS } from "../config/api.js";
import { showToast } from "../config/toast.js";

const builtInRoleOptions = [
  { key: "user", label: "User", description: "Standard account" },
  { key: "manager", label: "Manager", description: "Manager account" },
  { key: "admin", label: "Admin", description: "Account management" },
  { key: "superadmin", label: "Superadmin", description: "Full platform access" },
];

const permissionGroups = [
  {
    title: "Platform capabilities",
    description: "Allow this role to use Pixelcraft’s image tools and download features.",
    permissions: [
      { key: "backgroundRemoval", label: "Background remover", description: "Upload an image and save a version with its background removed." },
      { key: "backgroundChanger", label: "Background changer", description: "Replace an image background with a new color or scene." },
      { key: "imageCompressor", label: "Image compressor", description: "Reduce image file size with compression settings." },
      { key: "imageConverter", label: "Image converter", description: "Convert images to another supported file format." },
      { key: "imageCropper", label: "Image cropper", description: "Crop an image and save the result." },
      { key: "bulkImageProcessing", label: "Bulk image processing", description: "Process multiple images together and download the results." },
      { key: "imageAnalyzer", label: "Image analyzer", description: "Run image analysis and view saved analysis records." },
      { key: "imageQualityControls", label: "Quality controls", description: "Adjust image quality and export an optimized file." },
      { key: "zipDownloads", label: "Create ZIP downloads", description: "Bundle selected files into a ZIP download." },
    ],
  },
  {
    title: "User management",
    description: "Choose which account management actions this role can perform.",
    permissions: [
      { key: "viewUsers", label: "View user accounts", description: "Open the Users page and see registered account details." },
      { key: "createUsers", label: "Create user accounts", description: "Add new accounts from the Users page." },
      { key: "editUsers", label: "Edit user accounts", description: "Change a user’s name, email, and account details." },
      { key: "manageStatus", label: "Update account status", description: "Enable or disable an account." },
      { key: "manageRoles", label: "Assign roles to users", description: "Choose a role when creating or editing a user account." },
    ],
  },
  { title: "Download activity", description: "Separate a user’s own history from platform-wide download records.", permissions: [
    { key: "viewDownloadHistory", label: "View personal download history", description: "See downloads made by the signed-in account." },
    { key: "manageDownloadHistory", label: "Manage personal ZIP history", description: "Rename or remove ZIP records from the signed-in account’s history." },
    { key: "viewDownloads", label: "View all download activity", description: "Review download records across users in the admin console." },
    { key: "removeDownloads", label: "Remove download records", description: "Remove activity records from the admin console; this does not delete files." },
  ] },
  { title: "Role settings", description: "Control who can view and configure role access.", permissions: [
    { key: "viewRolePermissions", label: "View roles and permissions", description: "Open the Roles & Permissions page and review role settings." },
    { key: "manageRolePermissions", label: "Manage role permissions", description: "Change access, create custom roles, and remove unused roles." },
  ] },
];

const emptyPermissions = () => Object.fromEntries(permissionGroups.flatMap((group) => group.permissions.map(({ key }) => [key, false])));
const toolPermissions = Object.fromEntries(permissionGroups[0].permissions.map(({ key }) => [key, true]));
const initialPermissions = {
  user: { ...emptyPermissions(), ...toolPermissions, viewDownloadHistory: true, manageDownloadHistory: true },
  manager: emptyPermissions(),
  admin: { ...emptyPermissions(), ...toolPermissions, viewDownloadHistory: true, manageDownloadHistory: true, viewUsers: true, createUsers: true, editUsers: true, manageStatus: true, viewRolePermissions: true },
  superadmin: Object.fromEntries(Object.keys(emptyPermissions()).map((key) => [key, true])),
};

const roleIcons = { user: UserRound, admin: ShieldCheck, superadmin: Sparkles };

function RolesPermissionsPage({ superAdmin, users = [], loadingUsers = false, onRolesChange }) {
  const [roleOptions, setRoleOptions] = useState(builtInRoleOptions);
  const [selectedRole, setSelectedRole] = useState("");
  const [permissions, setPermissions] = useState(initialPermissions);
  const [draftPermissions, setDraftPermissions] = useState(initialPermissions);
  const [initializedRoleDrafts, setInitializedRoleDrafts] = useState(() => new Set());
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState("");

  useEffect(() => {
    if (!saveMessage) return undefined;
    const timeout = window.setTimeout(() => setSaveMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPermissions = async () => {
      setLoadingPermissions(true);
      setLoadError("");
      try {
        const response = await fetch(`${API_USERS}/admin/permissions`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not load role permissions.");
        setPermissions(data.permissions || initialPermissions);
        setDraftPermissions(data.permissions || initialPermissions);
        if (Array.isArray(data.roles)) {
          setRoleOptions(data.roles);
          onRolesChange?.(data.roles);
        }
      } catch (error) {
        if (error.name !== "AbortError") setLoadError(error.message || "Could not load role permissions.");
      } finally {
        if (!controller.signal.aborted) setLoadingPermissions(false);
      }
    };
    void loadPermissions();
    return () => controller.abort();
  }, [onRolesChange]);

  const togglePermission = (permission, allowed) => {
    setSaveError("");
    setSaveMessage("");
    setDraftPermissions((current) => ({
      ...current,
      [selectedRole]: { ...current[selectedRole], [permission]: allowed },
    }));
  };

  const addRole = async (event) => {
    event.preventDefault();
    if (!newRoleName.trim() || creatingRole) return;
    setCreatingRole(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const response = await fetch(`${API_USERS}/admin/roles`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not create role.");
      setRoleOptions(data.roles || builtInRoleOptions);
      onRolesChange?.(data.roles || builtInRoleOptions);
      setPermissions(data.permissions || initialPermissions);
      setDraftPermissions(data.permissions || initialPermissions);
      setSelectedRole(data.role.key);
      setInitializedRoleDrafts((current) => new Set(current).add(data.role.key));
      setNewRoleName("");
      setRoleFormOpen(false);
      showToast("success", "Role created", `${data.role.label} is ready to configure.`);
    } catch (error) {
      const message = error.message || "Could not create role.";
      setSaveError(message);
      showToast("error", "Role creation failed", message);
    } finally {
      setCreatingRole(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedRole || !canEditPermissions || !hasUnsavedChanges) return;
    setSavingKey(selectedRole);
    setSaveError("");
    setSaveMessage("");
    try {
      const response = await fetch(`${API_USERS}/admin/permissions`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, permissions: draftPermissions[selectedRole] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update role permission.");
      setPermissions(data.permissions || initialPermissions);
      setDraftPermissions(data.permissions || initialPermissions);
      setSaveMessage("Permissions saved.");
      const roleLabel = roleOptions.find((role) => role.key === selectedRole)?.label || selectedRole;
      showToast("success", "Permissions updated", `${roleLabel} permissions were saved.`);
    } catch (error) {
      const message = error.message || "Could not update role permission.";
      setSaveError(message);
      showToast("error", "Permission update failed", message);
    } finally {
      setSavingKey("");
    }
  };

  const removeRole = async (role) => {
    if (deletingRole || loadingUsers || users.some((user) => user.role === role.key)) return;
    if (!window.confirm(`Delete the ${role.label} role? This action cannot be undone.`)) return;

    setDeletingRole(role.key);
    setSaveError("");
    setSaveMessage("");
    try {
      const response = await fetch(`${API_USERS}/admin/roles/${encodeURIComponent(role.key)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Could not delete the ${role.label} role.`);
      const nextRoles = data.roles || builtInRoleOptions;
      setRoleOptions(nextRoles);
      onRolesChange?.(nextRoles);
      setPermissions(data.permissions || initialPermissions);
      setDraftPermissions(data.permissions || initialPermissions);
      if (selectedRole === role.key) setSelectedRole("");
      showToast("success", "Role deleted", `${role.label} was removed.`);
    } catch (error) {
      const message = error.message || `Could not delete the ${role.label} role.`;
      setSaveError(message);
      showToast("error", "Role deletion failed", message);
    } finally {
      setDeletingRole("");
    }
  };

  const selectedRoleInfo = roleOptions.find((role) => role.key === selectedRole);
  const assignedUsers = users.filter((user) => user.role === selectedRole);
  const canEditPermissions = Boolean(selectedRole) && superAdmin && !loadingPermissions && !loadError && !savingKey;
  const hasUnsavedChanges = Boolean(selectedRole) && JSON.stringify(permissions[selectedRole]) !== JSON.stringify(draftPermissions[selectedRole]);

  return (
    <div className="role-settings-layout">
      <section className="admin-card role-settings-main" aria-label="Role details and permissions">
        <div className="role-settings-header">
          <div className="role-settings-header-icon"><LockKeyhole size={18} /></div>
          <div><span>ACCESS CONTROL</span><h2>Role details</h2></div>
          <span className="role-settings-total">{permissionGroups.reduce((count, group) => count + group.permissions.length, 0)} permissions</span>
          {superAdmin && <button type="button" className="role-create-toggle" onClick={() => setRoleFormOpen((current) => !current)}>{roleFormOpen ? "Cancel" : "+ Create role"}</button>}
        </div>

        {roleFormOpen && <form className="role-create-form" onSubmit={addRole}>
          <label htmlFor="new-role-name">New role name</label>
          <input id="new-role-name" value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} maxLength={40} placeholder="e.g. Content manager" autoFocus required />
          <button type="submit" disabled={!newRoleName.trim() || creatingRole}>{creatingRole ? "Creating..." : "Create role"}</button>
        </form>}

        <div className="role-catalog">
          <div className="role-catalog-heading"><strong>Roles</strong><span>Select a role to edit permissions</span></div>
          <label className="role-picker-control">
            <span className="role-picker-icon"><ShieldCheck size={16} /></span>
            <select
              value={selectedRole}
              aria-label="Select a role"
              onChange={(event) => {
                const roleKey = event.target.value;
                setSelectedRole(roleKey);
                setSaveError("");
                setSaveMessage("");
                if (roleKey && !initializedRoleDrafts.has(roleKey)) {
                  setDraftPermissions((current) => ({ ...current, [roleKey]: emptyPermissions() }));
                  setInitializedRoleDrafts((current) => new Set(current).add(roleKey));
                }
              }}
            >
              <option value="">Select role</option>
              {roleOptions.map((role) => <option value={role.key} key={role.key}>{role.label}</option>)}
            </select>
            <span className="role-picker-chevron" aria-hidden="true" />
          </label>
          {selectedRoleInfo && (() => {
            const RoleIcon = roleIcons[selectedRoleInfo.key] || UserRound;
            const roleAssignedCount = users.filter((user) => user.role === selectedRoleInfo.key).length;
            const isProtected = selectedRoleInfo.key === "user" || selectedRoleInfo.key === "superadmin";
            return <div className="role-selected-summary">
              <span className={`role-catalog-icon role-name-${selectedRoleInfo.key}`}><RoleIcon size={15} /></span>
              <span className="role-catalog-copy"><strong>{selectedRoleInfo.label}</strong><small>{selectedRoleInfo.description}</small></span>
              <span className="role-catalog-count">{loadingUsers ? "…" : `${roleAssignedCount} assigned`}</span>
              {isProtected ? <span className={`role-catalog-badge ${selectedRoleInfo.key === "superadmin" ? "is-protected" : ""}`}>{selectedRoleInfo.key === "user" ? "Default role" : "Protected"}</span> : <button
                type="button"
                className="role-delete-button"
                onClick={() => void removeRole(selectedRoleInfo)}
                disabled={!superAdmin || Boolean(deletingRole) || loadingUsers}
                title={!superAdmin ? "Only a superadmin can delete roles" : roleAssignedCount > 0 ? "Reassign users before deleting this role" : `Delete ${selectedRoleInfo.label} role`}
                aria-label={`Delete ${selectedRoleInfo.label} role`}
              ><Trash2 size={13} />{deletingRole === selectedRoleInfo.key ? "Deleting…" : "Delete"}</button>}
            </div>;
          })()}
        </div>

        {loadError && <p className="admin-error role-settings-error" role="alert">{loadError}</p>}
        {saveError && <p className="admin-error role-settings-error" role="alert">{saveError}</p>}

        {!selectedRole && <div className="role-permission-unselected-note"><ShieldCheck size={15} /><span>Select a role above to edit these permissions. They’re all unchecked until a role is selected.</span></div>}
        {permissionGroups.map((group) => (
          <section className="role-permission-group" key={group.title} aria-label={group.title}>
            <div className="role-permission-group-heading"><div><h3>{group.title}</h3><p>{group.description}</p></div><span>{selectedRole ? `${group.permissions.filter(({ key }) => draftPermissions[selectedRole]?.[key]).length}/${group.permissions.length} selected` : `0/${group.permissions.length} selected`}</span></div>
            <div className="role-permission-grid">
              {group.permissions.map(({ key, label, description }) => {
                const checked = selectedRole ? Boolean(draftPermissions[selectedRole]?.[key]) : false;
                return <label className={`role-permission-option ${checked ? "is-enabled" : ""} ${canEditPermissions ? "" : "is-disabled"}`} key={key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canEditPermissions}
                    onChange={(event) => togglePermission(key, event.target.checked)}
                    aria-label={`${label}${selectedRoleInfo ? ` for ${selectedRoleInfo.label}` : " (select a role first)"}`}
                  />
                  <span className="role-permission-check" aria-hidden="true">{checked ? "✓" : ""}</span>
                  <span className="role-permission-copy"><strong>{label}</strong><small>{description}</small></span>
                </label>;
              })}
            </div>
          </section>
        ))}

        <div className="role-settings-footer">
          <span>{!selectedRole ? "Choose a role to continue." : loadingPermissions ? "Loading permissions..." : hasUnsavedChanges ? "You have unsaved changes." : superAdmin ? "Permissions are up to date." : "Only a superadmin can change permissions."}</span>
          {savingKey && <span className="role-saving-indicator">Saving...</span>}
          {saveMessage && <p className="admin-success role-settings-success" role="status"><CheckCircle2 size={17} /><span>{saveMessage}</span></p>}
          {selectedRole && superAdmin && <button type="button" className="role-save-button" onClick={savePermissions} disabled={!canEditPermissions || !hasUnsavedChanges}>{savingKey === selectedRole ? "Saving..." : "Save permissions"}</button>}
        </div>
      </section>

      <aside className="admin-card assigned-users-card" aria-label="Users assigned to this role">
        <div className="assigned-users-heading">
          <span className="assigned-users-icon"><Users size={17} /></span>
          <div><h2>Assigned users</h2><p>Accounts with this role</p></div>
          <span className="assigned-users-count">{!selectedRole ? "—" : loadingUsers ? "…" : assignedUsers.length}</span>
        </div>
        <div className="assigned-users-role">{selectedRoleInfo ? <span className={`role-pill role-${selectedRole}`}>{selectedRoleInfo.label}</span> : <span className="assigned-users-no-role">No role selected</span>}<span>{!selectedRole ? "Select a role" : loadingUsers ? "Loading accounts" : `${assignedUsers.length} assigned`}</span></div>
        {!selectedRole ? <div className="assigned-users-empty"><UserRound size={22} /><span>Select a role to view assigned users.</span></div> : loadingUsers ? <p className="assigned-users-empty">Loading users…</p> : assignedUsers.length ? (
          <ul className="assigned-users-list">
            {assignedUsers.map((user) => <li key={user.id}>
              <span className="assigned-user-avatar">{user.email?.slice(0, 1).toUpperCase() || "U"}</span>
              <span className="assigned-user-copy"><strong title={user.email}>{user.email}</strong><small>{user.status || "active"}</small></span>
              <span className={`assigned-user-status ${user.status === "disabled" ? "is-disabled" : ""}`} />
            </li>)}
          </ul>
        ) : <div className="assigned-users-empty"><UserRound size={22} /><span>No users assigned to this role.</span></div>}
        <p className="assigned-users-note">Change a user’s role from the Users page.</p>
      </aside>
    </div>
  );
}

export default RolesPermissionsPage;

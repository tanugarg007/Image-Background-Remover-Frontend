import { useEffect, useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { API_USERS } from "../config/api.js";

const builtInRoleOptions = [
  { key: "user", label: "User", description: "Standard account" },
  { key: "manager", label: "Manager", description: "Manager account" },
  { key: "admin", label: "Admin", description: "Account management" },
  { key: "superadmin", label: "Superadmin", description: "Full platform access" },
];

const permissionGroups = [
  {
    title: "Platform capabilities",
    description: "Choose which image and file workflows this role can use.",
    permissions: [
      { key: "backgroundRemoval", label: "Use background remover" },
      { key: "backgroundChanger", label: "Use background changer" },
      { key: "imageCompressor", label: "Use image compressor" },
      { key: "imageConverter", label: "Use image converter" },
      { key: "imageCropper", label: "Use image cropper" },
      { key: "bulkImageProcessing", label: "Use bulk image processing" },
      { key: "imageAnalyzer", label: "Use image analyzer" },
      { key: "imageQualityControls", label: "Use image quality controls" },
      { key: "zipDownloads", label: "Create ZIP downloads" },
    ],
  },
  {
    title: "User management",
    description: "Control account visibility and account changes.",
    permissions: [
      { key: "viewUsers", label: "View user accounts" },
      { key: "createUsers", label: "Create user accounts" },
      { key: "editUsers", label: "Edit user accounts" },
      { key: "manageStatus", label: "Update account status" },
      { key: "manageRoles", label: "Assign roles to users" },
    ],
  },
  { title: "Download activity", description: "Control access to user download records.", permissions: [
    { key: "viewDownloadHistory", label: "View personal download history" },
    { key: "manageDownloadHistory", label: "Rename and remove saved ZIP history" },
    { key: "viewDownloads", label: "View download activity" },
    { key: "removeDownloads", label: "Remove download records" },
  ] },
  { title: "Role settings", description: "Control access to role and permission settings.", permissions: [
    { key: "viewRolePermissions", label: "View role permissions" },
    { key: "manageRolePermissions", label: "Change role permissions" },
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
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleFormOpen, setRoleFormOpen] = useState(false);

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
      setNewRoleName("");
      setRoleFormOpen(false);
      setSaveMessage(`${data.role.label} role created. Choose its permissions, then save.`);
    } catch (error) {
      setSaveError(error.message || "Could not create role.");
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
      const roleLabel = roleOptions.find((role) => role.key === selectedRole)?.label || selectedRole;
      setSelectedRole("");
      setSaveMessage(`${roleLabel} permissions saved successfully.`);
    } catch (error) {
      setSaveError(error.message || "Could not update role permission.");
    } finally {
      setSavingKey("");
    }
  };

  const selectedRoleInfo = roleOptions.find((role) => role.key === selectedRole);
  const SelectedRoleIcon = selectedRole ? roleIcons[selectedRole] || UserRound : null;
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

        <div className="role-details-field">
          <label htmlFor="role-name">Role name</label>
          <div className={`role-name-control role-name-${selectedRole}`}>
            {SelectedRoleIcon && <span className="role-name-icon"><SelectedRoleIcon size={16} /></span>}
            <select id="role-name" value={selectedRole} onChange={(event) => {
              const role = event.target.value;
              setSelectedRole(role);
              setSaveError("");
              setSaveMessage("");
              if (role && superAdmin) {
                setDraftPermissions((current) => ({ ...current, [role]: emptyPermissions() }));
              }
            }}>
              <option value="">Select a role</option>
              {roleOptions.map((role) => <option value={role.key} key={role.key}>{role.label}</option>)}
            </select>
            <span className="role-name-description">{selectedRoleInfo?.description || "Choose a role to view its permissions"}</span>
          </div>
        </div>

        {loadError && <p className="admin-error role-settings-error" role="alert">{loadError}</p>}
        {saveError && <p className="admin-error role-settings-error" role="alert">{saveError}</p>}

        {permissionGroups.map((group) => (
          <section className="role-permission-group" key={group.title} aria-label={group.title}>
            <div className="role-permission-group-heading"><div><h3>{group.title}</h3><p>{group.description}</p></div><span>{group.permissions.length}</span></div>
            <div className="role-permission-grid">
              {group.permissions.map(({ key, label }) => {
                const checked = Boolean(draftPermissions[selectedRole]?.[key]);
                return <label className={`role-permission-option ${checked ? "is-enabled" : ""} ${canEditPermissions ? "" : "is-disabled"}`} key={key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canEditPermissions}
                    onChange={(event) => togglePermission(key, event.target.checked)}
                    aria-label={`${label}${selectedRoleInfo ? ` for ${selectedRoleInfo.label}` : " (select a role first)"}`}
                  />
                  <span className="role-permission-check" aria-hidden="true">{checked ? "✓" : ""}</span>
                  <span className="role-permission-label">{label}</span>
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

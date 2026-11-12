import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";

import AdminSidebar from "./AdminSidebar.jsx";
import UsersPage from "./UsersPage.jsx";
import RolesPermissionsPage from "./RolesPermissionsPage.jsx";
import AdminDownloadsPage from "./AdminDownloadsPage.jsx";
import AdminFinancePage from "./AdminFinancePage.jsx";
import UserAccountForm from "./UserAccountForm.jsx";
import AdminImageToolsPage from "./AdminImageToolsPage.jsx";
import "./AdminPanel.css";
import { API_USERS } from "../config/api.js";
import { showToast } from "../config/toast.js";
function AdminPanel({ superAdmin = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [access, setAccess] = useState("checking");
  const [adminUser, setAdminUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, admins: 0, roleCounts: { user: 0, admin: 0, superadmin: 0 } });
  const [availableRoles, setAvailableRoles] = useState([
    { key: "user", label: "User" },
    { key: "manager", label: "Manager" },
    { key: "admin", label: "Admin" },
    { key: "superadmin", label: "Superadmin" },
  ]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  const [roleError, setRoleError] = useState("");
  const [accountDialog, setAccountDialog] = useState(null);
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "", role: "user", status: "active" });
  const [savingAccount, setSavingAccount] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const adminBasePath = superAdmin ? "/superadmin" : "/admin";
  const requestedSection =
    location.pathname.slice(adminBasePath.length).split("/").filter(Boolean)[0] ||
    "users";
  const validSections = ["users", "roles", "downloads", "finance", "image-tools"];
  const activeSection =
    validSections.includes(requestedSection) &&
    (requestedSection !== "finance" || superAdmin)
      ? requestedSection
      : "users";

  const changeSection = (section) => {
    navigate(section === "users" ? adminBasePath : `${adminBasePath}/${section}`);
  };

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoadingUsers(true);
      setError("");
      let hasAdminAccess = false;
      try {
        const currentResponse = await fetch(`${API_USERS}/me`, {
          credentials: "include",
          signal: controller.signal,
        });
        const currentData = await currentResponse.json().catch(() => ({}));
        if (!currentResponse.ok || !currentData.user) {
          setAccess("signed-out");
          return;
        }

      
        const userRole = String(currentData.user.role || "")
  .trim()
  .toLowerCase();

const isSuperAdmin = userRole === "superadmin";
const isAdmin = userRole === "admin";

if (superAdmin ? !isSuperAdmin : !(isAdmin || isSuperAdmin)) {
  setAccess("forbidden");
  return;
}
        setAdminUser(currentData.user);
        setCanManageUsers(isAdmin || isSuperAdmin);
        setAccess("admin");
        hasAdminAccess = true;

        const usersResponse = await fetch(`${API_USERS}/admin/users`, {
          credentials: "include",
          signal: controller.signal,
        });
        const usersData = await usersResponse.json().catch(() => ({}));
        if (!usersResponse.ok) {
          throw new Error(usersData.message || "Could not load accounts.");
        }
        setUsers(usersData.users || []);
        setSummary({
          total: usersData.total || 0,
          admins: usersData.admins || 0,
          roleCounts: usersData.roleCounts || { user: 0, admin: 0, superadmin: 0 },
        });
        const rolesResponse = await fetch(`${API_USERS}/admin/permissions`, {
          credentials: "include",
          signal: controller.signal,
        });
        const rolesData = await rolesResponse.json().catch(() => ({}));
        if (rolesResponse.ok && Array.isArray(rolesData.roles)) setAvailableRoles(rolesData.roles);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          if (!hasAdminAccess) setAccess("error");
          else setError(requestError instanceof Error ? requestError.message : "Could not load accounts.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingUsers(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [superAdmin, reloadKey]);

  const signOut = async () => {
    try {
      await fetch(`${API_USERS}/logout`, { method: "POST", credentials: "include" });
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const openCreateAccount = () => {
    setRoleError("");
    setRoleMessage("");
    setAccountForm({ name: "", email: "", password: "", role: superAdmin ? "" : "user", status: "active" });
    setAccountDialog({ mode: "create" });
  };

  const openEditAccount = (user) => {
    setRoleError("");
    setRoleMessage("");
    setAccountForm({ name: user.name || "", email: user.email, password: "", role: user.role, status: user.status || "active" });
    setAccountDialog({ mode: "edit", user });
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!accountDialog) return;
    setSavingAccount(true);
    setRoleMessage("");
    setRoleError("");
    try {
      const isCreate = accountDialog.mode === "create";
      const response = await fetch(
        isCreate ? `${API_USERS}/admin/users` : `${API_USERS}/admin/users/${encodeURIComponent(accountDialog.user.id)}`,
        {
        method: isCreate ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountForm.name,
          email: accountForm.email,
          ...(isCreate ? { password: accountForm.password } : {}),
          role: accountForm.role,
          status: accountForm.status,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not save account.");

      if (isCreate) {
        setUsers((current) => [data.user, ...current]);
        setSummary((current) => ({
          total: current.total + 1,
          admins: current.admins + Number(["admin", "superadmin"].includes(data.user.role)),
          roleCounts: { ...current.roleCounts, [data.user.role]: (current.roleCounts[data.user.role] || 0) + 1 },
        }));
        showToast("success", "User created successfully", `${data.user.name || "New user"} · ${data.user.email}`);
      } else {
        const oldUser = accountDialog.user;
        setUsers((current) => current.map((item) => item.id === oldUser.id ? data.user : item));
        setSummary((current) => ({
          ...current,
          admins: current.admins + Number(["admin", "superadmin"].includes(data.user.role)) - Number(["admin", "superadmin"].includes(oldUser.role)),
          roleCounts: {
            ...current.roleCounts,
            [oldUser.role]: Math.max(0, (current.roleCounts[oldUser.role] || 0) - 1),
            [data.user.role]: (current.roleCounts[data.user.role] || 0) + Number(data.user.role !== oldUser.role),
          },
        }));
        showToast("success", "Account updated", data.user.email);
      }
      setAccountDialog(null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not save account.";
      setRoleError(message);
      showToast("error", "Account save failed", message);
    } finally {
      setSavingAccount(false);
    }
  };

  const deleteAccount = async (user) => {
    setDeletingUserId(user.id);
    setRoleMessage("");
    setRoleError("");
    try {
      const response = await fetch(`${API_USERS}/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not delete account.");

      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSummary((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
        admins: Math.max(0, current.admins - Number(["admin", "superadmin"].includes(user.role))),
        roleCounts: {
          ...current.roleCounts,
          [user.role]: Math.max(0, (current.roleCounts[user.role] || 0) - 1),
        },
      }));
      showToast("success", "Account deleted", user.email);
      setAccountToDelete(null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not delete account.";
      setRoleError(message);
      showToast("error", "Account deletion failed", message);
    } finally {
      setDeletingUserId("");
    }
  };

  const confirmAccountDelete = () => {
    if (accountToDelete && !deletingUserId) void deleteAccount(accountToDelete);
  };

  useEffect(() => {
    if (!accountToDelete || deletingUserId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountToDelete(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountToDelete, deletingUserId]);

  if (access === "checking") {
    return <main className="admin-gate"><div className="admin-gate-card"><span className="admin-gate-mark"><Sparkles size={20} /></span><p>Checking administrator access…</p></div></main>;
  }

  if (access !== "admin") {
    const message = access === "forbidden"
      ? "This account does not have the required administrator role."
      : access === "error"
        ? "Could not connect to the account service. Please try again."
        : "Sign in with an administrator account to continue.";
    return (
      <main className="admin-gate">
        <div className="admin-gate-card">
          <span className="admin-gate-mark"><ShieldCheck size={20} /></span>
          <p>{message}</p>
          <Link to={access === "forbidden" ? "/" : "/login"}>{access === "forbidden" ? "Back to home" : "Go to sign in"}</Link>
        </div>
      </main>
    );
  }

  const filteredUsers = users.filter((user) =>
    `${user.email} ${user.role}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <div className="admin-shell">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={changeSection}
        adminUser={adminUser}
        superAdmin={superAdmin}
        onSignOut={signOut}
      />

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="breadcrumb"><span>Console</span><span>/</span><strong>{activeSection === "image-tools" ? "Image Tools" : activeSection === "users" ? "Users" : activeSection === "roles" ? "Roles" : activeSection === "finance" ? "Finance" : "Downloads"}</strong></div>
          <div className="topbar-user"><span className="topbar-avatar">{adminUser?.email?.slice(0, 1).toUpperCase() || "A"}</span><span>{superAdmin ? "Super admin" : "Admin"}</span></div>
        </header>

        <div className={`admin-content ${activeSection === "roles" ? "admin-content-roles" : ""}`}>
          <section className={`admin-welcome ${activeSection === "roles" ? "roles-welcome" : ""}`}>
            <div>
              <span className="admin-kicker"><span /> {superAdmin ? "SUPER ADMIN" : "ADMIN"}</span>
             <h1>
  {activeSection === "image-tools" ? (
    <>Image <em>tools</em></>
  ) : activeSection === "users" ? (
    <>User <em>management</em></>
  ) : activeSection === "roles" ? (
    <>Roles & <em>permissions</em></>
  ) : activeSection === "finance" ? (
    <>Finance <em>overview</em></>
  ) : (
    <>Download <em>activity</em></>
  )}
</h1>
             <p>
  {activeSection === "image-tools"
    ? "Explore and manage all available image processing tools."
    : activeSection === "users"
      ? "View registered accounts and manage their access."
      : activeSection === "roles"
        ? "Set clear access across your workspace."
        : activeSection === "finance"
          ? "Review the finance tools and billing data available to this workspace."
        : "Review who downloaded files, which tools they used, and when."}
</p>
            </div>
           {!(["image-tools", "finance"].includes(activeSection)) && (
  <button
    className="refresh-button"
    onClick={() => setReloadKey((key) => key + 1)}
    disabled={loadingUsers}
  >
    <RefreshCw
      size={15}
      className={loadingUsers ? "is-spinning" : ""}
    />
    Refresh
  </button>
)}
          </section>

 {activeSection === "image-tools" ? (
  <AdminImageToolsPage />
) : activeSection === "roles" ? (
  <RolesPermissionsPage
    superAdmin={superAdmin}
    users={users}
    loadingUsers={loadingUsers}
    onRolesChange={setAvailableRoles}
  />
) : activeSection === "downloads" ? (
  <AdminDownloadsPage reloadKey={reloadKey} />
) : activeSection === "finance" && superAdmin ? (
  <AdminFinancePage />
) : (
  <UsersPage
    users={users}
    summary={summary}
    loadingUsers={loadingUsers}
    error={error}
    roleError={roleError}
    roleMessage={roleMessage}
    canManageUsers={canManageUsers}
    adminUser={adminUser}
    superAdmin={superAdmin}
    deletingUserId={deletingUserId}
    search={search}
    setSearch={setSearch}
    filteredUsers={filteredUsers}
    openCreateAccount={openCreateAccount}
    openEditAccount={openEditAccount}
    deleteAccount={setAccountToDelete}
  />
)}      <footer className="admin-footer"><span>© 2026 Pixelcraft</span><span>Account data is loaded from MongoDB</span></footer>
        </div>
      </main>

      <UserAccountForm
        accountDialog={accountDialog}
        setAccountDialog={setAccountDialog}
        accountForm={accountForm}
        roles={availableRoles}
        setAccountForm={setAccountForm}
        savingAccount={savingAccount}
        saveAccount={saveAccount}
        roleError={roleError}
        superAdmin={superAdmin}
      />
      {accountToDelete && (
        <div className="account-delete-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingUserId) setAccountToDelete(null); }}>
          <section className="account-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-delete-title" aria-describedby="account-delete-description">
            <button className="account-delete-close" type="button" onClick={() => setAccountToDelete(null)} disabled={Boolean(deletingUserId)} aria-label="Close confirmation"><X size={17} /></button>
            <span className="account-delete-icon"><AlertTriangle size={23} /></span>
            <span className="account-delete-eyebrow">DELETE ACCOUNT</span>
            <h2 id="account-delete-title">Delete this user?</h2>
            <p id="account-delete-description">The account for <strong>{accountToDelete.email}</strong> will be permanently deleted. This action cannot be undone.</p>
            <div className="account-delete-actions">
              <button type="button" className="account-delete-cancel" onClick={() => setAccountToDelete(null)} disabled={Boolean(deletingUserId)}>Cancel</button>
              <button type="button" className="account-delete-confirm" onClick={confirmAccountDelete} disabled={Boolean(deletingUserId)}><Trash2 size={15} />{deletingUserId ? "Deleting…" : "Delete account"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;

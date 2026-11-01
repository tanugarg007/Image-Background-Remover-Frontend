import { ArrowUpRight, Pencil, Plus, Search, UserRound } from "lucide-react";

function UsersPage({
  users,
  summary,
  loadingUsers,
  error,
  roleError,
  roleMessage,
  canManageUsers,
  search,
  setSearch,
  filteredUsers,
  openCreateAccount,
  openEditAccount,
}) {
  return (
    <>
      <section className="summary-grid" aria-label="Account summary">
        <article className="summary-card"><span className="summary-icon summary-icon-purple"><UserRound size={18} /></span><div><span>Total accounts</span><strong>{loadingUsers ? "—" : summary.total}</strong></div></article>
        <article className="summary-card"><span className="summary-icon summary-icon-blue"><UserRound size={18} /></span><div><span>Admin accounts</span><strong>{loadingUsers ? "—" : summary.admins}</strong></div></article>
      </section>

      <section className="admin-card users-card">
        <div className="users-heading">
          <div><h2>Users</h2><p>User details, role, status, and account actions</p></div>
          <label className="admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email or role" /></label>
          {canManageUsers && <button className="create-user-button" onClick={openCreateAccount}><Plus size={15} /> Add user</button>}
        </div>

        {error && <p className="admin-error" role="alert">{error}</p>}
        {roleError && <p className="admin-error" role="alert">{roleError}</p>}
        {roleMessage && <p className="admin-success" role="status">{roleMessage}</p>}
        <div className="users-table-wrap">
          <table className="users-table">
            <thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td><div className="user-cell"><span className="user-avatar"><UserRound size={15} /></span><div className="user-identity"><strong>{user.name || user.email}</strong><small>{user.email}</small></div></div></td>
                  <td><span className={`role-pill role-${user.role}`}>{user.role}</span></td>
                  <td><span className={`status-pill status-${user.status || "active"}`}>{user.status || "active"}</span></td>
                  <td className="joined-date">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                  <td>{canManageUsers ? <button className="edit-user-button" onClick={() => openEditAccount(user)}><Pencil size={13} /> Edit</button> : <span className="no-action">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadingUsers && !error && filteredUsers.length === 0 && <p className="empty-search">No accounts found.</p>}
          {loadingUsers && <p className="empty-search">Loading accounts from MongoDB…</p>}
        </div>
        <div className="table-footer"><span>All user accounts</span><span>{filteredUsers.length} shown <ArrowUpRight size={13} /></span></div>
      </section>

    </>
  );
}

export default UsersPage;

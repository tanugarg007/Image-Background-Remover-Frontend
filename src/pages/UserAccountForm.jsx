import { X } from "lucide-react";

function UserAccountForm({
  accountDialog,
  setAccountDialog,
  accountForm,
  roles = [],
  setAccountForm,
  savingAccount,
  saveAccount,
  roleError,
  superAdmin,
}) {
  if (!accountDialog) return null;

  const closeForm = () => {
    if (!savingAccount) setAccountDialog(null);
  };

  return (
    <div className="account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <div className="account-modal-heading">
          <div>
            <span className="admin-kicker"><span /> USER MANAGEMENT</span>
            <h2 id="account-modal-title">{accountDialog.mode === "create" ? "Create user" : "Edit user"}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={closeForm}><X size={18} /></button>
        </div>
        <form onSubmit={saveAccount}>
          <label className="modal-field">
            <span>Full name</span>
            <input type="text" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" minLength={1} maxLength={80} required />
          </label>
          <label className="modal-field">
            <span>Email address</span>
            <input type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" required />
          </label>
          {accountDialog.mode === "create" && <label className="modal-field">
            <span>Temporary password</span>
            <input type="password" value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" minLength={8} maxLength={128} required />
            <small>At least 8 characters</small>
          </label>}
          <label className="modal-field">
            <span>Role</span>
            <select value={accountForm.role} onChange={(event) => setAccountForm((current) => ({ ...current, role: event.target.value }))} disabled={!superAdmin} required>
              {accountDialog.mode === "create" && superAdmin && <option value="" disabled>Select role</option>}
              {roles.map((role) => <option value={role.key} key={role.key}>{role.label}</option>)}
            </select>
          </label>
          <label className="modal-field">
            <span>Status</span>
            <select value={accountForm.status} onChange={(event) => setAccountForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          {roleError && <p className="admin-error" role="alert">{roleError}</p>}
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={closeForm} disabled={savingAccount}>Cancel</button>
            <button type="submit" className="modal-save" disabled={savingAccount}>{savingAccount ? "Saving…" : accountDialog.mode === "create" ? "Create user" : "Save changes"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default UserAccountForm;

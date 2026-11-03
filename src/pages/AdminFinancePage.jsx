import { CreditCard, DollarSign, Receipt } from "lucide-react";

function AdminFinancePage() {
  return (
    <section className="admin-finance-card" aria-label="Finance overview">
      <div className="admin-finance-heading">
        <span className="admin-finance-icon"><DollarSign size={19} /></span>
        <div>
          <span className="admin-finance-eyebrow">FINANCE</span>
          <h2>Billing data is not configured</h2>
          <p>This project does not currently record payments, subscriptions, invoices, or expenses.</p>
        </div>
      </div>
      <div className="admin-finance-status-grid">
        <article><CreditCard size={17} /><span><strong>Payments</strong><small>No payment provider connected</small></span></article>
        <article><Receipt size={17} /><span><strong>Transactions</strong><small>No transaction records available</small></span></article>
      </div>
      <p className="admin-finance-note">Financial totals will appear here once the application has a billing or finance data source.</p>
    </section>
  );
}

export default AdminFinancePage;

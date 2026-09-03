import React, { useEffect, useMemo, useState } from "react";
import {
  Home,
  ReceiptIndianRupee,
  BarChart3,
  Users,
  Plus,
  Receipt,
  Wallet,
  Lock,
  KeyRound,
  LogOut,
  Eye,
  Smartphone,
  X,
  Check,
  CreditCard,
  Zap,
  Droplets,
  Armchair,
  Truck,
  Car,
  Utensils,
  ShoppingBag,
  House,
  Refrigerator,
  Wrench,
  HeartPulse,
  BookOpen,
  MoreHorizontal,
  Search,
  CalendarDays,
  Download,
  Edit3,
  Trash2,
  WalletCards,
  TrendingUp,
} from "lucide-react";
import "./styles.css";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://YOUR_PROJECT.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "expenses", label: "Expenses", icon: ReceiptIndianRupee },
  { id: "summary", label: "Summary", icon: BarChart3 },
  { id: "persons", label: "Persons", icon: Users },
];

const categoryIcons = {
  EMI: CreditCard,
  Electricity: Zap,
  Water: Droplets,
  Furniture: Armchair,
  Transport: Truck,
  Petrol: Car,
  Food: Utensils,
  Shopping: ShoppingBag,
  House: House,
  Appliance: Refrigerator,
  Repair: Wrench,
  Medical: HeartPulse,
  Education: BookOpen,
  Other: MoreHorizontal,
};

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(value) {
  if (!value) return "-";

  const d = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/* -------------------------------------------------------
   Persistent owner login
------------------------------------------------------- */

function readOwnerCredentials() {
  try {
    let saved = localStorage.getItem("dreamhome_credentials");

    /*
      Migrate an old sessionStorage login to localStorage
      automatically, so an already logged-in owner does not
      immediately lose access after this update.
    */
    if (!saved) {
      const oldSession = sessionStorage.getItem("dreamhome_credentials");

      if (oldSession) {
        localStorage.setItem("dreamhome_credentials", oldSession);
        saved = oldSession;
      }
    }

    if (!saved) return null;

    const parsed = JSON.parse(saved);

    if (!parsed?.username || !parsed?.password) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------
   Supabase helpers
------------------------------------------------------- */

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error_description ||
      data?.error ||
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

async function callRpc(functionName, body) {
  return supabaseRequest(`/rest/v1/rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* -------------------------------------------------------
   Generic UI
------------------------------------------------------- */

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal-card ${wide ? "modal-wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="page-kicker">DREAM HOME</span>
            <h2>{title}</h2>
          </div>

          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Receipt, title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} />
      </div>

      <h3>{title}</h3>
      <p>{text}</p>

      {action}
    </div>
  );
}

/* -------------------------------------------------------
   Login
------------------------------------------------------- */

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      /*
        Keep the current owner authentication method.
        The credentials are also stored in localStorage after
        successful login so the owner remains logged in.
      */
      const data = await callRpc("owner_login", {
        p_username: username.trim(),
        p_password: password,
      });

      const valid =
        data === true ||
        data?.ok === true ||
        data?.success === true ||
        data?.authenticated === true ||
        (Array.isArray(data) && data[0]?.ok === true);

      if (!valid) {
        throw new Error("Invalid username or password.");
      }

      const credentials = {
        username: username.trim(),
        password,
      };

      localStorage.setItem(
        "dreamhome_credentials",
        JSON.stringify(credentials)
      );

      localStorage.setItem("dreamhome_owner", "true");

      onLogin(credentials);
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Owner Login" onClose={onClose}>
      <form onSubmit={submit} className="form-stack">
        <div className="login-intro">
          <div className="login-icon">
            <Lock size={21} />
          </div>

          <div>
            <b>Owner access</b>
            <span>
              Login once and this device will stay logged in until you
              choose Logout.
            </span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <label className="field">
          <span>Username</span>
          <div className="input-wrap">
            <KeyRound size={16} />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Owner username"
              autoComplete="username"
            />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <div className="input-wrap">
            <Lock size={16} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Owner password"
              autoComplete="current-password"
            />
          </div>
        </label>

        <button className="primary full" disabled={busy}>
          {busy ? "Signing in..." : "Login"}
        </button>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------
   Person modal
------------------------------------------------------- */

function PersonModal({
  person,
  credentials,
  onClose,
  onSaved,
}) {
  const isNew = !person || person === "new";

  const [name, setName] = useState(isNew ? "" : person.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setError("Please enter the person's name.");
      return;
    }

    if (!credentials?.username || !credentials?.password) {
      setError("Owner login is missing. Please login again.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (isNew) {
        await callRpc("owner_add_person", {
          p_username: credentials.username,
          p_password: credentials.password,
          p_name: cleanName,
        });
      } else {
        await callRpc("owner_update_person", {
          p_username: credentials.username,
          p_password: credentials.password,
          p_id: person.id,
          p_name: cleanName,
        });
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Unable to save person.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add Person" : "Edit Person"}
      onClose={onClose}
    >
      <form onSubmit={save} className="form-stack">
        <div className="person-form-banner">
          <div className="person-avatar-form">
            {(name.trim() || "P").charAt(0).toUpperCase()}
          </div>

          <div>
            <b>{isNew ? "Create a family member" : "Update person"}</b>
            <span>
              This name will appear in the Paid By dropdown for expenses.
            </span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <label className="field">
          <span>Person name</span>
          <div className="input-wrap">
            <Users size={16} />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter person's name"
            />
          </div>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button type="submit" className="primary" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving..." : isNew ? "Add Person" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------
   Expense modal
------------------------------------------------------- */

function ExpenseModal({
  expense,
  persons,
  categories,
  credentials,
  onClose,
  onSaved,
}) {
  const isNew = !expense;

  const [date, setDate] = useState(
    isNew
      ? new Date().toISOString().slice(0, 10)
      : expense.expense_date || ""
  );

  const [title, setTitle] = useState(isNew ? "" : expense.title || "");

  const [categoryId, setCategoryId] = useState(
    isNew ? categories[0]?.id || "" : expense.category_id || ""
  );

  const [amount, setAmount] = useState(
    isNew ? "" : String(expense.amount ?? "")
  );

  const [personId, setPersonId] = useState(
    isNew
      ? ""
      : expense.person_id ||
        persons.find((p) => p.name === expense.paid_by)?.id ||
        ""
  );

  const [notes, setNotes] = useState(isNew ? "" : expense.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();

    if (!credentials?.username || !credentials?.password) {
      setError("Owner login is missing. Please login again.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter an expense title.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!personId) {
      setError("Please select who paid.");
      return;
    }

    const selectedPerson = persons.find((p) => p.id === personId);

    if (!selectedPerson) {
      setError("Selected person could not be found.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const base = {
        p_username: credentials.username,
        p_password: credentials.password,
        p_expense_date: date,
        p_title: title.trim(),
        p_category_id: categoryId || null,
        p_amount: Number(amount),
        p_paid_by: selectedPerson.name,
        p_notes: notes.trim() || null,
      };

      if (isNew) {
        const result = await callRpc("owner_add_expense", base);

        /*
          The existing RPC accepts p_paid_by.
          After creation we also try to attach person_id.
        */
        const newId =
          result?.id ||
          result?.expense_id ||
          (Array.isArray(result) ? result[0]?.id : null);

        if (newId) {
          try {
            await supabaseRequest(`/rest/v1/expenses?id=eq.${newId}`, {
              method: "PATCH",
              headers: {
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                person_id: personId,
              }),
            });
          } catch {
            /*
              Ignore here because the old RPC already saved the expense.
            */
          }
        }
      } else {
        await callRpc("owner_update_expense", {
          ...base,
          p_id: expense.id,
        });

        try {
          await supabaseRequest(
            `/rest/v1/expenses?id=eq.${expense.id}`,
            {
              method: "PATCH",
              headers: {
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                person_id: personId,
              }),
            }
          );
        } catch {
          /*
            Existing update RPC has already completed.
          */
        }
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Unable to save expense.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add Expense" : "Edit Expense"}
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="form-grid">
        {error && <div className="form-error form-error-wide">{error}</div>}

        <label className="field">
          <span>Date</span>
          <div className="input-wrap">
            <CalendarDays size={16} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </label>

        <label className="field">
          <span>Title</span>
          <div className="input-wrap">
            <Receipt size={16} />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Electricity bill"
            />
          </div>
        </label>

        <label className="field">
          <span>Category</span>
          <div className="input-wrap">
            <BarChart3 size={16} />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select category</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Amount</span>
          <div className="input-wrap">
            <ReceiptIndianRupee size={16} />
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
        </label>

        <label className="field">
          <span>Paid By</span>
          <div className="input-wrap">
            <Users size={16} />
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Select person</option>

              {persons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Notes</span>
          <div className="input-wrap">
            <BookOpen size={16} />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </label>

        <div className="modal-actions form-actions-wide">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button type="submit" className="primary" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving..." : isNew ? "Add Expense" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------
   Dashboard
------------------------------------------------------- */

function DashboardView({ expenses, persons, onAddExpense, owner }) {
  const total = useMemo(
    () =>
      expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses]
  );

  const contribution = useMemo(() => {
    return persons
      .map((person) => {
        const amount = expenses.reduce((sum, expense) => {
          const matchesId = expense.person_id === person.id;
          const matchesName =
            !expense.person_id && expense.paid_by === person.name;

          return sum + (matchesId || matchesName ? Number(expense.amount || 0) : 0);
        }, 0);

        return {
          ...person,
          amount,
          percentage: total ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, persons, total]);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-kicker">OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Track your family's total spending and contributions.</p>
        </div>

        {owner && (
          <button className="primary add-button" onClick={onAddExpense}>
            <Plus size={17} />
            Add Expense
          </button>
        )}
      </div>

      <section className="dashboard-total-card">
        <div className="dashboard-total-icon">
          <WalletCards size={24} />
        </div>

        <div>
          <span>Total Amount Spent</span>
          <strong>{money(total)}</strong>
          <small>Across all recorded months</small>
        </div>
      </section>

      <section className="section-block">
        <div className="section-title-row">
          <div>
            <span className="page-kicker">CONTRIBUTION</span>
            <h2>Person-wise Contribution</h2>
          </div>

          <span className="count-pill">{persons.length} people</span>
        </div>

        {persons.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people added"
            text="Add family members from the Persons tab."
          />
        ) : (
          <div className="contribution-list">
            {contribution.map((person) => (
              <div className="contribution-row" key={person.id}>
                <div className="person-mini">
                  <div className="person-avatar">
                    {person.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <b>{person.name}</b>
                    <span>{person.percentage.toFixed(1)}% of total</span>
                  </div>
                </div>

                <div className="contribution-amount">
                  <strong>{money(person.amount)}</strong>
                  <div className="mini-progress">
                    <i
                      style={{
                        width: `${Math.min(person.percentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------
   Expenses
------------------------------------------------------- */

function ExpensesView({
  expenses,
  persons,
  categories,
  owner,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return expenses;

    return expenses.filter((expense) => {
      return [
        expense.title,
        expense.paid_by,
        expense.notes,
        expense.category?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [expenses, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-kicker">RECORDS</span>
          <h1>Expenses</h1>
          <p>View and manage all household expenses.</p>
        </div>

        {owner && (
          <button className="primary add-button" onClick={onAddExpense}>
            <Plus size={17} />
            Add Expense
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
          />
        </div>

        <div className="count-pill">
          {filtered.length} {filtered.length === 1 ? "expense" : "expenses"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses found"
          text={
            search
              ? "Try a different search."
              : "Start recording your household expenses."
          }
          action={
            owner && !search ? (
              <button className="primary" onClick={onAddExpense}>
                <Plus size={16} />
                Add Expense
              </button>
            ) : null
          }
        />
      ) : (
        <div className="expense-list">
          {filtered.map((expense) => {
            const Icon =
              categoryIcons[expense.category?.name] || Receipt;

            return (
              <article className="expense-card" key={expense.id}>
                <div className="expense-icon">
                  <Icon size={19} />
                </div>

                <div className="expense-main">
                  <div className="expense-title-row">
                    <h3>{expense.title}</h3>
                    <strong>{money(expense.amount)}</strong>
                  </div>

                  <div className="expense-meta">
                    <span>{formatDate(expense.expense_date)}</span>
                    <span>{expense.category?.name || "Other"}</span>
                    <span>
                      Paid by{" "}
                      <b>
                        {expense.person?.name ||
                          expense.paid_by ||
                          "Unknown"}
                      </b>
                    </span>
                  </div>

                  {expense.notes && (
                    <p className="expense-notes">{expense.notes}</p>
                  )}
                </div>

                {owner && (
                  <div className="expense-actions">
                    <button
                      className="icon-button"
                      title="Edit"
                      onClick={() => onEditExpense(expense)}
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      className="icon-button danger-icon"
                      title="Delete"
                      onClick={() => onDeleteExpense(expense)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------
   Summary
------------------------------------------------------- */

function SummaryView({ expenses }) {
  const summary = useMemo(() => {
    const map = {};

    expenses.forEach((expense) => {
      const category = expense.category?.name || "Other";

      if (!map[category]) {
        map[category] = 0;
      }

      map[category] += Number(expense.amount || 0);
    });

    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-kicker">ANALYTICS</span>
          <h1>Summary</h1>
          <p>Understand where your household money is going.</p>
        </div>
      </div>

      <section className="summary-total">
        <div>
          <span>Total spending</span>
          <strong>{money(total)}</strong>
        </div>

        <div className="summary-total-icon">
          <TrendingUp size={22} />
        </div>
      </section>

      <section className="section-block">
        <div className="section-title-row">
          <div>
            <span className="page-kicker">BREAKDOWN</span>
            <h2>Category-wise Spending</h2>
          </div>
        </div>

        {summary.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No summary available"
            text="Add expenses to see the spending breakdown."
          />
        ) : (
          <div className="summary-list">
            {summary.map((item) => {
              const percentage = total
                ? (item.amount / total) * 100
                : 0;

              const Icon = categoryIcons[item.name] || MoreHorizontal;

              return (
                <div className="summary-row" key={item.name}>
                  <div className="summary-left">
                    <div className="summary-icon">
                      <Icon size={17} />
                    </div>

                    <div>
                      <b>{item.name}</b>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="summary-right">
                    <strong>{money(item.amount)}</strong>

                    <div className="summary-progress">
                      <i
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------
   Persons
------------------------------------------------------- */

function PersonsView({
  persons,
  expenses,
  owner,
  credentials,
  onRefresh,
}) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const total = useMemo(
    () =>
      expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses]
  );

  const personStats = useMemo(() => {
    return persons
      .map((person) => {
        const amount = expenses.reduce((sum, expense) => {
          const byId = expense.person_id === person.id;
          const byName =
            !expense.person_id && expense.paid_by === person.name;

          return sum + (byId || byName ? Number(expense.amount || 0) : 0);
        }, 0);

        return {
          ...person,
          amount,
          percentage: total ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [persons, expenses, total]);

  async function deletePerson() {
    if (!deleting) return;

    if (!credentials?.username || !credentials?.password) {
      setError("Owner login is missing. Please login again.");
      return;
    }

    try {
      await callRpc("owner_delete_person", {
        p_username: credentials.username,
        p_password: credentials.password,
        p_id: deleting.id,
      });

      setDeleting(null);
      setError("");
      await onRefresh();
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete this person. Make sure they are not required by existing records."
      );
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-kicker">HOUSEHOLD</span>
          <h1>Persons</h1>
          <p>Manage the people who can be selected as expense payers.</p>
        </div>

        {owner && (
          <button
            className="primary add-button"
            onClick={() => setEditing("new")}
          >
            <Plus size={17} />
            Add Person
          </button>
        )}
      </div>

      {error && (
        <div className="error">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      <section className="persons-overview">
        <div className="persons-overview-card">
          <div className="overview-icon">
            <Users size={20} />
          </div>

          <div>
            <span>People</span>
            <strong>{persons.length}</strong>
          </div>
        </div>

        <div className="persons-overview-card">
          <div className="overview-icon">
            <Wallet size={20} />
          </div>

          <div>
            <span>Total contributed</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
      </section>

      {persons.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          text="Add the family members who make payments for household expenses."
          action={
            owner ? (
              <button
                className="primary"
                onClick={() => setEditing("new")}
              >
                <Plus size={16} />
                Add First Person
              </button>
            ) : null
          }
        />
      ) : (
        <section className="persons-grid">
          {personStats.map((person) => (
            <article className="person-card" key={person.id}>
              <div className="person-card-head">
                <div className="person-avatar-large">
                  {person.name.charAt(0).toUpperCase()}
                </div>

                <div className="person-card-name">
                  <h3>{person.name}</h3>
                  <span>
                    {person.percentage.toFixed(1)}% of total spending
                  </span>
                </div>

                {owner && (
                  <div className="person-card-actions">
                    <button
                      className="icon-button"
                      title="Edit person"
                      onClick={() => setEditing(person)}
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      className="icon-button danger-icon"
                      title="Delete person"
                      onClick={() => setDeleting(person)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="person-card-money">
                <span>Total paid</span>
                <strong>{money(person.amount)}</strong>
              </div>

              <div className="person-progress">
                <i
                  style={{
                    width: `${Math.min(person.percentage, 100)}%`,
                  }}
                />
              </div>

              <div className="person-card-footer">
                <span>
                  <Receipt size={13} />
                  Payments recorded
                </span>

                <b>
                  {
                    expenses.filter((expense) => {
                      const byId = expense.person_id === person.id;
                      const byName =
                        !expense.person_id &&
                        expense.paid_by === person.name;

                      return byId || byName;
                    }).length
                  }
                </b>
              </div>
            </article>
          ))}
        </section>
      )}

      {editing && (
        <PersonModal
          person={editing}
          credentials={credentials}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}

      {deleting && (
        <Modal title="Delete Person" onClose={() => setDeleting(null)}>
          <div className="delete-confirm">
            <div className="delete-icon">
              <Trash2 size={22} />
            </div>

            <h3>Delete {deleting.name}?</h3>

            <p>
              This removes the person from the Persons list. Existing
              expenses are not automatically deleted.
            </p>

            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>

              <button className="danger-button" onClick={deletePerson}>
                <Trash2 size={16} />
                Delete Person
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* -------------------------------------------------------
   Main App
------------------------------------------------------- */

export default function App() {
  const initialCredentials = readOwnerCredentials();

  const [ownerCred, setOwnerCred] = useState(initialCredentials);
  const [owner, setOwner] = useState(!!initialCredentials);

  const [activeTab, setActiveTab] = useState("dashboard");

  const [persons, setPersons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showLogin, setShowLogin] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [personData, categoryData, expenseData] =
        await Promise.all([
          supabaseRequest(
            "/rest/v1/persons?select=*&order=name.asc"
          ),

          supabaseRequest(
            "/rest/v1/categories?select=*&order=name.asc"
          ),

          supabaseRequest(
            "/rest/v1/expenses?select=*,person:persons(id,name),category:categories(id,name)&order=expense_date.desc"
          ),
        ]);

      setPersons(Array.isArray(personData) ? personData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setExpenses(Array.isArray(expenseData) ? expenseData : []);
    } catch (err) {
      setError(err.message || "Unable to load app data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleLogin(credentials) {
    setOwnerCred(credentials);
    setOwner(true);
    setShowLogin(false);
  }

  function logout() {
    localStorage.removeItem("dreamhome_credentials");
    localStorage.removeItem("dreamhome_owner");

    /*
      Also remove the old temporary session value if it exists.
    */
    sessionStorage.removeItem("dreamhome_credentials");
    sessionStorage.removeItem("dreamhome_owner");

    setOwnerCred(null);
    setOwner(false);
  }

  function addExpense() {
    if (!owner) {
      setShowLogin(true);
      return;
    }

    setEditingExpense(null);
    setShowExpenseModal(true);
  }

  function editExpense(expense) {
    if (!owner) {
      setShowLogin(true);
      return;
    }

    setEditingExpense(expense);
    setShowExpenseModal(true);
  }

  async function deleteExpense(expense) {
    if (!owner || !ownerCred) {
      setShowLogin(true);
      return;
    }

    const ok = window.confirm(
      `Delete "${expense.title}" for ${money(expense.amount)}?`
    );

    if (!ok) return;

    try {
      await callRpc("owner_delete_expense", {
        p_username: ownerCred.username,
        p_password: ownerCred.password,
        p_id: expense.id,
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to delete expense.");
    }
  }

  if (loading) {
    return (
      <div className="center splash">
        <div className="splash-card">
          <div className="splash-logo">
            <Home size={34} />
            <span>₹</span>
          </div>

          <b>Dream Home</b>
          <span>Family expense management</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-mark">
            <Home size={21} />
            <span>₹</span>
          </div>

          <div>
            <b>Dream Home</b>
            <small>Family expenses</small>
          </div>
        </div>

        <div className="head-actions">
          <span className={`mode ${owner ? "edit" : ""}`}>
            {owner ? "OWNER MODE" : "VIEW ONLY"}
          </span>

          {owner ? (
            <button className="secondary small" onClick={logout}>
              <LogOut size={14} />
              Logout
            </button>
          ) : (
            <button
              className="secondary small"
              onClick={() => setShowLogin(true)}
            >
              <Lock size={14} />
              Owner Login
            </button>
          )}
        </div>
      </header>

      <div className="layout">
        <aside>
          <div className="side-brand">
            <div className="side-brand-icon">
              <Home size={18} />
              <span>₹</span>
            </div>

            <div>
              <b>Dream Home</b>
              <small>Expense Tracker</small>
            </div>
          </div>

          <nav className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={`nav ${
                    activeTab === item.id ? "active" : ""
                  }`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="side-bottom">
            <div className="secure-mark">
              <Smartphone size={15} />
            </div>

            <div>
              <b>Private family tracker</b>
              <small>
                {owner
                  ? "Owner editing is enabled on this device."
                  : "View-only access is enabled."}
              </small>
            </div>
          </div>
        </aside>

        <main>
          {error && (
            <div className="error">
              <span>{error}</span>

              <button onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardView
              expenses={expenses}
              persons={persons}
              owner={owner}
              onAddExpense={addExpense}
            />
          )}

          {activeTab === "expenses" && (
            <ExpensesView
              expenses={expenses}
              persons={persons}
              categories={categories}
              owner={owner}
              onAddExpense={addExpense}
              onEditExpense={editExpense}
              onDeleteExpense={deleteExpense}
            />
          )}

          {activeTab === "summary" && (
            <SummaryView expenses={expenses} />
          )}

          {activeTab === "persons" && (
            <PersonsView
              persons={persons}
              expenses={expenses}
              owner={owner}
              credentials={ownerCred}
              onRefresh={loadData}
            />
          )}
        </main>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={handleLogin}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          expense={editingExpense}
          persons={persons}
          categories={categories}
          credentials={ownerCred}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

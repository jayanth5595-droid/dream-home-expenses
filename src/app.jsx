import React, { useEffect, useMemo, useState } from "react";
import {
  Home,
  ReceiptIndianRupee,
  BarChart3,
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
  Users,
  UserPlus,
  Edit3,
  Trash2,
  Search,
  CalendarDays,
  Download,
  TrendingUp,
  WalletCards,
  UserRound,
} from "lucide-react";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const today = () => new Date().toISOString().slice(0, 10);

const readOwnerCredentials = () => {
  try {
    const local = localStorage.getItem("dreamhome_credentials");

    if (local) {
      const parsed = JSON.parse(local);
      if (parsed?.username && parsed?.password) return parsed;
    }

    // Migrate an older sessionStorage login automatically.
    const oldSession = sessionStorage.getItem("dreamhome_credentials");

    if (oldSession) {
      const parsed = JSON.parse(oldSession);

      if (parsed?.username && parsed?.password) {
        localStorage.setItem(
          "dreamhome_credentials",
          JSON.stringify(parsed)
        );
        localStorage.setItem("dreamhome_owner", "true");
        return parsed;
      }
    }
  } catch {
    return null;
  }

  return null;
};

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
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
    throw new Error(
      data?.message ||
        data?.error_description ||
        data?.hint ||
        data?.details ||
        "Supabase request failed."
    );
  }

  return data;
}

async function rpc(functionName, args) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error_description ||
        data?.hint ||
        data?.details ||
        "Request failed."
    );
  }

  return data;
}

function App() {
  const initialCredentials = readOwnerCredentials();

  const [ownerCred, setOwnerCred] = useState(initialCredentials);
  const [owner, setOwner] = useState(Boolean(initialCredentials));

  const [tab, setTab] = useState("dashboard");
  const [persons, setPersons] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expenseModal, setExpenseModal] = useState(null);
  const [personModal, setPersonModal] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [peopleData, expenseData, categoryData] = await Promise.all([
        supabaseRequest(
          "persons?select=id,name,username,created_at&order=name.asc"
        ),
        supabaseRequest(
          "expenses?select=*&order=expense_date.desc"
        ),
        supabaseRequest(
          "categories?select=*&order=name.asc"
        ),
      ]);

      setPersons(Array.isArray(peopleData) ? peopleData : []);
      setExpenses(Array.isArray(expenseData) ? expenseData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (err) {
      setError(err.message || "Unable to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const login = async (username, password) => {
    try {
      setError("");

      const data = await rpc("owner_login", {
        p_username: username,
        p_password: password,
      });

      if (data?.ok === false) {
        throw new Error(data.message || "Invalid owner credentials.");
      }

      const credentials = { username, password };

      localStorage.setItem(
        "dreamhome_credentials",
        JSON.stringify(credentials)
      );

      localStorage.setItem("dreamhome_owner", "true");

      setOwnerCred(credentials);
      setOwner(true);
      setLoginOpen(false);

      await loadData();
    } catch (err) {
      throw new Error(err.message || "Login failed.");
    }
  };

  const logout = () => {
    localStorage.removeItem("dreamhome_credentials");
    localStorage.removeItem("dreamhome_owner");

    sessionStorage.removeItem("dreamhome_credentials");
    sessionStorage.removeItem("dreamhome_owner");

    setOwnerCred(null);
    setOwner(false);
    setExpenseModal(null);
    setPersonModal(null);
    setTab("dashboard");
  };

  const addExpense = async (form) => {
    if (!ownerCred) throw new Error("Owner login required.");

    const person = persons.find((p) => p.id === form.person_id);

    if (!person) {
      throw new Error("Please select who paid.");
    }

    const result = await rpc("owner_add_expense", {
      p_username: ownerCred.username,
      p_password: ownerCred.password,
      p_expense_date: form.expense_date,
      p_title: form.title.trim(),
      p_category_id: form.category_id || null,
      p_amount: Number(form.amount),
      p_paid_by: person.name,
      p_notes: form.notes?.trim() || null,
    });

    await loadData();

    // Keep person_id synced if the existing RPC doesn't populate it.
    if (result?.id) {
      try {
        await supabaseRequest(`expenses?id=eq.${result.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            person_id: form.person_id,
          }),
        });
      } catch {
        // Existing RPC may already have populated person_id.
      }
    }

    setExpenseModal(null);
    await loadData();
  };

  const updateExpense = async (form) => {
    if (!ownerCred) throw new Error("Owner login required.");

    const person = persons.find((p) => p.id === form.person_id);

    if (!person) {
      throw new Error("Please select who paid.");
    }

    await rpc("owner_update_expense", {
      p_username: ownerCred.username,
      p_password: ownerCred.password,
      p_id: form.id,
      p_expense_date: form.expense_date,
      p_title: form.title.trim(),
      p_category_id: form.category_id || null,
      p_amount: Number(form.amount),
      p_paid_by: person.name,
      p_notes: form.notes?.trim() || null,
    });

    try {
      await supabaseRequest(`expenses?id=eq.${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          person_id: form.person_id,
        }),
      });
    } catch {
      // The owner RPC may already handle this.
    }

    setExpenseModal(null);
    await loadData();
  };

  const deleteExpense = async (id) => {
    if (!ownerCred) return;

    if (!window.confirm("Delete this expense?")) return;

    try {
      await rpc("owner_delete_expense", {
        p_username: ownerCred.username,
        p_password: ownerCred.password,
        p_id: id,
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to delete expense.");
    }
  };

  const addPerson = async (form) => {
    if (!ownerCred) throw new Error("Owner login required.");

    await rpc("owner_add_person", {
      p_username: ownerCred.username,
      p_password: ownerCred.password,
      p_name: form.name.trim(),
    });

    setPersonModal(null);
    await loadData();
  };

  const updatePerson = async (form) => {
    if (!ownerCred) throw new Error("Owner login required.");

    await rpc("owner_update_person", {
      p_username: ownerCred.username,
      p_password: ownerCred.password,
      p_id: form.id,
      p_name: form.name.trim(),
    });

    setPersonModal(null);
    await loadData();
  };

  const deletePerson = async (id) => {
    if (!ownerCred) return;

    const hasExpenses = expenses.some((expense) => expense.person_id === id);

    if (hasExpenses) {
      setError(
        "This person has expenses linked to them. Please keep the person or reassign those expenses first."
      );
      return;
    }

    if (!window.confirm("Delete this person?")) return;

    try {
      await rpc("owner_delete_person", {
        p_username: ownerCred.username,
        p_password: ownerCred.password,
        p_id: id,
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to delete person.");
    }
  };

  if (loading) {
    return (
      <div className="center splash">
        <div className="splash-card">
          <div className="splash-icon">
            ₹
          </div>
          <b>Dream Home</b>
          <span>Family Expense Manager</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark">₹</div>
          <div>
            <strong>Dream Home</strong>
            <span>Family Expense Manager</span>
          </div>
        </div>

        <div className="head-actions">
          {owner ? (
            <>
              <span className="mode edit">
                <Check size={12} />
                OWNER MODE
              </span>

              <button className="secondary small" onClick={logout}>
                <LogOut size={14} />
                Logout
              </button>
            </>
          ) : (
            <>
              <span className="mode">
                <Eye size={12} />
                VIEW ONLY
              </span>

              <button
                className="primary small"
                onClick={() => setLoginOpen(true)}
              >
                <KeyRound size={14} />
                Owner Login
              </button>
            </>
          )}
        </div>
      </header>

      <div className="layout">
        <aside>
          <div className="side-brand">
            <div className="side-logo">₹</div>
            <div>
              <b>Dream Home</b>
              <small>Family finance</small>
            </div>
          </div>

          <nav className="nav-list">
            <button
              className={`nav ${tab === "dashboard" ? "active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              <Home />
              <span>Dashboard</span>
            </button>

            <button
              className={`nav ${tab === "expenses" ? "active" : ""}`}
              onClick={() => setTab("expenses")}
            >
              <ReceiptIndianRupee />
              <span>Expenses</span>
            </button>

            <button
              className={`nav ${tab === "summary" ? "active" : ""}`}
              onClick={() => setTab("summary")}
            >
              <BarChart3 />
              <span>Summary</span>
            </button>

            <button
              className={`nav ${tab === "persons" ? "active" : ""}`}
              onClick={() => setTab("persons")}
            >
              <Users />
              <span>Persons</span>
            </button>
          </nav>

          <div className="side-bottom">
            <div className="secure-mark">
              <Lock size={14} />
            </div>

            <div>
              <b>Private family records</b>
              <small>
                Your expense data is synced securely with Supabase.
              </small>
            </div>
          </div>
        </aside>

        <main>
          {error && (
            <div className="error">
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {tab === "dashboard" && (
            <Dashboard
              expenses={expenses}
              persons={persons}
            />
          )}

          {tab === "expenses" && (
            <ExpensesView
              expenses={expenses}
              persons={persons}
              categories={categories}
              owner={owner}
              onAdd={() => setExpenseModal("new")}
              onEdit={(expense) => setExpenseModal(expense)}
              onDelete={deleteExpense}
            />
          )}

          {tab === "summary" && (
            <SummaryView
              expenses={expenses}
              persons={persons}
              categories={categories}
            />
          )}

          {tab === "persons" && (
            <PersonsView
              persons={persons}
              expenses={expenses}
              owner={owner}
              onAdd={() => setPersonModal("new")}
              onEdit={(person) => setPersonModal(person)}
              onDelete={deletePerson}
            />
          )}
        </main>
      </div>

      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={login}
        />
      )}

      {expenseModal && (
        <ExpenseModal
          mode={expenseModal === "new" ? "new" : "edit"}
          expense={expenseModal === "new" ? null : expenseModal}
          persons={persons}
          categories={categories}
          onClose={() => setExpenseModal(null)}
          onSave={expenseModal === "new" ? addExpense : updateExpense}
        />
      )}

      {personModal && (
        <PersonModal
          mode={personModal === "new" ? "new" : "edit"}
          person={personModal === "new" ? null : personModal}
          onClose={() => setPersonModal(null)}
          onSave={personModal === "new" ? addPerson : updatePerson}
        />
      )}
    </div>
  );
}

function Dashboard({ expenses, persons }) {
  const total = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [expenses]
  );

  const contribution = useMemo(() => {
    return persons
      .map((person) => {
        const amount = expenses
          .filter(
            (expense) =>
              expense.person_id === person.id ||
              (!expense.person_id &&
                expense.paid_by?.toLowerCase() === person.name?.toLowerCase())
          )
          .reduce(
            (sum, expense) => sum + Number(expense.amount || 0),
            0
          );

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
          <div className="page-kicker">OVERVIEW</div>
          <h1>Dashboard</h1>
          <p>Complete family spending overview.</p>
        </div>
      </div>

      <section className="dashboard-total-card">
        <div className="total-icon">
          <Wallet size={23} />
        </div>

        <div>
          <span>Total amount spent</span>
          <strong>{money(total)}</strong>
          <small>Across all recorded months</small>
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>Person-wise contribution</h2>
            <p>How much each person has paid towards family expenses.</p>
          </div>

          <div className="section-count">
            {persons.length} {persons.length === 1 ? "person" : "people"}
          </div>
        </div>

        {contribution.length === 0 ? (
          <div className="empty-card">
            <Users size={30} />
            <b>No people added yet</b>
            <span>Add people from the Persons tab.</span>
          </div>
        ) : (
          <div className="contribution-list">
            {contribution.map((person) => (
              <div className="contribution-row" key={person.id}>
                <div className="person-mini">
                  <div className="avatar">
                    {person.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>

                  <div>
                    <b>{person.name}</b>
                    <small>{person.percentage.toFixed(1)}% of total</small>
                  </div>
                </div>

                <div className="contribution-amount">
                  <strong>{money(person.amount)}</strong>
                  <div className="mini-progress">
                    <span
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

function ExpensesView({
  expenses,
  persons,
  categories,
  owner,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return expenses;

    return expenses.filter((expense) => {
      return (
        expense.title?.toLowerCase().includes(term) ||
        expense.paid_by?.toLowerCase().includes(term) ||
        expense.notes?.toLowerCase().includes(term)
      );
    });
  }, [expenses, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">TRANSACTIONS</div>
          <h1>Expenses</h1>
          <p>View and manage all family expenses.</p>
        </div>

        {owner && (
          <button className="primary add-button" onClick={onAdd}>
            <Plus size={17} />
            Add Expense
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
          />
        </div>

        <div className="record-count">
          {filtered.length} records
        </div>
      </div>

      <div className="table-card">
        {filtered.length === 0 ? (
          <div className="empty-card">
            <Receipt size={30} />
            <b>No expenses found</b>
            <span>Try another search or add a new expense.</span>
          </div>
        ) : (
          <div className="expense-table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Paid By</th>
                  <th>Amount</th>
                  {owner && <th></th>}
                </tr>
              </thead>

              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <span className="date-cell">
                        <CalendarDays size={13} />
                        {formatDate(expense.expense_date)}
                      </span>
                    </td>

                    <td>
                      <div className="expense-title">
                        <b>{expense.title}</b>
                        {expense.notes && <small>{expense.notes}</small>}
                      </div>
                    </td>

                    <td>
                      <span className="category-pill">
                        {expense.category?.name ||
                          expense.category_name ||
                          getCategoryName(expense, categories)}
                      </span>
                    </td>

                    <td>
                      <span className="paid-person">
                        <span className="tiny-avatar">
                          {(expense.paid_by || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        {expense.paid_by || "-"}
                      </span>
                    </td>

                    <td>
                      <strong className="amount-cell">
                        {money(expense.amount)}
                      </strong>
                    </td>

                    {owner && (
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            title="Edit"
                            onClick={() => onEdit(expense)}
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            className="icon-button danger"
                            title="Delete"
                            onClick={() => onDelete(expense.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryView({ expenses, persons, categories }) {
  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const categoryTotals = useMemo(() => {
    const map = {};

    expenses.forEach((expense) => {
      const name =
        expense.category?.name ||
        expense.category_name ||
        getCategoryName(expense, categories) ||
        "Other";

      map[name] = (map[name] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses, categories]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">ANALYTICS</div>
          <h1>Summary</h1>
          <p>Understand where the family's money is going.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon">
            <WalletCards size={19} />
          </div>
          <span>Total spending</span>
          <strong>{money(total)}</strong>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <ReceiptIndianRupee size={19} />
          </div>
          <span>Total expenses</span>
          <strong>{expenses.length}</strong>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Users size={19} />
          </div>
          <span>People</span>
          <strong>{persons.length}</strong>
        </div>
      </div>

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>Category spending</h2>
            <p>Total amount spent in each category.</p>
          </div>
        </div>

        {categoryTotals.length === 0 ? (
          <div className="empty-card">
            <BarChart3 size={30} />
            <b>No category data</b>
            <span>Add expenses to see the breakdown.</span>
          </div>
        ) : (
          <div className="category-summary">
            {categoryTotals.map(([name, amount]) => {
              const percentage = total ? (amount / total) * 100 : 0;

              return (
                <div className="category-summary-row" key={name}>
                  <div className="category-summary-head">
                    <b>{name}</b>
                    <strong>{money(amount)}</strong>
                  </div>

                  <div className="category-progress">
                    <span
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                      }}
                    />
                  </div>

                  <small>{percentage.toFixed(1)}%</small>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function PersonsView({
  persons,
  expenses,
  owner,
  onAdd,
  onEdit,
  onDelete,
}) {
  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const personData = persons.map((person) => {
    const amount = expenses
      .filter(
        (expense) =>
          expense.person_id === person.id ||
          (!expense.person_id &&
            expense.paid_by?.toLowerCase() === person.name?.toLowerCase())
      )
      .reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );

    return {
      ...person,
      amount,
      percentage: total ? (amount / total) * 100 : 0,
    };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">FAMILY</div>
          <h1>Persons</h1>
          <p>Manage the people who contribute to family expenses.</p>
        </div>

        {owner && (
          <button className="primary add-button" onClick={onAdd}>
            <UserPlus size={17} />
            Add Person
          </button>
        )}
      </div>

      <div className="persons-overview">
        <div className="persons-overview-icon">
          <Users size={21} />
        </div>

        <div>
          <span>Family members</span>
          <strong>{persons.length}</strong>
        </div>

        <div className="persons-overview-divider" />

        <div>
          <span>Total contributed</span>
          <strong>{money(total)}</strong>
        </div>
      </div>

      {persons.length === 0 ? (
        <div className="persons-empty">
          <div className="persons-empty-icon">
            <UserPlus size={30} />
          </div>

          <h2>No people added yet</h2>

          <p>
            Add your family members so every expense can be assigned
            correctly.
          </p>

          {owner && (
            <button className="primary" onClick={onAdd}>
              <Plus size={16} />
              Add First Person
            </button>
          )}
        </div>
      ) : (
        <div className="persons-grid">
          {personData.map((person) => (
            <article className="person-card" key={person.id}>
              <div className="person-card-top">
                <div className="person-avatar-large">
                  {person.name?.charAt(0)?.toUpperCase() || "?"}
                </div>

                <div className="person-card-info">
                  <h3>{person.name}</h3>
                  <span>
                    {person.username || "Family member"}
                  </span>
                </div>

                {owner && (
                  <div className="person-actions">
                    <button
                      className="icon-button"
                      title="Edit person"
                      onClick={() => onEdit(person)}
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      className="icon-button danger"
                      title="Delete person"
                      onClick={() => onDelete(person.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="person-card-divider" />

              <div className="person-stat-row">
                <div>
                  <span>Total contributed</span>
                  <strong>{money(person.amount)}</strong>
                </div>

                <div className="person-percentage">
                  <TrendingUp size={14} />
                  {person.percentage.toFixed(1)}%
                </div>
              </div>

              <div className="person-progress">
                <span
                  style={{
                    width: `${Math.min(person.percentage, 100)}%`,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function PersonModal({ mode, person, onClose, onSave }) {
  const [name, setName] = useState(person?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter the person's name.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Please enter a valid name.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await onSave({
        ...(person || {}),
        name: name.trim(),
      });
    } catch (err) {
      setError(err.message || "Unable to save person.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal person-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title-icon">
            {mode === "new" ? (
              <UserPlus size={20} />
            ) : (
              <UserRound size={20} />
            )}
          </div>

          <div>
            <h2>{mode === "new" ? "Add Person" : "Edit Person"}</h2>
            <p>
              {mode === "new"
                ? "Add a family member to your expense tracker."
                : "Update this person's details."}
            </p>
          </div>

          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={submit}>
          <label className="field">
            <span>Person name</span>

            <div className="input-with-icon">
              <UserRound size={16} />
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
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={saving}
            >
              {saving ? "Saving..." : mode === "new" ? "Add Person" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter username and password.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal login-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title-icon">
            <Lock

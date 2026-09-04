import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Blocks,
  BookOpen,
  CalendarDays,
  Car,
  Check,
  CreditCard,
  Download,
  Droplets,
  Edit3,
  Eye,
  HardHat,
  HeartPulse,
  Home,
  House,
  KeyRound,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  Receipt,
  ReceiptIndianRupee,
  Refrigerator,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  Truck,
  Utensils,
  Wallet,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "./supabase";

/* =========================================================
   HELPERS
========================================================= */

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const dateText = (value) => {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const sumBy = (items, key) =>
  items.reduce((sum, item) => sum + Number(item?.[key] || 0), 0);

/* =========================================================
   CATEGORY ICONS
========================================================= */

const CATEGORY_ICONS = {
  Food: Utensils,
  Groceries: ShoppingBag,
  Transport: Car,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Electricity: Zap,
  Water: Droplets,
  Rent: House,
  Home: Home,
  Health: HeartPulse,
  Education: BookOpen,
  EMI: CreditCard,
  Vehicle: Truck,
  Mobile: Smartphone,
  Appliances: Refrigerator,
  Construction: HardHat,
  Maintenance: Wrench,
  Insurance: ShieldIcon,
  Personal: Wallet,
  Other: Blocks,
};

const CATEGORY_ACCENTS = {
  Food: "orange",
  Groceries: "green",
  Transport: "blue",
  Shopping: "pink",
  Bills: "violet",
  Electricity: "yellow",
  Water: "cyan",
  Rent: "indigo",
  Home: "emerald",
  Health: "red",
  Education: "purple",
  EMI: "slate",
  Vehicle: "sky",
  Mobile: "teal",
  Appliances: "amber",
  Construction: "brown",
  Maintenance: "gray",
  Insurance: "rose",
  Personal: "lime",
  Other: "neutral",
};

function ShieldIcon(props) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l7 4v5c0 4.7-2.8 7.8-7 9-4.2-1.2-7-4.3-7-9V7l7-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CategoryIcon({ category, size = 18 }) {
  const Icon = CATEGORY_ICONS[category] || Blocks;

  return <Icon size={size} strokeWidth={2.1} />;
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

const OWNER_KEY = "dreamhome_owner";
const CREDENTIAL_KEY = "dreamhome_credentials";

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [setup, setSetup] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [owner, setOwner] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(OWNER_KEY) || "null");
    } catch {
      return null;
    }
  });

  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    let active = true;

    const loadSetup = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("owner_username")
          .eq("id", true)
          .single();

        if (!active) return;

        if (error) {
          setSetup(null);
        } else {
          setSetup(data);
        }
      } catch {
        if (active) setSetup(null);
      } finally {
        if (active) setCheckingSetup(false);
      }
    };

    loadSetup();

    const beforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Ignore install prompt errors.
    } finally {
      setInstallPrompt(null);
    }
  };

  const handleLogin = (data) => {
    localStorage.setItem(OWNER_KEY, JSON.stringify(data));
    setOwner(data);
  };

  const logout = () => {
    localStorage.removeItem(OWNER_KEY);
    setOwner(null);
  };

  if (checkingSetup) {
    return (
      <div className="center splash">
        <div className="splash-card">
          <div className="splash-logo">
            <House size={32} />
            <span>₹</span>
          </div>

          <h1>Dream Home</h1>
          <p>Preparing your family finance dashboard...</p>

          <div className="loader" />
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      owner={owner}
      setup={setup}
      onLogin={handleLogin}
      onLogout={logout}
      installPrompt={installPrompt}
      onInstall={installApp}
    />
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  owner,
  setup,
  onLogin,
  onLogout,
  installPrompt,
  onInstall,
}) {
  const [activeTab, setActiveTab] = useState("dashboard");

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [persons, setPersons] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");

  const [showAuth, setShowAuth] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [showPerson, setShowPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [expenseResult, categoryResult, personResult] =
        await Promise.all([
          supabase
            .from("expenses")
            .select("*")
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("categories")
            .select("*")
            .order("name", { ascending: true }),

          supabase
            .from("persons")
            .select("*")
            .order("name", { ascending: true }),
        ]);

      if (expenseResult.error) throw expenseResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (personResult.error) throw personResult.error;

      setExpenses(expenseResult.data || []);
      setCategories(categoryResult.data || []);
      setPersons(personResult.data || []);
    } catch (err) {
      setError(err?.message || "Unable to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    if (month) {
      result = result.filter((expense) =>
        String(expense.expense_date || "").startsWith(month)
      );
    }

    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter((expense) => {
        const text = [
          expense.title,
          expense.description,
          expense.category,
          expense.paid_by,
          expense.person_name,
          expense.payment_method,
          expense.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      });
    }

    return result;
  }, [expenses, month, search]);

  const totalExpense = useMemo(
    () => sumBy(filteredExpenses, "amount"),
    [filteredExpenses]
  );

  const allTimeTotal = useMemo(
    () => sumBy(expenses, "amount"),
    [expenses]
  );

  const categoryTotals = useMemo(() => {
    const map = {};

    filteredExpenses.forEach((expense) => {
      const key = expense.category || "Other";
      map[key] = (map[key] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const personTotals = useMemo(() => {
    const map = {};

    filteredExpenses.forEach((expense) => {
      const name =
        expense.person_name ||
        expense.paid_by ||
        persons.find((p) => p.id === expense.person_id)?.name ||
        "Unassigned";

      map[name] = (map[name] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, persons]);

  const monthlyTotals = useMemo(() => {
    const map = {};

    expenses.forEach((expense) => {
      const date = String(expense.expense_date || "");

      if (!date) return;

      const key = date.slice(0, 7);

      map[key] = (map[key] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, amount]) => {
        const date = new Date(`${key}-01T00:00:00`);

        return {
          key,
          label: date.toLocaleDateString("en-IN", {
            month: "short",
          }),
          amount,
        };
      });
  }, [expenses]);

  const deleteExpense = async (expense) => {
    if (!owner) return;

    const confirmed = window.confirm(
      `Delete "${expense.title || "this expense"}"?`
    );

    if (!confirmed) return;

    setError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "owner_delete_expense",
        {
          p_expense_id: expense.id,
          p_username: owner.username,
          p_password: owner.password,
        }
      );

      if (rpcError) throw rpcError;

      setExpenses((current) =>
        current.filter((item) => item.id !== expense.id)
      );
    } catch (err) {
      setError(err?.message || "Unable to delete expense.");
    }
  };

  const exportCsv = () => {
    const rows = filteredExpenses.map((expense) => ({
      Date: expense.expense_date || "",
      Title: expense.title || "",
      Category: expense.category || "",
      Amount: expense.amount || 0,
      "Paid By": expense.paid_by || "",
      Person: expense.person_name || "",
      "Payment Method": expense.payment_method || "",
      Note: expense.note || expense.description || "",
    }));

    if (!rows.length) {
      alert("There are no expenses to export.");
      return;
    }

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header] ?? "");
            return `"${value.replaceAll('"', '""')}"`
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `dream-home-expenses-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const saveExpense = async (form) => {
    if (!owner) {
      setShowAuth(true);
      return;
    }

    setError("");

    try {
      let expenseId = editingExpense?.id;

      if (editingExpense) {
        const { data, error: rpcError } = await supabase.rpc(
          "owner_update_expense",
          {
            p_username: owner.username,
            p_password: owner.password,
            p_expense_id: editingExpense.id,
            p_title: form.title,
            p_amount: Number(form.amount),
            p_category: form.category,
            p_expense_date: form.expense_date,
            p_description: form.description || null,
            p_payment_method: form.payment_method || null,
          }
        );

        if (rpcError) throw rpcError;

        if (data?.id) expenseId = data.id;
      } else {
        const { data, error: rpcError } = await supabase.rpc(
          "owner_add_expense",
          {
            p_username: owner.username,
            p_password: owner.password,
            p_title: form.title,
            p_amount: Number(form.amount),
            p_category: form.category,
            p_expense_date: form.expense_date,
            p_description: form.description || null,
            p_payment_method: form.payment_method || null,
          }
        );

        if (rpcError) throw rpcError;

        if (Array.isArray(data)) {
          expenseId = data[0]?.id;
        } else if (data?.id) {
          expenseId = data.id;
        }
      }

      if (expenseId && (form.person_id || form.paid_by)) {
        const { error: updateError } = await supabase
          .from("expenses")
          .update({
            person_id: form.person_id || null,
            paid_by: form.paid_by || null,
          })
          .eq("id", expenseId);

        if (updateError) throw updateError;
      }

      setShowExpense(false);
      setEditingExpense(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Unable to save expense.");
      throw err;
    }
  };

  const savePerson = async (form) => {
    if (!owner) {
      setShowAuth(true);
      return;
    }

    setError("");

    try {
      if (editingPerson) {
        const { error: rpcError } = await supabase.rpc(
          "owner_update_person",
          {
            p_username: owner.username,
            p_password: owner.password,
            p_person_id: editingPerson.id,
            p_name: form.name,
          }
        );

        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc(
          "owner_add_person",
          {
            p_username: owner.username,
            p_password: owner.password,
            p_name: form.name,
          }
        );

        if (rpcError) throw rpcError;
      }

      setShowPerson(false);
      setEditingPerson(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Unable to save person.");
      throw err;
    }
  };

  const deletePerson = async (person) => {
    if (!owner) return;

    if (
      !window.confirm(
        `Delete ${person.name}? Existing expenses will not be deleted.`
      )
    ) {
      return;
    }

    try {
      const { error: rpcError } = await supabase.rpc(
        "owner_delete_person",
        {
          p_username: owner.username,
          p_password: owner.password,
          p_person_id: person.id,
        }
      );

      if (rpcError) throw rpcError;

      setPersons((current) =>
        current.filter((item) => item.id !== person.id)
      );
    } catch (err) {
      setError(err?.message || "Unable to delete person.");
    }
  };

  const openAddExpense = () => {
    if (!owner) {
      setShowAuth(true);
      return;
    }

    setEditingExpense(null);
    setShowExpense(true);
  };

  const openEditExpense = (expense) => {
    if (!owner) {
      setShowAuth(true);
      return;
    }

    setEditingExpense(expense);
    setShowExpense(true);
  };

  const openAddPerson = () => {
    if (!owner) {
      setShowAuth(true);
      return;
    }

    setEditingPerson(null);
    setShowPerson(true);
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: ReceiptIndianRupee,
    },
    {
      id: "summary",
      label: "Summary",
      icon: Wallet,
    },
    {
      id: "persons",
      label: "Persons",
      icon: UsersIcon,
    },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">
            <House size={24} />
            <span>₹</span>
          </div>

          <div>
            <div className="brand-name">Dream Home</div>
            <div className="brand-subtitle">Family Finance</div>
          </div>
        </div>

        <div className="head-actions">
          {installPrompt && (
            <button className="secondary install-btn" onClick={onInstall}>
              <Download size={16} />
              Install
            </button>
          )}

          <div className={`mode ${owner ? "edit" : "view"}`}>
            {owner ? <Edit3 size={15} /> : <Eye size={15} />}
            {owner ? "Edit mode" : "View mode"}
          </div>

          {owner ? (
            <button className="secondary" onClick={onLogout}>
              <LogOut size={16} />
              Logout
            </button>
          ) : (
            <button className="primary login-button" onClick={() => setShowAuth(true)}>
              <Lock size={16} />
              Owner Login
            </button>
          )}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="side-brand">
            <div className="side-mini-logo">
              <House size={18} />
            </div>

            <div>
              <strong>Family Hub</strong>
              <span>Expense management</span>
            </div>
          </div>

          <nav className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={`nav ${activeTab === item.id ? "active" : ""}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="side-bottom">
            <div className="secure-mark">
              <div className="secure-icon">
                <Lock size={15} />
              </div>

              <div>
                <strong>Cloud Synced</strong>
                <span>Supabase protected</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          {error && (
            <div className="error">
              <div>
                <strong>Something went wrong</strong>
                <span>{error}</span>
              </div>

              <button onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardView
              expenses={filteredExpenses}
              allExpenses={expenses}
              totalExpense={totalExpense}
              allTimeTotal={allTimeTotal}
              categoryTotals={categoryTotals}
              personTotals={personTotals}
              monthlyTotals={monthlyTotals}
              persons={persons}
              loading={loading}
              month={month}
              setMonth={setMonth}
              onAddExpense={openAddExpense}
              onViewExpenses={() => setActiveTab("expenses")}
            />
          )}

          {activeTab === "expenses" && (
            <ExpensesView
              expenses={filteredExpenses}
              categories={categories}
              persons={persons}
              loading={loading}
              search={search}
              setSearch={setSearch}
              month={month}
              setMonth={setMonth}
              owner={owner}
              onAdd={openAddExpense}
              onEdit={openEditExpense}
              onDelete={deleteExpense}
              onExport={exportCsv}
            />
          )}

          {activeTab === "summary" && (
            <SummaryView
              expenses={filteredExpenses}
              categoryTotals={categoryTotals}
              personTotals={personTotals}
              monthlyTotals={monthlyTotals}
              totalExpense={totalExpense}
              month={month}
              setMonth={setMonth}
            />
          )}

          {activeTab === "persons" && (
            <PersonsView
              persons={persons}
              expenses={expenses}
              owner={owner}
              onAdd={openAddPerson}
              onEdit={(person) => {
                setEditingPerson(person);
                setShowPerson(true);
              }}
              onDelete={deletePerson}
            />
          )}
        </main>
      </div>

      {showAuth && (
        <AuthModal
          setup={setup}
          onClose={() => setShowAuth(false)}
          onSuccess={(data) => {
            onLogin(data);
            setShowAuth(false);
          }}
        />
      )}

      {showExpense && (
        <ExpenseModal
          expense={editingExpense}
          categories={categories}
          persons={persons}
          onClose={() => {
            setShowExpense(false);
            setEditingExpense(null);
          }}
          onSave={saveExpense}
        />
      )}

      {showPerson && (
        <PersonModal
          person={editingPerson}
          onClose={() => {
            setShowPerson(false);
            setEditingPerson(null);
          }}
          onSave={savePerson}
        />
      )}
    </div>
  );
}

/* =========================================================
   DASHBOARD VIEW
========================================================= */

function DashboardView({
  expenses,
  allExpenses,
  totalExpense,
  allTimeTotal,
  categoryTotals,
  personTotals,
  monthlyTotals,
  persons,
  loading,
  month,
  setMonth,
  onAddExpense,
  onViewExpenses,
}) {
  const topCategory = categoryTotals[0];
  const topPerson = personTotals[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">OVERVIEW</div>
          <h1>Good to see you.</h1>
          <p>Keep your family finances organised in one place.</p>
        </div>

        <div className="page-head-actions">
          <input
            className="month-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />

          <button className="primary add-button" onClick={onAddExpense}>
            <Plus size={18} />
            Add Expense
          </button>
        </div>
      </div>

      <section className="hero-card">
        <div className="hero-copy">
          <div className="eyebrow">TOTAL SPENDING</div>
          <div className="hero-amount">{money(totalExpense)}</div>

          <div className="hero-meta">
            {month
              ? `For ${new Date(`${month}-01T00:00:00`).toLocaleDateString(
                  "en-IN",
                  { month: "long", year: "numeric" }
                )}`
              : "Across all recorded expenses"}
          </div>

          <div className="hero-stat-row">
            <div>
              <span>Transactions</span>
              <strong>{expenses.length}</strong>
            </div>

            <div>
              <span>Categories</span>
              <strong>{categoryTotals.length}</strong>
            </div>

            <div>
              <span>Family members</span>
              <strong>{persons.length}</strong>
            </div>
          </div>
        </div>

        <div className="hero-architecture">
          <div className="hero-house">
            <House size={112} strokeWidth={1.2} />
            <div className="hero-rupee">₹</div>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card premium-card">
          <div className="card-title">
            <div>
              <span className="eyebrow-dark">BREAKDOWN</span>
              <h2>Where money goes</h2>
            </div>

            {topCategory && (
              <div className="small-highlight">
                <CategoryIcon category={topCategory.name} size={15} />
                {topCategory.name}
              </div>
            )}
          </div>

          {categoryTotals.length === 0 ? (
            <div className="empty">
              <Receipt size={30} />
              <strong>No expenses yet</strong>
              <span>Add your first expense to see the breakdown.</span>
            </div>
          ) : (
            <div className="premium-bars">
              {categoryTotals.slice(0, 6).map((item) => {
                const percent =
                  totalExpense > 0
                    ? Math.round((item.amount / totalExpense) * 100)
                    : 0;

                return (
                  <div className="premium-bar" key={item.name}>
                    <div className="premium-bar-head">
                      <div className="premium-label">
                        <span
                          className={`category-dot ${
                            CATEGORY_ACCENTS[item.name] || "neutral"
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>

                      <strong>{money(item.amount)}</strong>
                    </div>

                    <div className="premium-track">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card premium-card">
          <div className="card-title">
            <div>
              <span className="eyebrow-dark">FAMILY</span>
              <h2>Spending by person</h2>
            </div>

            {topPerson && (
              <div className="small-highlight">
                <UsersIcon size={15} />
                {topPerson.name}
              </div>
            )}
          </div>

          {personTotals.length === 0 ? (
            <div className="empty">
              <UsersIcon size={30} />
              <strong>No person data</strong>
              <span>Assign expenses to family members.</span>
            </div>
          ) : (
            <div className="premium-bars">
              {personTotals.slice(0, 5).map((item, index) => {
                const percent =
                  totalExpense > 0
                    ? Math.round((item.amount / totalExpense) * 100)
                    : 0;

                return (
                  <div className="premium-bar" key={item.name}>
                    <div className="premium-bar-head">
                      <div className="premium-label">
                        <span className="person-dot">
                          {item.name.slice(0, 1).toUpperCase()}
                        </span>

                        <span>{item.name}</span>
                      </div>

                      <strong>{money(item.amount)}</strong>
                    </div>

                    <div className="premium-track">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card premium-card monthly-card">
        <div className="card-title">
          <div>
            <span className="eyebrow-dark">TREND</span>
            <h2>Monthly spending</h2>
          </div>

          <button className="text-button" onClick={onViewExpenses}>
            View expenses
          </button>
        </div>

        {monthlyTotals.length === 0 ? (
          <div className="empty">
            <CalendarDays size={30} />
            <strong>No monthly data</strong>
            <span>Your monthly trend will appear here.</span>
          </div>
        ) : (
          <div className="monthly-bars">
            {monthlyTotals.map((item) => {
              const max = Math.max(
                ...monthlyTotals.map((entry) => entry.amount),
                1
              );

              const height = Math.max(
                12,
                Math.round((item.amount / max) * 100)
              );

              return (
                <div className="month-column" key={item.key}>
                  <strong className="month-value">
                    {money(item.amount)}
                  </strong>

                  <div className="month-bar-wrap">
                    <div
                      className="month-bar"
                      style={{ height: `${height}%` }}
                    />
                  </div>

                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="dashboard-mini-grid">
        <div className="card mini-stat">
          <div className="mini-icon blue">
            <ReceiptIndianRupee size={20} />
          </div>

          <div>
            <span>All-time spending</span>
            <strong>{money(allTimeTotal)}</strong>
          </div>
        </div>

        <div className="card mini-stat">
          <div className="mini-icon green">
            <Check size={20} />
          </div>

          <div>
            <span>Recorded transactions</span>
            <strong>{allExpenses.length}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EXPENSES VIEW
========================================================= */

function ExpensesView({
  expenses,
  categories,
  persons,
  loading,
  search,
  setSearch,
  month,
  setMonth,
  owner,
  onAdd,
  onEdit,
  onDelete,
  onExport,
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">TRANSACTIONS</div>
          <h1>Expenses</h1>
          <p>Review and manage every family expense.</p>
        </div>

        {owner && (
          <button className="primary add-button" onClick={onAdd}>
            <Plus size={18} />
            Add Expense
          </button>
        )}
      </div>

      <div className="expense-toolbar">
        <label className="search premium-input">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={16} />
            </button>
          )}
        </label>

        <input
          className="month-input"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />

        <button className="secondary" onClick={onExport}>
          <Download size={17} />
          Export CSV
        </button>
      </div>

      <div className="result result-premium">
        <div>
          <strong>{expenses.length}</strong>
          <span>expense{expenses.length === 1 ? "" : "s"} found</span>
        </div>

        <div>
          <span>Total</span>
          <strong>{money(sumBy(expenses, "amount"))}</strong>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : expenses.length === 0 ? (
        <EmptyExpenses owner={owner} onAdd={onAdd} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Person</th>
                  <th>Paid by</th>
                  <th>Amount</th>
                  {owner && <th />}
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{dateText(expense.expense_date)}</td>

                    <td>
                      <div className="expense-title-cell">
                        <strong>{expense.title || "Untitled expense"}</strong>

                        {(expense.description || expense.note) && (
                          <span>
                            {expense.description || expense.note}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="category-chip">
                        <CategoryIcon
                          category={expense.category}
                          size={15}
                        />
                        {expense.category || "Other"}
                      </span>
                    </td>

                    <td>{expense.person_name || "—"}</td>

                    <td>{expense.paid_by || "—"}</td>

                    <td className="amount">
                      {money(expense.amount)}
                    </td>

                    {owner && (
                      <td className="actions-cell">
                        <button
                          className="icon"
                          title="Edit"
                          onClick={() => onEdit(expense)}
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          className="icon danger"
                          title="Delete"
                          onClick={() => onDelete(expense)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-expenses">
            {expenses.map((expense) => (
              <article className="expense-card" key={expense.id}>
                <div className="expense-card-top">
                  <div>
                    <span className="category-chip">
                      <CategoryIcon
                        category={expense.category}
                        size={14}
                      />
                      {expense.category || "Other"}
                    </span>

                    <h3>{expense.title || "Untitled expense"}</h3>
                  </div>

                  <strong>{money(expense.amount)}</strong>
                </div>

                <div className="expense-card-meta">
                  <span>{dateText(expense.expense_date)}</span>
                  <span>{expense.person_name || "No person"}</span>
                  <span>{expense.paid_by || "Not specified"}</span>
                </div>

                {(expense.description || expense.note) && (
                  <div className="expense-card-note">
                    {expense.description || expense.note}
                  </div>
                )}

                {owner && (
                  <div className="expense-card-actions">
                    <button
                      className="mobile-action edit-mobile"
                      onClick={() => onEdit(expense)}
                    >
                      <Edit3 size={15} />
                      Edit
                    </button>

                    <button
                      className="mobile-action delete-mobile"
                      onClick={() => onDelete(expense)}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {categories.length === 0 && (
        <div className="notice small-notice">
          Categories have not been configured yet. Expenses can still be
          recorded using the category field.
        </div>
      )}

      {persons.length === 0 && (
        <div className="notice small-notice">
          Add family members from the Persons tab to assign expenses.
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY VIEW
========================================================= */

function SummaryView({
  expenses,
  categoryTotals,
  personTotals,
  monthlyTotals,
  totalExpense,
  month,
  setMonth,
}) {
  const average =
    expenses.length > 0 ? totalExpense / expenses.length : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">ANALYTICS</div>
          <h1>Summary</h1>
          <p>A clearer picture of where your family money goes.</p>
        </div>

        <input
          className="month-input"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <section className="summary-hero">
        <div>
          <span className="summary-badge">
            <BarChart3 size={15} />
            Spending overview
          </span>

          <h2>{money(totalExpense)}</h2>

          <p>
            Total recorded spending
            {month ? " for the selected month." : "."}
          </p>
        </div>

        <div className="summary-hero-stat">
          <span>Average transaction</span>
          <strong>{money(average)}</strong>
        </div>
      </section>

      <div className="content-grid">
        <section className="card summary-content">
          <div className="card-title">
            <div>
              <span className="eyebrow-dark">CATEGORIES</span>
              <h2>Category summary</h2>
            </div>
          </div>

          {categoryTotals.length === 0 ? (
            <div className="empty">
              <Blocks size={30} />
              <strong>No category data</strong>
            </div>
          ) : (
            <div className="summary-list">
              {categoryTotals.map((item) => {
                const percentage =
                  totalExpense > 0
                    ? (item.amount / totalExpense) * 100
                    : 0;

                return (
                  <div className="summary-row" key={item.name}>
                    <div className="summary-row-main">
                      <div
                        className={`summary-icon ${
                          CATEGORY_ACCENTS[item.name] || "neutral"
                        }`}
                      >
                        <CategoryIcon category={item.name} size={18} />
                      </div>

                      <div>
                        <strong>{item.name}</strong>
                        <span>{percentage.toFixed(1)}% of total</span>
                      </div>
                    </div>

                    <strong>{money(item.amount)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card summary-content">
          <div className="card-title">
            <div>
              <span className="eyebrow-dark">PEOPLE</span>
              <h2>Person summary</h2>
            </div>
          </div>

          {personTotals.length === 0 ? (
            <div className="empty">
              <UsersIcon size={30} />
              <strong>No person data</strong>
            </div>
          ) : (
            <div className="summary-list">
              {personTotals.map((item) => (
                <div className="summary-row" key={item.name}>
                  <div className="summary-row-main">
                    <div className="summary-person">
                      {item.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div>
                      <strong>{item.name}</strong>
                      <span>Family spending</span>
                    </div>
                  </div>

                  <strong>{money(item.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card premium-card monthly-card">
        <div className="card-title">
          <div>
            <span className="eyebrow-dark">HISTORY</span>
            <h2>Last six months</h2>
          </div>
        </div>

        {monthlyTotals.length === 0 ? (
          <div className="empty">
            <CalendarDays size={30} />
            <strong>No history available</strong>
          </div>
        ) : (
          <div className="monthly-bars large">
            {monthlyTotals.map((item) => {
              const max = Math.max(
                ...monthlyTotals.map((entry) => entry.amount),
                1
              );

              const height = Math.max(
                12,
                Math.round((item.amount / max) * 100)
              );

              return (
                <div className="month-column" key={item.key}>
                  <strong className="month-value">
                    {money(item.amount)}
                  </strong>

                  <div className="month-bar-wrap">
                    <div
                      className="month-bar"
                      style={{ height: `${height}%` }}
                    />
                  </div>

                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   PERSONS VIEW
========================================================= */

function PersonsView({
  persons,
  expenses,
  owner,
  onAdd,
  onEdit,
  onDelete,
}) {
  const totals = useMemo(() => {
    const map = {};

    expenses.forEach((expense) => {
      if (!expense.person_id) return;

      map[expense.person_id] =
        (map[expense.person_id] || 0) +
        Number(expense.amount || 0);
    });

    return map;
  }, [expenses]);

  const totalAssigned = Object.values(totals).reduce(
    (sum, value) => sum + value,
    0
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">FAMILY</div>
          <h1>Persons</h1>
          <p>Manage family members and track their assigned spending.</p>
        </div>

        {owner && (
          <button className="primary add-button" onClick={onAdd}>
            <Plus size={18} />
            Add Person
          </button>
        )}
      </div>

      <section className="persons-overview">
        <div className="persons-overview-main">
          <div className="persons-overview-icon">
            <UsersIcon size={25} />
          </div>

          <div>
            <span className="eyebrow-dark">FAMILY MEMBERS</span>
            <strong className="persons-count">{persons.length}</strong>
          </div>
        </div>

        <div className="persons-total">
          <span>Assigned spending</span>
          <strong>{money(totalAssigned)}</strong>
        </div>
      </section>

      {persons.length === 0 ? (
        <div className="persons-empty card">
          <div className="persons-empty-icon">
            <UsersIcon size={34} />
          </div>

          <h2>No family members yet</h2>

          <p>
            Add people to make expense tracking more useful for your
            household.
          </p>

          {owner && (
            <button className="primary" onClick={onAdd}>
              <Plus size={17} />
              Add First Person
            </button>
          )}
        </div>
      ) : (
        <div className="persons-grid">
          {persons.map((person) => {
            const total = totals[person.id] || 0;

            const percentage =
              totalAssigned > 0
                ? Math.round((total / totalAssigned) * 100)
                : 0;

            return (
              <article className="person-card card" key={person.id}>
                <div className="person-card-head">
                  <div className="person-avatar-large">
                    {person.name?.slice(0, 1).toUpperCase() || "?"}
                  </div>

                  {owner && (
                    <div className="person-card-menu">
                      <button
                        className="icon"
                        onClick={() => onEdit(person)}
                        title="Edit person"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        className="icon danger"
                        onClick={() => onDelete(person)}
                        title="Delete person"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="person-card-name">{person.name}</div>

                <div className="person-card-total">
                  <span>Total assigned</span>
                  <strong>{money(total)}</strong>
                </div>

                <div className="person-progress">
                  <div className="person-progress-head">
                    <span>Share of assigned spending</span>
                    <strong>{percentage}%</strong>
                  </div>

                  <div className="person-progress-track">
                    <span style={{ width: `${percentage}%` }} />
                  </div>
                </div>

                <div className="person-card-footer">
                  <span>
                    {
                      expenses.filter(
                        (expense) => expense.person_id === person.id
                      ).length
                    }{" "}
                    expense
                    {expenses.filter(
                      (expense) => expense.person_id === person.id
                    ).length === 1
                      ? ""
                      : "s"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   AUTH MODAL
========================================================= */

function AuthModal({ setup, onClose, onSuccess }) {
  const [mode, setMode] = useState(setup?.owner_username ? "login" : "create");

  const [username, setUsername] = useState(
    setup?.owner_username || ""
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (setup?.owner_username) {
      setMode("login");
      setUsername(setup.owner_username);
    }
  }, [setup]);

  const submit = async (event) => {
    event.preventDefault();

    setError("");

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    if (mode === "create" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "create") {
        const { data, error: rpcError } = await supabase.rpc(
          "owner_create",
          {
            p_username: username.trim(),
            p_password: password,
          }
        );

        if (rpcError) throw rpcError;

        onSuccess({
          username: username.trim(),
          password,
          ...((Array.isArray(data) ? data[0] : data) || {}),
        });
      } else {
        const { data, error: rpcError } = await supabase.rpc(
          "owner_login",
          {
            p_username: username.trim(),
            p_password: password,
          }
        );

        if (rpcError) throw rpcError;

        const result = Array.isArray(data) ? data[0] : data;

        if (result === false || result?.success === false) {
          throw new Error("Invalid username or password.");
        }

        onSuccess({
          username: username.trim(),
          password,
          ...(result || {}),
        });
      }
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="modal auth-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={19} />
        </button>

        <div className="auth-icon">
          <KeyRound size={25} />
        </div>

        <div className="auth-title">
          <span className="page-kicker">
            {mode === "create" ? "FIRST TIME SETUP" : "OWNER ACCESS"}
          </span>

          <h2>
            {mode === "create"
              ? "Create owner account"
              : "Welcome back"}
          </h2>

          <p>
            {mode === "create"
              ? "Create the private account used to edit family expenses."
              : "Sign in to manage your Dream Home finances."}
          </p>
        </div>

        {error && <div className="notice error-notice">{error}</div>}

        <form className="form" onSubmit={submit}>
          <label>
            <span>Username</span>

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busy || Boolean(setup?.owner_username)}
              placeholder="Owner username"
            />
          </label>

          <label>
            <span>Password</span>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "create" ? "new-password" : "current-password"
              }
              disabled={busy}
              placeholder="Password"
            />
          </label>

          {mode === "create" && (
            <label>
              <span>Confirm password</span>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
                placeholder="Confirm password"
              />
            </label>
          )}

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
              {busy ? (
                <>
                  <span className="button-loader" />
                  Please wait
                </>
              ) : (
                <>
                  <Lock size={16} />
                  {mode === "create" ? "Create Account" : "Login"}
                </>
              )}
            </button>
          </div>
        </form>

        {!setup?.owner_username && mode === "login" && (
          <button
            className="switch-auth"
            onClick={() => {
              setMode("create");
              setError("");
            }}
          >
            Create the owner account instead
          </button>
        )}

        {setup?.owner_username && mode === "login" && (
          <div className="privacy">
            <Lock size={14} />
            Owner access is required only for editing data.
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   EXPENSE MODAL
========================================================= */

function ExpenseModal({
  expense,
  categories,
  persons,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    title: expense?.title || "",
    amount: expense?.amount || "",
    category: expense?.category || categories[0]?.name || "Other",
    expense_date:
      expense?.expense_date ||
      new Date().toISOString().slice(0, 10),
    description: expense?.description || expense?.note || "",
    payment_method: expense?.payment_method || "",
    person_id: expense?.person_id || "",
    paid_by: expense?.paid_by || "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Please enter an expense title.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!form.expense_date) {
      setError("Please select a date.");
      return;
    }

    setBusy(true);

    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        amount: Number(form.amount),
      });
    } catch (err) {
      setError(err?.message || "Unable to save expense.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title-with-icon">
            <div className="modal-person-icon expense-modal-icon">
              <ReceiptIndianRupee size={21} />
            </div>

            <div>
              <span className="page-kicker">
                {expense ? "UPDATE" : "NEW TRANSACTION"}
              </span>

              <h2>
                {expense ? "Edit expense" : "Add expense"}
              </h2>
            </div>
          </div>

          <button className="modal-close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        {error && <div className="notice error-notice">{error}</div>}

        <form className="form" onSubmit={submit}>
          <div className="grid">
            <label className="full">
              <span>Expense title</span>

              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Monthly groceries"
                autoFocus
              />
            </label>

            <label>
              <span>Amount</span>

              <div className="money-input">
                <span>₹</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  placeholder="0"
                />
              </div>
            </label>

            <label>
              <span>Date</span>

              <input
                type="date"
                value={form.expense_date}
                onChange={(e) =>
                  update("expense_date", e.target.value)
                }
              />
            </label>

            <label>
              <span>Category</span>

              <select
                value={form.category}
                onChange={(e) =>
                  update("category", e.target.value)
                }
              >
                {categories.length > 0 ? (
                  categories.map((category) => (
                    <option
                      key={category.id || category.name}
                      value={category.name}
                    >
                      {category.name}
                    </option>
                  ))
                ) : (
                  <>
                    {Object.keys(CATEGORY_ICONS).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            <label>
              <span>Payment method</span>

              <select
                value={form.payment_method}
                onChange={(e) =>
                  update("payment_method", e.target.value)
                }
              >
                <option value="">Select</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              <span>Person</span>

              <select
                value={form.person_id}
                onChange={(e) =>
                  update("person_id", e.target.value)
                }
              >
                <option value="">Not assigned</option>

                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Paid by</span>

              <input
                value={form.paid_by}
                onChange={(e) =>
                  update("paid_by", e.target.value)
                }
                placeholder="Name"
              />
            </label>

            <label className="full">
              <span>Note</span>

              <textarea
                rows="3"
                value={form.description}
                onChange={(e) =>
                  update("description", e.target.value)
                }
                placeholder="Optional note..."
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>

            <button className="primary" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="button-loader" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={17} />
                  {expense ? "Save Changes" : "Add Expense"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   PERSON MODAL
========================================================= */

function PersonModal({ person, onClose, onSave }) {
  const [name, setName] = useState(person?.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please enter a person's name.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onSave({
        name: name.trim(),
      });
    } catch (err) {
      setError(err?.message || "Unable to save person.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="modal person-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title-with-icon">
            <div className="modal-person-icon">
              <UsersIcon size={21} />
            </div>

            <div>
              <span className="page-kicker">
                {person ? "UPDATE MEMBER" : "FAMILY MEMBER"}
              </span>

              <h2>
                {person ? "Edit person" : "Add person"}
              </h2>
            </div>
          </div>

          <button className="modal-close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        {error && <div className="notice error-notice">{error}</div>}

        <form className="form" onSubmit={submit}>
          <label>
            <span>Person's name</span>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vishwad"
              autoFocus
            />
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

            <button className="primary" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="button-loader" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={17} />
                  {person ? "Save Changes" : "Add Person"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY / LOADING
========================================================= */

function LoadingBlock() {
  return (
    <div className="loading-block card">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
    </div>
  );
}

function EmptyExpenses({ owner, onAdd }) {
  return (
    <div className="empty card">
      <div className="empty-icon">
        <Receipt size={32} />
      </div>

      <strong>No expenses found</strong>

      <span>
        {owner
          ? "Add your first expense to start tracking your household spending."
          : "There are no expenses matching the current filters."}
      </span>

      {owner && (
        <button className="primary" onClick={onAdd}>
          <Plus size={17} />
          Add Expense
        </button>
      )}
    </div>
  );
}

/* =========================================================
   USERS ICON
========================================================= */

function UsersIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Edit3,
  Home,
  Lock,
  LogOut,
  Plus,
  ReceiptIndianRupee,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  WalletCards,
  X,
  Check,
  Eye,
  KeyRound,
  Smartphone
} from 'lucide-react';

import { supabase } from './supabase';

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(n || 0));

const dateText = v =>
  new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

const sumBy = (a, f) => {
  const m = {};
  a.forEach(x => {
    const k = f(x);
    m[k] = (m[k] || 0) + Number(x.amount);
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

/* Fixes broken database emoji such as "��️".
   Valid icons from the database are still used when available. */
const categoryFallbacks = {
  materials: '🧱',
  material: '🧱',
  labour: '👷',
  labor: '👷',
  payments: '💳',
  payment: '💳',
  electrical: '⚡',
  plumbing: '🔧',
  furniture: '🪑',
  transport: '🚚',
  travel: '🚗',
  food: '🍽️',
  groceries: '🛒',
  household: '🏠',
  appliances: '🔌',
  tools: '🛠️',
  medical: '💊',
  education: '📚',
  other: '🏷️'
};

function categoryIcon(category) {
  const name = String(category?.name || '').trim().toLowerCase();
  const dbIcon = String(category?.icon || '');

  if (dbIcon && !dbIcon.includes('�')) return dbIcon;

  return categoryFallbacks[name] || '🏷️';
}

export default function App() {
  const [owner, setOwner] = useState(
    () => sessionStorage.getItem('dreamhome_owner') === 'true'
  );
  const [setup, setSetup] = useState(null);
  const [boot, setBoot] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = e => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('owner_username')
        .eq('id', true)
        .single();

      setSetup(!error && !!data?.owner_username);
      setBoot(false);
    })();
  }, []);

  if (boot) {
    return (
      <div className="center splash">
        <div className="splash-card">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Dream Home" />
          <b>Dream Home</b>
          <span>Family Expense Tracker</span>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      owner={owner}
      setup={setup}
      setOwner={v => {
        setOwner(v);

        if (v) {
          sessionStorage.setItem('dreamhome_owner', 'true');
        } else {
          sessionStorage.removeItem('dreamhome_owner');
        }
      }}
      installPrompt={installPrompt}
      installApp={installApp}
    />
  );
}

function Dashboard({
  owner,
  setup,
  setOwner,
  installPrompt,
  installApp
}) {
  const [tab, setTab] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [err, setErr] = useState('');
  const [auth, setAuth] = useState(null);

  const [ownerCred, setOwnerCred] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem('dreamhome_credentials') || 'null'
      );
    } catch {
      return null;
    }
  });

  async function load() {
    const [e, c] = await Promise.all([
      supabase
        .from('expenses')
        .select('*,category:categories(id,name,icon)')
        .order('expense_date', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .order('name')
    ]);

    if (e.error || c.error) {
      setErr(e.error?.message || c.error?.message);
    } else {
      setExpenses(e.data || []);
      setCats(c.data || []);
      setErr('');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      expenses.filter(x => {
        const q = search.toLowerCase().trim();

        return (
          (!q ||
            String(x.title || '').toLowerCase().includes(q) ||
            String(x.category?.name || '').toLowerCase().includes(q) ||
            String(x.paid_by || '').toLowerCase().includes(q)) &&
          (month === 'all' || String(x.expense_date).startsWith(month))
        );
      }),
    [expenses, search, month]
  );

  const total = expenses.reduce(
    (s, x) => s + Number(x.amount),
    0
  );

  const category = useMemo(
    () => sumBy(expenses, x => x.category?.name || 'Other'),
    [expenses]
  );

  const member = useMemo(
    () => sumBy(expenses, x => x.paid_by || 'Unknown'),
    [expenses]
  );

  const monthly = useMemo(
    () => sumBy(expenses, x => String(x.expense_date).slice(0, 7)),
    [expenses]
  );

  function logout() {
    setOwner(false);
    setOwnerCred(null);
    sessionStorage.removeItem('dreamhome_credentials');
    sessionStorage.removeItem('dreamhome_owner');
    setTab('dashboard');
  }

  async function del(id) {
    if (!ownerCred) {
      setErr('Owner session missing. Please login again.');
      return;
    }

    if (!confirm('Delete this expense?')) return;

    const { data, error } = await supabase.rpc(
      'owner_delete_expense',
      {
        p_username: ownerCred.username,
        p_password: ownerCred.password,
        p_id: id
      }
    );

    if (error || !data?.ok) {
      setErr(error?.message || data?.message || 'Delete failed');
    } else {
      await load();
    }
  }

  function csv() {
    const rows = [
      ['Date', 'Expense', 'Category', 'Amount', 'Paid By', 'Notes'],
      ...filtered.map(x => [
        x.expense_date,
        x.title,
        x.category?.name || '',
        x.amount,
        x.paid_by,
        x.notes || ''
      ])
    ];

    const s = rows
      .map(r =>
        r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')
      )
      .join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv' }));
    a.download = 'dream-home-expenses.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-icon"
            src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
            alt="Dream Home"
          />
          <div>
            <b>Dream Home</b>
            <span>Family Expense Tracker</span>
          </div>
        </div>

        <div className="head-actions">
          {installPrompt && (
            <button
              className="secondary small install-button"
              onClick={installApp}
              type="button"
            >
              <Smartphone size={15} />
              Install App
            </button>
          )}

          <span className={`mode ${owner ? 'edit' : ''}`}>
            {owner ? (
              <>
                <KeyRound size={13} />
                EDIT MODE
              </>
            ) : (
              <>
                <Eye size={13} />
                VIEW ONLY
              </>
            )}
          </span>

          {owner ? (
            <button
              className="secondary small"
              onClick={logout}
              type="button"
            >
              <LogOut size={15} />
              Logout
            </button>
          ) : (
            <button
              className="primary small"
              onClick={() => setAuth('login')}
              type="button"
            >
              <Lock size={15} />
              Owner Login
            </button>
          )}
        </div>
      </header>

      <div className="layout">
        <aside>
          <div className="side-brand">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
            <div>
              <b>Dream Home</b>
              <small>Expense Tracker</small>
            </div>
          </div>

          <div className="nav-list">
            <Nav t={tab} set={setTab} v="dashboard" i={<BarChart3 />}>
              Dashboard
            </Nav>
            <Nav t={tab} set={setTab} v="expenses" i={<ReceiptIndianRupee />}>
              Expenses
            </Nav>
            <Nav t={tab} set={setTab} v="summary" i={<TrendingUp />}>
              Summary
            </Nav>
          </div>

          <div className="side-bottom">
            <div className="cloud-dot">☁</div>
            <div>
              <b>Cloud Synced</b>
              <small>
                {owner
                  ? 'You can add, edit and manage expenses.'
                  : 'Your family can view expenses securely.'}
              </small>
            </div>
          </div>
        </aside>

        <main>
          {err && (
            <div className="error">
              <span>{err}</span>
              <button onClick={() => setErr('')} type="button">
                <X size={15} />
              </button>
            </div>
          )}

          {tab === 'dashboard' && (
            <>
              <Head
                title="Welcome back! 👋"
                sub="Here's the overview of your Dream Home expenses."
                action={
                  owner ? (
                    <button
                      type="button"
                      className="primary add-button"
                      onClick={() => setAuth('expense')}
                    >
                      <Plus />
                      Add Expense
                    </button>
                  ) : null
                }
              />

              <Stats
                total={total}
                count={expenses.length}
                members={member.length}
                categories={category.length}
              />

              <div className="dashboard-grid">
                <Card title="Top Categories" icon={<BarChart3 size={18} />}>
                  <Bars items={category.slice(0, 6)} total={total} />
                </Card>

                <Card title="Paid By" icon={<Users size={18} />}>
                  <Bars items={member.slice(0, 6)} total={total} />
                </Card>

                <Card title="Monthly Spending" icon={<TrendingUp size={18} />}>
                  <Bars items={monthly.slice(0, 6)} total={total} />
                </Card>
              </div>

              <Card
                title="Recent Expenses"
                icon={<ReceiptIndianRupee size={18} />}
              >
                <Table
                  rows={expenses.slice(0, 7)}
                  owner={owner}
                  edit={x =>
                    setAuth({
                      type: 'expense',
                      expense: x
                    })
                  }
                  del={del}
                />
              </Card>
            </>
          )}

          {tab === 'expenses' && (
            <>
              <Head
                title="Expenses"
                sub="Every purchase and payment for the home."
                action={
                  owner ? (
                    <button
                      type="button"
                      className="primary add-button"
                      onClick={() => setAuth('expense')}
                    >
                      <Plus />
                      Add Expense
                    </button>
                  ) : null
                }
              />

              <div className="toolbar">
                <div className="search">
                  <Search size={18} />
                  <input
                    placeholder="Search expenses…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <input
                  type="month"
                  value={month === 'all' ? '' : month}
                  onChange={e => setMonth(e.target.value || 'all')}
                />

                <button className="secondary" onClick={csv} type="button">
                  <Download />
                  CSV
                </button>
              </div>

              <Card>
                <div className="result">
                  <span>{filtered.length} records</span>
                  <b>
                    {money(
                      filtered.reduce(
                        (s, x) => s + Number(x.amount),
                        0
                      )
                    )}
                  </b>
                </div>

                <Table
                  rows={filtered}
                  owner={owner}
                  edit={x =>
                    setAuth({
                      type: 'expense',
                      expense: x
                    })
                  }
                  del={del}
                />
              </Card>
            </>
          )}

          {tab === 'summary' && (
            <>
              <Head
                title="Summary"
                sub="Understand where the home budget is going."
              />

              <Stats
                total={total}
                count={expenses.length}
                members={member.length}
                categories={category.length}
              />

              <div className="two">
                <Card title="Category Summary" icon={<BarChart3 size={18} />}>
                  <Bars items={category} total={total} />
                </Card>

                <Card title="People Summary" icon={<Users size={18} />}>
                  <Bars items={member} total={total} />
                </Card>
              </div>

              <Card title="Monthly Spending" icon={<TrendingUp size={18} />}>
                <Bars items={monthly} total={total} />
              </Card>
            </>
          )}
        </main>
      </div>

      {auth === 'login' && (
        <OwnerModal
          mode={setup ? 'login' : 'create'}
          setup={setup}
          close={() => setAuth(null)}
          success={cred => {
            setOwner(true);
            setOwnerCred(cred);
            sessionStorage.setItem(
              'dreamhome_credentials',
              JSON.stringify(cred)
            );
            sessionStorage.setItem('dreamhome_owner', 'true');
            setAuth(null);
          }}
        />
      )}

      {auth === 'expense' && (
        <ExpenseModal
          expense={null}
          cats={cats}
          close={() => setAuth(null)}
          saved={async () => {
            setAuth(null);
            await load();
          }}
          ownerCred={ownerCred}
        />
      )}

      {typeof auth === 'object' && auth?.type === 'expense' && (
        <ExpenseModal
          expense={auth.expense || null}
          cats={cats}
          close={() => setAuth(null)}
          saved={async () => {
            setAuth(null);
            await load();
          }}
          ownerCred={ownerCred}
        />
      )}
    </>
  );
}

function Nav({ t, set, v, i, children }) {
  return (
    <button
      type="button"
      className={t === v ? 'nav active' : 'nav'}
      onClick={() => set(v)}
    >
      {i}
      <span>{children}</span>
    </button>
  );
}

function Head({ title, sub, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <section className="card">
      {title && (
        <div className="card-title">
          <div className="card-title-left">
            {icon && <span className="card-icon">{icon}</span>}
            <b>{title}</b>
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

function Stats({ total, count, members, categories }) {
  return (
    <div className="stats">
      <Stat
        i={<WalletCards />}
        l="Total Spent"
        v={money(total)}
        note="All time"
      />
      <Stat
        i={<ReceiptIndianRupee />}
        l="Total Expenses"
        v={count}
        note="All time"
      />
      <Stat
        i={<Users />}
        l="People"
        v={members}
        note="Contributed"
      />
      <Stat
        i={<Settings />}
        l="Categories"
        v={categories}
        note="Used"
      />
    </div>
  );
}

function Stat({ i, l, v, note }) {
  return (
    <div className="stat card">
      <div className="stat-icon">{i}</div>
      <div className="stat-copy">
        <small>{l}</small>
        <b>{v}</b>
        <span>{note}</span>
      </div>
    </div>
  );
}

function Bars({ items, total }) {
  return (
    <div className="bars">
      {items.length ? (
        items.map(([n, v]) => (
          <div key={n}>
            <div className="bar-top">
              <span>{n}</span>
              <b>
                {money(v)}{' '}
                <small>
                  {total ? Math.round((v / total) * 100) : 0}%
                </small>
              </b>
            </div>

            <div className="track">
              <div
                className="fill"
                style={{
                  width: `${Math.max(
                    total ? (v / total) * 100 : 0,
                    2
                  )}%`
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <div className="empty">No expenses yet.</div>
      )}
    </div>
  );
}

function Table({ rows, owner, edit, del }) {
  if (!rows.length) {
    return <div className="empty">No expenses found.</div>;
  }

  return (
    <>
      <div className="table-wrap desktop-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Expense</th>
              <th>Category</th>
              <th>Paid By</th>
              <th className="right">Amount</th>
              {owner && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {rows.map(x => (
              <tr key={x.id}>
                <td>{dateText(x.expense_date)}</td>
                <td>
                  <b>{x.title}</b>
                  {x.notes && <small>{x.notes}</small>}
                </td>
                <td>
                  <span className="category-chip">
                    <span className="category-emoji">{categoryIcon(x.category)}</span>
                    {x.category?.name || 'Other'}
                  </span>
                </td>
                <td>{x.paid_by}</td>
                <td className="right amount">{money(x.amount)}</td>
                {owner && (
                  <td className="actions-cell">
                    <button className="icon action-edit" onClick={() => edit(x)} type="button" title="Edit">
                      <Edit3 size={15} />
                    </button>
                    <button className="icon danger" onClick={() => del(x.id)} type="button" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-expenses">
        {rows.map(x => (
          <article className="expense-card" key={x.id}>
            <div className="expense-card-top">
              <div className="expense-card-icon">{categoryIcon(x.category)}</div>
              <div className="expense-card-title">
                <b>{x.title}</b>
                <span>{dateText(x.expense_date)}</span>
              </div>
              <strong>{money(x.amount)}</strong>
            </div>

            <div className="expense-card-meta">
              <span className="category-pill">
                {x.category?.name || 'Other'}
              </span>
              <span className="paid-pill">
                Paid by <b>{x.paid_by}</b>
              </span>
            </div>

            {x.notes && <p className="expense-card-note">{x.notes}</p>}

            {owner && (
              <div className="expense-card-actions">
                <button className="mobile-action edit-mobile" onClick={() => edit(x)} type="button">
                  <Edit3 size={15} /> Edit
                </button>
                <button className="mobile-action delete-mobile" onClick={() => del(x.id)} type="button">
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function OwnerModal({ mode, setup, close, success }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');

    const fn = mode === 'create' ? 'owner_create' : 'owner_login';

    const { data, error } = await supabase.rpc(fn, {
      p_username: u.trim(),
      p_password: p
    });

    if (error || !data?.ok) {
      setErr(
        error?.message ||
          data?.message ||
          'Something went wrong.'
      );
    } else {
      success({
        username: u.trim().toLowerCase(),
        password: p
      });
    }

    setBusy(false);
  }

  return (
    <div className="backdrop">
      <div className="modal auth-modal">
        <div className="modal-head">
          <div className="auth-title">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Dream Home" />
            <div>
              <h2>
                {mode === 'create'
                  ? 'Create Owner Login'
                  : 'Owner Login'}
              </h2>
              <p>
                {mode === 'create'
                  ? 'Create the edit credential for your Dream Home tracker.'
                  : 'Enter the shared edit credential.'}
              </p>
            </div>
          </div>

          <button
            className="icon"
            onClick={close}
            type="button"
          >
            <X />
          </button>
        </div>

        <form className="form" onSubmit={go}>
          <label>
            Username
            <input
              value={u}
              onChange={e => setU(e.target.value)}
              autoCapitalize="none"
              required
              placeholder="dreamhome"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={p}
              onChange={e => setP(e.target.value)}
              minLength={8}
              required
              placeholder="At least 8 characters"
            />
          </label>

          {err && <div className="notice">{err}</div>}

          <button
            className="primary full"
            disabled={busy}
            type="submit"
          >
            {busy
              ? 'Please wait…'
              : mode === 'create'
              ? 'Create Owner Account'
              : 'Login & Enable Editing'}
          </button>
        </form>

        {mode === 'create' && (
          <small className="privacy">
            This is an app login, not your Supabase login.
          </small>
        )}
      </div>
    </div>
  );
}

function ExpenseModal({
  expense,
  cats,
  close,
  saved,
  ownerCred
}) {
  const [date, setDate] = useState(
    expense?.expense_date ||
      new Date().toISOString().slice(0, 10)
  );

  const [title, setTitle] = useState(expense?.title || '');

  const [cat, setCat] = useState(
    expense?.category_id || cats[0]?.id || ''
  );

  const [amount, setAmount] = useState(expense?.amount || '');
  const [paid, setPaid] = useState(expense?.paid_by || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();

    if (!ownerCred) {
      setErr('Owner session missing. Please login again.');
      return;
    }

    if (!cat) {
      setErr('Please select a category.');
      return;
    }

    setBusy(true);
    setErr('');

    const args = {
      p_username: ownerCred.username,
      p_password: ownerCred.password,
      p_expense_date: date,
      p_title: title.trim(),
      p_category_id: cat,
      p_amount: Number(amount),
      p_paid_by: paid.trim(),
      p_notes: notes.trim() || null
    };

    const { data, error } = await supabase.rpc(
      expense
        ? 'owner_update_expense'
        : 'owner_add_expense',
      expense
        ? { ...args, p_id: expense.id }
        : args
    );

    if (error || !data?.ok) {
      setErr(
        error?.message ||
          data?.message ||
          'Save failed.'
      );
    } else {
      await saved();
    }

    setBusy(false);
  }

  return (
    <div className="backdrop">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>{expense ? 'Edit Expense' : 'Add Expense'}</h2>
            <p>Record a Dream Home payment.</p>
          </div>

          <button
            className="icon"
            onClick={close}
            type="button"
          >
            <X />
          </button>
        </div>

        <form className="form" onSubmit={save}>
          <div className="grid">
            <label>
              Date
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </label>

            <label>
              Amount (₹)
              <input
                type="number"
                min="1"
                step=".01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </label>
          </div>

          <label>
            Expense / Item
            <input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Cement, tiles"
            />
          </label>

          <div className="grid">
            <label>
              Category
              <select
                value={cat}
                onChange={e => setCat(e.target.value)}
                required
              >
                <option value="">Select category</option>

                {cats.map(c => (
                  <option key={c.id} value={c.id}>
                    {categoryIcon(c)} {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Paid By
              <input
                required
                value={paid}
                onChange={e => setPaid(e.target.value)}
                placeholder="Enter person's name"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              rows="3"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </label>

          {err && <div className="notice">{err}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={close}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              {busy ? (
                'Saving…'
              ) : (
                <>
                  <Check />
                  Save Expense
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

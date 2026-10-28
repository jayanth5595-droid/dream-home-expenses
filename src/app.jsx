import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft, BarChart3, Blocks, BookOpen, CalendarDays, Car, Check, CreditCard,
  Download, Droplets, Edit3, Eye, HandCoins, HardHat, HeartPulse, Home, House,
  KeyRound, Lock, LogOut, MoreHorizontal, Plus, Receipt,
  ReceiptIndianRupee, Refrigerator, Search, ShoppingBag, Smartphone,
  Trash2, Truck, Utensils, Wallet, Wrench, X, Zap
} from 'lucide-react';
import { supabase } from './supabase';

const money = n => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(Number(n || 0));

const dateText = v => {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sumBy = (a, f) => {
  const m = {};
  a.forEach(x => {
    const k = f(x);
    m[k] = (m[k] || 0) + Number(x.amount || 0);
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

const categoryIconMap = {
  materials: Blocks, material: Blocks, cement: Blocks, bricks: Blocks,
  labour: HardHat, labor: HardHat, mason: HardHat, masonry: HardHat,
  payments: CreditCard, payment: CreditCard,
  electrical: Zap, electricity: Zap, plumbing: Droplets,
  furniture: Home, transport: Truck, travel: Car, food: Utensils,
  groceries: ShoppingBag, grocery: ShoppingBag, shopping: ShoppingBag,
  household: House, home: House, appliances: Refrigerator,
  tools: Wrench, medical: HeartPulse, health: HeartPulse,
  education: BookOpen, receipt: Receipt, other: MoreHorizontal
};

const categoryAccentMap = {
  materials: 'blue', material: 'blue', cement: 'blue', bricks: 'blue',
  labour: 'green', labor: 'green', mason: 'green', masonry: 'green',
  payments: 'indigo', payment: 'indigo', electrical: 'amber', electricity: 'amber',
  plumbing: 'cyan', furniture: 'violet', transport: 'orange', travel: 'orange',
  food: 'rose', groceries: 'pink', grocery: 'pink', shopping: 'pink',
  household: 'slate', home: 'slate', appliances: 'sky', tools: 'gray',
  medical: 'red', health: 'red', education: 'purple', receipt: 'indigo', other: 'gray'
};

function categoryKey(category) {
  return String(category?.name || '').trim().toLowerCase();
}

function CategoryIcon({ category, size = 16 }) {
  const Icon = categoryIconMap[categoryKey(category)] || MoreHorizontal;
  const accent = categoryAccentMap[categoryKey(category)] || 'blue';
  return (
    <span className={`category-icon category-icon-${accent}`} aria-hidden="true">
      <Icon size={size} strokeWidth={2.15} />
    </span>
  );
}

function categoryLabel(category) {
  return String(category?.name || 'Other');
}

function buildAdvanceBalances(funds, transactions) {
  const fundRemaining = {};
  const byFundHolder = {};
  const byOwnerRemaining = {};
  funds.forEach(f => {
    const id = String(f.id);
    fundRemaining[id] = Number(f.original_amount || 0);
    byFundHolder[id] = {};
  });
  transactions.forEach(t => {
    const fid = String(t.fund_id);
    if (!fundRemaining[fid]) return;
    const amount = Number(t.amount || 0);
    const holders = byFundHolder[fid] || (byFundHolder[fid] = {});
    if (t.transaction_type === 'ADVANCE_CREATED') {
      const to = String(t.to_person_id || '');
      if (to) holders[to] = (holders[to] || 0) + amount;
    } else if (t.transaction_type === 'ADVANCE_TRANSFER' || t.transaction_type === 'ADVANCE_RETURN') {
      const from = String(t.from_person_id || '');
      const to = String(t.to_person_id || '');
      if (from) holders[from] = (holders[from] || 0) - amount;
      if (to) holders[to] = (holders[to] || 0) + amount;
    } else if (t.transaction_type === 'ADVANCE_EXPENSE') {
      const from = String(t.from_person_id || '');
      if (from) holders[from] = (holders[from] || 0) - amount;
      fundRemaining[fid] = Math.max(0, fundRemaining[fid] - amount);
    }
  });
  Object.keys(byFundHolder).forEach(fid => {
    Object.keys(byFundHolder[fid]).forEach(pid => {
      if (Math.abs(byFundHolder[fid][pid]) < 0.004) byFundHolder[fid][pid] = 0;
    });
  });
  funds.forEach(f => {
    const owner = String(f.owner_person_id);
    byOwnerRemaining[owner] = (byOwnerRemaining[owner] || 0) + Number(fundRemaining[String(f.id)] || 0);
  });
  return { fundRemaining, byFundHolder, byOwnerRemaining };
}

// ONE contribution calculation used by Dashboard, Summary and Persons.
// For normal expenses, contribution belongs to expense.person_id.
// For advance-funded expenses, contribution belongs to the advance fund owner.
// The physical payer/holder is intentionally NOT used as the contributor.
function buildContributionStats(expenses, persons, advanceTransactions) {
  const personMap = new Map(persons.map(p => [String(p.id), p]));
  const advanceOwnerByExpense = new Map();

  (advanceTransactions || []).forEach(t => {
    if (t.transaction_type === 'ADVANCE_EXPENSE' && t.expense_id && t.owner_person_id) {
      advanceOwnerByExpense.set(String(t.expense_id), String(t.owner_person_id));
    }
  });

  const totals = new Map();
  const counts = new Map();

  (expenses || []).forEach(expense => {
    const advanceOwnerId = advanceOwnerByExpense.get(String(expense.id));
    let personId = advanceOwnerId || expense.person_id || expense.person?.id;

    // Backward-compatible fallback for older normal expenses that only have paid_by.
    if (!personId && expense.paid_by) {
      const paidName = String(expense.paid_by).trim().toLowerCase();
      const match = persons.find(p => String(p.name || '').trim().toLowerCase() === paidName);
      personId = match?.id;
    }

    const key = personId ? String(personId) : `unknown:${String(expense.paid_by || 'Unknown')}`;
    const amount = Number(expense.amount || 0);
    totals.set(key, (totals.get(key) || 0) + amount);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const items = Array.from(totals.entries()).map(([key, total]) => {
    const person = personMap.get(key);
    const name = person?.name || (key.startsWith('unknown:') ? key.slice(8) : 'Unknown');
    return { id: person?.id || key, name, total, count: counts.get(key) || 0, known: Boolean(person) };
  }).sort((a, b) => b.total - a.total);

  return {
    items,
    knownItems: items.filter(x => x.known),
    byPersonId: new Map(items.filter(x => x.known).map(x => [String(x.id), x])),
    total: (expenses || []).reduce((sum, x) => sum + Number(x.amount || 0), 0)
  };
}

const OWNER_KEY = 'dreamhome_owner';
const CREDENTIALS_KEY = 'dreamhome_credentials';

function getStoredOwner() {
  try { return localStorage.getItem(OWNER_KEY) === 'true'; } catch { return false; }
}

function getStoredCredentials() {
  try { return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || 'null'); } catch { return null; }
}

export default function App() {
  const [owner, setOwner] = useState(getStoredOwner);
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
    try { await installPrompt.userChoice; } catch {}
    setInstallPrompt(null);
  }

  useEffect(() => {
    let active = true;
    async function checkSetup() {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('owner_username')
          .eq('id', true)
          .single();

        if (!active) return;
        setSetup(error ? null : Boolean(data?.owner_username));
      } catch {
        if (active) setSetup(null);
      } finally {
        if (active) setBoot(false);
      }
    }
    checkSetup();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const checkLocalLogin = () => setOwner(getStoredOwner());
    window.addEventListener('focus', checkLocalLogin);
    document.addEventListener('visibilitychange', checkLocalLogin);
    return () => {
      window.removeEventListener('focus', checkLocalLogin);
      document.removeEventListener('visibilitychange', checkLocalLogin);
    };
  }, []);

  if (boot) {
    return (
      <div className="center splash">
        <div className="splash-card">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Dream Home" className="splash-logo" />
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
      setOwner={value => {
        setOwner(value);
        if (value) localStorage.setItem(OWNER_KEY, 'true');
        else localStorage.removeItem(OWNER_KEY);
      }}
      installPrompt={installPrompt}
      installApp={installApp}
    />
  );
}

function Dashboard({ owner, setup, setOwner, installPrompt, installApp }) {
  const [tab, setTab] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [cats, setCats] = useState([]);
  const [persons, setPersons] = useState([]);
  const [advanceFunds, setAdvanceFunds] = useState([]);
  const [advanceTransactions, setAdvanceTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [err, setErr] = useState('');
  const [auth, setAuth] = useState(null);
  const [ownerCred, setOwnerCred] = useState(getStoredCredentials);

  async function load() {
    try {
      const [e, c, p, f, t] = await Promise.all([
        supabase.from('expenses')
          .select('*,category:categories(id,name,icon),person:persons(id,name)')
          .order('expense_date', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('persons').select('*').order('name'),
        supabase.from('advance_funds').select('*').order('created_at', { ascending: false }),
        supabase.from('advance_transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false })
      ]);

      if (e.error || c.error || p.error || f.error || t.error) {
        setErr(e.error?.message || c.error?.message || p.error?.message || f.error?.message || t.error?.message || 'Unable to load data.');
        return;
      }

      setExpenses(e.data || []);
      setCats(c.data || []);
      setPersons(p.data || []);
      setAdvanceFunds(f.data || []);
      setAdvanceTransactions(t.data || []);
      setErr('');
    } catch (error) {
      setErr(error?.message || 'Unable to load data.');
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => expenses.filter(x => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      String(x.title || '').toLowerCase().includes(q) ||
      String(x.category?.name || '').toLowerCase().includes(q) ||
      String(x.person?.name || x.paid_by || '').toLowerCase().includes(q);
    const matchesMonth = month === 'all' || String(x.expense_date).startsWith(month);
    return matchesSearch && matchesMonth;
  }), [expenses, search, month]);

  const total = useMemo(() => expenses.reduce((s, x) => s + Number(x.amount || 0), 0), [expenses]);
  const category = useMemo(() => sumBy(expenses, x => x.category?.name || 'Other'), [expenses]);
  const contribution = useMemo(() => buildContributionStats(expenses, persons, advanceTransactions), [expenses, persons, advanceTransactions]);
  const member = useMemo(() => contribution.knownItems.map(x => [x.name, x.total]), [contribution]);
  const monthly = useMemo(() => sumBy(expenses, x => String(x.expense_date).slice(0, 7)), [expenses]);
  const advanceBalances = useMemo(() => buildAdvanceBalances(advanceFunds, advanceTransactions), [advanceFunds, advanceTransactions]);

  function logout() {
    setOwner(false);
    setOwnerCred(null);
    localStorage.removeItem(OWNER_KEY);
    localStorage.removeItem(CREDENTIALS_KEY);
    setTab('dashboard');
    setAuth(null);
    setErr('');
  }

  async function del(id) {
    if (!ownerCred) return setErr('Owner session missing. Please login again.');
    if (!window.confirm('Delete this expense?')) return;

    try {
      const { data, error } = await supabase.rpc('owner_delete_expense', {
        p_username: ownerCred.username, p_password: ownerCred.password, p_id: id
      });
      if (error || !data?.ok) setErr(error?.message || data?.message || 'Delete failed');
      else await load();
    } catch (error) {
      setErr(error?.message || 'Delete failed');
    }
  }

  function csv() {
    const rows = [
      ['Date', 'Expense', 'Category', 'Amount', 'Paid By', 'Notes'],
      ...filtered.map(x => [
        x.expense_date, x.title, x.category?.name || '', x.amount,
        x.person?.name || x.paid_by || '', x.notes || ''
      ])
    ];
    const s = rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'dream-home-expenses.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Dream Home" />
        </div>
        <div className="head-actions">
          {installPrompt && (
            <button className="secondary small install-button" onClick={installApp} type="button">
              <Smartphone size={15} />Install
            </button>
          )}
          <span className={`mode ${owner ? 'edit' : ''}`}>
            {owner ? <><KeyRound size={13} />EDIT MODE</> : <><Eye size={13} />VIEW ONLY</>}
          </span>
          {owner ? (
            <button className="secondary small" onClick={logout} type="button"><LogOut size={15} />Logout</button>
          ) : (
            <button className="primary small" onClick={() => setAuth('login')} type="button"><Lock size={15} />Owner Login</button>
          )}
        </div>
      </header>

      <div className="layout">
        <aside>
          <div className="side-brand">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
            <div><b>Dream Home</b><small>Family finances</small></div>
          </div>

          <div className="nav-list">
            <Nav t={tab} set={setTab} v="dashboard" i={<Home />}>Dashboard</Nav>
            <Nav t={tab} set={setTab} v="expenses" i={<ReceiptIndianRupee />}>Expenses</Nav>
            <Nav t={tab} set={setTab} v="advances" i={<HandCoins />}>Advances</Nav>
            <Nav t={tab} set={setTab} v="summary" i={<BarChart3 />}>Summary</Nav>
            <Nav t={tab} set={setTab} v="persons" i={<UsersIcon />}>Persons</Nav>
          </div>

          <div className="side-bottom">
            <span className="secure-mark"><Check size={14} /></span>
            <div><b>Cloud synced</b><small>{owner ? 'Editing is enabled for this session.' : 'View-only access is active.'}</small></div>
          </div>
        </aside>

        <main>
          {err && <div className="error"><span>{err}</span><button onClick={() => setErr('')} type="button"><X size={15} /></button></div>}

          {tab === 'dashboard' && (
            <DashboardView total={total} expenses={expenses} category={category} member={member} owner={owner} setAuth={setAuth} setTab={setTab} />
          )}

          {tab === 'expenses' && (
            <ExpensesView filtered={filtered} search={search} setSearch={setSearch}
              month={month} setMonth={setMonth} csv={csv} owner={owner} setAuth={setAuth} del={del} />
          )}

          {tab === 'advances' && (
            <AdvancesView funds={advanceFunds} transactions={advanceTransactions} balances={advanceBalances} persons={persons} owner={owner} ownerCred={ownerCred} setAuth={setAuth} load={load} setErr={setErr} />
          )}

          {tab === 'summary' && (
            <SummaryView total={total} expenses={expenses} category={category} member={member} monthly={monthly} funds={advanceFunds} transactions={advanceTransactions} balances={advanceBalances} persons={persons} />
          )}

          {tab === 'persons' && (
            <PersonsView persons={persons} expenses={expenses} contribution={contribution} owner={owner}
              ownerCred={ownerCred} load={load} setErr={setErr} />
          )}
        </main>
      </div>

      {auth === 'login' && (
        <OwnerModal
          mode={setup === false ? 'create' : 'login'}
          close={() => setAuth(null)}
          success={cred => {
            setOwner(true); setOwnerCred(cred);
            localStorage.setItem(OWNER_KEY, 'true');
            localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(cred));
            setAuth(null);
          }}
        />
      )}

      {auth === 'advance' && (
        <AdvanceModal advance={null} persons={persons}
          close={() => setAuth(null)} saved={async () => { setAuth(null); await load(); }}
          ownerCred={ownerCred} />
      )}

      {(auth === 'advance-transfer' || (typeof auth === 'object' && auth?.type === 'advance-transfer')) && (
        <AdvanceTransferModal fund={typeof auth === 'object' ? auth.fund : null} funds={advanceFunds} transactions={advanceTransactions} balances={advanceBalances} persons={persons}
          close={() => setAuth(null)} saved={async () => { setAuth(null); await load(); }} ownerCred={ownerCred} />
      )}

      {auth === 'expense' && (
        <ExpenseModal expense={null} cats={cats} persons={persons} funds={advanceFunds} transactions={advanceTransactions} balances={advanceBalances}
          close={() => setAuth(null)} saved={async () => { setAuth(null); await load(); }}
          ownerCred={ownerCred} />
      )}

      {typeof auth === 'object' && auth?.type === 'expense' && (
        <ExpenseModal expense={auth.expense || null} cats={cats} persons={persons} funds={advanceFunds} transactions={advanceTransactions} balances={advanceBalances}
          close={() => setAuth(null)} saved={async () => { setAuth(null); await load(); }}
          ownerCred={ownerCred} />
      )}
    </>
  );
}

function DashboardView({ total, expenses, category, member, owner, setAuth, setTab }) {
  return (
    <div className="dashboard-signature">
      <section className="investment-card investment-card-standalone main-total-block dashboard-total-block">
        <div className="investment-main">
          <div className="investment-icon"><House size={28} /></div>
          <div>
            <span className="investment-label">TOTAL INVESTED SO FAR</span>
            <strong>{money(total)}</strong>
            <p>All-time spending across your family</p>
          </div>
        </div>
        <div className="investment-stats">
          <div><span className="stat-icon"><Receipt size={18} /></span><b>{expenses.length}</b><small>Expenses</small></div>
          <div><span className="stat-icon"><Blocks size={18} /></span><b>{category.length}</b><small>Categories</small></div>
          <div><span className="stat-icon"><UsersIcon size={18} /></span><b>{member.length}</b><small>Contributors</small></div>
        </div>
      </section>

      <Card title="Person-wise Contribution" subtitle="Total contribution across all months"
        action={<button className="card-link" onClick={() => setTab('persons')} type="button">View all <span>→</span></button>}>
        <PersonBars items={member} total={total} />
      </Card>

      {owner && (
        <button className="dashboard-add-expense" onClick={() => setAuth('expense')} type="button">
          <Plus size={18} /> Add Expense
        </button>
      )}
    </div>
  );
}

function ExpensesView({ filtered, search, setSearch, month, setMonth, csv, owner, setAuth, del }) {
  return (
    <>
      <Head title="Expenses" sub="A complete record of every home payment."
        action={owner && <button className="primary add-button" onClick={() => setAuth('expense')} type="button"><Plus size={17} />Add Expense</button>} />

      <div className="expense-toolbar">
        <div className="search premium-input"><Search size={17} /><input placeholder="Search expenses" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <label className="month-input"><CalendarDays size={16} /><input type="month" value={month === 'all' ? '' : month} onChange={e => setMonth(e.target.value || 'all')} /></label>
        <button className="secondary" onClick={csv} type="button"><Download size={16} />Export</button>
      </div>

      <section className="expense-overview-main main-total-block">
        <div className="expense-overview-main-info">
          <span className="expense-overview-main-icon"><ReceiptIndianRupee size={21} /></span>
          <div>
            <span className="expense-overview-main-label">EXPENSE OVERVIEW</span>
            <span className="expense-overview-main-count">Showing <b>{filtered.length}</b> {filtered.length === 1 ? 'record' : 'records'}</span>
          </div>
        </div>
        <strong>{money(filtered.reduce((s, x) => s + Number(x.amount || 0), 0))}</strong>
      </section>

      <Card className="expense-list-card">
        <Table rows={filtered} owner={owner} edit={x => setAuth({ type: 'expense', expense: x })} del={del} />
      </Card>
    </>
  );
}

function SummaryView({ total, expenses, category, member, monthly, funds, transactions, balances, persons }) {
  return (
    <>
      <Head title="Summary" sub="See the bigger picture behind your home spending." />
      <section className="summary-hero main-total-block">
        <div className="summary-hero-main">
          <span className="eyebrow">TOTAL INVESTED SO FAR</span>
          <strong>{money(total)}</strong>
          <p>All-time spending across your family</p>
        </div>
        <div className="summary-badge"><BarChart3 size={18} /><span>Financial overview</span></div>
        <div className="summary-hero-stats">
          <div><span><Receipt size={16} /></span><b>{expenses.length}</b><small>Expenses</small></div>
          <div><span><Blocks size={16} /></span><b>{category.length}</b><small>Categories</small></div>
          <div><span><UsersIcon size={16} /></span><b>{member.length}</b><small>Contributors</small></div>
        </div>
      </section>
      <div className="content-grid summary-content">
        <Card title="Category breakdown" subtitle="Share of total spending"><CategoryBars items={category} total={total} /></Card>
        <Card title="Paid by" subtitle="Contribution by person"><PersonBars items={member} total={total} /></Card>
        <Card title="Monthly spending" subtitle="Recent month-to-month view" wide><MonthlyBars items={monthly.slice(0, 8)} /></Card>
        <AdvanceBalanceCard funds={funds} transactions={transactions} balances={balances} persons={persons} />
      </div>
    </>
  );
}

function AdvancesView({ funds, transactions, balances, persons, owner, ownerCred, setAuth, load, setErr }) {
  const personMap = useMemo(() => new Map(persons.map(p => [String(p.id), p.name])), [persons]);
  const totalOriginal = funds.reduce((s, f) => s + Number(f.original_amount || 0), 0);
  const totalRemaining = funds.reduce((s, f) => s + Number(balances.fundRemaining?.[String(f.id)] || 0), 0);
  const totalUsed = Math.max(totalOriginal - totalRemaining, 0);

  async function deleteFund(id) {
    if (!ownerCred) return setErr('Owner session missing. Please login again.');
    if (!window.confirm('Delete this advance fund and its history?')) return;
    try {
      const { data, error } = await supabase.rpc('owner_delete_advance_fund', {
        p_username: ownerCred.username, p_password: ownerCred.password, p_fund_id: id
      });
      if (error || !data?.ok) setErr(error?.message || data?.message || 'Unable to delete advance fund.');
      else await load();
    } catch (error) { setErr(error?.message || 'Unable to delete advance fund.'); }
  }

  return (
    <>
      <Head title="Advances" sub="Track money ownership, who currently holds it, transfers, and spending from advances."
        action={owner && <div className="head-action-group"><button className="secondary add-button" onClick={() => setAuth('advance-transfer')} type="button"><ArrowRightLeft size={16} />Transfer</button><button className="primary add-button" onClick={() => setAuth('advance')} type="button"><Plus size={17} />New Advance</button></div>} />

      <section className="advance-main-block main-total-block">
        <div className="advance-main-left">
          <div className="advance-main-icon"><HandCoins size={25} /></div>
          <div>
            <span className="advance-main-label">ADVANCE BALANCE</span>
            <strong>{money(totalRemaining)}</strong>
            <p>{money(totalUsed)} used from {money(totalOriginal)} created advances</p>
          </div>
        </div>
        <div className="advance-main-stats">
          <div><b>{funds.length}</b><small>Funds</small></div>
          <div><b>{transactions.length}</b><small>Transactions</small></div>
          <div><b>{new Set(funds.map(f => String(f.owner_person_id))).size}</b><small>Owners</small></div>
        </div>
      </section>

      <div className="advance-balance-grid">
        {funds.map(f => {
          const ownerName = personMap.get(String(f.owner_person_id)) || 'Unknown';
          const remaining = Number(balances.fundRemaining?.[String(f.id)] || 0);
          const used = Math.max(Number(f.original_amount || 0) - remaining, 0);
          const holderRows = Object.entries(balances.byFundHolder?.[String(f.id)] || {}).filter(([,v]) => Number(v) > 0.004).sort((a,b)=>b[1]-a[1]);
          return <Card key={f.id} className="advance-fund-card" title={`${ownerName}'s advance`} subtitle={`Created ${dateText(f.created_date || String(f.created_at || '').slice(0,10))}`}>
            <div className="fund-topline"><div><small>ORIGINAL</small><strong>{money(f.original_amount)}</strong></div><div><small>REMAINING</small><strong>{money(remaining)}</strong></div></div>
            <div className="fund-progress"><span style={{width:`${Math.min(100, Number(f.original_amount) ? used / Number(f.original_amount) * 100 : 0)}%`}} /></div>
            <div className="fund-holder-title">Current holders</div>
            {holderRows.length ? holderRows.map(([pid, value]) => <div className="fund-holder-row" key={pid}><span>{personMap.get(pid) || 'Unknown'}</span><b>{money(value)}</b></div>) : <div className="empty compact">No balance remaining.</div>}
            {owner && <div className="fund-actions"><button className="secondary small" type="button" onClick={() => setAuth({type:'advance-transfer', fund:f})}><ArrowRightLeft size={14}/>Move money</button><button className="icon danger" type="button" title="Delete fund" onClick={() => deleteFund(f.id)}><Trash2 size={15}/></button></div>}
          </Card>;
        })}
      </div>

      <Card title="Advance ledger" subtitle="Every creation, transfer, return, and expense is kept as a separate transaction.">
        {!transactions.length ? <div className="empty-state-advance"><div className="advance-empty-icon"><HandCoins size={24}/></div><b>No advance transactions yet</b><p>Create an advance to start tracking money ownership and custody.</p>{owner && <button className="primary" onClick={() => setAuth('advance')} type="button"><Plus size={15}/>Add First Advance</button>}</div> :
          <div className="advance-ledger-list">{transactions.map(t => {
            const from = t.from_person_id ? personMap.get(String(t.from_person_id)) : null;
            const to = t.to_person_id ? personMap.get(String(t.to_person_id)) : null;
            const ownerName = personMap.get(String(t.owner_person_id)) || 'Unknown';
            const label = t.transaction_type === 'ADVANCE_CREATED' ? `${ownerName} → ${to || 'Unknown'}` : t.transaction_type === 'ADVANCE_EXPENSE' ? `${from || 'Holder'} → Expense` : `${from || 'Unknown'} → ${to || 'Unknown'}`;
            const typeLabel = t.transaction_type === 'ADVANCE_CREATED' ? 'Advance created' : t.transaction_type === 'ADVANCE_EXPENSE' ? 'Used for expense' : t.transaction_type === 'ADVANCE_RETURN' ? 'Returned' : 'Transferred';
            return <article className="advance-ledger-row" key={t.id}><span className={`ledger-icon ledger-${t.transaction_type.toLowerCase().replaceAll('_','-')}`}>{t.transaction_type === 'ADVANCE_EXPENSE' ? <Receipt size={18}/> : t.transaction_type === 'ADVANCE_CREATED' ? <Plus size={18}/> : <ArrowRightLeft size={18}/>}</span><div className="ledger-main"><b>{label}</b><span>{typeLabel} · {dateText(t.transaction_date)}{t.notes ? ` · ${t.notes}` : ''}</span></div><strong>{money(t.amount)}</strong></article>;
          })}</div>}
      </Card>
    </>
  );
}

function AdvanceBalanceCard({ funds, transactions, balances, persons }) {
  const personMap = useMemo(() => new Map(persons.map(p => [String(p.id), p.name])), [persons]);
  const rows = Object.entries(balances.byOwnerRemaining || {}).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const total = rows.reduce((s,[,v])=>s+Number(v),0);
  return <Card title="Advance balances" subtitle="Money still held and available to be used"><div className="advance-summary-top"><span><HandCoins size={17}/></span><div><small>REMAINING ADVANCE</small><strong>{money(total)}</strong></div></div>{rows.length ? <div className="advance-summary-list">{rows.map(([id,value])=>{const pct=total?Math.round(value/total*100):0; return <div className="advance-summary-row" key={id}><div><span className="person-dot">{String(personMap.get(id)||'?').slice(0,1).toUpperCase()}</span><b>{personMap.get(id)||'Unknown'}</b></div><strong>{money(value)}</strong><em>{pct}%</em><div className="advance-summary-track"><span style={{width:`${Math.max(pct,2)}%`}}/></div></div>})}</div>:<div className="empty">No advance balance yet.</div>}</Card>;
}

function PersonsView({ persons, contribution, owner, ownerCred, load, setErr }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [personErr, setPersonErr] = useState('');

  // Use the exact same centralized contribution values as Dashboard/Summary.
  const personStats = useMemo(() => persons.map(person => {
    const stat = contribution.byPersonId.get(String(person.id));
    return {
      ...person,
      total: Number(stat?.total || 0),
      count: Number(stat?.count || 0)
    };
  }), [persons, contribution]);

  const grandTotal = contribution.total;

  function startAdd() { setPersonErr(''); setName(''); setEditing({ mode: 'new' }); }
  function startEdit(person) { setPersonErr(''); setName(person?.name || ''); setEditing({ mode: 'edit', person }); }
  function closeModal() { setEditing(null); setName(''); setPersonErr(''); setBusy(false); }

  async function savePerson(e) {
    e.preventDefault();
    setPersonErr('');
    if (!ownerCred) { setPersonErr('Owner session missing. Please login again.'); return; }

    const cleanName = name.trim();
    if (!cleanName) { setPersonErr('Please enter a person name.'); return; }

    setBusy(true);
    const isNew = editing?.mode === 'new';
    const fn = isNew ? 'owner_add_person' : 'owner_update_person';
    const params = isNew
      ? { p_username: ownerCred.username, p_password: ownerCred.password, p_name: cleanName }
      : { p_username: ownerCred.username, p_password: ownerCred.password, p_id: editing.person.id, p_name: cleanName };

    try {
      const { data, error } = await supabase.rpc(fn, params);
      if (error || !data?.ok) { setPersonErr(error?.message || data?.message || 'Unable to save person.'); return; }
      closeModal(); await load();
    } catch (error) {
      setPersonErr(error?.message || 'Unable to save person.');
    } finally { setBusy(false); }
  }

  async function deletePerson(person) {
    setPersonErr('');
    if (!ownerCred) { setPersonErr('Owner session missing. Please login again.'); return; }
    if (!person?.id) { setPersonErr('This person could not be identified.'); return; }
    if (!window.confirm(`Delete "${person.name}"?`)) return;

    try {
      const { data, error } = await supabase.rpc('owner_delete_person', {
        p_username: ownerCred.username, p_password: ownerCred.password, p_id: person.id
      });
      if (error || !data?.ok) setPersonErr(error?.message || data?.message || 'Unable to delete person.');
      else await load();
    } catch (error) { setPersonErr(error?.message || 'Unable to delete person.'); }
  }

  return (
    <>
      <Head title="Persons" sub="Manage the people who contribute to your home expenses."
        action={owner && <button className="primary add-button" onClick={startAdd} type="button"><Plus size={17} />Add Person</button>} />

      <section className="persons-overview main-total-block">
        <div className="persons-overview-main">
          <div className="persons-overview-icon"><UsersIcon size={22} /></div>
          <div><span className="eyebrow-dark">FAMILY CONTRIBUTION</span><strong>{money(grandTotal)}</strong><p>Total spending recorded across all persons</p></div>
        </div>
        <div className="persons-count"><span>PEOPLE</span><strong>{persons.length}</strong><small>{persons.length === 1 ? 'family member' : 'family members'}</small></div>
      </section>

      <Card title="Family Members" subtitle="People available in the Paid By selector">
        {!personStats.length ? (
          <div className="persons-empty">
            <div className="persons-empty-icon"><UsersIcon size={24} /></div>
            <b>No persons added yet</b>
            <p>Add family members here so their names can be selected while recording expenses.</p>
            {owner && <button className="primary" onClick={startAdd} type="button"><Plus size={15} />Add First Person</button>}
          </div>
        ) : (
          <div className="persons-grid">
            {personStats.map(person => {
              const percentage = grandTotal > 0 ? Math.round((person.total / grandTotal) * 100) : 0;
              return (
                <article className="person-card" key={person.id}>
                  <div className="person-card-head">
                    <div className="person-avatar-large">{String(person.name || '?').slice(0, 1).toUpperCase()}</div>
                    <div className="person-card-name"><b>{person.name}</b><span>{person.count === 0 ? 'No expenses yet' : `${person.count} ${person.count === 1 ? 'expense' : 'expenses'}`}</span></div>
                    {owner && <div className="person-card-menu">
                      <button className="icon" type="button" title="Edit person" onClick={() => startEdit(person)}><Edit3 size={15} /></button>
                      <button className="icon danger" type="button" title="Delete person" onClick={() => deletePerson(person)}><Trash2 size={15} /></button>
                    </div>}
                  </div>
                  <div className="person-card-total"><span>Total contribution</span><strong>{money(person.total)}</strong></div>
                  <div className="person-progress">
                    <div className="person-progress-head"><span>Contribution</span><b>{percentage}%</b></div>
                    <div className="person-progress-track"><span style={{ width: `${Math.max(percentage, person.total > 0 ? 2 : 0)}%` }} /></div>
                  </div>
                  <div className="person-card-footer"><span><Receipt size={13} />{person.count} {person.count === 1 ? 'record' : 'records'}</span><span>{percentage}% of total</span></div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <div className="backdrop" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget && !busy) closeModal(); }}>
          <div className="modal person-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title-with-icon">
                <div className="modal-person-icon"><UsersIcon size={19} /></div>
                <div><div className="page-kicker">DREAM HOME</div><h2>{editing.mode === 'new' ? 'Add Person' : 'Edit Person'}</h2><p>{editing.mode === 'new' ? 'Add a person who can be selected when recording expenses.' : "Update the person's name."}</p></div>
              </div>
              <button className="icon" onClick={closeModal} type="button" disabled={busy}><X /></button>
            </div>
            <form className="form" onSubmit={savePerson}>
              <label>Person Name<input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Enter person's name" disabled={busy} /></label>
              {personErr && <div className="notice">{personErr}</div>}
              <div className="modal-actions"><button className="secondary" type="button" onClick={closeModal} disabled={busy}>Cancel</button><button className="primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : <><Check />Save Person</>}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Nav({ t, set, v, i, children }) {
  return <button type="button" className={t === v ? 'nav active' : 'nav'} onClick={() => set(v)}>{i}<span>{children}</span></button>;
}

function Head({ title, sub, action }) {
  return <div className="page-head"><div><div className="page-kicker">DREAM HOME</div><h1>{title}</h1><p>{sub}</p></div>{action}</div>;
}

function Card({ title, subtitle, action, children, wide, className = '' }) {
  return <section className={`card premium-card ${wide ? 'wide' : ''} ${className}`}>{(title || action) && <div className="card-title"><div>{title && <b>{title}</b>}{subtitle && <small>{subtitle}</small>}</div>{action}</div>}{children}</section>;
}

function CategoryBars({ items, total }) {
  if (!items.length) return <div className="empty">No expenses yet.</div>;
  return <div className="premium-bars">{items.map(([name, value]) => {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return <div className="premium-bar" key={name}><div className="premium-bar-head"><div className="premium-label"><CategoryIcon category={{ name }} size={15} /><span>{name}</span></div><b>{money(value)} <em>{pct}%</em></b></div><div className="premium-track"><span style={{ width: `${Math.max(pct, 2)}%` }} /></div></div>;
  })}</div>;
}

function PersonBars({ items, total }) {
  if (!items.length) return <div className="empty">No expenses yet.</div>;
  return <div className="premium-bars">{items.map(([name, value]) => {
    // All pages pass the same centralized contribution totals and same expense total.
    const pct = total > 0 ? Math.round((Number(value || 0) / Number(total)) * 100) : 0;
    return <div className="premium-bar" key={name}><div className="premium-bar-head"><div className="premium-label"><span className="person-dot">{String(name).slice(0, 1).toUpperCase()}</span><span>{name}</span></div><b>{money(value)} <em>{pct}%</em></b></div><div className="premium-track"><span style={{ width: `${Math.max(pct, 2)}%` }} /></div></div>;
  })}</div>;
}

function MonthlyBars({ items }) {
  if (!items.length) return <div className="empty">No monthly data yet.</div>;
  const max = Math.max(...items.map(x => x[1]), 1);
  return <div className="monthly-bars">{items.slice().reverse().map(([name, value]) => {
    const label = new Date(`${name}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });
    return <div className="month-column" key={name}><div className="month-value">{money(value)}</div><div className="month-bar"><span style={{ height: `${Math.max((value / max) * 100, 7)}%` }} /></div><small>{label}</small></div>;
  })}</div>;
}

function Table({ rows, owner, edit, del }) {
  if (!rows.length) return <div className="empty">No expenses found.</div>;
  return <>
    <div className="table-wrap desktop-table">
      <table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Paid By</th><th className="right">Amount</th>{owner && <th>Actions</th>}</tr></thead>
      <tbody>{rows.map(x => <tr key={x.id}>
        <td>{dateText(x.expense_date)}</td>
        <td><b>{x.title}</b>{x.notes && <small>{x.notes}</small>}</td>
        <td><span className="category-chip"><CategoryIcon category={x.category} size={15} />{categoryLabel(x.category)}</span></td>
        <td>{x.person?.name || x.paid_by || '—'}</td>
        <td className="right amount">{money(x.amount)}</td>
        {owner && <td className="actions-cell"><button className="icon action-edit" onClick={() => edit(x)} type="button" title="Edit"><Edit3 size={15} /></button><button className="icon danger" onClick={() => del(x.id)} type="button" title="Delete"><Trash2 size={15} /></button></td>}
      </tr>)}</tbody></table>
    </div>
    <div className="mobile-expenses">{rows.map(x => <article className="expense-card" key={x.id}>
      <div className="expense-card-top"><CategoryIcon category={x.category} size={17} /><div className="expense-card-title"><b>{x.title}</b><span>{dateText(x.expense_date)}</span></div><strong>{money(x.amount)}</strong></div>
      <div className="expense-card-meta"><span>{categoryLabel(x.category)}</span><span>Paid by <b>{x.person?.name || x.paid_by || '—'}</b></span></div>
      {x.notes && <p className="expense-card-note">{x.notes}</p>}
      {owner && <div className="expense-card-actions"><button className="mobile-action edit-mobile" onClick={() => edit(x)} type="button"><Edit3 size={14} />Edit</button><button className="mobile-action delete-mobile" onClick={() => del(x.id)} type="button"><Trash2 size={14} />Delete</button></div>}
    </article>)}</div>
  </>;
}

function OwnerModal({ mode, close, success }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc(mode === 'create' ? 'owner_create' : 'owner_login', {
        p_username: u.trim(), p_password: p
      });
      if (error || !data?.ok) { setErr(error?.message || data?.message || 'Something went wrong.'); return; }
      success({ username: u.trim().toLowerCase(), password: p });
    } catch (error) { setErr(error?.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  return <div className="backdrop"><div className="modal auth-modal">
    <div className="modal-head"><div className="auth-title"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Dream Home" /><div><div className="page-kicker">DREAM HOME</div><h2>{mode === 'create' ? 'Create Owner Login' : 'Owner Login'}</h2><p>{mode === 'create' ? 'Create the edit credential for your tracker.' : 'Enter the shared edit credential.'}</p></div></div><button className="icon" onClick={close} type="button"><X /></button></div>
    <form className="form" onSubmit={go}>
      <label>Username<input value={u} onChange={e => setU(e.target.value)} autoCapitalize="none" autoCorrect="off" required placeholder="Enter username" /></label>
      <label>Password<input type="password" value={p} onChange={e => setP(e.target.value)} minLength={8} required placeholder="Enter password" /></label>
      {err && <div className="notice">{err}</div>}
      <button className="primary full" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'create' ? 'Create Owner Account' : 'Login & Enable Editing'}</button>
    </form>
    {mode === 'create' && <small className="privacy">This is an app login, not your Supabase login.</small>}
  </div></div>;
}

function AdvanceModal({ advance, persons, close, saved, ownerCred }) {
  const [date, setDate] = useState(advance?.created_date || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(advance?.original_amount || '');
  const [ownerPerson, setOwnerPerson] = useState(advance?.owner_person_id || '');
  const [holder, setHolder] = useState(advance?.initial_holder_id || '');
  const [notes, setNotes] = useState(advance?.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save(e) {
    e.preventDefault();
    if (!ownerCred) return setErr('Owner session missing. Please login again.');
    if (!ownerPerson || !holder) return setErr('Please select the money owner and initial holder.');
    if (!Number(amount) || Number(amount) <= 0) return setErr('Please enter a valid advance amount.');
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('owner_create_advance_fund', { p_username: ownerCred.username, p_password: ownerCred.password, p_created_date: date, p_amount: Number(amount), p_owner_person_id: ownerPerson, p_initial_holder_id: holder, p_notes: notes.trim() || null });
      if (error || !data?.ok) { setErr(error?.message || data?.message || 'Unable to create advance.'); return; }
      await saved();
    } catch (error) { setErr(error?.message || 'Unable to create advance.'); }
    finally { setBusy(false); }
  }
  return <div className="backdrop"><div className="modal advance-modal"><div className="modal-head"><div><div className="page-kicker">DREAM HOME</div><h2>New Advance</h2><p>Create a fund whose ownership stays with one person while another person can hold the money.</p></div><button className="icon" onClick={close} type="button" disabled={busy}><X/></button></div><form className="form" onSubmit={save}><div className="grid"><label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label><label>Amount (₹)<input type="number" min="1" step=".01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter amount" disabled={busy}/></label></div><label>Money Owner<select value={ownerPerson} onChange={e=>setOwnerPerson(e.target.value)} required disabled={busy}><option value="">Select owner</option>{persons.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><small className="field-help">This person's contribution remains the owner of the advance.</small></label><label>Initial Holder<select value={holder} onChange={e=>setHolder(e.target.value)} required disabled={busy}><option value="">Who currently holds the money?</option>{persons.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Notes<textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes" disabled={busy}/></label>{err&&<div className="notice">{err}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="primary" disabled={busy||!persons.length}>{busy?'Saving…':<><Check/>Create Advance</>}</button></div></form></div></div>;
}

function AdvanceTransferModal({ fund, funds, transactions, balances, persons, close, saved, ownerCred }) {
  const [fundId, setFundId] = useState(fund?.id || funds[0]?.id || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [err,setErr]=useState('');
  const fundBalances = fundId ? (balances.byFundHolder?.[String(fundId)] || {}) : {};
  const holders = persons.filter(p => Number(fundBalances[String(p.id)] || 0) > 0.004);
  useEffect(()=>{ if(!from && holders[0]) setFrom(holders[0].id); }, [fundId, holders.length]);
  const selectedBalance = Number(fundBalances[String(from)] || 0);
  async function save(e){e.preventDefault(); if(!ownerCred)return setErr('Owner session missing. Please login again.'); if(!fundId||!from||!to)return setErr('Please select the fund, current holder and recipient.'); if(String(from)===String(to))return setErr('Choose a different recipient.'); if(!Number(amount)||Number(amount)<=0)return setErr('Enter a valid transfer amount.'); if(Number(amount)>selectedBalance+0.004)return setErr(`Only ${money(selectedBalance)} is available with this holder.`); setBusy(true);setErr('');try{const {data,error}=await supabase.rpc('owner_transfer_advance',{p_username:ownerCred.username,p_password:ownerCred.password,p_fund_id:fundId,p_transaction_date:date,p_from_person_id:from,p_to_person_id:to,p_amount:Number(amount),p_notes:notes.trim()||null});if(error||!data?.ok){setErr(error?.message||data?.message||'Unable to transfer advance.');return;}await saved();}catch(error){setErr(error?.message||'Unable to transfer advance.');}finally{setBusy(false)}}
  return <div className="backdrop"><div className="modal advance-modal"><div className="modal-head"><div><div className="page-kicker">DREAM HOME</div><h2>Move Advance Money</h2><p>Transfer custody without changing the original owner's contribution or total fund.</p></div><button className="icon" onClick={close} type="button" disabled={busy}><X/></button></div><form className="form" onSubmit={save}><label>Advance Fund<select value={fundId} onChange={e=>{setFundId(e.target.value);setFrom('')}} disabled={busy}><option value="">Select advance fund</option>{funds.map(f=><option key={f.id} value={f.id}>{money(f.original_amount)} · Owner {persons.find(p=>String(p.id)===String(f.owner_person_id))?.name||'Unknown'}</option>)}</select></label><div className="grid"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required disabled={busy}/></label><label>Amount (₹)<input type="number" min="1" step=".01" value={amount} onChange={e=>setAmount(e.target.value)} required disabled={busy} placeholder={`Available ${money(selectedBalance)}`}/></label></div><label>Current Holder<select value={from} onChange={e=>setFrom(e.target.value)} required disabled={busy}><option value="">Select holder</option>{holders.map(p=><option key={p.id} value={p.id}>{p.name} · {money(fundBalances[String(p.id)])}</option>)}</select></label><label>Transfer To<select value={to} onChange={e=>setTo(e.target.value)} required disabled={busy}><option value="">Select recipient</option>{persons.filter(p=>String(p.id)!==String(from)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Notes<textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes" disabled={busy}/></label>{err&&<div className="notice">{err}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="primary" disabled={busy||!funds.length}>{busy?'Saving…':<><ArrowRightLeft/>Transfer Money</>}</button></div></form></div></div>;
}

function ExpenseModal({ expense, cats, persons, funds, transactions, balances, close, saved, ownerCred }) {
  const existingAdvanceTx = expense ? transactions.find(t => String(t.expense_id) === String(expense.id) && t.transaction_type === 'ADVANCE_EXPENSE') : null;
  const [date, setDate] = useState(expense?.expense_date || new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(expense?.title || '');
  const [cat, setCat] = useState(expense?.category_id || cats[0]?.id || '');
  const [amount, setAmount] = useState(expense?.amount || '');
  const [paid, setPaid] = useState(existingAdvanceTx?.from_person_id || expense?.person_id || '');
  const [source, setSource] = useState(expense?.advance_fund_id ? 'advance' : 'own');
  const [fundId, setFundId] = useState(expense?.advance_fund_id || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const eligibleFunds = useMemo(() => funds.filter(f => Number(balances.byFundHolder?.[String(f.id)]?.[String(paid)] || 0) > 0.004), [funds, balances, paid]);

  async function save(e) {
    e.preventDefault();
    if (!ownerCred) return setErr('Owner session missing. Please login again.');
    if (!cat) return setErr('Please select a category.');
    if (!paid) return setErr('Please select who paid for this expense.');
    const selectedPerson = persons.find(p => String(p.id) === String(paid));
    if (!selectedPerson) return setErr('Please select a valid person.');
    if (!title.trim() || Number(amount) <= 0) return setErr('Please enter a valid expense and amount.');
    if (source === 'advance' && !fundId) return setErr('Please select the advance fund used for this expense.');
    if (source === 'advance' && Number(balances.byFundHolder?.[String(fundId)]?.[String(paid)] || 0) + 0.004 < Number(amount)) return setErr(`Only ${money(balances.byFundHolder?.[String(fundId)]?.[String(paid)] || 0)} is available from this advance.`);

    setBusy(true); setErr('');
    const args = {
      p_username: ownerCred.username, p_password: ownerCred.password,
      p_expense_date: date, p_title: title.trim(), p_category_id: cat,
      p_amount: Number(amount), p_paid_by: selectedPerson.name, p_notes: notes.trim() || null
    };

    try {
      const { data, error } = await supabase.rpc(
        expense ? 'owner_update_expense' : 'owner_add_expense',
        expense ? { ...args, p_id: expense.id } : args
      );

      if (error || !data?.ok) { setErr(error?.message || data?.message || 'Save failed.'); return; }

      let savedExpenseId = expense?.id || data?.id || data?.expense_id || data?.data?.id;
      if (!savedExpenseId) {
        const { data: latest } = await supabase.from('expenses')
          .select('id,expense_date,title,amount')
          .eq('expense_date', date).eq('title', title.trim()).eq('amount', Number(amount))
          .order('created_at', { ascending: false }).limit(1);
        savedExpenseId = latest?.[0]?.id;
      }

      if (savedExpenseId) {
        if (source === 'advance') {
          const rpcName = expense?.advance_fund_id ? 'owner_update_advance_expense' : 'owner_record_advance_expense';
          const payload = expense?.advance_fund_id
            ? { p_username: ownerCred.username, p_password: ownerCred.password, p_expense_id: savedExpenseId, p_fund_id: fundId, p_transaction_date: date, p_holder_person_id: selectedPerson.id, p_amount: Number(amount), p_notes: notes.trim() || null }
            : { p_username: ownerCred.username, p_password: ownerCred.password, p_fund_id: fundId, p_transaction_date: date, p_holder_person_id: selectedPerson.id, p_amount: Number(amount), p_expense_id: savedExpenseId, p_notes: notes.trim() || null };
          const { data: advanceData, error: advanceError } = await supabase.rpc(rpcName, payload);
          if (advanceError || !advanceData?.ok) { setErr(advanceError?.message || advanceData?.message || 'Expense saved, but advance could not be linked.'); return; }
        } else if (expense?.advance_fund_id) {
          const { data: unlinkData, error: unlinkError } = await supabase.rpc('owner_unlink_advance_expense', {
            p_username: ownerCred.username, p_password: ownerCred.password, p_expense_id: savedExpenseId, p_person_id: selectedPerson.id, p_paid_by: selectedPerson.name
          });
          if (unlinkError || !unlinkData?.ok) { setErr(unlinkError?.message || unlinkData?.message || 'Expense saved, but advance link could not be removed.'); return; }
        } else {
          const { error: linkError } = await supabase.from('expenses')
            .update({ person_id: selectedPerson.id, paid_by: selectedPerson.name })
            .eq('id', savedExpenseId);
          if (linkError) { setErr(`Expense saved, but person link failed: ${linkError.message}`); return; }
        }
      }
      await saved();
    } catch (error) { setErr(error?.message || 'Save failed.'); }
    finally { setBusy(false); }
  }

  return <div className="backdrop"><div className="modal">
    <div className="modal-head"><div><div className="page-kicker">DREAM HOME</div><h2>{expense ? 'Edit Expense' : 'Add Expense'}</h2><p>Record a home payment.</p></div><button className="icon" onClick={close} type="button"><X /></button></div>
    <form className="form" onSubmit={save}>
      <div className="grid">
        <label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Amount (₹)<input type="number" min="1" step=".01" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
      </div>
      <label>Expense / Item<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter expense or item" /></label>
      <div className="grid">
        <label>Category<select value={cat} onChange={e => setCat(e.target.value)} required><option value="">Select category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Paid By<select value={paid} onChange={e => setPaid(e.target.value)} required><option value="">Select person</option>{persons.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      </div>
      <div className="payment-source"><span>Payment Source</span><div className="source-options"><button type="button" className={source === 'own' ? 'source-option active' : 'source-option'} onClick={() => { setSource('own'); setFundId(''); }}>Own Money</button><button type="button" className={source === 'advance' ? 'source-option active' : 'source-option'} onClick={() => setSource('advance')}>Advance Money</button></div></div>
      {source === 'advance' && <label>Advance Fund<select value={fundId} onChange={e => setFundId(e.target.value)} required><option value="">Select advance fund</option>{eligibleFunds.map(f => { const ownerName = persons.find(p => String(p.id) === String(f.owner_person_id))?.name || 'Unknown'; const avail = balances.byFundHolder?.[String(f.id)]?.[String(paid)] || 0; return <option key={f.id} value={f.id}>{ownerName}'s advance · Available {money(avail)}</option>; })}</select><small className="field-help">The expense will contribute to the advance owner, even though {persons.find(p => String(p.id) === String(paid))?.name || 'the holder'} pays it.</small></label>}
      {!persons.length && <div className="notice">No persons have been added yet. Please add a person from the Persons tab before recording an expense.</div>}
      <label>Notes<textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" /></label>
      {err && <div className="notice">{err}</div>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button type="submit" className="primary" disabled={busy || !persons.length}>{busy ? 'Saving…' : <><Check />Save Expense</>}</button></div>
    </form>
  </div></div>;
}

function UsersIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>;
}

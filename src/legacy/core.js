
/* ======================================================================
   TARKIT v1.0 — Application Layer
   Store → Router → Pages → Handlers
   ====================================================================== */

/* ---------- Icons (Lucide-style SVG) ---------- */
/* ---------- Icon set (Lucide) ----------
   I.<key> returns an SVG string (so existing template-literal usage `${I.home}` keeps working).
   Internal keys map to Lucide PascalCase icon names. Add to ICON_MAP if you need more. */
const ICON_MAP = {
  home: 'Home',
  reportUsers: 'Users',
  chart: 'BarChart3',
  target: 'Target',
  activity: 'Activity',
  building: 'Building2',
  users: 'Users',
  kanban: 'Kanban',
  handshake: 'Handshake',
  icp: 'Heart',
  sparkles: 'Sparkles',
  chevron: 'ChevronDown',
  check: 'Check',
  x: 'X',
  phone: 'Phone',
  mail: 'Mail',
  linkedin: 'Linkedin',
  calendar: 'Calendar',
  trending: 'TrendingUp',
  trendDown: 'TrendingDown',
  bolt: 'Zap',
  edit: 'Pencil',
  trash: 'Trash2',
  wallet: 'Wallet',
  settings: 'Settings',
  briefcase: 'Briefcase',
};
/* PascalCase ('House') → kebab-case ('house') — Lucide's data-lucide format. */
function pascalToKebab(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }

/* Render a Lucide icon to an SVG string by hydrating a hidden host element.
   Works regardless of which export shape this Lucide build uses. */
function renderLucideToString(lucideName) {
  if (!window.lucide?.createIcons) return '';
  const kebab = pascalToKebab(lucideName);
  const host = document.createElement('span');
  host.style.display = 'none';
  host.innerHTML = `<i data-lucide="${kebab}"></i>`;
  document.body.appendChild(host);
  try {
    window.lucide.createIcons({ nameAttr: 'data-lucide', attrs: { 'stroke-width': 2 } });
    // After hydration, the <i> is replaced by an <svg>. Grab its outerHTML.
    const svg = host.querySelector('svg');
    return svg ? svg.outerHTML : '';
  } finally {
    host.remove();
  }
}

const _iconCache = Object.create(null);
const I = new Proxy({}, {
  get(_, key) {
    if (key in _iconCache) return _iconCache[key];
    const lucideName = ICON_MAP[key] || key;
    const svg = renderLucideToString(lucideName);
    if (!svg) console.warn(`[TARKIT] Missing Lucide icon: ${lucideName} (key=${key})`);
    _iconCache[key] = svg;
    return svg;
  },
});

/* ---------- Supabase client ---------- */
const SUPABASE_URL = window.TARKIT_CONFIG.url;
const SUPABASE_ANON = window.TARKIT_CONFIG.anonKey;
const rawDb = window.TARKIT_DEMO_CLIENT || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }
});
const db = window.TarkitData.create(rawDb);
let session = null;
let userId  = null;

/* ---------- UI prefs (per-device, stays in localStorage) ---------- */
const UI_KEY = 'pipelineiq_v1.0_ui';
function loadUi(){
  try { return { sidebarCollapsed:false, theme:'light', collapsedSections:{}, ...(JSON.parse(localStorage.getItem(UI_KEY)||'{}')) }; }
  catch { return { sidebarCollapsed:false, theme:'light', collapsedSections:{} }; }
}
function saveUi(){ localStorage.setItem(UI_KEY, JSON.stringify(store.ui)); }

/* ---------- Default ICP (fallback on first save if no profile exists) ---------- */
const DEFAULT_ICP = {
  profile_name: 'Oracle PMIS/ERP — KSA ICP',
  min_deal_size_sar: 500000,
  target_company_types: ['Government','Semi-Government','PIF','Private','Enterprise','Multinational'],
  preferred_industries: ['Construction','Real Estate'],
  excluded_industries: [],
  target_countries: ['Saudi Arabia','UAE','Qatar'],
  weight_company_type: 25,
  weight_industry: 20,
  weight_company_size: 20,
  weight_deal_potential: 20,
  weight_digital_maturity: 15,
  disqualify_below_size: ['Startup','Small'],
};

/* Stage colors (presentation only — not in DB) */
const STAGE_COLORS = {
  'Qualification':'#64748B','Demo':'#0EA5E9','Proposal':'#8B5CF6',
  'Negotiation':'#F59E0B','Awarding':'#EC4899','Won':'#10B981','Lost':'#EF4444',
};

/* Hardcoded fallbacks — used if Supabase lookup tables return empty/blocked.
   Loaded values from Supabase take precedence. */
const FALLBACK_STAGES = [
  { key:'Qualification', probability:10,  subs:['Initial Contact','Meeting Scheduled','Discovery Completed','Qualified Opportunity'] },
  { key:'Demo',                      probability:25,  subs:['Demo Scheduled','Demo Delivered','Workshop','Proof Of Concept'] },
  { key:'Proposal',                  probability:50,  subs:['Proposal Preparation','Internal Alignment','Proposal Submitted','Proposal Under Review'] },
  { key:'Negotiation',               probability:75,  subs:['Commercial Discussion','Technical Discussion','Final Terms Alignment'] },
  { key:'Awarding',                  probability:90,  subs:['Verbal Approval','Procurement Process','Draft Contract','PO Pending'] },
  { key:'Won',                       probability:100, subs:['Won'] },
  { key:'Lost',                      probability:0,   subs:['Lost'] },
].map(s => ({ ...s, color: STAGE_COLORS[s.key] || '#64748B' }));
const FALLBACK_PRODUCT_LINES = ['Oracle PMIS','Oracle ERP','Oracle Cloud','Other'];
const FALLBACK_SUB_PRODUCT_LINES = ['Oracle Cloud Infrastructure','Oracle Fusion','Primavera Unifier','Oracle Autonomous Database','Primavera P6','Oracle EBS','NetSuite','Aconex','JD Edwards','Primavera Cloud'];

let STAGES = [...FALLBACK_STAGES];
let PRODUCT_LINES = [...FALLBACK_PRODUCT_LINES];
let SUB_PRODUCT_LINES = [...FALLBACK_SUB_PRODUCT_LINES];

const ACTIVITY_TYPES = ['Call','Meeting','Demo'];
const LEGACY_ACTIVITY_TYPES = ['Email','WhatsApp','LinkedIn','Proposal'];
const SAR_PER_USD = 3.75;

/* ---------- Runtime store (populated from Supabase) ---------- */
let store = {
  ui: loadUi(),
  companies: [],
  contacts: [],
  deals: [],
  activities: [],
  icp: { ...DEFAULT_ICP },
  targets: { weekly: {}, annual_sar: 0 },
};

/* ---------- Server ↔ UI adapters ---------- */
function fromDbDeal(r){ return { ...r, database_stage:r.stage, close_date: r.expected_close || null }; }
function toDbDeal(d){
  const { id, owner, close_date, value_usd, database_stage, ...rest } = d;
  return {
    ...rest,
    expected_close: d.expected_close || d.close_date || null,
    actual_close:   d.actual_close   || null,
  };
}
function fromDbActivity(r){ return { ...r, date: r.activity_date }; }
function toDbActivity(a){
  const { id, date, ...rest } = a;
  return { ...rest, activity_date: date || new Date().toISOString().slice(0,10) };
}
function fromDbCompany(r){ return { ...r, created: r.created_at ? r.created_at.slice(0,10) : null }; }
function toDbCompany(c){ const { id, created, icp_score, ...rest } = c; return rest; }
function toDbContact(p){ const { id, ...rest } = p; return rest; }

/* ---------- loadStore: fetch all data from Supabase in parallel ---------- */
async function loadStore(){
  if (!userId) return;
  try {
    const r = await Promise.all([
      db.from('companies').select('*').order('created_at', {ascending:false}),
      db.from('contacts').select('*').order('last_name'),
      db.from('deals').select('*').order('created_at', {ascending:false}),
      db.from('activities').select('*').order('activity_date', {ascending:false}),
      db.from('icp_profiles').select('*').eq('is_default', true).maybeSingle(),
      db.from('activity_targets').select('*').eq('period_type','Weekly'),
      db.from('annual_targets').select('*').eq('year', new Date().getFullYear()).maybeSingle(),
      db.from('lk_product_lines').select('value').order('display_order'),
      db.from('lk_sub_product_lines').select('value').order('display_order'),
      db.from('lk_stages').select('*').order('display_order'),
      db.from('lk_sub_stages').select('*').order('display_order'),
    ]);
    const firstErr = r.find(x => x.error);
    if (firstErr) throw firstErr.error;

    const [companies, contacts, deals, activities, icp, weeklyTgts, annualTgt,
           productLines, subProductLines, stages, subStages] = r;

    store.companies  = (companies.data  || []).map(fromDbCompany);
    store.contacts   = (contacts.data   || []);
    store.deals      = (deals.data      || []).map(fromDbDeal).map(d => {
      if (d.stage === 'Discovery & Qualification') d.stage = 'Qualification';
      return d;
    });
    store.activities = (activities.data || []).map(fromDbActivity);

    store.icp = icp.data ? icp.data : { ...DEFAULT_ICP };

    store.targets.weekly = {};
    (weeklyTgts.data || []).forEach(t => { store.targets.weekly[t.activity_type] = t.target_count; });
    ACTIVITY_TYPES.forEach(ty => { if (store.targets.weekly[ty] == null) store.targets.weekly[ty] = 0; });
    store.targets.annual_sar = annualTgt.data ? Number(annualTgt.data.target_sar) : 0;

    const pl  = (productLines.data    || []).map(x => x.value);
    const spl = (subProductLines.data || []).map(x => x.value);
    const normalizeStageName = (v) => v === 'Discovery & Qualification' ? 'Qualification' : v;
    const st  = (stages.data || []).map(s => {
      const key = normalizeStageName(s.value);
      return {
        key,
        color: STAGE_COLORS[key] || '#64748B',
        probability: s.probability,
        subs: (subStages.data || [])
          .filter(ss => normalizeStageName(ss.parent_stage) === key)
          .sort((a,b) => a.display_order - b.display_order)
          .map(ss => ss.value),
      };
    });
    PRODUCT_LINES     = pl.length  ? pl  : FALLBACK_PRODUCT_LINES.slice();
    SUB_PRODUCT_LINES = spl.length ? spl : FALLBACK_SUB_PRODUCT_LINES.slice();
    STAGES            = st.length  ? st  : FALLBACK_STAGES.slice();
    if (!pl.length || !spl.length || !st.length) {
      console.warn('[TARKIT] One or more lookup tables returned empty. Using fallback constants. Check RLS/grants on lk_* tables.');
    }

    setStatus('ok');
  } catch (e) {
    setStatus('err');
    toast('Load failed: ' + (e.message || e), 'danger');
    throw e;
  }
}
/* Legacy sync shim — every save/delete now writes directly, but UI prefs still persist */
function saveStore(){ saveUi(); }

function setStatus(kind){
  const el = document.getElementById('connStatus');
  if (!el) return;
  el.className = 'status-dot' + (kind==='ok' ? ' ok' : kind==='err' ? ' err' : '');
  el.title = kind==='ok' ? 'Connected to Supabase' : kind==='err' ? 'Connection error' : 'Connecting…';
}

/* ---------- Router ---------- */
const ROUTES = {
  home:      { title:'Home',                   render: page => renderHome(page) },
  reportCC:       { title:'Companies & Contacts', render: page => renderReportCC(page) },
  reportCRM:      { title:'CRM Analytics',        render: page => renderReportCRM(page) },
  reportCSM:      { title:'CSM Analytics',        render: page => renderReportCSM(page) },
  reportActivity: { title:'Activity Progress',    render: page => renderReportActivity(page) },
  icp:       { title:'Ideal Customer Profile', render: page => renderICP(page) },
  target:    { title:'Sales Targets',          render: page => renderTargets(page) },
  activities:{ title:'Activities',             render: page => renderActivities(page) },
  leadProfile:{ title:'Lead Profiling',         render: page => renderLeadProfile(page) },
  companies: { title:'Companies',              render: page => renderCompanies(page) },
  people:    { title:'Contacts',               render: page => renderPeople(page) },
  integrations: { title:'Integrations',         render: page => renderIntegrations(page) },
  findContacts: { title:'Find Contacts',         render: page => renderFindContacts(page) },
  crm:       { title:'CRM — Sales Kanban',     render: page => renderCRMKanban(page) },
  csm:       { title:'Customer Success',       render: page => renderCSM(page) },
  billing:   { title:'Billing & Usage',        render: page => renderBilling(page) },
  settings:  { title:'Settings',               render: page => renderSettings(page) },
};
const router = {
  current: 'home',
  go(key){
    if (!ROUTES[key]) key = 'home';
    this.current = key;
    document.getElementById('topbarTitle').textContent = ROUTES[key].title;
    const page = document.getElementById('page');
    page.innerHTML = '';
    ROUTES[key].render(page);
    // update nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === key));
    page.scrollTop = 0;
  }
};

/* ---------- Sidebar Nav ---------- */
const NAV = [
  { label:'Home', key:'home', items: [
    { key:'home',      label:'Home Page',              icon:I.home,      tip:'Home Page' },
  ]},
  { label:'Analytics', key:'analytics', items: [
    { key:'reportCRM',      label:'CRM',                  icon:I.chart,       tip:'CRM Analytics & Performance' },
    { key:'reportCSM',      label:'CSM',                  icon:I.handshake,   tip:'Customer Success Analytics' },
    { key:'reportActivity', label:'Activity Progress',    icon:I.activity,    tip:'Activities & Weekly Progress' },
    { key:'reportCC',       label:'Companies & Contacts', icon:I.reportUsers, tip:'Companies & Contacts Overview' },
  ]},
  { label:'Sales Intelligence', key:'crmgroup', items: [
    { key:'crm',  label:'CRM',  icon:I.kanban,    tip:'Customer Relationship Management' },
    { key:'csm',  label:'CSM',  icon:I.handshake, tip:'Customer Success Management' },
  ]},
  { label:'Core', key:'intel', items: [
    { key:'icp',        label:'ICP',         icon:I.icp,      tip:'Ideal Customer Profile' },
    { key:'target',     label:'Target',      icon:I.target,   tip:'Sales Target' },
    { key:'activities', label:'Activities',  icon:I.activity, tip:'Sales Activities — Calls, meetings & tasks' },
    { key:'companies',  label:'Companies',   icon:I.building, tip:'Company Directory & Profiling' },
    { key:'people',     label:'Contacts',    icon:I.users,    tip:'Contact Directory & Find Contacts' },
    { key:'integrations', label:'Integrations', icon:I.sparkles, tip:'Connect APIs, MCPs, LLMs' },
  ]},
];

function renderNav(){
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = NAV.map(section => {
    const collapsed = store.ui.collapsedSections[section.key];
    return `
    <div class="nav-section ${collapsed?'collapsed':''}" data-section="${section.key}">
      <div class="section-header" role="button" tabindex="0" aria-expanded="${!collapsed}">
        <span class="section-label">${section.label}</span>
        <span class="section-chevron">${I.chevron}</span>
      </div>
      <div class="nav-list">
        ${section.items.map(item => `
          <button class="nav-item" data-route="${item.key}" data-tip="${item.tip}" aria-label="${item.label}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-item-label">${item.label}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
  }).join('');

  nav.querySelectorAll('.section-header').forEach(h => {
    h.addEventListener('click', e => {
      const section = h.closest('.nav-section');
      const key = section.dataset.section;
      store.ui.collapsedSections[key] = !store.ui.collapsedSections[key];
      section.classList.toggle('collapsed');
      h.setAttribute('aria-expanded', String(!store.ui.collapsedSections[key]));
      saveStore();
    });
  });
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => router.go(btn.dataset.route));
  });
}

/* ---------- Theme & Sidebar toggle ---------- */
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.ui.theme = next;
  saveStore();
  // Refresh charts colors
  if (ROUTES[router.current]) router.go(router.current);
});
document.getElementById('sidebarToggle').addEventListener('click', () => {
  store.ui.sidebarCollapsed = !store.ui.sidebarCollapsed;
  document.getElementById('app').classList.toggle('sidebar-collapsed', store.ui.sidebarCollapsed);
  saveStore();
});

/* ---------- Utilities ---------- */
const SAR = (n) => new Intl.NumberFormat('en-US',{ style:'currency', currency:'SAR', maximumFractionDigits:0 }).format(n);
const USD = (n) => new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD', maximumFractionDigits:0 }).format(n);
const SAR_TO_USD = (n) => USD(Number(n||0) / SAR_PER_USD);
const NUM = (n) => new Intl.NumberFormat('en-US').format(n);
const UID = (p='x') => p + '-' + Math.random().toString(36).slice(2,9);
const todayStr = () => new Date().toISOString().slice(0,10);
function initials(first,last){ return (first?.[0]||'')+(last?.[0]||''); }
function companyById(id){ return store.companies.find(c=>c.id===id); }
function contactById(id){ return store.contacts.find(c=>c.id===id); }
function dealById(id){ return store.deals.find(d=>d.id===id); }

function toast(msg, variant='success', opts={}){
  const t = document.createElement('div');
  t.className = `toast ${variant}`;
  const prefix = variant === 'celebration' ? '🎉 ' : '';
  if (opts.undo) {
    const id = 'undo_' + Math.random().toString(36).slice(2,9);
    t.innerHTML = `<span>${prefix}${msg}</span><button id="${id}" class="btn btn-ghost btn-sm" style="margin-left:12px">Undo</button>`;
    document.getElementById('toasts').appendChild(t);
    document.getElementById(id).addEventListener('click', () => {
      try { opts.undo(); } finally { t.remove(); }
    });
    setTimeout(() => t.remove(), 6000);
  } else {
    t.innerHTML = `<span>${prefix}${msg}</span>`;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
}

/* ---------- ICP Auto-Scoring ---------- */
function scoreCompany(c){
  const icp = store.icp;
  let score = 0;
  // Company type (binary weight)
  if (icp.target_company_types.includes(c.type)) score += icp.weight_company_type;
  else score += icp.weight_company_type * 0.3;
  // Industry
  if (icp.preferred_industries.includes(c.industry)) score += icp.weight_industry;
  else if (icp.excluded_industries.includes(c.industry)) score += 0;
  else score += icp.weight_industry * 0.6;
  // Size
  const sizeRank = { 'Startup':0.2, 'Small':0.4, 'Medium':0.6, 'Large':0.85, 'Enterprise':1.0 };
  score += icp.weight_company_size * (sizeRank[c.size] ?? 0.5);
  // Deal potential (proxy by current deals)
  const bigDeal = store.deals.some(d => d.company_id===c.id && d.value_sar >= icp.min_deal_size_sar);
  score += icp.weight_deal_potential * (bigDeal ? 1 : 0.55);
  // Digital maturity (proxy by ERP known/not)
  const mature = c.erp_current && c.erp_current !== 'Unknown';
  score += icp.weight_digital_maturity * (mature ? 0.9 : 0.55);

  // Disqualifiers
  if (icp.disqualify_below_size.includes(c.size)) score = Math.min(score, 30);

  return Math.round(Math.max(0, Math.min(100, score)));
}
function recomputeAllIcpScores(){
  store.companies.forEach(c => c.icp_score = scoreCompany(c));
  saveStore();
}

/* ---------- Modals ---------- */
function openModal(html){
  const host = document.getElementById('modalHost');
  host.innerHTML = `<div class="modal-backdrop open" id="modalBackdrop" role="dialog" aria-modal="true">${html}</div>`;
  const bd = document.getElementById('modalBackdrop');
  bd.addEventListener('click', e => { if (e.target === bd) closeModal(); });
  document.addEventListener('keydown', escClose);
}
function closeModal(){
  const host = document.getElementById('modalHost');
  host.innerHTML = '';
  document.removeEventListener('keydown', escClose);
}
function escClose(e){ if (e.key==='Escape') closeModal(); }


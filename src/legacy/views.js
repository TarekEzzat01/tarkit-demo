/* =========================================================
   PAGE RENDERERS
   ========================================================= */

/* ---------- Home ---------- */
/* Calm, claude.ai-inspired Home: serif greeting + command box + chips + Today panel.
   The dashboard-y Home (KPIs, weekly progress, pipeline chart) lives now under Analytics. */
const HOME_SPARK_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 1.5l1.6 4.6L18 7.6l-3.4 2.5 1.3 4.2L12 11.6l-3.9 2.7 1.3-4.2L6 7.6l4.4-1.5L12 1.5zM5.5 13l1 2.7 2.8.9-2.4 1.7.9 2.7L5.5 19.4 3.2 21l.9-2.7-2.4-1.7 2.8-.9L5.5 13zM18 14l.9 2.6 2.7.8-2.3 1.6.8 2.6L18 20.1l-2.1 1.5.8-2.6-2.3-1.6 2.7-.8L18 14z"/>
</svg>`;

function _firstName() {
  const u = session?.user;
  if (!u) return 'there';
  return (u.user_metadata?.full_name || u.email?.split('@')[0] || 'there')
    .split(/\s+/)[0]
    .replace(/^./, c => c.toUpperCase());
}
function _greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function renderHome(page){
  const today = todayStr();
  const name  = _firstName();
  const greeting = _greetingWord();

  // Today's meetings — synchronous events that happen on a date
  const meetingTypes = new Set(['Meeting', 'Demo', 'Call']);
  const todaysMeetings = store.activities
    .filter(a => a.date === today && meetingTypes.has(a.type))
    .sort((a,b) => (a.summary || '').localeCompare(b.summary || ''));

  // Today's tasks — anything with a next_action whose due date is today or earlier
  const todaysTasks = store.activities
    .filter(a => a.next_action && a.next_action.trim() && a.next_action_due && a.next_action_due <= today)
    .sort((a,b) => (a.next_action_due || '').localeCompare(b.next_action_due || ''));

  const meetingsHtml = todaysMeetings.length
    ? todaysMeetings.map(a => {
        const c = companyById(a.company_id);
        const p = contactById(a.contact_id);
        return `
          <div class="today-row">
            <span class="today-row-icon">${I[a.type === 'Demo' ? 'sparkles' : a.type === 'Call' ? 'phone' : 'calendar']}</span>
            <div class="today-row-body">
              <div class="today-row-title">${a.summary || a.type}</div>
              <div class="today-row-sub">${[c?.name, p ? `${p.first_name} ${p.last_name}` : null, a.type].filter(Boolean).join(' · ')}</div>
            </div>
          </div>`;
      }).join('')
    : `<div class="today-row empty">Nothing on the calendar today.</div>`;

  const tasksHtml = todaysTasks.length
    ? todaysTasks.map(a => {
        const c = companyById(a.company_id);
        const overdue = a.next_action_due < today;
        return `
          <div class="today-row">
            <span class="today-row-icon">${I.check}</span>
            <div class="today-row-body">
              <div class="today-row-title">${a.next_action}</div>
              <div class="today-row-sub">${[c?.name, overdue ? `Overdue · was ${a.next_action_due}` : 'Due today'].filter(Boolean).join(' · ')}</div>
            </div>
          </div>`;
      }).join('')
    : `<div class="today-row empty">No tasks queued. Nice — go close something.</div>`;

  page.innerHTML = `
    <div class="home-hero">
      <h1 class="home-greeting">
        <span class="greeting-mark">${HOME_SPARK_SVG}</span>
        <span>${greeting}, ${name}</span>
      </h1>

      <button class="home-prompt" onclick="openQuickCapture()" aria-label="Quick capture an activity">
        <div class="home-prompt-placeholder">What's next? Add a deal, log a call, or capture a contact…</div>
        <div class="home-prompt-row">
          <span class="home-prompt-add">${I.bolt}</span>
          <span class="home-prompt-meta"><kbd>Ctrl</kbd>+<kbd>K</kbd></span>
        </div>
      </button>

      <div class="home-chips">
        <button class="home-chip" onclick="openActivityModal()">${I.activity}Log activity</button>
        <button class="home-chip" onclick="openDealModal()">${I.briefcase}+ Deal</button>
        <button class="home-chip" onclick="openCompanyModal()">${I.building}+ Company</button>
        <button class="home-chip" onclick="openContactModal()">${I.users}+ Contact</button>
        <button class="home-chip" onclick="openAIProfile()">${I.sparkles}AI profile</button>
      </div>
    </div>

    <div class="home-today">
      <div class="today-card">
        <div class="today-card-header">
          <div class="today-card-title">Today's meetings</div>
          <div class="today-card-count">${todaysMeetings.length}</div>
        </div>
        ${meetingsHtml}
      </div>
      <div class="today-card">
        <div class="today-card-header">
          <div class="today-card-title">Today's tasks</div>
          <div class="today-card-count">${todaysTasks.length}</div>
        </div>
        ${tasksHtml}
      </div>
    </div>
  `;
}

function kpiCard(label, value, dir, delta, color, icon){
  return `<div class="card span-3">
    <div class="stat">
      <div class="stat-icon" style="background:${color}">${icon.replace('<svg','<svg width=\"20\" height=\"20\"')}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-delta ${dir}">${dir==='up'?'▲':'▼'} ${delta}</div>
    </div>
  </div>`;
}

function renderActivityRow(a){
  const c = companyById(a.company_id); const p = contactById(a.contact_id);
  return `<div class="list-row">
    <div class="avatar-sm" style="background:${typeColor(a.type)}">${a.type[0]}</div>
    <div style="flex:1; min-width:0">
      <div class="flex gap-2 items-center">
        <span class="badge">${a.type}</span>
        <span style="font-weight:500">${a.summary||''}</span>
      </div>
      <div class="text-sm text-muted truncate">${c?.name||''}${p?' · '+p.first_name+' '+p.last_name:''} · ${a.date}</div>
    </div>
    ${a.next_action?`<span class="text-sm text-muted" data-tip="Next action">↗ ${a.next_action}</span>`:''}
  </div>`;
}

async function syncToCRM(){
  await loadStore();
  toast('Synced — all reports refreshed');
  router.go(router.current);
}

function greetingTime(){ const h = new Date().getHours(); return h<12?'morning':h<18?'afternoon':'evening'; }
function getWeekStart(){
  const d = new Date();
  const day = d.getDay(); // 0 Sun
  d.setDate(d.getDate()-day);
  return d.toISOString().slice(0,10);
}
function typeColor(t){ return { Call:'#0EA5E9', Meeting:'#10B981', Demo:'#8B5CF6', Email:'#64748B', WhatsApp:'#22C55E', LinkedIn:'#0A66C2', Proposal:'#F59E0B' }[t]||'#6366F1'; }
function icpColor(s){ return s>=85?'#10B981':s>=70?'#0EA5E9':s>=50?'#F59E0B':'#EF4444'; }
function stageColor(s){ return STAGES.find(x=>x.key===s)?.color || 'var(--text-muted)'; }
function emptyState(msg){ return `<div class="empty-state"><span class="empty-icon">${I.sparkles}</span><div>${msg}</div></div>`; }

/* ---------- Reports ---------- */
function renderReportCC(page){
  const totalC = store.companies.length;
  const totalP = store.contacts.length;
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Companies & Contacts</h1>
        <div class="page-subtitle">Overview of your account and contact directory</div>
      </div>
    </div>
    <div class="grid grid-12 mb-4">
      ${kpiCard('Total Companies', NUM(totalC), 'up', `${store.companies.filter(c=>c.status==='Hot').length} hot`, '#10B981', I.building)}
      ${kpiCard('Total Contacts',  NUM(totalP), 'up', `${Math.round(totalP/totalC*10)/10} per co.`, '#6366F1', I.users)}
    </div>
    <div class="grid grid-12">
      <div class="card span-6">
        <div class="card-header"><div class="card-title">Company Types</div></div>
        <div class="chart-wrap"><canvas id="chartCompanyTypes"></canvas></div>
      </div>
      <div class="card span-6">
        <div class="card-header"><div class="card-title">Industries</div></div>
        <div class="chart-wrap"><canvas id="chartIndustries"></canvas></div>
      </div>
    </div>
  `;
  drawDoughnut('chartCompanyTypes', groupCount(store.companies, 'type'));
  drawBar('chartIndustries', groupCount(store.companies, 'industry'));
}

let _crmYear = new Date().getFullYear();
function renderReportCRM(page){
  const allDeals = store.deals;
  const yearsSet = new Set([_crmYear, new Date().getFullYear()]);
  allDeals.forEach(d => { const y = d.close_date ? (new Date(d.close_date)).getFullYear() : null; if (y) yearsSet.add(y); });
  const years = Array.from(yearsSet).sort((a,b)=>b-a);
  const inYear = (d) => d.close_date ? (new Date(d.close_date)).getFullYear() === _crmYear : false;

  const deals = allDeals;
  const pipelineValue = deals.filter(d=>!['Won','Lost'].includes(d.stage)).reduce((a,b)=>a+b.value_sar,0);
  const won = deals.filter(d=>d.stage==='Won' && inYear(d)).reduce((a,b)=>a+b.value_sar,0);
  const lost= deals.filter(d=>d.stage==='Lost' && inYear(d)).reduce((a,b)=>a+b.value_sar,0);
  const winRate = won+lost>0 ? Math.round(won/(won+lost)*100) : 0;
  const stuck = deals.filter(d => d.stage === 'Negotiation' || d.stage==='Proposal').length;
  const annualTarget = store.targets.annual_sar || 0;

  const kpiSAR_USD = (label, sar, dir, sub, color, icon) =>
    `<div class="card span-3">
      <div class="stat">
        <div class="stat-icon" style="background:${color}">${icon.replace('<svg','<svg width=\"20\" height=\"20\"')}</div>
        <div class="stat-label">${label}</div>
        <div class="stat-value">${SAR(sar)}</div>
        <div class="text-sm text-muted" style="margin-top:2px">≈ ${SAR_TO_USD(sar)}</div>
        <div class="stat-delta ${dir}">${dir==='up'?'▲':'▼'} ${sub}</div>
      </div>
    </div>`;

  const yearSelect = `<select class="select" id="crmYearSel" onchange="onCrmYearChange(this.value)" style="width:auto">
    ${years.map(y=>`<option value="${y}" ${y===_crmYear?'selected':''}>${y}</option>`).join('')}
  </select>`;

  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>CRM Analytics</h1>
        <div class="page-subtitle">Pipeline performance and deal intelligence</div>
      </div>
      <div class="flex items-center gap-2"><label class="text-sm text-muted">Year</label>${yearSelect}</div>
    </div>
    <div class="grid grid-12 mb-4">
      ${kpiSAR_USD('Pipeline Value', pipelineValue, 'up', `${deals.filter(d=>!['Won','Lost'].includes(d.stage)).length} open deals`, '#10B981', I.trending)}
      ${kpiSAR_USD('Won YTD · ' + _crmYear, won, 'up', `${annualTarget?Math.round(won/annualTarget*100):0}% of target`, '#F59E0B', I.bolt)}
      ${kpiCard('Win Rate',       winRate+'%',        'up', `vs ${winRate>=50?'above':'below'} benchmark`, '#6366F1', I.target)}
      ${kpiCard('Deals At Risk',  stuck,              'down', 'Follow-up needed', '#EF4444', I.trendDown)}
    </div>
    <div class="grid grid-12">
      <div class="card span-12">
        <div class="card-header"><div class="card-title">Pipeline Value by Stage · ${_crmYear}</div></div>
        <div class="chart-wrap"><canvas id="chartValStage"></canvas></div>
      </div>
      <div class="card span-12">
        <div class="card-header"><div class="card-title">Top 5 Deals</div></div>
        <div class="table-wrap">
          <table class="datatable">
            <thead><tr><th scope="col">Deal</th><th scope="col">Company</th><th scope="col">Stage</th><th scope="col">Value</th><th scope="col">Probability</th><th scope="col">Close Date</th></tr></thead>
            <tbody>
              ${deals.slice().sort((a,b)=>b.value_sar-a.value_sar).slice(0,5).map(d=>`
                <tr>
                  <td style="font-weight:500">${d.name}</td>
                  <td>${companyById(d.company_id)?.name||'—'}</td>
                  <td><span class="badge" style="background:${hexA(stageColor(d.stage),.15)};color:${stageColor(d.stage)}">● ${d.stage}</span></td>
                  <td>${SAR(d.value_sar)}</td>
                  <td>${d.probability}%</td>
                  <td>${d.close_date}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  const stageDealsForYear = deals.filter(d => inYear(d));
  drawBar('chartValStage', groupSum(stageDealsForYear, 'stage', 'value_sar'), { money:true, dataLabels:true });
}
function onCrmYearChange(y){
  _crmYear = Number(y);
  router.go('reportCRM');
}

function renderReportActivity(page){
  const weekStart = getWeekStart();
  const weekActs = store.activities.filter(a => a.date >= weekStart);
  const progressByType = {};
  ACTIVITY_TYPES.forEach(t => progressByType[t] = weekActs.filter(a=>a.type===t).length);
  const totalWeek = weekActs.length;
  const totalTarget = ACTIVITY_TYPES.reduce((s,t)=> s + (store.targets.weekly[t]===999?0:(store.targets.weekly[t]||0)), 0);
  const overallPct = totalTarget>0 ? Math.round(totalWeek/totalTarget*100) : 0;

  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Activity Progress</h1>
        <div class="page-subtitle">Weekly progress, recent activity, and top ICP matches — week of ${weekStart}</div>
      </div>
      <button class="btn btn-outline" onclick="openActivityModal()">+ Log Activity</button>
    </div>

    <div class="grid grid-12 mb-4">
      ${kpiCard('Activities This Week', NUM(totalWeek), 'up', `${overallPct}% of target`, '#10B981', I.activity)}
      ${kpiCard('Weekly Target',        NUM(totalTarget||'∞'), 'up', 'across all types', '#6366F1', I.target)}
      ${kpiCard('Recent (30d)',         NUM(store.activities.filter(a=>{const d=new Date(a.date);return (Date.now()-d.getTime())<=30*864e5;}).length), 'up', 'last 30 days', '#0EA5E9', I.trending)}
      ${kpiCard('Top ICP Companies',    NUM(store.companies.filter(c=>c.icp_score>=85).length), 'up', 'score ≥ 85', '#F59E0B', I.bolt)}
    </div>

    <div class="grid grid-12">
      <div class="card span-7">
        <div class="card-header">
          <div>
            <div class="card-title">Weekly Activity Progress</div>
            <div class="card-subtitle">Resets every Sunday (Saudi work week)</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${ACTIVITY_TYPES.map(t => {
            const target = store.targets.weekly[t] ?? 0;
            const done = progressByType[t];
            const pct = target > 0 ? Math.min(100, (done/target)*100) : 0;
            const variant = pct >= 100 ? '' : (pct >= 60 ? 'warning' : 'danger');
            return `<div>
              <div class="flex justify-between" style="margin-bottom:6px">
                <div style="font-weight:500">${t}</div>
                <div class="text-muted text-sm">${done} / ${target===999?'∞':target}</div>
              </div>
              <div class="progress"><div class="progress-bar ${variant}" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card span-5">
        <div class="card-header"><div class="card-title">Top ICP Matches</div><div class="card-subtitle">Top 10 by score</div></div>
        ${store.companies.slice().sort((a,b)=>b.icp_score-a.icp_score).slice(0,10).map(c=>`
          <div class="list-row">
            <div class="avatar-sm" style="background:${icpColor(c.icp_score)}">${c.name[0]}</div>
            <div style="flex:1; min-width:0">
              <div style="font-weight:600" class="truncate">${c.name}</div>
              <div class="text-sm text-muted truncate">${c.industry} · ${c.type}</div>
            </div>
            <span class="badge ${c.icp_score>=85?'success':c.icp_score>=70?'info':'warning'}">${c.icp_score}</span>
          </div>
        `).join('') || emptyState('No companies yet')}
      </div>

      <div class="card span-12">
        <div class="card-header">
          <div class="card-title">Recent Activity</div>
          <button class="btn btn-ghost text-sm" onclick="router.go('activities')">View all →</button>
        </div>
        <div>
          ${store.activities.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15).map(renderActivityRow).join('') || emptyState('No activities yet')}
        </div>
      </div>
    </div>
  `;
}

function csmHealthBucket(id){
  let h = 0; for (let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  const mod = h % 10;
  if (mod < 6) return 'Healthy';
  if (mod < 9) return 'At-risk';
  return 'Critical';
}
function csmRenewalDate(closeDate){
  const d = new Date(closeDate); d.setFullYear(d.getFullYear()+1); return d;
}
function csmQuarterLabel(d){ return `${d.getFullYear()} Q${Math.floor(d.getMonth()/3)+1}`; }

function renderReportCSM(page){
  const customers = store.deals.filter(d => d.stage === 'Won');
  const totalValue = customers.reduce((a,b)=>a+b.value_sar,0);
  const avgValue   = customers.length ? Math.round(totalValue/customers.length) : 0;
  const now = Date.now();
  const upcoming = customers.filter(d => {
    const r = csmRenewalDate(d.close_date).getTime();
    return r >= now && r - now <= 90*864e5;
  }).length;

  const withHealth = customers.map(d => ({...d, health: csmHealthBucket(d.id)}));
  const healthCounts = groupCount(withHealth, 'health');
  const renewalByQ = {};
  customers.forEach(d => {
    const q = csmQuarterLabel(csmRenewalDate(d.close_date));
    renewalByQ[q] = (renewalByQ[q]||0) + 1;
  });
  const qLabels = Object.keys(renewalByQ).sort();

  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>CSM Analytics</h1>
        <div class="page-subtitle">Post-sale customer health, renewals, and contract value</div>
      </div>
    </div>
    <div class="grid grid-12 mb-4">
      ${kpiCard('Active Customers',     NUM(customers.length),                            'up', `${withHealth.filter(c=>c.health==='Healthy').length} healthy`, '#10B981', I.handshake)}
      ${kpiCard('Total Contract Value', SAR(totalValue),                                  'up', `${customers.length} contracts`,                                '#6366F1', I.trending)}
      ${kpiCard('Avg Contract Size',    SAR(avgValue),                                    'up', 'per customer',                                                  '#0EA5E9', I.bolt)}
      ${kpiCard('Upcoming Renewals',    NUM(upcoming),                                    upcoming>0?'up':'down', 'next 90 days',                                '#F59E0B', I.target)}
    </div>
    <div class="grid grid-12">
      <div class="card span-6">
        <div class="card-header"><div class="card-title">Customer Health Distribution</div></div>
        <div class="chart-wrap"><canvas id="chartCSMHealth"></canvas></div>
      </div>
      <div class="card span-6">
        <div class="card-header"><div class="card-title">Renewal Timeline</div><div class="card-subtitle">Contracts by quarter</div></div>
        <div class="chart-wrap"><canvas id="chartCSMRenewals"></canvas></div>
      </div>
      <div class="card span-12">
        <div class="card-header"><div class="card-title">Top Customers</div></div>
        <div class="table-wrap">
          <table class="datatable">
            <thead><tr><th scope="col">Customer</th><th scope="col">Deal</th><th scope="col">Contract Value</th><th scope="col">Renewal</th><th scope="col">Health</th><th scope="col">Status</th></tr></thead>
            <tbody>
              ${withHealth.slice().sort((a,b)=>b.value_sar-a.value_sar).map(d=>{
                const c = companyById(d.company_id);
                const r = csmRenewalDate(d.close_date).toISOString().slice(0,10);
                const healthClass = d.health==='Healthy'?'success':d.health==='At-risk'?'warning':'danger';
                return `<tr>
                  <td style="font-weight:500">${c?.name||'—'}</td>
                  <td>${d.name}</td>
                  <td>${SAR(d.value_sar)}</td>
                  <td>${r}</td>
                  <td><span class="badge ${healthClass}">${d.health}</span></td>
                  <td><span class="badge success">Active</span></td>
                </tr>`;
              }).join('') || `<tr><td colspan="6">${emptyState('No customers yet')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  drawDoughnut('chartCSMHealth', healthCounts);
  drawBar('chartCSMRenewals', { labels: qLabels, data: qLabels.map(q=>renewalByQ[q]) });
}

function hexA(cssVar, a){ return cssVar.startsWith('var(') ? cssVar : cssVar; } // passthrough; Chart uses colors differently

/* ---------- ICP ---------- */
function renderICP(page){
  const icp = store.icp;
  const scored = store.companies.slice().sort((a,b)=>b.icp_score-a.icp_score);
  const weights = ['weight_company_type','weight_industry','weight_company_size','weight_deal_potential','weight_digital_maturity'];
  const totalW = weights.reduce((a,k)=>a+icp[k],0);

  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Ideal Customer Profile</h1>
        <div class="page-subtitle">Defines who's a fit — and drives automatic ICP scoring on every company</div>
      </div>
      <button class="btn btn-primary" onclick="openICPModal()">${I.edit.replace('<svg','<svg width=\"14\" height=\"14\"')} Edit ICP</button>
    </div>

    <div class="grid grid-12">
      <div class="card span-7">
        <div class="card-header">
          <div class="card-title">${icp.profile_name}</div>
          <span class="badge success">Active</span>
        </div>

        <div class="field-row">
          <div><div class="stat-label">Min Deal Size</div><div style="font-weight:600; font-size:18px">${SAR(icp.min_deal_size_sar)}</div></div>
          <div><div class="stat-label">Target Countries</div><div>${icp.target_countries.map(x=>`<span class="badge">${x}</span>`).join(' ')}</div></div>
        </div>
        <div class="mt-4"><div class="stat-label">Target Company Types</div><div>${icp.target_company_types.map(x=>`<span class="badge info">${x}</span>`).join(' ')}</div></div>
        <div class="mt-4"><div class="stat-label">Preferred Industries</div><div>${icp.preferred_industries.map(x=>`<span class="badge success">${x}</span>`).join(' ')}</div></div>
        <div class="mt-4"><div class="stat-label">Excluded Industries</div><div>${icp.excluded_industries.length?icp.excluded_industries.map(x=>`<span class="badge danger">${x}</span>`).join(' '):'<span class="text-muted">None</span>'}</div></div>
        <div class="mt-4"><div class="stat-label">Disqualifiers (Size)</div><div>${icp.disqualify_below_size.map(x=>`<span class="badge danger">${x}</span>`).join(' ')}</div></div>
      </div>

      <div class="card span-5">
        <div class="card-header"><div class="card-title">Scoring Weights</div><span class="text-muted text-sm">Total: ${totalW}%</span></div>
        ${weights.map(w => {
          const pct = icp[w];
          const label = w.replace('weight_','').replace(/_/g,' ');
          return `<div class="mb-4">
            <div class="flex justify-between mb-2"><div style="text-transform:capitalize">${label}</div><b>${pct}%</b></div>
            <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>

      <div class="card span-12">
        <div class="card-header">
          <div class="card-title">ICP-Scored Companies</div>
          <div class="card-subtitle">Auto-calculated when ICP or company data changes</div>
        </div>
        <div class="table-wrap">
          <table class="datatable">
            <thead><tr><th scope="col">Company</th><th scope="col">Type</th><th scope="col">Industry</th><th scope="col">Size</th><th scope="col">ICP Score</th></tr></thead>
            <tbody>
              ${scored.map(c=>`<tr onclick="openCompanyModal('${c.id}')">
                <td style="font-weight:500">${c.name}</td>
                <td>${c.type}</td>
                <td>${c.industry}</td>
                <td>${c.size}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <span style="font-weight:700; color:${icpColor(c.icp_score)}">${c.icp_score}</span>
                    <div class="progress" style="width:120px"><div class="progress-bar ${c.icp_score<50?'danger':c.icp_score<70?'warning':''}" style="width:${c.icp_score}%"></div></div>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openICPModal(){
  const icp = store.icp;
  openModal(`
    <div class="modal wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">Edit ICP Profile</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>Profile Name</label><input class="input" id="f_name" value="${icp.profile_name}"/></div>
          <div class="field"><label>Min Deal Size (SAR)</label><input class="input" type="number" id="f_min" value="${icp.min_deal_size_sar}"/></div>
        </div>
        <div class="field"><label>Target Company Types (comma-separated)</label><input class="input" id="f_types" value="${icp.target_company_types.join(', ')}"/></div>
        <div class="field"><label>Preferred Industries</label><input class="input" id="f_pref" value="${icp.preferred_industries.join(', ')}"/></div>
        <div class="field"><label>Excluded Industries</label><input class="input" id="f_excl" value="${icp.excluded_industries.join(', ')}"/></div>
        <div class="field"><label>Target Countries</label><input class="input" id="f_countries" value="${icp.target_countries.join(', ')}"/></div>
        <div class="field"><label>Disqualify Below Size</label><input class="input" id="f_dq" value="${icp.disqualify_below_size.join(', ')}"/></div>

        <h3 class="mt-4 mb-2">Scoring Weights (must sum to 100)</h3>
        <div class="field-row">
          <div class="field"><label>Company Type</label><input class="input" type="number" id="w1" value="${icp.weight_company_type}"/></div>
          <div class="field"><label>Industry</label><input class="input" type="number" id="w2" value="${icp.weight_industry}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Company Size</label><input class="input" type="number" id="w3" value="${icp.weight_company_size}"/></div>
          <div class="field"><label>Deal Potential</label><input class="input" type="number" id="w4" value="${icp.weight_deal_potential}"/></div>
        </div>
        <div class="field"><label>Digital Maturity</label><input class="input" type="number" id="w5" value="${icp.weight_digital_maturity}"/></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveICP()">Save ICP</button>
      </div>
    </div>
  `);
}
async function saveICP(){
  const parseList = id => document.getElementById(id).value.split(',').map(s=>s.trim()).filter(Boolean);
  const w = ['w1','w2','w3','w4','w5'].map(id=>Number(document.getElementById(id).value||0));
  const sum = w.reduce((a,b)=>a+b,0);
  if (sum !== 100) { toast(`Weights must sum to 100 (current: ${sum})`, 'warning'); return; }
  const payload = {
    profile_name: document.getElementById('f_name').value,
    is_default: true,
    min_deal_size_sar: Number(document.getElementById('f_min').value),
    target_company_types: parseList('f_types'),
    preferred_industries: parseList('f_pref'),
    excluded_industries: parseList('f_excl'),
    target_countries: parseList('f_countries'),
    disqualify_below_size: parseList('f_dq'),
    weight_company_type:w[0], weight_industry:w[1], weight_company_size:w[2], weight_deal_potential:w[3], weight_digital_maturity:w[4],
  };
  const existing = store.icp && store.icp.id;
  const { error } = existing
    ? await db.from('icp_profiles').update(payload).eq('id', store.icp.id)
    : await db.from('icp_profiles').insert({ ...payload, owner_id: userId });
  if (error) return toast(error.message, 'danger');
  // Schema trigger t_icp_recalc_all + t_company_icp will recompute icp_score on the server.
  await loadStore(); closeModal(); toast('ICP saved — scores recomputed'); router.go('icp');
}

/* ---------- Targets ---------- */
const QUARTERS_KEY = 'tz_quarter_targets';
function loadQuarterTargets(year){
  try {
    const all = JSON.parse(localStorage.getItem(QUARTERS_KEY) || '{}');
    const y = all[year];
    if (y && Array.isArray(y) && y.length === 4) return y.map(Number);
  } catch(_){}
  return null;
}
function saveQuarterTargetsLocal(year, qs){
  let all = {};
  try { all = JSON.parse(localStorage.getItem(QUARTERS_KEY) || '{}'); } catch(_){}
  all[year] = qs.map(Number);
  localStorage.setItem(QUARTERS_KEY, JSON.stringify(all));
}
function getQuartersFor(year, annual){
  const stored = loadQuarterTargets(year);
  if (stored && stored.reduce((a,b)=>a+b,0) === Number(annual)) return stored;
  const base = Math.floor(Number(annual||0) / 4);
  const last = Number(annual||0) - base*3;
  return [base, base, base, last];
}
function quarterOfDate(dateStr){
  const d = new Date(dateStr); if (isNaN(d)) return null;
  return Math.floor(d.getMonth()/3) + 1;
}

function renderTargets(page){
  const t = store.targets;
  const weekStart = getWeekStart();
  const weekActs = store.activities.filter(a => a.date >= weekStart);
  const year = new Date().getFullYear();
  const wonYTD = store.deals
    .filter(d => d.stage==='Won' && (new Date(d.close_date)).getFullYear() === year)
    .reduce((a,b)=>a+b.value_sar,0);
  const quarters = getQuartersFor(year, t.annual_sar);
  const wonByQ = [0,0,0,0];
  store.deals.filter(d=>d.stage==='Won' && (new Date(d.close_date)).getFullYear()===year)
    .forEach(d => { const q = quarterOfDate(d.close_date); if (q) wonByQ[q-1]+=d.value_sar; });

  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Sales Targets</h1>
        <div class="page-subtitle">Weekly activity KPIs + annual & quarterly revenue targets</div>
      </div>
      <button class="btn btn-primary" onclick="openTargetsModal()">${I.edit.replace('<svg','<svg width=\"14\" height=\"14\"')} Edit Targets</button>
    </div>
    <div class="grid grid-12">
      <div class="card span-12">
        <div class="card-header"><div class="card-title">Annual Revenue Target · ${year}</div></div>
        <div class="flex justify-between mb-2"><div>Progress</div><div class="text-muted">${SAR(wonYTD)} / ${SAR(t.annual_sar)}</div></div>
        <div class="progress" style="height:14px"><div class="progress-bar" style="width:${Math.min(100, t.annual_sar?wonYTD/t.annual_sar*100:0)}%"></div></div>
      </div>
      <div class="card span-12">
        <div class="card-header">
          <div class="card-title">Quarterly Distribution</div>
          <div class="card-subtitle">Sum of quarters must equal annual target</div>
        </div>
        <div class="grid grid-12">
          ${[1,2,3,4].map((q,i) => {
            const target = quarters[i] || 0;
            const done = wonByQ[i];
            const pct = target>0 ? Math.min(100, done/target*100) : 0;
            return `<div class="card span-3" style="padding:16px; background:var(--bg-muted); box-shadow:none;">
              <div class="flex justify-between items-center mb-2">
                <div style="font-weight:600">Q${q} ${year}</div>
                <div class="badge ${pct>=100?'success':pct>=60?'warning':'danger'}">${SAR(done)}</div>
              </div>
              <div class="text-sm text-muted mb-2">Target ${SAR(target)}</div>
              <div class="progress"><div class="progress-bar ${pct>=100?'':pct>=60?'warning':'danger'}" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card span-12">
        <div class="card-header"><div class="card-title">Weekly Activity Targets</div><div class="card-subtitle">Week starting ${weekStart}</div></div>
        <div class="grid grid-12">
          ${ACTIVITY_TYPES.map(type => {
            const target = t.weekly[type] || 0;
            const done = weekActs.filter(a=>a.type===type).length;
            const pct = target>0 ? Math.min(100, (done/target)*100) : 0;
            return `<div class="card span-4" style="padding:16px; background:var(--bg-muted); box-shadow:none;">
              <div class="flex justify-between items-center mb-2">
                <div style="font-weight:600">${type}</div>
                <div class="badge ${pct>=100?'success':pct>=60?'warning':'danger'}">${done}/${target===999?'∞':target}</div>
              </div>
              <div class="progress"><div class="progress-bar ${pct>=100?'':pct>=60?'warning':'danger'}" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}
function openTargetsModal(){
  const t = store.targets;
  const year = new Date().getFullYear();
  const quarters = getQuartersFor(year, t.annual_sar);
  openModal(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">Edit Targets</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Annual Revenue Target (SAR)</label><input class="input" id="t_annual" type="number" value="${t.annual_sar}" oninput="onTargetsInput()"/></div>
        <div class="flex justify-between items-center mt-3 mb-2">
          <h3 style="margin:0">Quarterly Distribution (SAR)</h3>
          <button type="button" class="btn btn-ghost text-sm" onclick="distributeEqually()">Distribute Equally</button>
        </div>
        <div class="grid grid-12">
          ${[1,2,3,4].map((q,i) => `
            <div class="field span-3"><label>Q${q}</label><input class="input" id="t_q${q}" type="number" value="${quarters[i]||0}" oninput="onTargetsInput()"/></div>
          `).join('')}
        </div>
        <div id="t_qsum_msg" class="text-sm" style="margin-top:6px"></div>
        <h3 class="mt-4 mb-2">Weekly Activity Targets</h3>
        ${ACTIVITY_TYPES.map(ty => `
          <div class="field"><label>${ty}</label><input class="input" id="t_${ty}" type="number" value="${t.weekly[ty]||0}"/></div>
        `).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="t_save" onclick="saveTargets()">Save</button>
      </div>
    </div>
  `);
  onTargetsInput();
}
function onTargetsInput(){
  const annual = Number(document.getElementById('t_annual').value||0);
  const qs = [1,2,3,4].map(q => Number(document.getElementById('t_q'+q).value||0));
  const sum = qs.reduce((a,b)=>a+b,0);
  const delta = annual - sum;
  const msg = document.getElementById('t_qsum_msg');
  const btn = document.getElementById('t_save');
  if (delta === 0) {
    msg.style.color = 'var(--color-success)';
    msg.textContent = `Sum matches annual: ${SAR(sum)}`;
    btn.removeAttribute('disabled');
    btn.classList.remove('disabled');
  } else {
    msg.style.color = 'var(--color-danger)';
    msg.textContent = `Sum ${SAR(sum)} ≠ Annual ${SAR(annual)} (diff ${SAR(Math.abs(delta))} ${delta>0?'short':'over'})`;
    btn.setAttribute('disabled','disabled');
    btn.classList.add('disabled');
  }
}
function distributeEqually(){
  const annual = Number(document.getElementById('t_annual').value||0);
  const base = Math.floor(annual/4);
  const last = annual - base*3;
  document.getElementById('t_q1').value = base;
  document.getElementById('t_q2').value = base;
  document.getElementById('t_q3').value = base;
  document.getElementById('t_q4').value = last;
  onTargetsInput();
}
async function saveTargets(){
  const annual = Number(document.getElementById('t_annual').value||0);
  const qs = [1,2,3,4].map(q => Number(document.getElementById('t_q'+q).value||0));
  if (qs.reduce((a,b)=>a+b,0) !== annual) return toast('Quarter targets must sum to the annual target.', 'danger');
  const year = new Date().getFullYear();
  const { error: e1 } = await db.from('annual_targets')
    .upsert({ owner_id: userId, year, target_sar: annual }, { onConflict: 'owner_id,year' });
  if (e1) return toast(e1.message, 'danger');
  saveQuarterTargetsLocal(year, qs);
  const rows = ACTIVITY_TYPES.map(ty => ({
    owner_id: userId, period_type: 'Weekly', activity_type: ty,
    target_count: Number(document.getElementById('t_'+ty).value||0),
  }));
  const { error: e2 } = await db.from('activity_targets')
    .upsert(rows, { onConflict: 'owner_id,period_type,activity_type' });
  if (e2) return toast(e2.message, 'danger');
  await loadStore(); closeModal(); toast('Targets updated'); router.go('target');
}

/* ---------- Activities ---------- */
function renderActivities(page){
  const weekStart = getWeekStart();
  const acts = store.activities.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const weekActs = acts.filter(a => a.date >= weekStart);
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Activities</h1>
        <div class="page-subtitle">${weekActs.length} activities this week · ${acts.length} total</div>
      </div>
      <button class="btn btn-primary" onclick="openActivityModal()">+ Log Activity</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="datatable">
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Company</th><th scope="col">Contact</th><th scope="col">Deal</th><th scope="col">Summary</th><th scope="col">Next Action</th><th scope="col"></th></tr></thead>
          <tbody>
            ${acts.map(a=>{
              const c=companyById(a.company_id), p=contactById(a.contact_id), d=dealById(a.deal_id);
              return `<tr>
                <td>${a.date}</td>
                <td><span class="badge" style="background:${a.type?hexA('',0):''}; color:${typeColor(a.type)}">${a.type}</span></td>
                <td>${c?.name||'—'}</td>
                <td>${p?`${p.first_name} ${p.last_name}`:'—'}</td>
                <td>${d?.name||'—'}</td>
                <td>${a.summary||''}</td>
                <td class="text-muted">${a.next_action||''}</td>
                <td><button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();openActivityModal('${a.id}')" aria-label="Edit activity">${I.edit}</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
/* ====================================================================
   Workflow 1 · Quick Capture — single-line natural-language activity logger
   Press `q` anywhere outside an input to open. Enter to save. Esc to cancel.
   ==================================================================== */
const QC_TYPE_KEYWORDS = [
  { type: 'Call',     re: /\b(called?|call|rang|phoned|spoke\s+with|talked\s+to)\b/i },
  { type: 'Meeting',  re: /\b(met|meeting|met\s+with|sat\s+with|workshop)\b/i },
  { type: 'Demo',     re: /\b(demo'?d|demo|demoed|showed|presented)\b/i },
  { type: 'Email',    re: /\b(emailed|email|sent\s+email|replied|wrote\s+to)\b/i },
  { type: 'WhatsApp', re: /\b(whatsapped|whatsapp|wa'?d|texted|pinged)\b/i },
  { type: 'LinkedIn', re: /\b(dm'?d|dm|connected|linkedin|inmailed)\b/i },
  { type: 'Proposal', re: /\b(sent\s+proposal|proposal\s+sent|submitted\s+proposal)\b/i },
];
const QC_DAY_NAMES = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
function _qcNextDayOfWeek(from, targetDay) {
  const d = new Date(from);
  const cur = d.getDay();
  let diff = (targetDay - cur + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function parseDatePhrase(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  const today = new Date();
  if (t === 'today') return today;
  if (t === 'tomorrow') { const d = new Date(today); d.setDate(d.getDate()+1); return d; }
  if (t === 'next week') { const d = new Date(today); d.setDate(d.getDate()+7); return d; }
  if (t === 'eow' || t === 'end of week') return _qcNextDayOfWeek(today, 4); // KSA: Thursday
  const inMatch = t.match(/^in\s+(\d+)\s+(day|days|week|weeks)$/);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const mul = inMatch[2].startsWith('week') ? 7 : 1;
    const d = new Date(today); d.setDate(d.getDate() + n * mul); return d;
  }
  const dayMatch = t.match(/^(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (dayMatch) return _qcNextDayOfWeek(today, QC_DAY_NAMES[dayMatch[1]]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(t);
  return null;
}

function _qcDetectType(text) {
  for (const { type, re } of QC_TYPE_KEYWORDS) if (re.test(text)) return type;
  return 'Call';
}
function _qcFindContact(q) {
  if (!q) return null;
  const ql = q.toLowerCase();
  return store.contacts.find(p =>
    p.first_name?.toLowerCase().startsWith(ql) ||
    p.last_name?.toLowerCase().startsWith(ql) ||
    `${p.first_name||''} ${p.last_name||''}`.toLowerCase().includes(ql)
  ) || null;
}
function _qcFindCompany(q) {
  if (!q) return null;
  const ql = q.toLowerCase();
  return store.companies.find(c => c.name?.toLowerCase().includes(ql)) || null;
}
function _qcFindDeal(q) {
  if (!q) return null;
  const ql = q.toLowerCase();
  return store.deals.find(d => d.name?.toLowerCase().includes(ql)) || null;
}

function parseQuickCapture(text) {
  const orig = (text || '').trim();
  if (!orig) return null;

  // 1. Split off the next-action half on the first `>`
  let main = orig, nextAction = null, nextActionDue = null;
  const gt = orig.indexOf('>');
  if (gt >= 0) {
    main = orig.slice(0, gt).trim();
    let after = orig.slice(gt + 1).trim();
    // Try to match a trailing date phrase
    const datePat = /\s+(today|tomorrow|next\s+week|eow|end\s+of\s+week|in\s+\d+\s+(?:day|days|week|weeks)|(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d{4}-\d{2}-\d{2})$/i;
    const m = after.match(datePat);
    if (m) {
      const phrase = m[1].replace(/\s+/g, ' ');
      const due = parseDatePhrase(phrase);
      if (due) {
        nextActionDue = due.toISOString().slice(0, 10);
        after = after.slice(0, m.index).trim();
      }
    }
    nextAction = after || null;
  }

  // 2. Extract @contact, #company, $deal mentions from the main half.
  //    Single-word for @ and #; multi-word with smart shrink for $deal so
  //    "$Fennec Projects PMIS pricing" still resolves to the "Fennec Projects PMIS Rollout" deal.
  const contactMatch = main.match(/@([\p{L}\p{N}.\-']+)/u);
  const companyMatch = main.match(/#([\p{L}\p{N}.\-']+)/u);
  const contact = contactMatch ? _qcFindContact(contactMatch[1]) : null;
  const company = companyMatch ? _qcFindCompany(companyMatch[1]) : null;

  // Smart-shrink deal match: capture words after $, then progressively drop trailing words until a deal matches.
  let deal = null;
  const dealStart = main.match(/\$([\p{L}\p{N}.\-' ]+)/u);
  if (dealStart) {
    let candidate = dealStart[1].trim();
    while (candidate) {
      const found = _qcFindDeal(candidate);
      if (found) { deal = found; break; }
      const words = candidate.split(/\s+/);
      if (words.length === 1) break;
      words.pop();
      candidate = words.join(' ');
    }
  }

  // 3. Activity type
  const type = _qcDetectType(main);

  // 4. Clean summary — strip the @ # $ markers but keep the names
  const summary = main
    .replace(/@([\p{L}\p{N}.\-']+)/gu, '$1')
    .replace(/#([\p{L}\p{N}.\-']+)/gu, '$1')
    .replace(/\$([\p{L}\p{N}.\-' ]+)/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    type,
    date: todayStr(),
    company_id: company?.id || null,
    contact_id: contact?.id || null,
    deal_id: deal?.id || null,
    summary,
    next_action: nextAction,
    next_action_due: nextActionDue,
    _resolved: { contact, company, deal }, // for preview UI only
  };
}

function openQuickCapture(prefill = '') {
  const ov = document.getElementById('qcOverlay');
  if (!ov) return;
  ov.style.display = 'flex';
  const inp = document.getElementById('qcInput');
  inp.value = prefill;
  setTimeout(() => { inp.focus(); if (prefill) inp.setSelectionRange(prefill.length, prefill.length); }, 0);
  updateQuickCapturePreview();
}
function closeQuickCapture() {
  const ov = document.getElementById('qcOverlay');
  if (!ov) return;
  ov.style.display = 'none';
  const inp = document.getElementById('qcInput');
  if (inp) inp.value = '';
}
function updateQuickCapturePreview() {
  const text = (document.getElementById('qcInput')?.value || '').trim();
  const p = document.getElementById('qcPreview');
  if (!p) return;
  if (!text) {
    p.innerHTML = `<div class="qc-empty">Type to preview the parsed activity here.</div>`;
    return;
  }
  const parsed = parseQuickCapture(text);
  if (!parsed) { p.innerHTML = ''; return; }
  const { contact, company, deal } = parsed._resolved;
  p.innerHTML = `
    <div class="qc-row"><span>Type</span><strong>${parsed.type}</strong></div>
    ${company ? `<div class="qc-row"><span>Company</span><strong>${company.name}</strong></div>` : ''}
    ${contact ? `<div class="qc-row"><span>Contact</span><strong>${contact.first_name} ${contact.last_name}</strong></div>` : ''}
    ${deal ? `<div class="qc-row"><span>Deal</span><strong>${deal.name}</strong></div>` : ''}
    ${parsed.next_action ? `<div class="qc-row"><span>Next action</span><strong>${parsed.next_action}${parsed.next_action_due ? ' · '+parsed.next_action_due : ''}</strong></div>` : ''}
  `;
}
async function submitQuickCapture() {
  const text = (document.getElementById('qcInput')?.value || '').trim();
  if (!text) return;
  const parsed = parseQuickCapture(text);
  if (!parsed) return;
  // Reuse the existing toDbActivity adapter so the persistence path matches saveActivity exactly.
  const payload = toDbActivity({
    type: parsed.type,
    date: parsed.date,
    company_id: parsed.company_id,
    contact_id: parsed.contact_id,
    deal_id: parsed.deal_id,
    summary: parsed.summary,
    next_action: parsed.next_action,
  });
  // next_action_due is on the activities table directly — pass through if set.
  if (parsed.next_action_due) payload.next_action_due = parsed.next_action_due;

  // Optimistic insert (mirrors saveActivity pattern).
  const tempId = 'tmp_' + Math.random().toString(36).slice(2, 9);
  store.activities.unshift({
    id: tempId, owner_id: userId,
    ...payload,
    date: payload.activity_date,
  });
  closeQuickCapture();
  toast('Activity logged');
  checkCelebrations();
  router.go(router.current);

  const { error } = await db.from('activities').insert({ ...payload, owner_id: userId });
  if (error) {
    store.activities = store.activities.filter(a => !String(a.id).startsWith('tmp_'));
    router.go(router.current);
    toast(error.message, 'danger');
    return;
  }
  await loadStore();
  router.go(router.current);
}

function openActivityModal(id){
  const editing = id ? store.activities.find(a=>a.id===id) : null;
  const a = editing || { type:'Call', date: todayStr(), company_id:'', contact_id:'', deal_id:'', summary:'', next_action:'' };
  openModal(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${editing?'Edit':'Log'} Activity</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>Type</label><select class="select" id="a_type">${ACTIVITY_TYPES.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label>Date</label><input class="input" type="date" id="a_date" value="${a.date}"/></div>
        </div>
        <div class="field"><label>Company</label><select class="select" id="a_company"><option value="">—</option>${store.companies.map(c=>`<option value="${c.id}" ${c.id===a.company_id?'selected':''}>${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Contact</label><select class="select" id="a_contact"><option value="">—</option>${store.contacts.map(p=>`<option value="${p.id}" ${p.id===a.contact_id?'selected':''}>${p.first_name} ${p.last_name} — ${companyById(p.company_id)?.name||''}</option>`).join('')}</select></div>
        <div class="field"><label>Deal</label><select class="select" id="a_deal"><option value="">—</option>${store.deals.map(d=>`<option value="${d.id}" ${d.id===a.deal_id?'selected':''}>${d.name}</option>`).join('')}</select></div>
        <div class="field"><label>Summary</label><textarea class="textarea" id="a_summary">${a.summary||''}</textarea></div>
        <div class="field"><label>Next Action</label><input class="input" id="a_next" value="${a.next_action||''}"/></div>
      </div>
      <div class="modal-footer">
        ${editing?`<button class="btn btn-danger" onclick="deleteActivity('${editing.id}')">${I.trash.replace('<svg','<svg width=\"14\" height=\"14\"')} Delete</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveActivity('${editing?editing.id:''}')">${editing?'Update':'Log Activity'}</button>
      </div>
    </div>
  `);
}
async function saveActivity(id){
  const payload = toDbActivity({
    type: document.getElementById('a_type').value,
    date: document.getElementById('a_date').value,
    company_id: document.getElementById('a_company').value || null,
    contact_id: document.getElementById('a_contact').value || null,
    deal_id:    document.getElementById('a_deal').value    || null,
    summary:    document.getElementById('a_summary').value,
    next_action:document.getElementById('a_next').value,
  });
  const existing = id ? store.activities.find(a => a.id === id) : null;
  const prev = existing ? structuredClone(existing) : null;
  if (existing) Object.assign(existing, payload, { date: payload.activity_date });
  else {
    const tempId = 'tmp_' + Math.random().toString(36).slice(2, 9);
    store.activities.unshift({ id: tempId, owner_id: userId, ...payload, date: payload.activity_date });
  }
  closeModal();

  checkCelebrations();
  router.go(router.current);
  const { error } = id
    ? await db.from('activities').update(payload).eq('id', id)
    : await db.from('activities').insert({ ...payload, owner_id: userId });
  if (error) {
    if (existing && prev) Object.assign(existing, prev);
    else store.activities = store.activities.filter(a => !String(a.id).startsWith('tmp_'));
    router.go(router.current);
    toast(error.message, 'danger');
    return;
  }
  if (!id) await loadStore();
  toast('Activity saved');
}
async function deleteActivity(id){
  const removed = store.activities.find(a => a.id === id);
  if (!removed) return;
  store.activities = store.activities.filter(a => a.id !== id);
  closeModal();
  router.go(router.current);
  toast('Activity deleted', 'warning', { undo: () => restoreActivity(removed) });
  const { error } = await db.from('activities').delete().eq('id', id);
  if (error) {
    store.activities.push(removed);
    router.go(router.current);
    toast(error.message, 'danger');
  }
}
async function restoreActivity(a){
  const { id, owner_id, date, ...rest } = a;
  const { error } = await db.from('activities').insert({ ...rest, owner_id: userId });
  if (error) return toast(error.message, 'danger');
  await loadStore(); router.go(router.current); toast('Activity restored');
}

function checkCelebrations(){
  const weekStart = getWeekStart();
  ACTIVITY_TYPES.forEach(type => {
    const target = store.targets.weekly[type];
    if (!target || target >= 900) return;
    const done = store.activities.filter(a=>a.type===type && a.date>=weekStart).length;
    if (done === target) toast(`You hit your ${target} ${type}s goal for the week!`, 'celebration');
  });
}

/* ---------- Companies ---------- */
/* ====================================================================
   Workflow 1·B · Lead Profiling
   Bulk-profile names from a list or CSV → editable draft table → batch save.
   ==================================================================== */
const KSA_PATTERNS = [
  // PIF gigaprojects / subsidiaries
  { match: /\b(Fennec Projects|Dune Works|Cedar Systems|Harbor Services|Madar Engineering|Red\s*Sea\s*Global|Public\s+Investment\s+Fund|PIF)\b/i,
    set: { type: 'PIF', industry: 'Real Estate', size: 'Enterprise', city: 'Riyadh' } },
  // Energy / petrochem / mining
  { match: /\b(Aramco|SABIC|Maaden|ACWA)\b/i,
    set: { type: 'Government', industry: 'Oil & Gas', size: 'Enterprise', city: 'Dhahran' } },
  // Telecom
  { match: /\b(STC|Mobily|Zain)\b/i,
    set: { type: 'Semi-Government', industry: 'Telecom', size: 'Enterprise', city: 'Riyadh' } },
  // Banks / financial
  { match: /\b(Bank|Bancorp|Financial|Saudi\s*Fransi|Al\s*Rajhi|SNB|Riyad\s*Bank|Capital)\b/i,
    set: { type: 'Private', industry: 'Financial Services', size: 'Large', city: 'Riyadh' } },
  // Government bodies / utilities
  { match: /\b(Authority|Ministry|Commission|Saudi\s*Electricity|SEC)\b/i,
    set: { type: 'Government', industry: 'Utilities', size: 'Large', city: 'Riyadh' } },
  // Construction / real estate signals
  { match: /\b(Construction|Contracting|Real\s*Estate|Properties|Holding)\b/i,
    set: { type: 'Private', industry: 'Construction', size: 'Large', city: 'Riyadh' } },
];
const LEAD_DEFAULTS = {
  type: 'Private',
  industry: 'Construction',
  size: 'Medium',
  country: 'Saudi Arabia',
  city: 'Riyadh',
  erp_current: 'Unknown',
  status: 'Warm',
};

function inferCompanyDefaults(name) {
  const out = { ...LEAD_DEFAULTS };
  for (const { match, set } of KSA_PATTERNS) {
    if (match.test(name)) { Object.assign(out, set); break; }
  }
  return out;
}

function profileLead(name) {
  const defaults = inferCompanyDefaults(name);
  const tmp = { id: 'tmp', name, ...defaults };
  return { ...defaults, name, icp_score: scoreCompany(tmp) };
}

function parseLeadInput(text) {
  if (!text) return [];
  const seen = new Set();
  return text.split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function parseLeadCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = String(e.target.result || '');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return resolve([]);
        // Detect header: if first line contains "name" or "company" (case-insensitive), drop it.
        let rows = lines;
        const first = lines[0].toLowerCase();
        if (/\b(name|company)\b/.test(first) && !/\d/.test(lines[0])) rows = lines.slice(1);
        const names = rows.map(line => {
          // Take the first column. Handle simple quoted CSV.
          const m = line.match(/^"([^"]*)"|^([^,]+)/);
          return (m ? (m[1] ?? m[2]) : line).trim();
        }).filter(Boolean);
        resolve(names);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function downloadLeadTemplate() {
  const csv = 'company_name\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TARKIT_lead_template.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

let _leadDrafts = [];

function heuristicDraft(name){
  const d = inferCompanyDefaults(name);
  const draft = {
    name,
    website: '',
    type: d.type,
    industry: d.industry,
    size: d.size,
    country: d.country || 'Saudi Arabia',
    city: d.city || '',
    erp_current: d.erp_current || 'Unknown',
    status: 'Cold',
    _source: 'heuristic'
  };
  draft.icp_score = scoreCompany({ id:'tmp', ...draft });
  draft.status = statusFromScore(draft.icp_score);
  return draft;
}

function normalizeWebsite(raw){
  if (!raw) return { website:'', warning:'' };
  let w = String(raw).trim().toLowerCase();
  w = w.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (!w) return { website:'', warning:'' };
  let warning = '';
  // suspicious patterns: example/test TLDs, no dot, spaces
  if (/\s/.test(w)) warning = 'looks invalid (whitespace)';
  else if (!/\./.test(w)) warning = 'missing TLD';
  else if (/\.(example|test|invalid|localhost)$/.test(w)) warning = 'placeholder TLD';
  else if (/(^|\.)example\./.test(w)) warning = 'looks like a placeholder';
  return { website: w, warning };
}

const COMPANY_SYSTEM_PROMPT = `You profile B2B companies in Saudi Arabia/GCC for an Oracle PMIS/ERP vendor.
Return ONLY JSON matching this template; copy keys exactly.

{
  "company_name": "<official legal name>",
  "website":      "<root domain only, no http/www>",
  "type":         "<Government|Semi-Government|PIF|Private|Enterprise|Multinational|Startup>",
  "industry":     "<short phrase, e.g. Oil & Gas>",
  "size":         "<Startup|Small|Medium|Large|Enterprise>",
  "current_erp":  "<Unknown|SAP|Oracle EBS|Oracle Fusion|Microsoft|Odoo|Other>",
  "country":      "<country>",
  "city":         "<city>"
}

Rules:
- Pick exactly one value from each pipe-separated list.
- Use empty string "" for unknown text fields; use "Unknown" for current_erp if unclear.
- Default country: "Saudi Arabia".
- Do not invent facts. If web search results are provided below, prefer them.`;

async function aiProfileOneCompany(name){
  let user = `Profile this company: ${name}`;

  // Optional web grounding (Tavily)
  const tavilyKey = getIntegration('tavily').api_key;
  if (tavilyKey) {
    try {
      const results = await Integrations.search.web(`${name} Saudi Arabia company official website`, 3);
      if (results && results.length) {
        const block = results.map((r,i)=>`[${i+1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`).join('\n\n');
        user += `\n\n--- Web search results ---\n${block}`;
        trace('search.web', { name, results: results.length });
      }
    } catch (e) {
      trace('search.web', { name, error: e.message }, 'err');
    }
  }

  const out = await llmJSON(getPromptOrDefault('companyProfile'), user, LLM_SCHEMAS.companyOut);

  // Enum coercion — fuzzy-match returned values against allowed enums
  const cType = coerceEnum('type', out.type);
  const cSize = coerceEnum('size', out.size);
  const cErp  = coerceEnum('current_erp', out.current_erp);
  const valueWarnings = {};
  if (cType.warning) valueWarnings.type = cType.warning;
  if (cSize.warning) valueWarnings.size = cSize.warning;
  if (cErp.warning)  valueWarnings.current_erp = cErp.warning;
  if (Object.keys(valueWarnings).length) {
    trace('coerce.warnings', { name, ...valueWarnings });
  }

  const wn = normalizeWebsite(out.website);
  const draft = {
    name: out.company_name || name,
    website: wn.website,
    type: cType.value,
    industry: out.industry || '',
    size: cSize.value,
    country: out.country || 'Saudi Arabia',
    city: out.city || '',
    erp_current: cErp.value,
    status: 'Cold',
    _source: 'llm',
    _website_warning: wn.warning,
    _value_warnings: valueWarnings,
    _usage: out.__usage || null
  };
  draft.icp_score = scoreCompany({ id:'tmp', ...draft });
  draft.status = statusFromScore(draft.icp_score);

  if (isVerboseTrace()) {
    trace('llm.response.parsed', {
      name: draft.name, website: draft.website, type: draft.type,
      industry: draft.industry, size: draft.size, current_erp: draft.erp_current,
      country: draft.country, city: draft.city
    });
  }

  return draft;
}

function findExistingCompany(name){
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return store.companies.find(c => (c.name||'').trim().toLowerCase() === n) || null;
}

async function processLeads(names) {
  if (!names.length) return;
  const useLLM = !!defaultLLM();
  if (!useLLM) toast('No LLM configured — using heuristic profiling. Connect OpenAI or DeepSeek in Integrations for AI profiling.', 'warning');

  _leadDrafts = [];
  _leadProfilingProgress = { done: 0, total: names.length, current: names[0] };
  router.go('leadProfile');

  let heuristicFallbacks = 0;
  let duplicates = 0;
  let totalTokens = 0;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    _leadProfilingProgress = { done: i, total: names.length, current: name };
    if (i > 0) router.go('leadProfile');
    trace('input', { name });

    const existing = findExistingCompany(name);
    let draft;
    if (existing) {
      // Skip the LLM call for known dupes — save tokens.
      draft = {
        name: existing.name,
        website: existing.website || '',
        type: existing.type, industry: existing.industry, size: existing.size,
        country: existing.country || 'Saudi Arabia', city: existing.city || '',
        erp_current: existing.erp_current || 'Unknown', status: existing.status || 'Cold',
        icp_score: existing.icp_score || 0,
        _source: 'duplicate',
        _duplicate_of: existing.id,
        _website_warning: ''
      };
      duplicates++;
      trace('dedupe.match', { name, existing_id: existing.id });
    } else if (useLLM) {
      try {
        draft = await aiProfileOneCompany(name);
        if (draft && draft._usage && typeof draft._usage.total_tokens === 'number') {
          totalTokens += draft._usage.total_tokens;
        }
        trace('llm.companyOut', { name, source: draft._source, type: draft.type, size: draft.size, icp_score: draft.icp_score });
      } catch (e) {
        trace('llm.companyOut', { name, error: e.message }, 'err');
        draft = heuristicDraft(name);
        heuristicFallbacks++;
      }
    } else {
      draft = heuristicDraft(name);
    }
    draft._idx = _leadDrafts.length;
    // Auto-discard duplicates by default; user can restore from the row action.
    draft._discarded = draft._source === 'duplicate';
    _leadDrafts.push(draft);
    trace('profileLead.done', { name, source: draft._source, icp_score: draft.icp_score, status: draft.status });
  }

  _leadProfilingProgress = null;
  router.go('leadProfile');

  const profiledCount = names.length - duplicates - heuristicFallbacks;
  const parts = [];
  if (profiledCount > 0) parts.push(`${profiledCount} profiled by AI`);
  if (heuristicFallbacks > 0) parts.push(`${heuristicFallbacks} fell back to heuristics`);
  if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates===1?'':'s'} skipped`);
  if (totalTokens > 0) parts.push(`~${NUM(totalTokens)} tokens used`);
  if (parts.length) {
    const variant = (heuristicFallbacks || duplicates) ? 'warning' : 'success';
    toast(parts.join(' · '), variant);
  }
}

function discardLeadDraft(idx) {
  const d = _leadDrafts[idx]; if (!d) return;
  d._discarded = !d._discarded;
  router.go('leadProfile');
}
function discardAllLeadDrafts() {
  _leadDrafts = [];
  router.go('leadProfile');
}
function updateLeadDraft(idx, field, value) {
  const d = _leadDrafts[idx]; if (!d) return;
  d[field] = value;
  d.icp_score = scoreCompany({ id:'tmp', ...d });
  // Targeted DOM update (avoid full re-render — keeps focus on the input)
  const row = document.querySelector(`tr[data-lead-idx="${idx}"]`);
  if (row) {
    const icpCell = row.querySelector('.icp-cell');
    if (icpCell) {
      icpCell.textContent = d.icp_score;
      icpCell.style.color = icpColor(d.icp_score);
    }
  }
}

async function saveAllLeadDrafts() {
  const rows = _leadDrafts.filter(d => !d._discarded).map(d => ({
    owner_id: userId,
    name: d.name,
    website: d.website || '',
    type: d.type,
    industry: d.industry,
    size: d.size,
    country: d.country || 'Saudi Arabia',
    city: d.city || '',
    erp_current: d.erp_current,
    status: d.status,
    source: 'Lead Profiling',
  }));
  if (!rows.length) { toast('Nothing to save', 'warning'); return; }
  const { error } = await db.from('companies').insert(rows);
  if (error) return toast(error.message, 'danger');
  const n = rows.length;
  _leadDrafts = [];
  await loadStore();
  toast(`${n} compan${n === 1 ? 'y' : 'ies'} added`);
  router.go('companies');
}

let _leadProfilingProgress = null; // {done, total, current} while running, null when idle

function renderLeadProfile(page) {
  const haveDrafts = _leadDrafts.length > 0;
  const running = !!_leadProfilingProgress;
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Profile New Companies</h1>
        <div class="page-subtitle">Single name or list. AI profiles each company and fills all fields. Review before saving.</div>
      </div>
      ${haveDrafts && !running ? `<button class="btn btn-ghost" onclick="discardAllLeadDrafts()">Start over</button>` : ''}
    </div>
    ${running ? `
      <div class="card" style="margin-bottom:12px">
        <div class="flex justify-between items-center mb-2">
          <div style="font-weight:600">Profiling ${_leadProfilingProgress.done} of ${_leadProfilingProgress.total} · ${_leadProfilingProgress.current}…</div>
          <div class="text-sm text-muted">Sequential · LLM call per company</div>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${Math.round(_leadProfilingProgress.done / _leadProfilingProgress.total * 100)}%"></div></div>
      </div>` : ''}
    ${haveDrafts ? renderLeadDraftStep() : renderLeadInputStep()}
  `;
  if (!haveDrafts && !running) wireLeadInputStep();
}

function renderLeadInputStep() {
  return `
    <div class="grid grid-12">
      <div class="card span-7">
        <div class="card-header">
          <div>
            <div class="card-title">Upload a CSV</div>
            <div class="card-subtitle">One column · header <code>company_name</code></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="downloadLeadTemplate()">Download template</button>
        </div>
        <label class="lead-drop" id="leadDrop">
          <span class="lead-drop-icon">${I.sparkles}</span>
          <span class="lead-drop-title">Drop CSV here or click to browse</span>
          <span class="lead-drop-sub">.csv · just one column needed</span>
          <input type="file" id="leadCsvInput" accept=".csv,text/csv"/>
        </label>
        <div class="text-sm text-muted" style="margin-top:10px" id="leadDropHint">No file selected.</div>
      </div>
      <div class="card span-5">
        <div class="card-header">
          <div>
            <div class="card-title">Or paste names</div>
            <div class="card-subtitle">One per line</div>
          </div>
        </div>
        <textarea class="textarea" id="leadPasteInput" rows="8"
          placeholder="Fennec Projects&#10;Nakhla Logistics&#10;Sahab Digital&#10;Pearlpath Consulting"></textarea>
      </div>
      <div class="card span-12" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div class="text-muted text-sm" id="leadCount">No leads parsed yet.</div>
        <button class="btn btn-primary" id="leadProfileBtn" disabled>Profile leads</button>
      </div>
    </div>
  `;
}

function wireLeadInputStep() {
  const drop = document.getElementById('leadDrop');
  const fileInput = document.getElementById('leadCsvInput');
  const paste = document.getElementById('leadPasteInput');
  const btn = document.getElementById('leadProfileBtn');
  const hint = document.getElementById('leadDropHint');
  const count = document.getElementById('leadCount');

  let csvNames = [];
  let pasteNames = [];

  function refreshCount() {
    const all = csvNames.length ? csvNames : pasteNames;
    btn.disabled = all.length === 0;
    btn.textContent = all.length
      ? `Profile ${all.length} ${all.length===1?'company':'companies'} with AI`
      : 'Profile with AI';
    count.textContent = all.length
      ? `${all.length} ${all.length===1?'company':'companies'} ready · ${csvNames.length ? 'from CSV' : 'pasted'}.`
      : 'No companies parsed yet.';
  }

  paste?.addEventListener('input', () => {
    pasteNames = parseLeadInput(paste.value);
    refreshCount();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      csvNames = await parseLeadCsv(file);
      hint.textContent = `${file.name} · ${csvNames.length} row${csvNames.length===1?'':'s'} found.`;
      refreshCount();
    } catch (err) {
      hint.textContent = 'Could not read CSV: ' + err.message;
      toast('CSV read error', 'danger');
    }
  });

  // Drag & drop
  ['dragenter','dragover'].forEach(ev => drop?.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(ev => drop?.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('dragover');
  }));
  drop?.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      csvNames = await parseLeadCsv(file);
      hint.textContent = `${file.name} · ${csvNames.length} row${csvNames.length===1?'':'s'} found.`;
      refreshCount();
    } catch (err) {
      hint.textContent = 'Could not read CSV: ' + err.message;
    }
  });

  btn?.addEventListener('click', () => {
    const names = csvNames.length ? csvNames : pasteNames;
    if (!names.length) return;
    processLeads(names);
  });
}

function renderLeadDraftStep() {
  const kept = _leadDrafts.filter(d => !d._discarded).length;
  const COMPANY_TYPES = ['Government','Semi-Government','PIF','Private','Enterprise','Multinational','Startup'];
  const COMPANY_SIZES = ['Startup','Small','Medium','Large','Enterprise'];
  const ERP_OPTIONS = ['Unknown','SAP','Oracle EBS','Oracle Fusion','Microsoft','Odoo','Other'];
  const STATUS_OPTIONS = ['Hot','Warm','Active','Cold','Archived'];
  const opt = (vals, sel) => vals.map(v => `<option ${v===sel?'selected':''}>${v}</option>`).join('');

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Review & save · ${_leadDrafts.length} draft${_leadDrafts.length===1?'':'s'}</div>
          <div class="card-subtitle">Edit any field; ICP score recomputes live. Discard rows you don't want.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="lead-table">
          <thead><tr>
            <th scope="col">Name</th>
            <th scope="col">Website</th>
            <th scope="col">Type</th>
            <th scope="col">Industry</th>
            <th scope="col">Size</th>
            <th scope="col">Country</th>
            <th scope="col">City</th>
            <th scope="col">ERP</th>
            <th scope="col">Status</th>
            <th scope="col" style="text-align:right">ICP</th>
            <th scope="col" style="text-align:right"></th>
          </tr></thead>
          <tbody>
            ${_leadDrafts.map((d, i) => `
              <tr data-lead-idx="${i}" class="${d._discarded?'discarded':''}">
                <td style="font-weight:500">${d.name}
                  ${d._source==='heuristic'?'<span class="badge warning" style="margin-left:6px">heuristic</span>':''}
                  ${d._source==='duplicate'?'<span class="badge danger" style="margin-left:6px">duplicate</span>':''}
                </td>
                <td>
                  <input class="input" value="${d.website||''}" oninput="updateLeadDraft(${i},'website',this.value)" ${d._website_warning?`title="${d._website_warning}" style="border-color:var(--color-warning)"`:''}/>
                  ${d._website_warning?`<div class="text-sm" style="color:var(--color-warning); margin-top:2px">⚠ ${d._website_warning}</div>`:''}
                </td>
                <td><select class="select" onchange="updateLeadDraft(${i},'type',this.value)">${opt(COMPANY_TYPES, d.type)}</select></td>
                <td><input class="input" value="${d.industry}" oninput="updateLeadDraft(${i},'industry',this.value)"/></td>
                <td><select class="select" onchange="updateLeadDraft(${i},'size',this.value)">${opt(COMPANY_SIZES, d.size)}</select></td>
                <td><input class="input" value="${d.country||''}" oninput="updateLeadDraft(${i},'country',this.value)"/></td>
                <td><input class="input" value="${d.city||''}" oninput="updateLeadDraft(${i},'city',this.value)"/></td>
                <td><select class="select" onchange="updateLeadDraft(${i},'erp_current',this.value)">${opt(ERP_OPTIONS, d.erp_current)}</select></td>
                <td><select class="select" onchange="updateLeadDraft(${i},'status',this.value)">${opt(STATUS_OPTIONS, d.status)}</select></td>
                <td class="icp-cell" style="color:${icpColor(d.icp_score)}">${d.icp_score}</td>
                <td style="text-align:right">
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="discardLeadDraft(${i})" aria-label="${d._discarded ? 'Restore' : 'Discard'} ${d.name}">
                    ${d._discarded ? I.check : I.trash}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="lead-actionbar">
      <div class="lead-counter">${kept} of ${_leadDrafts.length} will be saved.</div>
      <div class="flex gap-2">
        <button class="btn btn-outline" onclick="discardAllLeadDrafts()">Discard all</button>
        <button class="btn btn-primary" onclick="saveAllLeadDrafts()" ${kept===0?'disabled':''}>Save ${kept} compan${kept===1?'y':'ies'}</button>
      </div>
    </div>
  `;
}

function renderCompanies(page){
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>Companies</h1><div class="page-subtitle">${store.companies.length} companies in directory</div></div>
      <div class="flex gap-2">
        <button class="btn btn-accent" onclick="router.go('leadProfile')">${I.sparkles.replace('<svg','<svg width=\"14\" height=\"14\"')} Profile New Companies</button>
        <button class="btn btn-primary" onclick="openCompanyModal()">+ Add Company</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="datatable">
          <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Industry</th><th scope="col">Size</th><th scope="col">Country</th><th scope="col">ERP</th><th scope="col">ICP</th><th scope="col">Status</th></tr></thead>
          <tbody>
            ${store.companies.map(c => `
              <tr onclick="openCompanyModal('${c.id}')">
                <td><div class="flex items-center gap-2"><div class="avatar-sm" style="background:${icpColor(c.icp_score)}">${c.name[0]}</div><div><div style="font-weight:500">${c.name}</div><div class="text-sm text-muted">${c.website||''}</div></div></div></td>
                <td>${c.type}</td>
                <td>${c.industry}</td>
                <td>${c.size}</td>
                <td>${c.country}</td>
                <td>${c.erp_current||'—'}</td>
                <td><span class="badge ${c.icp_score>=85?'success':c.icp_score>=70?'info':'warning'}">${c.icp_score}</span></td>
                <td><span class="badge ${c.status==='Hot'?'danger':c.status==='Warm'?'warning':'success'}">${c.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function openCompanyModal(id){
  const editing = id ? companyById(id) : null;
  const c = editing || { name:'', type:'Private', industry:'', size:'Medium', country:'Saudi Arabia', city:'', website:'', erp_current:'Unknown', status:'Active' };
  openModal(`
    <div class="modal wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${editing?'Edit':'Add'} Company${editing?` · <span style="color:var(--brand-secondary)">ICP ${editing.icp_score}</span>`:''}</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>Company Name</label><input class="input" id="c_name" value="${c.name}" required/></div>
          <div class="field"><label>Website</label><input class="input" id="c_website" value="${c.website||''}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Type</label><select class="select" id="c_type">${['Government','Semi-Government','PIF','Private','Enterprise','Multinational','Startup'].map(x=>`<option ${x===c.type?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="field"><label>Industry</label><input class="input" id="c_industry" value="${c.industry||''}" list="industries"/><datalist id="industries">${['Oil & Gas','Construction','Real Estate','Utilities','Energy','FMCG','Finance','Healthcare','Government','Telecom'].map(x=>`<option value="${x}">`).join('')}</datalist></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Size</label><select class="select" id="c_size">${['Startup','Small','Medium','Large','Enterprise'].map(x=>`<option ${x===c.size?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="field"><label>Current ERP</label><select class="select" id="c_erp">${['Unknown','SAP','Oracle EBS','Oracle Fusion','Microsoft','Odoo','Other'].map(x=>`<option ${x===c.erp_current?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Country</label><input class="input" id="c_country" value="${c.country||''}"/></div>
          <div class="field"><label>City</label><input class="input" id="c_city" value="${c.city||''}"/></div>
        </div>
        <div class="field"><label>Status</label><select class="select" id="c_status">${['Hot','Warm','Active','Cold'].map(x=>`<option ${x===c.status?'selected':''}>${x}</option>`).join('')}</select></div>
        ${editing ? `
          <h3 class="mt-4">Contacts at this company</h3>
          <div>${store.contacts.filter(p=>p.company_id===id).map(p=>`<div class="list-row"><div class="avatar-sm">${initials(p.first_name,p.last_name)}</div><div style="flex:1"><div style="font-weight:500">${p.first_name} ${p.last_name}</div><div class="text-sm text-muted">${p.title}</div></div><span class="badge">${p.seniority}</span></div>`).join('')||'<div class="text-muted">No contacts yet.</div>'}</div>
        `:''}
      </div>
      <div class="modal-footer">
        ${editing?`<button class="btn btn-danger" onclick="deleteCompany('${editing.id}')">Delete</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveCompany('${editing?editing.id:''}')">${editing?'Update':'Add Company'}</button>
      </div>
    </div>
  `);
}
async function saveCompany(id){
  const payload = {
    name: document.getElementById('c_name').value.trim(),
    website: document.getElementById('c_website').value.trim(),
    type: document.getElementById('c_type').value,
    industry: document.getElementById('c_industry').value.trim(),
    size: document.getElementById('c_size').value,
    erp_current: document.getElementById('c_erp').value,
    country: document.getElementById('c_country').value.trim(),
    city: document.getElementById('c_city').value.trim(),
    status: document.getElementById('c_status').value,
  };
  if (!payload.name) { toast('Company name required', 'warning'); return; }
  const existing = id ? companyById(id) : null;
  const prev = existing ? structuredClone(existing) : null;
  if (existing) Object.assign(existing, payload);
  else {
    const tempId = 'tmp_' + Math.random().toString(36).slice(2, 9);
    store.companies.unshift({ id: tempId, owner_id: userId, ...payload, created: todayStr() });
  }
  closeModal();

  router.go(router.current);
  const { error } = id
    ? await db.from('companies').update(payload).eq('id', id)
    : await db.from('companies').insert({ ...payload, owner_id: userId });
  if (error) {
    if (existing && prev) Object.assign(existing, prev);
    else store.companies = store.companies.filter(c => !String(c.id).startsWith('tmp_'));
    router.go(router.current);
    toast(error.message, 'danger');
    return;
  }
  await loadStore();
  router.go(router.current);
  toast('Company saved');
}
async function deleteCompany(id){
  const removed = companyById(id);
  if (!removed) return;
  store.companies = store.companies.filter(c => c.id !== id);
  closeModal();
  router.go(router.current);
  toast('Company deleted', 'warning', { undo: () => restoreCompany(removed) });
  // ON DELETE CASCADE on contacts + deals handles the dependents server-side.
  const { error } = await db.from('companies').delete().eq('id', id);
  if (error) {
    store.companies.push(removed);
    router.go(router.current);
    toast(error.message, 'danger');
  }
}
async function restoreCompany(c){
  const payload = toDbCompany(c);
  const { error } = await db.from('companies').insert({ ...payload, owner_id: userId });
  if (error) return toast(error.message, 'danger');
  await loadStore(); router.go(router.current); toast('Company restored');
}

/* ---------- People ---------- */
function renderPeople(page){
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>Contacts</h1><div class="page-subtitle">${store.contacts.length} contacts · full account mapping</div></div>
      <div class="flex items-center gap-2">
        <button class="btn btn-accent" onclick="router.go('findContacts')">${I.sparkles.replace('<svg','<svg width=\"14\" height=\"14\"')} Find Contacts in Profiled Companies</button>
        <button class="btn btn-primary" onclick="openContactModal()">+ Add Contact</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="datatable">
          <thead><tr><th scope="col">Name</th><th scope="col">Title</th><th scope="col">Company</th><th scope="col">Seniority</th><th scope="col">Department</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">LinkedIn</th></tr></thead>
          <tbody>
            ${store.contacts.map(p=>`
              <tr onclick="openContactModal('${p.id}')">
                <td><div class="flex items-center gap-2"><div class="avatar-sm">${initials(p.first_name,p.last_name)}</div><div style="font-weight:500">${p.first_name} ${p.last_name}</div></div></td>
                <td>${p.title}</td>
                <td>${companyById(p.company_id)?.name||'—'}</td>
                <td><span class="badge">${p.seniority}</span></td>
                <td>${p.department||'—'}</td>
                <td class="text-muted">${p.email||'—'}</td>
                <td class="text-muted">${p.phone||'—'}</td>
                <td>${p.linkedin?`<a href="https://${p.linkedin.replace(/^https?:\/\//,'')}" target="_blank" rel="noopener">View</a>`:'—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function openContactModal(id){
  const editing = id ? contactById(id) : null;
  const p = editing || { first_name:'', last_name:'', title:'', company_id: store.companies[0]?.id||'', seniority:'Manager', department:'', email:'', phone:'', linkedin:'' };
  openModal(`
    <div class="modal wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${editing?'Edit':'Add'} Contact</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>First Name</label><input class="input" id="p_first" value="${p.first_name}"/></div>
          <div class="field"><label>Last Name</label><input class="input" id="p_last" value="${p.last_name}"/></div>
        </div>
        <div class="field"><label>Title</label><input class="input" id="p_title" value="${p.title||''}"/></div>
        <div class="field-row">
          <div class="field"><label>Company</label><select class="select" id="p_company">${store.companies.map(c=>`<option value="${c.id}" ${c.id===p.company_id?'selected':''}>${c.name}</option>`).join('')}</select></div>
          <div class="field"><label>Seniority</label><select class="select" id="p_sen">${['C-Level','VP','Director','Manager','Individual'].map(x=>`<option ${x===p.seniority?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Department</label><input class="input" id="p_dept" value="${p.department||''}"/></div>
          <div class="field"><label>Email</label><input class="input" type="email" id="p_email" value="${p.email||''}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Phone</label><input class="input" id="p_phone" value="${p.phone||''}"/></div>
          <div class="field"><label>LinkedIn</label><input class="input" id="p_linkedin" value="${p.linkedin||''}"/></div>
        </div>
      </div>
      <div class="modal-footer">
        ${editing?`<button class="btn btn-danger" onclick="deleteContact('${editing.id}')">Delete</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveContact('${editing?editing.id:''}')">${editing?'Update':'Add Contact'}</button>
      </div>
    </div>
  `);
}
async function saveContact(id){
  const payload = {
    first_name: document.getElementById('p_first').value.trim(),
    last_name:  document.getElementById('p_last').value.trim(),
    title:      document.getElementById('p_title').value.trim(),
    company_id: document.getElementById('p_company').value,
    seniority:  document.getElementById('p_sen').value,
    department: document.getElementById('p_dept').value.trim(),
    email:      document.getElementById('p_email').value.trim(),
    phone:      document.getElementById('p_phone').value.trim(),
    linkedin:   document.getElementById('p_linkedin').value.trim(),
  };
  const existing = id ? contactById(id) : null;
  const prev = existing ? structuredClone(existing) : null;
  if (existing) Object.assign(existing, payload);
  else {
    const tempId = 'tmp_' + Math.random().toString(36).slice(2, 9);
    store.contacts.unshift({ id: tempId, owner_id: userId, ...payload });
  }
  closeModal();

  router.go(router.current);
  const { error } = id
    ? await db.from('contacts').update(payload).eq('id', id)
    : await db.from('contacts').insert({ ...payload, owner_id: userId });
  if (error) {
    if (existing && prev) Object.assign(existing, prev);
    else store.contacts = store.contacts.filter(p => !String(p.id).startsWith('tmp_'));
    router.go(router.current);
    toast(error.message, 'danger');
    return;
  }
  if (!id) await loadStore();
  toast('Contact saved');
}
async function deleteContact(id){
  const removed = contactById(id);
  if (!removed) return;
  store.contacts = store.contacts.filter(p => p.id !== id);
  closeModal();
  router.go(router.current);
  toast('Contact deleted', 'warning', { undo: () => restoreContact(removed) });
  const { error } = await db.from('contacts').delete().eq('id', id);
  if (error) {
    store.contacts.push(removed);
    router.go(router.current);
    toast(error.message, 'danger');
  }
}
async function restoreContact(p){
  const { id, ...payload } = p;
  const { error } = await db.from('contacts').insert({ ...payload, owner_id: userId });
  if (error) return toast(error.message, 'danger');
  await loadStore(); router.go(router.current); toast('Contact restored');
}

/* ---------- CRM Kanban (Drag & Drop) ---------- */
let _dragDealId = null;
let _dragFromStage = null;

function renderCRMKanban(page){
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>CRM — Sales Kanban</h1><div class="page-subtitle">Drag deals between stages · sub-stage confirmation required</div></div>
      <button class="btn btn-primary" onclick="openDealModal()">+ Add Deal</button>
    </div>
    <div class="kanban" id="kanban">
      ${STAGES.map(s => {
        const deals = store.deals.filter(d => d.stage === s.key);
        const total = deals.reduce((a,b)=>a+b.value_sar,0);
        return `
        <div class="kanban-col" data-stage="${s.key}">
          <div class="kanban-col-header">
            <div class="kanban-col-title"><span class="stage-dot" style="background:${s.color}"></span>${s.key}</div>
            <span class="kanban-col-count">${deals.length} · ${SAR(total)}</span>
          </div>
          ${deals.map(d => `
            <div class="deal-card" draggable="true" data-deal="${d.id}" role="button" tabindex="0" aria-label="Open deal ${d.name}" onclick="openDealModal('${d.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDealModal('${d.id}');}">
              <div class="deal-card-title">${d.name}</div>
              <div class="deal-card-company">${companyById(d.company_id)?.name||''}</div>
              <div class="flex justify-between items-center">
                <span class="deal-card-value">${SAR(d.value_sar)}</span>
                <span class="badge">${d.sub_stage}</span>
              </div>
              <div class="deal-card-footer"><span>Close ${d.close_date}</span><span>${d.probability}%</span></div>
            </div>
          `).join('')}
        </div>`;
      }).join('')}
    </div>
  `;
  wireKanban();
}

function wireKanban(){
  const cards = document.querySelectorAll('.deal-card');
  const cols  = document.querySelectorAll('.kanban-col');
  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      _dragDealId = card.dataset.deal;
      const deal = dealById(_dragDealId);
      _dragFromStage = deal?.stage;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  cols.forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop-target'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drop-target');
      const newStage = col.dataset.stage;
      if (!_dragDealId || newStage === _dragFromStage) return;
      openSubStagePicker(_dragDealId, newStage);
    });
  });
}

function openSubStagePicker(dealId, newStage){
  const stage = STAGES.find(s=>s.key===newStage);
  openModal(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">Move to <span style="color:${stage.color}">${newStage}</span></div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Select Sub-Stage</label><select class="select" id="ss_pick">${stage.subs.map(s=>`<option>${s}</option>`).join('')}</select></div>
        <div class="ai-insight"><div class="ai-icon">${I.sparkles}</div><div class="text-muted">Moving a deal updates stage + sub-stage in the database and refreshes all reports.</div></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="confirmMoveDeal('${dealId}','${newStage}')">Confirm Move</button>
      </div>
    </div>
  `);
}
async function confirmMoveDeal(dealId, newStage){
  const sub = document.getElementById('ss_pick').value;
  const patch = { stage: newStage, sub_stage: sub };
  if (newStage === 'Won') patch.probability = 100;
  if (newStage === 'Lost') patch.probability = 0;
  // OPTIMISTIC: apply locally + render before the network round-trip.
  const d = dealById(dealId);
  const prev = structuredClone(d);
  Object.assign(d, patch);
  closeModal();
  toast(`Moved to ${newStage} · ${sub}`);
  router.go('crm');
  // Background sync.
  const { error } = await db.from('deals').update(patch).eq('id', dealId);
  if (error) {
    Object.assign(d, prev);
    router.go('crm');
    toast(error.message, 'danger');
  }
}

function openDealModal(id){
  const editing = id ? dealById(id) : null;
  const d = editing || {
    name:'', company_id: store.companies[0]?.id||'',
    product_line:'', sub_product_line:'', scope_of_work:'',
    value_sar:500000, value_usd: Math.round(500000/SAR_PER_USD*100)/100,
    stage:'Qualification', sub_stage:'Initial Contact',
    expected_close: todayStr(), actual_close:'',
    notes:'', probability:20, owner:'Sara'
  };
  const expected = d.expected_close || d.close_date || '';
  const related = id ? store.activities.filter(a => a.deal_id === id) : [];

  openModal(`
    <div class="modal wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${editing?'Edit':'Add'} Deal</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Deal Name</label><input class="input" id="d_name" value="${d.name}"/></div>
        <div class="field-row">
          <div class="field"><label>Company</label><select class="select" id="d_company">${store.companies.map(c=>`<option value="${c.id}" ${c.id===d.company_id?'selected':''}>${c.name}</option>`).join('')}</select></div>
          <div class="field"><label>Stage</label><select class="select" id="d_stage" onchange="updateSubstageOptions(); autoFillProbability()">${STAGES.map(s=>`<option ${s.key===d.stage?'selected':''}>${s.key}</option>`).join('')}</select></div>
        </div>

        <div class="field-row">
          <div class="field"><label>Product Line</label>
            <select class="select" id="d_product">
              <option value="">— Select —</option>
              ${PRODUCT_LINES.map(k=>`<option ${k===d.product_line?'selected':''}>${k}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Sub-Product Line</label>
            <select class="select" id="d_subproduct">
              <option value="">— Select —</option>
              ${SUB_PRODUCT_LINES.map(s=>`<option ${s===d.sub_product_line?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field"><label>Scope of Work</label>
          <textarea class="input" id="d_scope" rows="2" placeholder="Describe the scope...">${d.scope_of_work||''}</textarea>
        </div>

        <div class="field-row">
          <div class="field"><label>Value (SAR)</label><input class="input" type="number" id="d_value_sar" value="${d.value_sar}" oninput="recalcDealUSD()"/></div>
          <div class="field"><label>Value (USD) <span class="text-muted text-sm">· auto @ ${SAR_PER_USD}</span></label>
            <input class="input" type="number" id="d_value_usd" value="${d.value_usd ?? Math.round((d.value_sar||0)/SAR_PER_USD*100)/100}" readonly/>
          </div>
        </div>

        <div class="field-row">
          <div class="field"><label>Sub-Stage</label><select class="select" id="d_sub">${STAGES.find(s=>s.key===d.stage).subs.map(s=>`<option ${s===d.sub_stage?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Probability (%)</label><input class="input" type="number" min="0" max="100" id="d_prob" value="${d.probability ?? 20}"/></div>
        </div>

        <div class="field-row">
          <div class="field"><label>Expected Close</label><input class="input" type="date" id="d_expected" value="${expected}"/></div>
          <div class="field"><label>Actual Close</label><input class="input" type="date" id="d_actual" value="${d.actual_close||''}"/></div>
        </div>

        <div class="field"><label>Notes</label>
          <textarea class="input" id="d_notes" rows="2" placeholder="Additional notes...">${d.notes||''}</textarea>
        </div>

        ${editing ? `
          <div class="field">
            <label>Related Activities <span class="text-muted text-sm">· ${related.length}</span></label>
            ${related.length === 0
              ? `<div class="text-muted text-sm">No activities linked to this deal yet.</div>`
              : `<div style="display:flex;flex-direction:column;gap:4px">${related.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(renderActivityRow).join('')}</div>`
            }
            <div style="margin-top:8px"><button type="button" class="btn btn-outline btn-sm" onclick="closeModal();openActivityModal()">+ Log Activity for this Deal</button></div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        ${editing?`<button class="btn btn-danger" onclick="deleteDeal('${editing.id}')">Delete</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveDeal('${editing?editing.id:''}')">${editing?'Update':'Add Deal'}</button>
      </div>
    </div>
  `);
}
function updateSubstageOptions(){
  const stage = document.getElementById('d_stage').value;
  const subs = STAGES.find(s=>s.key===stage).subs;
  document.getElementById('d_sub').innerHTML = subs.map(s=>`<option>${s}</option>`).join('');
}
function autoFillProbability(){
  const stage = document.getElementById('d_stage').value;
  const stageDef = STAGES.find(s=>s.key===stage);
  const prob = document.getElementById('d_prob');
  if (stageDef && prob) prob.value = stageDef.probability;
}
function recalcDealUSD(){
  const sar = Number(document.getElementById('d_value_sar').value||0);
  document.getElementById('d_value_usd').value = (sar/SAR_PER_USD).toFixed(2);
}
async function saveDeal(id){
  const value_sar = Number(document.getElementById('d_value_sar').value||0);
  const payload = toDbDeal({
    name: document.getElementById('d_name').value.trim(),
    company_id: document.getElementById('d_company').value,
    product_line: document.getElementById('d_product').value || null,
    sub_product_line: document.getElementById('d_subproduct').value || null,
    scope_of_work: document.getElementById('d_scope').value.trim() || null,
    value_sar,
    stage: document.getElementById('d_stage').value,
    sub_stage: document.getElementById('d_sub').value,
    probability: Number(document.getElementById('d_prob').value||0),
    expected_close: document.getElementById('d_expected').value || null,
    actual_close:   document.getElementById('d_actual').value   || null,
    notes: document.getElementById('d_notes').value.trim() || null,
  });
  // OPTIMISTIC: update local store + re-render immediately.
  const prev = id ? structuredClone(dealById(id)) : null;
  if (id) Object.assign(dealById(id), payload, { close_date: payload.expected_close });
  else {
    // Temporary client-side ID — will be replaced on reload.
    const tempId = 'tmp_' + Math.random().toString(36).slice(2, 9);
    store.deals.unshift({ id: tempId, owner_id: userId, ...payload, close_date: payload.expected_close });
  }
  closeModal();

  router.go(router.current);
  // Background sync.
  const { error } = id
    ? await db.from('deals').update(payload).eq('id', id)
    : await db.from('deals').insert({ ...payload, owner_id: userId });
  if (error) {
    // Roll back on failure.
    if (id && prev) Object.assign(dealById(id), prev);
    else store.deals = store.deals.filter(d => !String(d.id).startsWith('tmp_'));
    router.go(router.current);
    toast(error.message, 'danger');
    return;
  }
  // For new deals, re-fetch once to pick up the real DB-issued UUID.
  if (!id) await loadStore();
  toast('Deal saved');
}
async function deleteDeal(id){
  const removed = dealById(id);
  if (!removed) return;
  store.deals = store.deals.filter(d => d.id !== id);
  closeModal();
  router.go(router.current);
  toast('Deal deleted', 'warning', { undo: () => restoreDeal(removed) });
  const { error } = await db.from('deals').delete().eq('id', id);
  if (error) {
    store.deals.push(removed);
    router.go(router.current);
    toast(error.message, 'danger');
  }
}
async function restoreDeal(d){
  // Insert with the original payload; lets the user undo a delete.
  const { id, owner_id, close_date, value_usd, ...payload } = d;
  const { error } = await db.from('deals').insert({ ...payload, owner_id: userId });
  if (error) return toast(error.message, 'danger');
  await loadStore();
  router.go(router.current);
  toast('Deal restored');
}

/* ---------- CSM ---------- */
function renderCSM(page){
  const customers = store.deals.filter(d => d.stage === 'Won');
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>Customer Success</h1><div class="page-subtitle">${customers.length} active customers post-sale</div></div>
    </div>
    <div class="grid grid-12">
      ${customers.length === 0 ? `<div class="card span-12">${emptyState('No customers yet. Won deals automatically become CSM customers.')}</div>` : customers.map(d => {
        const c = companyById(d.company_id);
        return `<div class="card span-4">
          <div class="flex items-center gap-3 mb-4"><div class="avatar-sm" style="background:var(--brand-secondary)">${c.name[0]}</div><div><div style="font-weight:600">${c.name}</div><div class="text-sm text-muted">${d.name}</div></div></div>
          <div class="stat-label">Contract Value</div>
          <div style="font-size:22px; font-weight:700">${SAR(d.value_sar)}</div>
          <div class="mt-4 flex gap-2"><span class="badge success">Active</span><span class="badge">Health: 85</span></div>
        </div>`;
      }).join('')}
    </div>
  `;
}

/* ---------- Billing & Settings ---------- */
function renderBilling(page){ window.TarkitExperience.renderUsage(page); }
function renderSettings(page){
  page.innerHTML = `
    <div class="page-header"><div class="page-title"><h1>Settings</h1><div class="page-subtitle">Personalization and data management</div></div></div>
    <div class="grid grid-12">
      <div class="card span-6"><div class="card-header"><div class="card-title">Appearance</div></div>
        <div class="field"><label>Theme</label>
          <div class="flex gap-2">
            <button class="btn ${document.documentElement.dataset.theme!=='dark'?'btn-primary':'btn-outline'}" onclick="setTheme('light')">Light</button>
            <button class="btn ${document.documentElement.dataset.theme==='dark'?'btn-primary':'btn-outline'}" onclick="setTheme('dark')">Dark</button>
          </div>
        </div>
      </div>
      <div class="card span-6"><div class="card-header"><div class="card-title">Account</div></div>
        <div class="text-muted mb-2">Signed in as <b>${session?.user?.email || '—'}</b></div>
        <div class="flex gap-2 mt-4">
          <button class="btn btn-outline" onclick="exportData()">Export Snapshot (JSON)</button>
          <button class="btn btn-danger" onclick="signOut()">Sign out</button>
        </div>
      </div>
    </div>
  `;
}
function setTheme(t){
  document.documentElement.dataset.theme = t;
  store.ui.theme = t; saveStore(); router.go('settings');
}
function exportData(){
  const blob = new Blob([JSON.stringify(store,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'TARKIT_v1.0_data.json'; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- AI Profile (simulated) ---------- */
function openAIProfile(){
  openModal(`
    <div class="modal wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${I.sparkles.replace('<svg','<svg width=\"18\" height=\"18\"')} AI Profile Company</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Company Name</label><input class="input" id="ai_name" placeholder="e.g., Tabuk Construction Co"/></div>
        <div class="ai-insight"><div class="ai-icon">${I.sparkles}</div><div class="text-muted">Claude + LinkedIn + web scraping + news APIs will enrich this company and auto-score it against your ICP.</div></div>
        <div id="ai_result" class="mt-4"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-accent" id="ai_run">${I.sparkles.replace('<svg','<svg width=\"14\" height=\"14\"')} Run AI Profile</button>
      </div>
    </div>
  `);
  document.getElementById('ai_run').onclick = runAIProfile;
}
function runAIProfile(){
  const name = document.getElementById('ai_name').value.trim();
  if (!name) { toast('Enter a company name','warning'); return; }
  const res = document.getElementById('ai_result');
  res.innerHTML = `<div class="text-muted">Enriching ${name}…</div>`;
  // Simulated enrichment
  setTimeout(() => {
    const mock = {
      industry: 'Construction', type:'Private', size:'Large',
      country:'Saudi Arabia', city:'Riyadh', website: name.toLowerCase().replace(/\s+/g,'')+'.com',
      erp_current:'Unknown',
    };
    const tmp = { id:'tmp', ...mock, name, status:'Warm' };
    const score = scoreCompany(tmp);
    res.innerHTML = `
      <div class="ai-insight"><div class="ai-icon">${I.sparkles}</div>
        <div style="flex:1">
          <div style="font-weight:600; margin-bottom:6px">AI Findings for ${name}</div>
          <div class="text-muted mb-2">Industry: <b>${mock.industry}</b> · Type: <b>${mock.type}</b> · Size: <b>${mock.size}</b></div>
          <div class="mb-2"><b>ICP Score: <span style="color:${icpColor(score)}">${score}</span></b></div>
          <div class="mb-2"><b>Pain points:</b> Project visibility, cost overruns, disconnected PMO systems.</div>
          <div class="mb-2"><b>Recommended products:</b> Oracle Unifier + Primavera P6 + Aconex.</div>
          <div class="mb-2"><b>Suggested outreach:</b> LinkedIn connect with PMO Director → 3-day wait → value-driven DM → discovery call.</div>
        </div>
      </div>
      <div class="mt-4 flex gap-2"><button class="btn btn-primary" id="ai_save">Add to Companies</button></div>
    `;
    document.getElementById('ai_save').onclick = async () => {
      const { error } = await db.from('companies').insert({ owner_id: userId, name, ...mock, status:'Hot' });
      if (error) return toast(error.message, 'danger');
      await loadStore(); closeModal(); toast('Company added with AI profile'); router.go('companies');
    };
  }, 900);
}

/* ---------- Quick Add ---------- */
document.getElementById('quickAddBtn').addEventListener('click', () => {
  openModal(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header"><div class="modal-title">Quick Add</div><button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button></div>
      <div class="modal-body">
        <div style="display:grid; grid-template-columns: repeat(2,1fr); gap:12px">
          <button class="btn btn-outline" style="padding:20px" onclick="closeModal();openCompanyModal()">${I.building.replace('<svg','<svg width=\"18\" height=\"18\"')} Company</button>
          <button class="btn btn-outline" style="padding:20px" onclick="closeModal();openContactModal()">${I.users.replace('<svg','<svg width=\"18\" height=\"18\"')} Contact</button>
          <button class="btn btn-outline" style="padding:20px" onclick="closeModal();openDealModal()">${I.briefcase.replace('<svg','<svg width=\"18\" height=\"18\"')} Deal</button>
          <button class="btn btn-outline" style="padding:20px" onclick="closeModal();openActivityModal()">${I.activity.replace('<svg','<svg width=\"18\" height=\"18\"')} Activity</button>
        </div>
      </div>
    </div>
  `);
});

/* ---------- Charts ---------- */
function chartColors(){
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    grid: dark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.08)',
    text: dark ? '#94A3B8' : '#475569',
    palette: ['#10B981','#6366F1','#0EA5E9','#F59E0B','#EF4444','#8B5CF6','#EC4899','#64748B'],
  };
}
function groupCount(arr, key){
  const m = {};
  arr.forEach(x => { m[x[key]] = (m[x[key]]||0) + 1; });
  return { labels: Object.keys(m), data: Object.values(m) };
}
function groupSum(arr, key, sumKey){
  const m = {};
  arr.forEach(x => { m[x[key]] = (m[x[key]]||0) + x[sumKey]; });
  return { labels: Object.keys(m), data: Object.values(m) };
}
function drawBar(id, data, opts={}){
  const el = document.getElementById(id); if (!el) return;
  const col = chartColors();
  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.fillStyle = col.text;
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      meta.data.forEach((bar, i) => {
        const v = chart.data.datasets[0].data[i];
        if (v == null) return;
        const txt = opts.money ? SAR(v) : NUM(v);
        ctx.fillText(txt, bar.x, bar.y - 6);
      });
      ctx.restore();
    }
  };
  new Chart(el, {
    type:'bar',
    data:{ labels: data.labels, datasets:[{ data: data.data, backgroundColor: col.palette, borderRadius: 8, barThickness:'flex', maxBarThickness: 42 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      layout: opts.dataLabels ? { padding: { top: 24 } } : {},
      plugins:{ legend:{ display:false }, tooltip:{ callbacks: opts.money? { label:(c)=>SAR(c.parsed.y) }:{} } },
      scales:{
        x:{ grid:{ display:false }, ticks:{ color:col.text } },
        y:{ grid:{ color:col.grid }, ticks:{ color:col.text, callback: (v)=> opts.money? SAR(v):NUM(v) } },
      }
    },
    plugins: opts.dataLabels ? [valueLabelsPlugin] : []
  });
}
function drawDoughnut(id, data){
  const el = document.getElementById(id); if (!el) return;
  const col = chartColors();
  new Chart(el, {
    type:'doughnut',
    data:{ labels: data.labels, datasets:[{ data: data.data, backgroundColor: col.palette, borderWidth: 0 }] },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{ legend:{ position:'right', labels:{ color:col.text, boxWidth:12 } } }
    }
  });
}
function drawPipelineStage(id){
  const data = groupSum(store.deals.filter(d=>!['Won','Lost'].includes(d.stage)), 'stage', 'value_sar');
  drawBar(id, data, { money:true });
}


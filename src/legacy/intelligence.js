/* =========================================================================
   WORKFLOW LAYER · JSON contracts, validated LLM calls, traced pipeline
   Pattern: every step takes JSON in → returns JSON out.
   ========================================================================= */
/* RECORD_SCHEMAS: shape of the saved row in our database (what the app stores). */
const RECORD_SCHEMAS = {
  companyIn:  { name: '' },
  companyOut: {
    company_name:'', website:'', type:'', industry:'',
    size:'', current_erp:'', country:'', city:'', status:''
  },
  contactsIn: { company_id:'', company_name:'', count: 5 },
  contactOut: {
    first_name:'', last_name:'', title:'', company:'', company_id:'',
    seniority:'', department:'', email:'', phone:'', linkedin:''
  }
};
/* LLM_SCHEMAS: the strict contract we expect the LLM to return. NO derived fields. */
const LLM_SCHEMAS = {
  companyOut: {
    company_name:'', website:'', type:'', industry:'',
    size:'', current_erp:'', country:'', city:''
  }
};
/* Backwards-compat alias (some older code may reference SCHEMAS) */
const SCHEMAS = RECORD_SCHEMAS;

/* Allowed enum values — must mirror the manual Add Company modal */
const ENUMS = {
  type:        ['Government','Semi-Government','PIF','Private','Enterprise','Multinational','Startup'],
  size:        ['Startup','Small','Medium','Large','Enterprise'],
  current_erp: ['Unknown','SAP','Oracle EBS','Oracle Fusion','Microsoft','Odoo','Other'],
};
const ENUM_DEFAULTS = { type:'Private', size:'Medium', current_erp:'Unknown' };
const ENUM_ALIASES = {
  type: {
    'govt':'Government','government entity':'Government','public':'Government',
    'semi-gov':'Semi-Government','semi government':'Semi-Government','semi-governmental':'Semi-Government',
    'sovereign wealth fund':'PIF','public investment fund':'PIF',
    'private company':'Private','privately held':'Private','llc':'Private',
    'large enterprise':'Enterprise','enterprise corp':'Enterprise',
    'mnc':'Multinational','multi-national':'Multinational','global':'Multinational',
    'start-up':'Startup','start up':'Startup','sme':'Small'
  },
  size: {
    'sme':'Small','small business':'Small','smb':'Small',
    'mid-market':'Medium','mid market':'Medium','midsize':'Medium','mid-size':'Medium',
    'enterprise corp':'Enterprise','large enterprise':'Enterprise',
    'startup':'Startup','start-up':'Startup'
  },
  current_erp: {
    's/4hana':'SAP','sap s/4':'SAP','sap erp':'SAP','sap business one':'SAP',
    'oracle e-business suite':'Oracle EBS','ebs':'Oracle EBS','e-business':'Oracle EBS',
    'fusion':'Oracle Fusion','oracle cloud erp':'Oracle Fusion','oracle erp cloud':'Oracle Fusion',
    'dynamics 365':'Microsoft','d365':'Microsoft','dynamics':'Microsoft','navision':'Microsoft','axapta':'Microsoft',
    'none':'Unknown','n/a':'Unknown','na':'Unknown','':'Unknown'
  }
};
function coerceEnum(field, raw){
  if (raw == null) return { value: ENUM_DEFAULTS[field], warning: 'missing → defaulted' };
  const allowed = ENUMS[field];
  const v = String(raw).trim();
  if (!v) return { value: ENUM_DEFAULTS[field], warning: 'empty → defaulted' };
  // exact or case-insensitive match
  const ci = allowed.find(a => a.toLowerCase() === v.toLowerCase());
  if (ci) return { value: ci, warning: '' };
  // alias map
  const aliased = ENUM_ALIASES[field][v.toLowerCase()];
  if (aliased) return { value: aliased, warning: `coerced "${v}" → ${aliased}` };
  // substring fuzzy match
  const sub = allowed.find(a => v.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(v.toLowerCase()));
  if (sub) return { value: sub, warning: `fuzzy "${v}" → ${sub}` };
  return { value: ENUM_DEFAULTS[field], warning: `unknown "${v}" → ${ENUM_DEFAULTS[field]}` };
}

const WF_LOG_KEY = 'tz_workflow_log';
const WF_LOG_LIMIT = 50;
function wfLog(){ try { return JSON.parse(localStorage.getItem(WF_LOG_KEY) || '[]'); } catch(_){ return []; } }
function trace(step, payload, status='ok'){
  const entry = { ts: new Date().toISOString(), step, status, payload };
  const log = wfLog(); log.unshift(entry);
  if (log.length > WF_LOG_LIMIT) log.length = WF_LOG_LIMIT;
  localStorage.setItem(WF_LOG_KEY, JSON.stringify(log));
  console.log(`[wf:${step}:${status}]`, payload);
  return payload;
}
function clearWfLog(){ localStorage.removeItem(WF_LOG_KEY); if (router.current==='integrations') router.go('integrations'); }

/* One-line summary for a log entry — keeps the collapsed row scannable. */
function wfSummary(e){
  const p = e.payload;
  if (p == null) return '';
  if (typeof p === 'string') return p.length > 80 ? p.slice(0, 80) + '…' : p;
  if (typeof p !== 'object') return String(p);
  if (e.step === 'input' && p.name) return `name: ${p.name}`;
  if (e.step === 'llm.request') return `${p.provider || '?'} · ${p.model || '?'} · attempt ${p.attempt || 1}`;
  if (e.step === 'llm.response.raw') {
    const tok = p.usage?.total_tokens != null ? `${p.usage.total_tokens} tokens` : '';
    return [p.provider, p.model, tok].filter(Boolean).join(' · ');
  }
  if (e.step === 'llm.response.parsed') return `${p.name||''} · ${p.type||''} · ${p.size||''}`;
  if (e.step === 'llm.companyOut') return p.error ? `error: ${p.error}` : `${p.name||''} · ${p.type||''} · score ${p.icp_score??''}`;
  if (e.step === 'profileLead.done') return `${p.name||''} · ${p.source||''} · score ${p.icp_score??''} · ${p.status||''}`;
  if (e.step === 'coerce.warnings') return Object.entries(p).filter(([k])=>k!=='name').map(([k,v])=>`${k}: ${v}`).join(' · ');
  if (e.step === 'search.web') return p.error ? `error: ${p.error}` : `${p.name||''} · ${p.results||0} result${p.results===1?'':'s'}`;
  if (e.step === 'contactsIn') return `${p.company||''} · count ${p.count||''}`;
  if (e.step === 'enrich.contacts') return p.error ? `${p.company||''} · error: ${p.error}` : `${p.company||''} · ${p.received||0} received`;
  if (e.step === 'llm.classify') return `${p.name||''} · ${p.seniority||''}`;
  if (e.step === 'dedupe.match') return `${p.name||''} → existing ${p.existing_id?.slice(0,8) || ''}`;
  if (e.step === 'done') return `${p.company||''} · ${p.contacts||0} contacts`;
  // Generic fallback
  const keys = Object.keys(p).filter(k => !k.startsWith('_'));
  return keys.slice(0,3).map(k => `${k}: ${truncate(String(p[k]), 30)}`).join(' · ');
}
function truncate(s, n){ return (s||'').length > n ? s.slice(0,n)+'…' : s; }

/* Prompt editor card (one per prompt key) */
function renderPromptEditor(key, label, hint){
  const stored = loadPrompts()[key];
  const value = stored != null ? stored : DEFAULT_PROMPTS[key];
  const isCustom = !!(stored && stored.trim());
  return `
    <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
      <div class="flex justify-between items-center mb-2">
        <div>
          <div style="font-weight:600">${label}
            ${isCustom ? '<span class="badge warning" style="margin-left:6px">customized</span>' : '<span class="badge" style="margin-left:6px">default</span>'}
          </div>
          <div class="text-sm text-muted">${hint}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="resetPromptUI('${key}')">Reset to default</button>
          <button class="btn btn-primary btn-sm" onclick="savePromptUI('${key}')">Save</button>
        </div>
      </div>
      <textarea class="textarea" id="prompt_${key}" rows="10" style="font-family: ui-monospace, SF Mono, Menlo, monospace; font-size:12px;">${value.replace(/[<>&]/g, s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</textarea>
    </div>
  `;
}
function savePromptUI(key){
  const el = document.getElementById('prompt_'+key);
  if (!el) return;
  const v = el.value;
  if (!v.trim() || v === DEFAULT_PROMPTS[key]) {
    resetPrompt(key);
    toast('Prompt reset to default');
  } else {
    setPrompt(key, v);
    toast('Prompt saved');
  }
  router.go('integrations');
}
function resetPromptUI(key){
  resetPrompt(key);
  toast('Prompt reset to default');
  router.go('integrations');
}

function isVerboseTrace(){
  const v = localStorage.getItem('tz_verbose_trace');
  return v === null ? true : v === '1'; // default on
}
function setVerboseTrace(on){ localStorage.setItem('tz_verbose_trace', on ? '1' : '0'); }

async function llmJSON(system, user, schema){
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (isVerboseTrace()) {
        const which = defaultLLM();
        const cfg = which ? getIntegration(which) : {};
        trace('llm.request', {
          provider: which,
          model: cfg.model || (which === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat'),
          system_preview: system.slice(0, 240) + (system.length>240?'…':''),
          user_preview:   user.slice(0, 240) + (user.length>240?'…':''),
          attempt: attempt + 1
        });
      }
      const env = await Integrations.llm.chat({ system, user, json:true });
      if (isVerboseTrace()) {
        trace('llm.response.raw', {
          provider: env.provider, model: env.model,
          raw: (env.raw || '').slice(0, 400) + ((env.raw||'').length>400?'…':''),
          usage: env.usage
        });
      }
      const obj = (env.parsed && typeof env.parsed === 'object' && !Array.isArray(env.parsed)) ? env.parsed : {};
      const missing = Object.keys(schema).filter(k => !(k in obj));
      if (missing.length) throw new Error('Missing keys: ' + missing.join(','));
      obj.__usage = env.usage;
      return obj;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function statusFromScore(score){
  if (score >= 85) return 'Hot';
  if (score >= 70) return 'Warm';
  return 'Cold';
}

async function workflowProfileCompany(name){
  trace('input', { name });
  const sys = 'You return ONLY a JSON object with keys: company_name, website, type, industry, size, current_erp, country, city. Use empty string if unknown. Saudi Arabia / GCC context.';
  const llmOut = await llmJSON(sys, `Profile this company: ${name}`, SCHEMAS.companyOut);
  trace('llm.companyOut', llmOut);

  const candidate = {
    name:        llmOut.company_name || name,
    website:     llmOut.website || '',
    type:        llmOut.type || 'Private',
    industry:    llmOut.industry || '',
    size:        llmOut.size || 'Mid-Market',
    erp_current: llmOut.current_erp || '',
    country:     llmOut.country || 'Saudi Arabia',
    city:        llmOut.city || '',
    status:      'Cold',
    icp_score:   0
  };
  candidate.icp_score = scoreCompany(candidate);
  candidate.status = statusFromScore(candidate.icp_score);
  trace('score', { icp_score: candidate.icp_score, status: candidate.status });

  const { data: saved, error } = await db.from('companies')
    .insert({ ...toDbCompany(candidate), owner_id: userId })
    .select().single();
  if (error) { trace('save.company', error.message, 'err'); throw new Error(error.message); }
  trace('save.company', { id: saved.id, name: saved.name });
  return saved;
}

async function workflowFindContacts(companyId, companyName, count=5){
  trace('contactsIn', { companyId, companyName, count });
  const arr = await Integrations.enrich.contacts({ companyId, companyName, count });
  trace('enrich.contacts', { received: arr.length });
  for (const c of arr) await inferContactClassification(c);
  trace('llm.classified', { count: arr.length });
  if (!arr.length) return [];
  const rows = arr.map(c => ({
    owner_id: userId, company_id: companyId,
    first_name: c.first_name || '', last_name: c.last_name || '',
    title: c.title || '', seniority: c.seniority || '', department: c.department || '',
    email: c.email || '', phone: c.phone || '', linkedin: c.linkedin || ''
  }));
  const { error } = await db.from('contacts').insert(rows);
  if (error) { trace('save.contacts', error.message, 'err'); throw new Error(error.message); }
  trace('save.contacts', { saved: rows.length });
  return rows;
}

async function workflowHelloWorld(companyName, contactCount=3){
  try {
    const company = await workflowProfileCompany(companyName);
    const contacts = await workflowFindContacts(company.id, company.name, contactCount);
    trace('done', { company: company.name, contacts: contacts.length });
    return { company, contacts };
  } catch (e) {
    trace('error', e.message, 'err');
    throw e;
  }
}
window.workflowHelloWorld = workflowHelloWorld;

/* ---------- Run Workflow modal (Companies page) ---------- */
function openRunWorkflowModal(){
  openModal(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${I.sparkles.replace('<svg','<svg width=\"18\" height=\"18\"')} Run Profiling Workflow</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <div class="text-sm text-muted mb-2">Profile a company end-to-end: LLM enrich → ICP score → save → find contacts → save.</div>
        <div class="field"><label>Company Name</label><input class="input" id="wf_name" placeholder="e.g., Nakhla Logistics"/></div>
        <div class="field"><label>Contacts to find</label><input class="input" id="wf_count" type="number" min="0" max="25" value="3"/></div>
        <div id="wf_status" class="text-sm" style="margin-top:8px"></div>
        <pre id="wf_trail" class="text-sm" style="background:var(--bg-muted); padding:10px; border-radius:8px; max-height:240px; overflow:auto; margin-top:8px; display:none"></pre>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" id="wf_run" onclick="runWorkflowFromModal()">Run</button>
      </div>
    </div>
  `);
}
async function runWorkflowFromModal(){
  const name = document.getElementById('wf_name').value.trim();
  const count = Number(document.getElementById('wf_count').value || 0);
  if (!name) return toast('Enter a company name', 'danger');
  const btn = document.getElementById('wf_run');
  const status = document.getElementById('wf_status');
  const trail = document.getElementById('wf_trail');
  btn.disabled = true; status.textContent = 'Running…'; status.style.color='var(--text-muted)';
  try {
    const r = await workflowHelloWorld(name, count);
    status.style.color = 'var(--color-success)';
    status.textContent = `✓ Saved ${r.company.name} + ${r.contacts.length} contact(s)`;
    trail.style.display = 'block';
    trail.textContent = wfLog().slice(0, 12).map(e => `${e.ts.slice(11,19)} [${e.step}:${e.status}] ${typeof e.payload==='string'?e.payload:JSON.stringify(e.payload)}`).join('\n');
    await loadStore();
  } catch (e) {
    status.style.color = 'var(--color-danger)';
    status.textContent = '✗ ' + e.message;
    trail.style.display = 'block';
    trail.textContent = wfLog().slice(0, 12).map(e => `${e.ts.slice(11,19)} [${e.step}:${e.status}] ${typeof e.payload==='string'?e.payload:JSON.stringify(e.payload)}`).join('\n');
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================================
   INTEGRATIONS HUB · Adapter layer (LLM / Enrichment / Automation)
   Storage: localStorage 'tz_integrations' (JSON). Browser-local only.
   All adapter methods return JSON (matches workflow preference).
   ========================================================================= */
const INTEGRATIONS_KEY = 'tz_integrations';
const INTEGRATION_DEFS = [
  { id:'openai',   group:'LLM',         name:'OpenAI / ChatGPT', fields:[ {k:'api_key', label:'API Key', type:'password'}, {k:'model', label:'Model', type:'text', default:'gpt-4o-mini'} ] },
  { id:'deepseek', group:'LLM',         name:'DeepSeek',         fields:[ {k:'api_key', label:'API Key', type:'password'}, {k:'model', label:'Model', type:'text', default:'deepseek-chat'} ] },
  { id:'tavily',   group:'Search',      name:'Tavily Web Search', fields:[ {k:'api_key', label:'API Key', type:'password'} ] },
  { id:'lusha',    group:'Enrichment',  name:'Lusha',            fields:[ {k:'api_key', label:'API Key', type:'password'} ] },
  { id:'n8n',      group:'Automation',  name:'n8n',              fields:[ {k:'base_url', label:'Base URL', type:'text', default:'https://your-n8n.example.com'}, {k:'auth_header', label:'Auth Header (e.g., X-N8N-API-KEY: ...)', type:'text'} ] },
  { id:'supabase', group:'Database',    name:'Supabase',         fields:[ {k:'note', label:'Status', type:'readonly', default:'Connected via app config'} ] },
  { id:'email',    group:'Outreach',    name:'Email (coming soon)', fields:[], comingSoon:true },
  { id:'linkedin', group:'Outreach',    name:'LinkedIn (coming soon)', fields:[], comingSoon:true },
];
function loadIntegrations(){
  try { return JSON.parse(localStorage.getItem(INTEGRATIONS_KEY) || '{}'); } catch(_){ return {}; }
}
function saveIntegrations(cfg){
  localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(cfg));
}
function getIntegration(id){ return loadIntegrations()[id] || {}; }
function setIntegration(id, partial){
  const cfg = loadIntegrations();
  cfg[id] = { ...(cfg[id]||{}), ...partial };
  saveIntegrations(cfg);
}
function defaultLLM(){
  const cfg = loadIntegrations();
  if (cfg.openai && cfg.openai.api_key) return 'openai';
  if (cfg.deepseek && cfg.deepseek.api_key) return 'deepseek';
  return null;
}

window.Integrations = {
  async test(id){
    const cfg = getIntegration(id);
    try {
      if (id === 'openai') {
        if (!cfg.api_key) throw new Error('Missing API key');
        const res = await fetch('https://api.openai.com/v1/models', { headers:{ Authorization:`Bearer ${cfg.api_key}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok:true, info:'OpenAI reachable' };
      }
      if (id === 'deepseek') {
        if (!cfg.api_key) throw new Error('Missing API key');
        const res = await fetch('https://api.deepseek.com/models', { headers:{ Authorization:`Bearer ${cfg.api_key}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok:true, info:'DeepSeek reachable' };
      }
      if (id === 'tavily') {
        if (!cfg.api_key) throw new Error('Missing API key');
        const res = await fetch('https://api.tavily.com/search', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ api_key: cfg.api_key, query: 'test', max_results: 1 })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok:true, info:'Tavily reachable' };
      }
      if (id === 'lusha') {
        if (!cfg.api_key) throw new Error('Missing API key');
        const res = await fetch('https://api.lusha.com/v2/person', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'api_key': cfg.api_key },
          body: JSON.stringify({ contacts:[{ contactId:'test', firstName:'Test', lastName:'User', companies:[{ name:'Example' }] }] })
        });
        if (res.status === 401 || res.status === 403) throw new Error('Auth failed');
        return { ok:true, info:`Lusha responded (HTTP ${res.status})` };
      }
      if (id === 'n8n') {
        if (!cfg.base_url) throw new Error('Missing base URL');
        const res = await fetch(cfg.base_url.replace(/\/$/,'') + '/healthz').catch(()=>null);
        if (!res) throw new Error('Network error');
        return { ok:true, info:`n8n responded (HTTP ${res.status})` };
      }
      if (id === 'supabase') {
        const r = await db.from('companies').select('id', { head:true, count:'exact' });
        if (r.error) throw new Error(r.error.message);
        return { ok:true, info:'Supabase reachable' };
      }
      throw new Error('Test not implemented');
    } catch (e) {
      return { ok:false, info: e.message || String(e) };
    }
  },
  llm: {
    async chat({ system, user, json=true }){
      const which = defaultLLM();
      if (!which) throw new Error('No LLM configured. Connect OpenAI or DeepSeek in Integrations.');
      const cfg = getIntegration(which);
      const url   = which === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
      const model = cfg.model || (which === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat');
      const messages = [];
      if (system) messages.push({ role:'system', content: system });
      messages.push({ role:'user', content: user });
      const body = { model, messages, temperature: 0.2 };
      if (json) body.response_format = { type:'json_object' };
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${cfg.api_key}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errText = await res.text().catch(()=> '');
        throw new Error(`LLM HTTP ${res.status}${errText ? ': ' + errText.slice(0,200) : ''}`);
      }
      const data = await res.json();
      const txt = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || null;
      let parsed = null;
      if (json) { try { parsed = JSON.parse(txt); } catch(_){ parsed = null; } }
      return { provider: which, model, raw: txt, parsed, usage };
    }
  },
  search: {
    async web(query, max=3){
      const cfg = getIntegration('tavily');
      if (!cfg.api_key) return null;
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ api_key: cfg.api_key, query, max_results: Number(max), search_depth:'basic' })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.results || []).map(r => ({
          title: r.title || '', url: r.url || '', snippet: r.content || r.snippet || ''
        }));
      } catch(_){ return null; }
    }
  },
  enrich: {
    async company(name){
      const llm = defaultLLM();
      if (llm) {
        const res = await Integrations.llm.chat({
          system: 'You return ONLY a JSON object profiling a company. Keys: company_name, website, type, industry, size, current_erp, country, city. Use empty string if unknown.',
          user: `Profile this company in Saudi Arabia / GCC context. Name: ${name}`
        });
        return res;
      }
      return { company_name: name, website:'', type:'', industry:'', size:'', current_erp:'', country:'', city:'' };
    },
    async contacts({ companyId, companyName, count=5 }){
      const cfg = getIntegration('lusha');
      if (cfg.api_key) {
        try {
          const res = await fetch('https://api.lusha.com/prospecting/contact/search', {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'api_key': cfg.api_key },
            body: JSON.stringify({ pages:{ page:0, size: Number(count) }, filters:{ companies:{ include:{ names:[companyName] } } } })
          });
          if (res.ok) {
            const data = await res.json();
            return (data.data || data.contacts || []).map(c => ({
              first_name: c.firstName || c.first_name || '',
              last_name:  c.lastName  || c.last_name  || '',
              title:      c.jobTitle  || c.title || '',
              company:    companyName, company_id: companyId,
              seniority:  c.seniority || '',
              department: c.department || '',
              email:      c.email || '',
              phone:      c.phone || '',
              linkedin:   c.linkedinUrl || c.linkedin || '',
            }));
          }
        } catch(_){}
      }
      const llm = defaultLLM();
      if (llm) {
        const env = await Integrations.llm.chat({
          system: getPromptOrDefault('contactsFind'),
          user: `Company: ${companyName}. N: ${count}`
        });
        const parsed = env && env.parsed ? env.parsed : {};
        const arr = parsed.contacts || [];
        return arr.map(c => ({
          first_name: c.first_name||'', last_name: c.last_name||'', title: c.title||'',
          company: companyName, company_id: companyId,
          seniority: c.seniority||'', department: c.department||'',
          email:'', phone:'', linkedin:''
        }));
      }
      return [];
    }
  },
  automate: {
    async trigger(workflowId, payload){
      const cfg = getIntegration('n8n');
      if (!cfg.base_url) throw new Error('n8n not configured');
      const headers = { 'Content-Type':'application/json' };
      if (cfg.auth_header) {
        const idx = cfg.auth_header.indexOf(':');
        if (idx>0) headers[cfg.auth_header.slice(0,idx).trim()] = cfg.auth_header.slice(idx+1).trim();
      }
      const url = cfg.base_url.replace(/\/$/,'') + '/webhook/' + workflowId;
      const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
      return res.json().catch(()=>({ ok:true }));
    }
  }
};

async function inferContactClassification(c){
  if (c.seniority && c.department) return c;
  try {
    const env = await Integrations.llm.chat({
      system: getPromptOrDefault('contactClassify'),
      user: `Title: ${c.title || ''}`
    });
    const parsed = env && env.parsed ? env.parsed : null;
    if (parsed) {
      if (!c.seniority && parsed.seniority) c.seniority = parsed.seniority;
      if (!c.department && parsed.department) c.department = parsed.department;
    }
  } catch(_){}
  return c;
}

/* ---------- Customizable LLM prompts ---------- */
const PROMPTS_KEY = 'tz_prompts';
const DEFAULT_PROMPTS = {
  companyProfile: COMPANY_SYSTEM_PROMPT,
  contactsFind: `You return ONLY JSON: {"contacts":[{"first_name":"","last_name":"","title":"","seniority":"","department":""}]}.
List up to N plausible decision-maker contacts at the given company in Saudi Arabia/GCC.
Seniority must be one of: C-Level, VP, Director, Manager, Senior, Junior, Other.
Department: short phrase (e.g., IT, Finance, Procurement, Operations).
Email/phone/linkedin are NOT included — leave them out.`,
  contactClassify: 'Return ONLY JSON {"seniority":"...","department":"..."} inferred from a job title. Seniority one of: C-Level, VP, Director, Manager, Senior, Junior, Other.'
};
function loadPrompts(){
  try { return JSON.parse(localStorage.getItem(PROMPTS_KEY) || '{}'); } catch(_){ return {}; }
}
function savePrompts(p){ localStorage.setItem(PROMPTS_KEY, JSON.stringify(p)); }
function getPromptOrDefault(key){
  const p = loadPrompts();
  const v = p[key];
  return (v && v.trim()) ? v : DEFAULT_PROMPTS[key];
}
function setPrompt(key, value){
  const p = loadPrompts();
  p[key] = value;
  savePrompts(p);
}
function resetPrompt(key){
  const p = loadPrompts();
  delete p[key];
  savePrompts(p);
}

/* ---------- Integrations page ---------- */
function renderIntegrations(page){
  const cfg = loadIntegrations();
  const log = wfLog();
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>Integrations</h1><div class="page-subtitle">Connect APIs, MCPs and LLMs · keys stored in this browser only · JSON workflows</div></div>
      <button class="btn btn-outline" onclick="openRunWorkflowModal()">${I.bolt.replace('<svg','<svg width=\"14\" height=\"14\"')} Run Workflow</button>
    </div>
    <div class="grid grid-12 mb-4">
      <div class="card span-12">
        <div class="card-header">
          <div>
            <div class="card-title">Workflow Log</div>
            <div class="card-subtitle">Last ${WF_LOG_LIMIT} JSON payloads moving through the workflow · newest first</div>
          </div>
          <div class="flex gap-2 items-center">
            <label class="text-sm text-muted" style="display:flex; align-items:center; gap:6px">
              <input type="checkbox" id="verboseToggle" ${isVerboseTrace()?'checked':''} onchange="setVerboseTrace(this.checked); router.go('integrations')"/> Verbose
            </label>
            <button class="btn btn-ghost text-sm" onclick="clearWfLog()">Clear log</button>
          </div>
        </div>
        <div class="text-sm" style="margin-bottom:10px; color: ${cfg.tavily && cfg.tavily.api_key ? 'var(--color-success)' : 'var(--text-muted)'}">
          ${cfg.tavily && cfg.tavily.api_key
            ? '● Web grounding is <b>on</b> — Tavily snippets are injected before each LLM call.'
            : '○ Web grounding is <b>off</b> — connect Tavily above to ground LLM calls with live snippets.'}
        </div>
        ${log.length === 0
          ? `<div class="text-muted text-sm">No workflow runs yet. Run "Profile New Companies" or "Find Contacts" to populate the log.</div>`
          : `<div class="wf-log">
              ${log.map((e, i) => {
                const fullJson = (typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload, null, 2));
                const summary = wfSummary(e);
                const dotColor = e.status==='ok' ? 'var(--color-success)' : 'var(--color-danger)';
                return `
                  <details class="wf-row" ${i<3?'open':''}>
                    <summary class="wf-summary">
                      <span class="wf-time">${e.ts.slice(11,19)}</span>
                      <span class="wf-dot" style="background:${dotColor}"></span>
                      <span class="wf-step">${e.step}</span>
                      <span class="wf-msg">${summary.replace(/[<>&]/g, s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</span>
                    </summary>
                    <pre class="wf-json">${fullJson.replace(/[<>&]/g, s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</pre>
                  </details>`;
              }).join('')}
            </div>`
        }
      </div>
      <div class="card span-12">
        <div class="card-header">
          <div>
            <div class="card-title">Custom LLM Prompts</div>
            <div class="card-subtitle">Edit the system prompts the app sends to DeepSeek/OpenAI. Empty = use default.</div>
          </div>
        </div>
        ${renderPromptEditor('companyProfile', 'Company Profiling', 'Used by Profile New Companies. The LLM must return JSON matching the 8-field template.')}
        ${renderPromptEditor('contactsFind', 'Find Contacts', 'Used by Find Contacts in Profiled Companies. Must return {"contacts":[...]}.')}
        ${renderPromptEditor('contactClassify', 'Contact Classifier', 'Tiny prompt that infers seniority + department from a job title.')}
      </div>
    </div>
    <div class="grid grid-12">
      ${INTEGRATION_DEFS.map(def => {
        const v = cfg[def.id] || {};
        const hasKey = def.fields.some(f => f.type !== 'readonly') && def.fields.some(f => v[f.k]);
        const status = def.comingSoon ? 'Coming soon' : (hasKey ? 'Configured' : 'Not configured');
        const badgeCls = def.comingSoon ? 'warning' : (hasKey ? 'success' : '');
        return `<div class="card span-6">
          <div class="card-header">
            <div>
              <div class="card-title">${def.name}</div>
              <div class="card-subtitle">${def.group}</div>
            </div>
            <span class="badge ${badgeCls}">${status}</span>
          </div>
          ${def.comingSoon ? '<div class="text-muted text-sm">Will be wired up in a future round.</div>' : `
            ${def.fields.map(f => f.type==='readonly' ? `
              <div class="text-sm text-muted">${f.label}: ${v[f.k] || f.default || '—'}</div>` : `
              <div class="field"><label>${f.label}</label>
                <input class="input" id="int_${def.id}_${f.k}" type="${f.type}" value="${v[f.k] || f.default || ''}" placeholder="${f.default||''}"/>
              </div>`).join('')}
            <div class="flex gap-2 mt-2">
              <button class="btn btn-primary" onclick="saveIntegration('${def.id}')">Save</button>
              <button class="btn btn-outline" onclick="testIntegration('${def.id}')">Test Connection</button>
              <span id="int_${def.id}_status" class="text-sm text-muted" style="align-self:center"></span>
            </div>
          `}
        </div>`;
      }).join('')}
    </div>
  `;
}
function saveIntegration(id){
  const def = INTEGRATION_DEFS.find(d=>d.id===id); if (!def) return;
  const partial = {};
  def.fields.forEach(f => {
    if (f.type === 'readonly') return;
    const el = document.getElementById(`int_${id}_${f.k}`);
    if (el) partial[f.k] = el.value;
  });
  setIntegration(id, partial);
  toast(def.name + ' saved');
}
async function testIntegration(id){
  const el = document.getElementById(`int_${id}_status`);
  if (el) el.textContent = 'Testing…';
  const r = await Integrations.test(id);
  if (el) {
    el.textContent = (r.ok ? '✓ ' : '✗ ') + r.info;
    el.style.color = r.ok ? 'var(--color-success)' : 'var(--color-danger)';
  }
}

/* ---------- Find Contacts in Profiled Companies (full page) ---------- */
let _foundDrafts = [];
let _findContactsSelection = { companyIds: [], count: 5 };
let _findContactsProgress = null; // {done, total, current} while running

function renderFindContacts(page) {
  const haveDrafts = _foundDrafts.length > 0;
  const running = !!_findContactsProgress;
  const opts = store.companies.slice().sort((a,b)=>a.name.localeCompare(b.name));
  page.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1>Find Contacts in Profiled Companies</h1>
        <div class="page-subtitle">Pick one or more profiled companies. AI finds plausible decision-makers and fills all contact fields. Review before saving.</div>
      </div>
      ${haveDrafts && !running ? `<button class="btn btn-ghost" onclick="discardAllFoundDrafts()">Start over</button>` : ''}
    </div>
    ${running ? `
      <div class="card" style="margin-bottom:12px">
        <div class="flex justify-between items-center mb-2">
          <div style="font-weight:600">Searching ${_findContactsProgress.done} of ${_findContactsProgress.total} · ${_findContactsProgress.current}…</div>
          <div class="text-sm text-muted">Sequential · LLM/Lusha per company</div>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${Math.round(_findContactsProgress.done / _findContactsProgress.total * 100)}%"></div></div>
      </div>` : ''}
    ${haveDrafts ? renderFoundDraftsStep() : renderFindContactsInputStep(opts)}
  `;
  if (!haveDrafts && !running) wireFindContactsInputStep();
}

function renderFindContactsInputStep(opts) {
  if (!opts.length) {
    return `<div class="card"><div class="text-muted">No profiled companies yet. Go to <b>Companies → Profile New Companies</b> first to build your directory.</div></div>`;
  }
  return `
    <div class="grid grid-12">
      <div class="card span-7">
        <div class="card-header">
          <div>
            <div class="card-title">Pick companies</div>
            <div class="card-subtitle">Multi-select · contacts will be found for each</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="fcSelectAll()">Select all</button>
            <button class="btn btn-ghost btn-sm" onclick="fcSelectNone()">Clear</button>
          </div>
        </div>
        <select class="select" id="fc_companies" multiple size="10" style="min-height:240px; width:100%">
          ${opts.map(c => `<option value="${c.id}" ${_findContactsSelection.companyIds.includes(c.id)?'selected':''}>${c.name}</option>`).join('')}
        </select>
        <div class="text-sm text-muted" style="margin-top:6px">Hold Ctrl/Cmd to pick multiple.</div>
      </div>
      <div class="card span-5">
        <div class="card-header">
          <div>
            <div class="card-title">Contacts per company</div>
            <div class="card-subtitle">1–25</div>
          </div>
        </div>
        <input class="input" id="fc_count" type="number" min="1" max="25" value="${_findContactsSelection.count}"/>
      </div>
      <div class="card span-12" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div class="text-muted text-sm" id="fc_count_hint">No companies selected.</div>
        <button class="btn btn-primary" id="fc_findBtn" disabled>Find contacts</button>
      </div>
    </div>
  `;
}

function wireFindContactsInputStep() {
  const sel = document.getElementById('fc_companies');
  const cnt = document.getElementById('fc_count');
  const btn = document.getElementById('fc_findBtn');
  const hint = document.getElementById('fc_count_hint');
  function refresh() {
    const ids = sel ? Array.from(sel.selectedOptions).map(o=>o.value) : [];
    const count = Number(cnt?.value || 5);
    _findContactsSelection = { companyIds: ids, count };
    btn.disabled = ids.length === 0;
    btn.textContent = ids.length ? `Find contacts at ${ids.length} ${ids.length===1?'company':'companies'}` : 'Find contacts';
    hint.textContent = ids.length
      ? `${ids.length} ${ids.length===1?'company':'companies'} × ${count} contact${count===1?'':'s'} = up to ${ids.length*count} drafts.`
      : 'No companies selected.';
  }
  sel?.addEventListener('change', refresh);
  cnt?.addEventListener('input', refresh);
  btn?.addEventListener('click', () => runFindContacts(_findContactsSelection.companyIds, _findContactsSelection.count));
  refresh();
}

function fcSelectAll() {
  const sel = document.getElementById('fc_companies');
  if (!sel) return;
  Array.from(sel.options).forEach(o => o.selected = true);
  sel.dispatchEvent(new Event('change'));
}
function fcSelectNone() {
  const sel = document.getElementById('fc_companies');
  if (!sel) return;
  Array.from(sel.options).forEach(o => o.selected = false);
  sel.dispatchEvent(new Event('change'));
}

async function runFindContacts(ids, count) {
  if (!ids?.length) return toast('Pick at least one company', 'danger');
  count = Number(count) || 5;
  const useLLM = !!defaultLLM();
  const hasLusha = !!getIntegration('lusha').api_key;
  if (!useLLM && !hasLusha) {
    toast('No LLM or Lusha configured. Connect one in Integrations to find contacts.', 'warning');
    return;
  }

  _foundDrafts = [];
  _findContactsProgress = { done: 0, total: ids.length, current: companyById(ids[0])?.name || '…' };
  router.go('findContacts');

  let totalTokens = 0;
  let failures = 0;
  for (let i = 0; i < ids.length; i++) {
    const co = companyById(ids[i]);
    if (!co) continue;
    _findContactsProgress = { done: i, total: ids.length, current: co.name };
    if (i > 0) router.go('findContacts');
    trace('contactsIn', { company: co.name, count });
    try {
      const arr = await Integrations.enrich.contacts({ companyId: co.id, companyName: co.name, count });
      trace('enrich.contacts', { company: co.name, received: arr.length });
      for (const c of arr) {
        const before = { sen: c.seniority, dep: c.department };
        const enriched = await inferContactClassification(c);
        if (!before.sen && enriched.seniority) trace('llm.classify', { name: enriched.first_name+' '+enriched.last_name, seniority: enriched.seniority });
        _foundDrafts.push({ ...enriched, _id: UID('fc') });
      }
    } catch (e) {
      failures++;
      trace('enrich.contacts', { company: co.name, error: e.message }, 'err');
      toast(`Lookup failed for ${co.name}: ${e.message}`, 'danger');
    }
  }
  _findContactsProgress = null;
  router.go('findContacts');

  const parts = [`${_foundDrafts.length} contact${_foundDrafts.length===1?'':'s'} drafted`];
  if (failures > 0) parts.push(`${failures} compan${failures===1?'y':'ies'} failed`);
  if (totalTokens > 0) parts.push(`~${NUM(totalTokens)} tokens used`);
  const variant = failures ? 'warning' : 'success';
  toast(parts.join(' · '), variant);
}

function renderFoundDraftsStep() {
  const SENIORITY_OPTIONS = ['','C-Level','VP','Director','Manager','Senior','Junior','Other'];
  const opt = (vals, sel) => vals.map(v => `<option ${v===sel?'selected':''}>${v||'—'}</option>`).join('');
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Review & save · ${_foundDrafts.length} draft${_foundDrafts.length===1?'':'s'}</div>
          <div class="card-subtitle">Edit any field. Discard rows you don't want before saving.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="lead-table">
          <thead><tr>
            <th>First</th>
            <th>Last</th>
            <th>Title</th>
            <th>Company</th>
            <th>Seniority</th>
            <th>Department</th>
            <th>Email</th>
            <th>Phone</th>
            <th>LinkedIn</th>
            <th style="text-align:right"></th>
          </tr></thead>
          <tbody>
            ${_foundDrafts.map(c => `
              <tr data-id="${c._id}" class="${c._discarded?'discarded':''}">
                <td><input class="input" value="${c.first_name||''}" oninput="updateFoundDraft('${c._id}','first_name',this.value)"/></td>
                <td><input class="input" value="${c.last_name||''}" oninput="updateFoundDraft('${c._id}','last_name',this.value)"/></td>
                <td><input class="input" value="${c.title||''}" oninput="updateFoundDraft('${c._id}','title',this.value)"/></td>
                <td style="font-weight:500">${companyById(c.company_id)?.name || c.company || '—'}</td>
                <td><select class="select" onchange="updateFoundDraft('${c._id}','seniority',this.value)">${opt(SENIORITY_OPTIONS, c.seniority)}</select></td>
                <td><input class="input" value="${c.department||''}" oninput="updateFoundDraft('${c._id}','department',this.value)"/></td>
                <td><input class="input" value="${c.email||''}" oninput="updateFoundDraft('${c._id}','email',this.value)"/></td>
                <td><input class="input" value="${c.phone||''}" oninput="updateFoundDraft('${c._id}','phone',this.value)"/></td>
                <td><input class="input" value="${c.linkedin||''}" oninput="updateFoundDraft('${c._id}','linkedin',this.value)"/></td>
                <td style="text-align:right"><button class="btn btn-ghost btn-icon btn-sm" onclick="discardFoundDraft('${c._id}')" aria-label="${c._discarded?'Restore':'Discard'}">${c._discarded ? I.check : I.trash}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="lead-actionbar">
      <div class="lead-counter">${_foundDrafts.filter(c=>!c._discarded).length} of ${_foundDrafts.length} will be saved.</div>
      <div class="flex gap-2">
        <button class="btn btn-outline" onclick="discardAllFoundDrafts()">Discard all</button>
        <button class="btn btn-primary" onclick="saveFoundContacts()" ${_foundDrafts.filter(c=>!c._discarded).length===0?'disabled':''}>Save ${_foundDrafts.filter(c=>!c._discarded).length} contact${_foundDrafts.filter(c=>!c._discarded).length===1?'':'s'}</button>
      </div>
    </div>
  `;
}

function updateFoundDraft(id, k, v){
  const c = _foundDrafts.find(x=>x._id===id); if (c) c[k] = v;
}
function discardFoundDraft(id){
  const c = _foundDrafts.find(x=>x._id===id); if (!c) return;
  c._discarded = !c._discarded;
  router.go('findContacts');
}
function discardAllFoundDrafts(){
  _foundDrafts = [];
  router.go('findContacts');
}

async function saveFoundContacts(){
  const keep = _foundDrafts.filter(c => !c._discarded);
  if (!keep.length) { toast('Nothing to save', 'warning'); return; }
  const rows = keep.map(c => ({
    owner_id: userId,
    first_name: c.first_name || '', last_name: c.last_name || '',
    title: c.title || '', company_id: c.company_id || null,
    seniority: c.seniority || '', department: c.department || '',
    email: c.email || '', phone: c.phone || '', linkedin: c.linkedin || ''
  }));
  const { error } = await db.from('contacts').insert(rows);
  if (error) return toast(error.message, 'danger');
  await loadStore();
  const n = rows.length;
  _foundDrafts = [];
  toast(`${n} contact${n===1?'':'s'} saved`);
  router.go('people');
}

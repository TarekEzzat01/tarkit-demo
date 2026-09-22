import { normalizeName, localDate } from './domain.js';

export const ENVIRONMENTS = {
  executive: { name: 'Stakeholder · C-Suite', short: 'Executive', icon: 'landmark', objective: 'See the revenue picture. Decide where to focus.' },
  commercial: { name: 'Commercial Head · CCO', short: 'Commercial', icon: 'chart-no-axes-combined', objective: 'Turn pipeline visibility into commercial momentum.' },
  sales: { name: 'Sales Team · Sales Reps', short: 'Sales', icon: 'briefcase-business', objective: 'Know your next move. Keep every opportunity moving.' },
};
export const CSM_STAGES = [
  { key: 'Onboarding', subs: ['Handoff pending', 'Kickoff scheduled', 'Implementation in progress'] },
  { key: 'Adoption', subs: ['Training', 'First value delivered', 'Usage review'] },
  { key: 'Value realization', subs: ['Success review', 'Outcomes documented', 'Expansion identified'] },
  { key: 'Renewal', subs: ['Renewal planning', 'Terms under review', 'Renewed'] },
  { key: 'At risk', subs: ['Risk identified', 'Recovery plan', 'Executive escalation'] },
];
export const PILLARS = ['Market Segmentation', 'ICP (Ideal Customer Profile)', 'Buying Center Mapping', 'Value Proposition', 'Brand Positioning', 'Messaging & Channels', 'Proof System', 'Packaging', 'Pricing'];
export const MOTIONS = ['Sales-Led Growth', 'Marketing-Led Growth', 'Partner-Led Growth', 'Product-Led Growth'];
export function accessFor(active, ownMembership) {
  const admin = !active || ['owner', 'admin'].includes(active.role);
  const role = admin ? 'admin' : ownMembership?.app_role || 'sales_rep';
  const environments = admin ? Object.keys(ENVIRONMENTS) : (ownMembership?.environments || ['sales']).filter(x => ENVIRONMENTS[x]);
  return { admin, role, environments, writeCRM: admin || ['cco','sales_rep'].includes(role), writeStrategy: admin || role === 'cco' };
}
export function selectEnvironment(saved, allowed) { return allowed.includes(saved) ? saved : allowed[0] || null; }
export function sumValue(rows) { return rows.reduce((sum, row) => sum + (Number(row.value_sar) || 0), 0); }
export function dealDate(row) { return String(row.expected_close || row.close_date || '').slice(0,10); }
export function metrics(store, today = localDate()) {
  const open = store.deals.filter(d => !['Won','Lost'].includes(d.stage));
  const won = store.deals.filter(d => d.stage === 'Won');
  const closed = store.deals.filter(d => ['Won','Lost'].includes(d.stage));
  const ytd = won.filter(d => String(d.actual_close || dealDate(d)).startsWith(today.slice(0,4)));
  const due = store.activities.filter(a => a.next_action?.trim() && a.next_action_due && a.next_action_due <= today && !a.next_action_completed_at);
  return { open, won, closed, due, pipeline: sumValue(open), wonValue: sumValue(ytd), wonTotal: sumValue(won), winRate: closed.length ? won.length / closed.length * 100 : null, weighted: open.reduce((sum,d) => sum + (Number(d.value_sar)||0) * Math.min(100, Math.max(0, Number(d.probability)||0))/100,0) };
}
export function forecast(deals, scenario = 'base', start = localDate(), months = 6) {
  const offset = { conservative: -15, base: 0, aggressive: 15 }[scenario] ?? 0;
  const origin = new Date(`${start.slice(0,7)}-01T12:00:00`);
  const buckets = Array.from({length:months}, (_,i) => { const d = new Date(origin.getFullYear(), origin.getMonth()+i,1,12); return { key: localDate(d).slice(0,7), label: d.toLocaleDateString('en',{month:'short',year:'2-digit'}), value:0 }; });
  let undated=0, overdue=0;
  for(const deal of deals) {
    if (deal.stage === 'Lost') continue;
    const date = deal.stage === 'Won' ? String(deal.actual_close || dealDate(deal)) : dealDate(deal);
    if (!date) { undated++; continue; }
    if (date < start && deal.stage !== 'Won') { overdue++; continue; }
    const bucket = buckets.find(b => b.key === date.slice(0,7));
    if (bucket) bucket.value += (Number(deal.value_sar)||0) * (deal.stage==='Won' ? 1 : Math.min(100,Math.max(0,(Number(deal.probability)||0)+offset))/100);
  }
  let running=0;
  return { buckets:buckets.map(b => ({...b,cumulative:running+=b.value})), total:running, undated, overdue, offset };
}
export function dataHealth(store) {
  const checks = [
    ['Company website',store.companies,'website','companies'],['Company industry',store.companies,'industry','companies'],['Company country',store.companies,'country','companies'],
    ['Contact email',store.contacts,'email','people'],['Contact title',store.contacts,'title','people'],['Contact company',store.contacts,'company_id','people'],
  ];
  const rows=checks.map(([label,records,key,route])=>({label,route,total:records.length,complete:records.filter(r=>String(r[key]||'').trim() && r[key]!=='Unknown').length}));
  const total=rows.reduce((s,r)=>s+r.total,0), filled=rows.reduce((s,r)=>s+r.complete,0);
  const duplicates=records=>{const counts=new Map();for(const r of records){const key=normalizeName(r);if(key)counts.set(key,(counts.get(key)||0)+1);}return [...counts.values()].reduce((sum,n)=>sum+Math.max(0,n-1),0);};
  return {rows,score:total ? Math.round(filled/total*100):null,companyDuplicates:duplicates(store.companies.map(c=>c.name)),emailDuplicates:duplicates(store.contacts.map(c=>c.email)),invalidEmails:store.contacts.filter(c=>c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)).length};
}
export function roi({people=0,hours=0,hourly=0,benefit=0,setup=0,annual=0}) {
  const values=[people,hours,hourly,benefit,setup,annual].map(Number);
  if(values.some(n=>!Number.isFinite(n)||n<0)) throw new Error('Use non-negative numbers for every assumption.');
  const [p,h,c,b,s,a]=values, savings=p*h*c*52+b, investment=s+a;
  return {savings,investment,net:savings-investment,percent:investment ? (savings-investment)/investment*100:null,payback:savings>a ? s/((savings-a)/12):null};
}

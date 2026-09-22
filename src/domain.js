export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const money = value => new Intl.NumberFormat('en', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number(value) || 0);
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function normalizeName(value) { return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' '); }
export function safeWebsite(value) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}
export function accountState(company, store) {
  const deals = store.deals.filter(row => row.company_id === company.id);
  const contacts = store.contacts.filter(row => row.company_id === company.id);
  const activities = store.activities.filter(row => row.company_id === company.id);
  const active = deals.filter(row => !['Won', 'Lost'].includes(row.stage));
  const next = activities.filter(row => row.next_action?.trim() && row.next_action_due && !row.next_action_completed_at).sort((a, b) => a.next_action_due.localeCompare(b.next_action_due));
  return { deals, contacts, activities, active, next };
}
export function activation(store) {
  const companyIds = new Set(store.companies.map(row => row.id));
  const realDeals = store.deals.filter(row => companyIds.has(row.company_id) && !String(row.id).startsWith('tmp_'));
  const complete = realDeals.some(deal => store.activities.some(activity => activity.deal_id === deal.id && activity.company_id === deal.company_id && activity.next_action?.trim() && activity.next_action_due && (deal.assigned_to || deal.owner_id)));
  return { company: companyIds.size > 0, deal: realDeals.length > 0, nextAction: complete, complete };
}
export function accountBrief(company, store) {
  const state = accountState(company, store);
  const gaps = [];
  if (!company.industry) gaps.push('Confirm the industry and buying context.');
  if (!state.contacts.length) gaps.push('Identify the decision-maker and add a contact.');
  if (!state.active.length) gaps.push('Qualify the next opportunity before creating a deal.');
  if (!state.next.length) gaps.push('Agree on a dated next action with the account owner.');
  return {
    summary: `${company.name} has ${state.contacts.length} contact${state.contacts.length === 1 ? '' : 's'}, ${state.active.length} open opportunit${state.active.length === 1 ? 'y' : 'ies'}, and ${state.activities.length} logged activit${state.activities.length === 1 ? 'y' : 'ies'} in this workspace.`,
    nextAction: state.next[0]?.next_action || gaps[0] || 'Review the latest account activity with your team.',
    gaps,
  };
}
export function parseCSV(text) {
  if (text.length > 2_000_000) throw new Error('Use a CSV file smaller than 2 MB.');
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('A quoted cell is unfinished. Close the quote and upload again.');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('Include a header row and at least one company.');
  if (rows.length > 501) throw new Error('Import up to 500 companies at a time.');
  return { headers: rows[0].map((x, i) => i ? x : x.replace(/^\uFEFF/, '')), rows: rows.slice(1) };
}
export function prepareImport(parsed, mapping, existing) {
  const seen = new Set(existing.map(row => normalizeName(row.name)));
  return parsed.rows.map((cells, index) => {
    const get = field => mapping[field] === '' || mapping[field] == null ? '' : (cells[Number(mapping[field])] || '').trim();
    const record = { name: get('name'), website: get('website'), industry: get('industry'), country: get('country') || 'Saudi Arabia', type: 'Private', status: 'Cold', erp_current: 'Unknown' };
    let error = !record.name ? 'Company name is missing' : record.name.length > 240 ? 'Name exceeds 240 characters' : '';
    const key = normalizeName(record.name);
    if (!error && seen.has(key)) error = 'Possible duplicate — skipped';
    if (!error && record.website && !safeWebsite(record.website)) error = 'Check the website address';
    if (!error) seen.add(key);
    return { index: index + 2, record, error };
  });
}

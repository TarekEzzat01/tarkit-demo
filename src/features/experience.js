import { escapeHTML as e, money, localDate, normalizeName, safeWebsite, accountState, accountBrief, activation, parseCSV, prepareImport } from '../domain.js';

export function createExperience(L, W) {
  const ui = { companyId: null, query: '', parsed: null, imported: [], notice: '', ai: new Map(), busy: new Set() };
  const page = () => document.getElementById('page');
  const icon = name => L.icons[name] || '';
  const button = (label, action, primary = false, extra = '') => `<button class="btn ${primary ? 'btn-primary' : 'btn-outline'}" data-action="${action}" ${extra}>${label}</button>`;
  const empty = (title, text, action = '') => `<div class="product-empty"><h3>${title}</h3><p>${text}</p>${action}</div>`;
  const head = (title, text, actions = '') => `<div class="page-header"><div class="page-title"><h1>${title}</h1><p class="page-subtitle">${text}</p></div><div class="action-group">${actions}</div></div>`;
  const pending = () => !W.state.installed;
  const selected = () => L.store.companies.find(row => row.id === ui.companyId);
  const ownerName = id => W.state.members.find(row => row.user_id === id)?.display_name || (id === L.userId ? 'You' : 'Account owner');
  const note = text => `<p class="form-note">${text}</p>`;
  const field = (label, name, options = '') => `<label class="field"><span>${label}</span><input class="input" name="${name}" ${options}></label>`;
  const errorBox = '<p class="form-error" role="alert" data-form-error></p>';
  const formatDay = date => date ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(`${date.slice(0, 10)}T12:00:00`)) : 'No date';

  function updateShell() {
    const active = W.state.active;
    if (window.TARKIT_DEMO_CLIENT) { const status = document.getElementById('connStatus'); status.title = 'Sample data · no database connection'; status.setAttribute('aria-label', status.title); }
    const name = active?.name || 'Personal workspace';
    const switcher = document.getElementById('workspaceSwitcher');
    switcher.innerHTML = `<span class="workspace-initial">${e(name[0])}</span><span><strong>${e(name)}</strong><small>${active ? 'Team workspace' : 'Your existing CRM'}</small></span>${icon('chevron')}`;
    document.getElementById('app').classList.toggle('sample-mode', Boolean(window.TARKIT_DEMO_CLIENT));
    let banner = document.getElementById('sampleBanner');
    if (window.TARKIT_DEMO_CLIENT && !banner) {
      banner = document.createElement('div'); banner.id = 'sampleBanner'; banner.className = 'sample-banner';
      banner.innerHTML = window.TARKIT_PUBLIC_DEMO
        ? 'Interactive demo · fictional data. Changes stay in this browser session.'
        : 'Sample workspace · fictional data, saved only in this browser. <a href="index.html">Return to your CRM</a>';
      document.querySelector('.main').prepend(banner);
    }
  }

  function checklist() {
    const status = activation(L.store);
    const items = [
      { done: status.company, title: 'Add your first company', description: 'Start with an account you already know.', action: status.company ? 'accounts' : 'new-company' },
      { done: status.deal, title: 'Create an opportunity', description: 'Connect a deal to the right account.', action: 'first-deal' },
      { done: status.nextAction, title: 'Give it a next action', description: 'Set an owner and a date to move it forward.', action: 'first-next' },
    ];
    return `<section class="setup-section"><div class="section-heading"><div><h2>${status.complete ? 'Your sales workflow is ready' : 'Make your first account actionable'}</h2><p>${status.complete ? 'Keep momentum with a clear next action on every opportunity.' : 'Three useful steps. Your progress is saved with your work.'}</p></div><span class="completion-count">${items.filter(x => x.done).length} of 3 complete</span></div><ol class="setup-list">${items.map((item, i) => `<li class="${item.done ? 'is-complete' : ''}"><span class="step-marker">${item.done ? icon('check') : i + 1}</span><div><h3>${item.title}</h3><p>${item.description}</p></div>${button(item.done ? 'Review' : 'Start', item.action, false)}</li>`).join('')}</ol></section>`;
  }

  function renderHome(target) {
    const today = localDate();
    const due = L.store.activities.filter(row => row.next_action?.trim() && row.next_action_due && row.next_action_due <= today && !row.next_action_completed_at).sort((a, b) => a.next_action_due.localeCompare(b.next_action_due));
    const active = L.store.deals.filter(row => !['Won', 'Lost'].includes(row.stage));
    const name = (L.session?.user.user_metadata?.full_name || L.session?.user.email?.split('@')[0] || 'there').split(/[ ._]/)[0];
    target.innerHTML = head(`Your next move, ${e(name)}.`, 'A clear view of your accounts, opportunities, and follow-through.', button(`${icon('building')} Add company`, 'new-company', true))
      + `<div class="workspace-summary"><span>${L.store.companies.length} companies</span><span>${active.length} open opportunities</span><span>${money(active.reduce((sum, row) => sum + Number(row.value_sar || 0), 0))} open pipeline</span></div>`
      + `<div class="home-layout"><div>${checklist()}<section class="work-section"><div class="section-heading"><h2>Follow-ups that need you</h2><span>${due.length} due</span></div>${due.length ? `<div class="action-list">${due.slice(0, 8).map(row => {
        const company = L.store.companies.find(c => c.id === row.company_id);
        return `<div class="work-row"><span class="due-mark ${row.next_action_due < today ? 'overdue' : ''}">${row.next_action_due < today ? 'Overdue' : 'Today'}</span><div><button class="text-button" data-action="open-account" data-id="${e(row.company_id)}">${e(row.next_action)}</button><small>${e(company?.name || 'Unlinked activity')} · ${e(ownerName(row.owner_id))}</small></div>${pending() ? '' : button('Complete', 'complete-followup', false, `data-id="${e(row.id)}"`)}</div>`;
      }).join('')}</div>` : empty('Nothing overdue', 'Add a next action to an opportunity so your team knows what comes next.', button('Choose an account', 'accounts'))}</section></div><aside class="workspace-aside"><section><h2>Work as one team</h2><p>Bring the people, context, and next steps for an account together.</p>${button('Open workspace', 'team')}${pending() ? note('Your personal CRM is available. Shared workspaces will be available after the database upgrade.') : note(`${W.state.members.length} workspace member${W.state.members.length === 1 ? '' : 's'}`)}</section><section><h2>Recently added</h2>${L.store.companies.length ? L.store.companies.slice(0, 5).map(c => `<button class="account-link" data-action="open-account" data-id="${e(c.id)}"><span class="account-monogram">${e(c.name?.[0] || 'C')}</span><span>${e(c.name)}<small>${e(c.industry || c.country || 'Company')}</small></span>${icon('chevron')}</button>`).join('') : '<p>Your first company will appear here.</p>'}</section></aside></div>`;
  }

  function renderCompanies(target) {
    const companies = L.store.companies.filter(c => normalizeName(`${c.name} ${c.industry} ${c.country}`).includes(normalizeName(ui.query)));
    target.innerHTML = head('Companies', 'Account context and next steps, together.', button('Import CSV', 'import') + button('+ Add company', 'new-company', true))
      + `<div class="directory-tools"><label class="directory-search">${icon('building')}<input class="input" id="companySearch" placeholder="Search companies, industries, or countries" value="${e(ui.query)}" aria-label="Search companies"></label><span>${companies.length} of ${L.store.companies.length} companies</span></div>`
      + (companies.length ? `<div class="table-wrap product-table"><table class="datatable"><thead><tr><th scope="col">Company</th><th scope="col">Industry</th><th scope="col">Open pipeline</th><th scope="col">Next action</th><th scope="col">Contacts</th></tr></thead><tbody>${companies.map(c => {
        const state = accountState(c, L.store);
        return `<tr><td><button class="company-name text-button" data-action="open-account" data-id="${e(c.id)}"><span class="account-monogram">${e(c.name?.[0] || 'C')}</span><span>${e(c.name)}<small>${e(c.country || 'Country not set')}</small></span></button></td><td>${e(c.industry || 'Not set')}</td><td class="numeric">${money(state.active.reduce((sum, d) => sum + Number(d.value_sar || 0), 0))}<small>${state.active.length} opportunities</small></td><td>${state.next[0] ? `<span>${e(state.next[0].next_action)}</span><small>${formatDay(state.next[0].next_action_due)}</small>` : '<span class="text-muted">No next action</span>'}</td><td>${state.contacts.length}</td></tr>`;
      }).join('')}</tbody></table></div>` : empty(ui.query ? 'No matching companies' : 'Build your first account', ui.query ? 'Try a different name or industry.' : 'Add a company or import a spreadsheet to begin.', button('Add company', 'new-company', true)));
  }

  function renderNewCompany(target) {
    target.innerHTML = head('Start with a company', 'A name is enough to start. Add the details you already know.', button('Back to companies', 'accounts'))
      + `<form id="companyForm" class="product-form"><h2>Company details</h2><div class="form-grid">${field('Company name', 'name', 'required maxlength="240" autocomplete="organization" dir="auto"')}${field('Website', 'website', 'placeholder="example.com" autocomplete="url"')}${field('Industry', 'industry', 'maxlength="160" placeholder="e.g. Construction" dir="auto"')}<label class="field"><span>Country</span><select class="input" name="country">${['Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Other'].map(c => `<option>${c}</option>`).join('')}</select></label></div>${note('We check for a matching company name before saving. You can add contacts and opportunities on the account page.')}${errorBox}<div class="form-actions">${button('Cancel', 'accounts')}<button class="btn btn-primary" type="submit">Save company</button></div></form>`;
  }

  function renderAccount(target) {
    const c = selected();
    if (!c) { target.innerHTML = empty('Company not available', 'It may have been removed or belong to another workspace.', button('Back to companies', 'accounts')); return; }
    const state = accountState(c, L.store), brief = accountBrief(c, L.store), ai = ui.ai.get(`${W.state.active?.id || L.userId}:${c.id}`);
    const website = safeWebsite(c.website);
    target.innerHTML = `<button class="back-link" data-action="accounts">${icon('chevron')} All companies</button>`
      + head(e(c.name), `${e(c.industry || 'Industry not set')} · ${e(c.country || 'Country not set')}`, button('Edit company', 'edit-company') + button('Add opportunity', 'new-deal', true))
      + `<div class="account-layout"><div class="account-main"><section class="brief-section"><div class="section-heading"><h2>Account brief</h2><span class="source-label">${ai ? 'AI draft · review before use' : 'From your CRM records'}</span></div><p>${e(ai?.summary || brief.summary)}</p><div class="next-action-highlight"><span>Suggested next step</span><p>${e(ai?.next_action || brief.nextAction)}</p></div>${(ai?.gaps || brief.gaps).length ? `<ul class="brief-gaps">${(ai?.gaps || brief.gaps).map(gap => `<li>${e(gap)}</li>`).join('')}</ul>` : ''}<div class="action-group">${button('Generate AI brief', 'ai-brief', false)}${button('Schedule next action', 'new-followup')}</div><p class="form-note">${ai ? 'Based only on saved CRM context. No external research or contact verification.' : 'This summary uses saved facts and rules. Generating an AI brief sends this company’s saved details to the configured AI provider.'}</p><p id="aiStatus" role="status" class="form-note"></p></section>
      <section class="work-section"><div class="section-heading"><h2>Opportunities</h2><span>${state.deals.length} total</span></div>${state.deals.length ? state.deals.map(d => `<div class="work-row"><div><button class="text-button" data-action="edit-deal" data-id="${e(d.id)}">${e(d.name || 'Untitled opportunity')}</button><small>${e(d.stage)} · ${e(ownerName(d.assigned_to || d.owner_id))} · ${formatDay(d.close_date)}</small></div><strong class="numeric">${money(d.value_sar)}</strong></div>`).join('') : empty('Make the opportunity visible', 'Give the deal a name, a value, and an owner.', button('Add opportunity', 'new-deal'))}</section>
      <section class="work-section"><div class="section-heading"><h2>Activity & next actions</h2>${button('Schedule action', 'new-followup')}</div>${state.activities.length ? `<ol class="activity-timeline">${[...state.activities].sort((a,b) => (b.date || '').localeCompare(a.date || '')).map(a => `<li><span class="timeline-dot"></span><div><strong>${e(a.summary || a.type)}</strong><small>${formatDay(a.date)} · ${e(ownerName(a.owner_id))}</small>${a.next_action ? `<p>${e(a.next_action)}${a.next_action_due ? ` · ${formatDay(a.next_action_due)}` : ''} ${a.next_action_completed_at ? '<span class="badge success">Completed</span>' : ''}</p>` : ''}</div>${a.next_action && !a.next_action_completed_at && !pending() ? button('Complete', 'complete-followup', false, `data-id="${e(a.id)}"`) : ''}</li>`).join('')}</ol>` : empty('Keep the next step clear', 'Schedule a follow-up or log an interaction with this account.')}</section></div>
      <aside class="account-aside"><section><h2>Account details</h2><dl><dt>Website</dt><dd>${website ? `<a href="${e(website)}" target="_blank" rel="noopener noreferrer">${e(c.website)}</a>` : 'Not set'}</dd><dt>Country</dt><dd>${e(c.country || 'Not set')}</dd><dt>Status</dt><dd>${e(c.status || 'Not set')}</dd><dt>Open pipeline</dt><dd>${money(state.active.reduce((sum,d) => sum + Number(d.value_sar || 0), 0))}</dd></dl></section><section><div class="section-heading"><h2>People</h2>${button('Add', 'new-contact')}</div>${state.contacts.length ? state.contacts.map(p => `<div class="person-row"><span class="account-monogram">${e(p.first_name?.[0] || 'P')}</span><div><button class="text-button" data-action="edit-contact" data-id="${e(p.id)}">${e(`${p.first_name || ''} ${p.last_name || ''}`)}</button><small>${e(p.title || 'Role not set')}</small></div></div>`).join('') : '<p class="text-muted">Add the people involved in this account.</p>'}</section></aside></div>`;
  }

  function renderOpportunity(target) {
    const c = selected(); if (!c) return renderCompanies(target);
    const members = W.state.members.length ? W.state.members : [{ user_id: L.userId, display_name: 'You' }];
    target.innerHTML = head('Create an opportunity', `Keep the next step connected to ${e(c.name)}.`, button('Back to account', 'back-account'))
      + `<form id="opportunityForm" class="product-form"><h2>Opportunity details</h2><div class="form-grid">${field('Opportunity name', 'name', 'required maxlength="240" placeholder="e.g. Annual support agreement" dir="auto"')}${field('Value (SAR)', 'value', 'type="number" min="0" step="0.01" required value="0"')}<label class="field"><span>Stage</span><select class="input" name="stage">${L.stages.filter(s => !['Won','Lost'].includes(s.key)).map(s => `<option value="${e(s.key)}">${e(s.key)}</option>`).join('')}</select></label>${field('Expected close', 'close', 'type="date" required')}<label class="field"><span>Owner</span><select class="input" name="owner">${members.map(m => `<option value="${e(m.user_id)}" ${m.user_id === L.userId ? 'selected' : ''}>${e(m.display_name)}</option>`).join('')}</select></label></div><h2 class="form-section-title">Make the next step explicit</h2><div class="form-grid">${field('Next action', 'next', 'required maxlength="500" placeholder="e.g. Confirm requirements with the buyer" dir="auto"')}${field('Action due', 'due', `type="date" required value="${localDate()}"`)}</div>${note('The opportunity and its next action are saved together when team workspaces are enabled. Values use SAR in this first release.')}${errorBox}<div class="form-actions">${button('Cancel', 'back-account')}<button type="submit" class="btn btn-primary">Save opportunity & next action</button></div></form>`;
  }

  function renderFollowup(target) {
    const c = selected(); if (!c) return renderCompanies(target);
    const deals = accountState(c, L.store).deals;
    target.innerHTML = head('Schedule the next action', e(c.name), button('Back to account', 'back-account'))
      + `<form id="followupForm" class="product-form"><div class="form-grid">${field('Next action', 'next', 'required maxlength="500" dir="auto"')}${field('Due date', 'due', `type="date" required value="${localDate()}"`)}<label class="field"><span>Related opportunity</span><select class="input" name="deal"><option value="">Account follow-up</option>${deals.map(d => `<option value="${e(d.id)}">${e(d.name || 'Untitled opportunity')}</option>`).join('')}</select></label><label class="field"><span>Interaction type</span><select class="input" name="type"><option>Call</option><option>Meeting</option><option>Demo</option></select></label></div>${errorBox}<div class="form-actions">${button('Cancel', 'back-account')}<button class="btn btn-primary" type="submit">Save next action</button></div></form>`;
  }

  function renderWorkspace(target) {
    if (pending()) {
      target.innerHTML = head('Your workspace', 'Your existing personal CRM remains connected.') + `<section class="product-form"><h2>Team workspaces are being prepared</h2><p>Shared records, teammate invitations, and workspace roles need the database upgrade before they can be used.</p><p>You can continue adding companies, opportunities, and follow-ups in your personal workspace.</p><div class="action-group">${button('Go to companies', 'accounts', true)}<a class="btn btn-outline" href="index.html?demo=1">Explore a sample team</a></div></section>`; return;
    }
    const active = W.state.active;
    target.innerHTML = head(active ? e(active.name) : 'Create your team workspace', active ? 'The people and permissions behind your shared pipeline.' : 'A shared home for your companies, opportunities, and follow-ups.')
      + (active ? `<section class="work-section"><div class="section-heading"><h2>Members</h2><span>${W.state.members.length} total</span></div>${W.state.members.map(m => `<div class="work-row"><span class="account-monogram">${e(m.display_name?.[0] || 'T')}</span><div><strong>${e(m.display_name)}</strong><small>${m.user_id === L.userId ? 'You' : 'Workspace member'}</small></div><span class="badge neutral">${e(m.role)}</span></div>`).join('')}${['owner','admin'].includes(active.role) ? `<form id="inviteForm" class="invite-form">${field('Invite a teammate by email', 'email', 'type="email" required autocomplete="email"')}<button class="btn btn-primary" type="submit">Create invitation link</button>${errorBox}<div data-invite-result></div>${note('Share the link yourself. Only the invited email can accept it; it expires after seven days. No email is sent automatically.')}</form>` : note('Ask a workspace owner or admin to invite teammates.')}</section><section class="work-section"><h2>Switch workspace</h2><div class="workspace-options">${W.state.memberships.map(m => button(e(m.tarkit_workspaces.name), 'switch-workspace', m.workspace_id === active.id, `data-id="${e(m.workspace_id)}"`)).join('')}</div></section>` : '')
      + `<form id="workspaceForm" class="product-form"><h2>${active ? 'Create another workspace' : 'Workspace details'}</h2><div class="form-grid">${field('Workspace name', 'name', 'required minlength="2" maxlength="100" placeholder="Your team or company" dir="auto"')}<label class="field"><span>Country</span><select class="input" name="country">${['Saudi Arabia','United Arab Emirates','Qatar','Kuwait','Bahrain','Oman'].map(c => `<option>${c}</option>`).join('')}</select></label></div>${!active ? '<label class="checkbox-label"><input type="checkbox" name="adopt" checked> Move my existing personal CRM records into this workspace</label>' : ''}${note('New workspaces start separately. Existing records keep their IDs and relationships if you choose to move them.')}${errorBox}<button type="submit" class="btn btn-primary">Create workspace</button></form>`;
  }

  function renderImport(target) {
    target.innerHTML = head('Bring your companies with you', 'Import up to 500 companies from a CSV file. Review before saving.', button('Back to companies', 'accounts'))
      + `<section class="product-form"><h2>Choose your spreadsheet</h2><p>Use a CSV with a header row. Company name is required; website, industry, and country are optional.</p><label class="field"><span>CSV file (up to 2 MB)</span><input class="input" id="csvFile" type="file" accept=".csv,text/csv"></label><a href="assets/company-import-template.csv" download>Download the import template</a><p id="importMessage" class="form-error" role="alert"></p></section><div id="importMapping"></div><div id="importPreview"></div>`;
  }
  function mappingForm() {
    const guesses = { name: /^(company|company name|name)$/i, website: /^(website|url|domain)$/i, industry: /^industry$/i, country: /^country$/i };
    document.getElementById('importMapping').innerHTML = `<form id="mappingForm" class="product-form"><h2>Match your columns</h2><div class="form-grid">${Object.entries(guesses).map(([key, pattern]) => `<label class="field"><span>${key === 'name' ? 'Company name (required)' : key[0].toUpperCase() + key.slice(1)}</span><select class="input" name="${key}" ${key === 'name' ? 'required' : ''}><option value="">${key === 'name' ? 'Choose a column' : 'Skip this field'}</option>${ui.parsed.headers.map((header,i) => `<option value="${i}" ${pattern.test(header) ? 'selected' : ''}>${e(header || `Column ${i+1}`)}</option>`).join('')}</select></label>`).join('')}</div><button class="btn btn-primary" type="submit">Review import</button>${errorBox}</form>`;
  }
  function previewImport(mapping) {
    ui.imported = prepareImport(ui.parsed, mapping, L.store.companies);
    const valid = ui.imported.filter(row => !row.error);
    document.getElementById('importPreview').innerHTML = `<section class="work-section"><div class="section-heading"><h2>Review ${ui.imported.length} rows</h2><span>${valid.length} ready · ${ui.imported.length-valid.length} skipped</span></div><div class="table-wrap"><table class="datatable"><thead><tr><th>CSV row</th><th>Company</th><th>Country</th><th>Result</th></tr></thead><tbody>${ui.imported.slice(0,50).map(row => `<tr><td>${row.index}</td><td>${e(row.record.name || 'Missing name')}</td><td>${e(row.record.country)}</td><td>${e(row.error || 'Ready')}</td></tr>`).join('')}</tbody></table></div>${ui.imported.length > 50 ? note('Showing the first 50 rows. All validated rows are included in the import.') : ''}${button(`Import ${valid.length} companies`, 'save-import', true, valid.length ? '' : 'disabled')}<p id="importResult" role="status"></p></section>`;
  }

  function renderUsage(target) {
    target.innerHTML = head('Usage & plan', 'Understand your workspace before choosing what comes next.') + `<section class="product-form"><h2>Foundation release</h2><p>No paid subscription is configured for this release.</p><dl class="usage-list"><dt>Companies</dt><dd>${L.store.companies.length}</dd><dt>Contacts</dt><dd>${L.store.contacts.length}</dd><dt>Opportunities</dt><dd>${L.store.deals.length}</dd><dt>Team members</dt><dd>${W.state.members.length || 1}</dd></dl><p>AI account briefs are available when the secure AI service is connected. This screen does not estimate usage or display example charges.</p></section>`;
  }

  async function submit(form, handler) {
    if (ui.busy.has(form.id)) return;
    const submitButton = form.querySelector('[type="submit"]');
    const error = form.querySelector('[data-form-error]');
    const label = submitButton?.textContent;
    ui.busy.add(form.id); if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Saving…'; } if (error) error.textContent = '';
    try { await handler(Object.fromEntries(new FormData(form))); }
    catch (err) { if (error) error.textContent = err.message || 'Unable to save. Your entries are still here; try again.'; }
    finally { ui.busy.delete(form.id); if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = label; } }
  }

  async function saveOpportunity(values, form) {
    const c = selected(); if (!c) throw new Error('Choose a company first.');
    const value = Number(values.value); if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid opportunity value.');
    if (!values.name.trim() || !values.next.trim()) throw new Error('Enter an opportunity name and next action.');
    const stage = L.stages.find(s => s.key === values.stage);
    const payload = { company_id: c.id, name: values.name.trim(), value_sar: value, stage: stage.key, sub_stage: stage.subs[0], probability: stage.probability, expected_close: values.close };
    if (W.state.active) {
      const { error } = await L.rawDb.rpc('tarkit_create_opportunity', { p_workspace_id: W.state.active.id, p_company_id: c.id, p_name: payload.name, p_value_sar: value, p_stage: stage.key, p_sub_stage: stage.subs[0], p_probability: stage.probability, p_expected_close: values.close, p_assigned_to: values.owner, p_next_action: values.next.trim(), p_due: values.due, p_request_id: form.dataset.requestId ||= crypto.randomUUID() });
      if (error) throw error;
    } else {
      // A partial failure retains the created deal id on the form, so a retry cannot create a duplicate deal.
      let id = form.dataset.savedDeal;
      if (!id) {
        const { data, error } = await L.db.from('deals').insert(payload).select('id').single(); if (error) throw error;
        id = data.id; form.dataset.savedDeal = id;
      }
      const { error } = await L.db.from('activities').insert({ company_id: c.id, deal_id: id, type: 'Call', activity_date: localDate(), summary: 'Next action scheduled for opportunity', next_action: values.next.trim(), next_action_due: values.due });
      if (error) throw new Error('The opportunity was saved, but its next action was not. Try again to attach the action without creating another opportunity.');
    }
    await L.loadStore(); L.toast('Opportunity and next action saved'); openAccount(c.id);
  }

  function openAccount(id) { ui.companyId = id; L.router.go('account'); }
  async function handleAction(action, el) {
    switch (action) {
      case 'accounts': L.router.go('companies'); break;
      case 'new-company': L.router.go('newCompany'); break;
      case 'import': L.router.go('importCompanies'); break;
      case 'team': L.router.go('workspace'); break;
      case 'back-account': L.router.go('account'); break;
      case 'open-account': openAccount(el.dataset.id); break;
      case 'edit-company': L.openCompanyModal(ui.companyId); break;
      case 'new-contact': L.openContactModal(); { const input = document.getElementById('p_company'); if (input) input.value = ui.companyId; } break;
      case 'edit-contact': L.openContactModal(el.dataset.id); break;
      case 'edit-deal': L.openDealModal(el.dataset.id); break;
      case 'new-deal': L.router.go('newOpportunity'); break;
      case 'new-followup': L.router.go('newFollowup'); break;
      case 'first-deal': case 'first-next':
        if (!L.store.companies.length) L.router.go('newCompany');
        else openAccount(L.store.companies[0].id);
        break;
      case 'switch-workspace': ui.companyId = null; ui.ai.clear(); L.router.current = 'home'; await W.select(el.dataset.id); break;
      case 'complete-followup': {
        if (pending()) throw new Error('Follow-up completion needs the database upgrade.');
        el.disabled = true;
        const { error } = await L.rawDb.rpc('tarkit_complete_followup', { p_activity_id: el.dataset.id });
        if (error) { el.disabled = false; throw error; }
        await L.loadStore(); L.toast('Follow-up completed'); L.router.go(L.router.current); break;
      }
      case 'ai-brief': {
        const c = selected(), targetId = c.id, workspaceId = W.state.active?.id;
        const status = document.getElementById('aiStatus'); el.disabled = true; status.textContent = 'Preparing a brief from your saved account context…';
        const { data, error } = await L.rawDb.functions.invoke('account-brief', { body: { company_id: c.id } });
        el.disabled = false;
        if (error || !data?.summary || !Array.isArray(data.gaps)) { status.textContent = 'AI generation is not available. Your record-based brief remains available; ask your workspace administrator to check the AI connection.'; break; }
        ui.ai.set(`${workspaceId || L.userId}:${targetId}`, data);
        await W.track('account_brief_reviewed', c.id);
        if (ui.companyId === targetId && W.state.active?.id === workspaceId && L.router.current === 'account') renderAccount(page());
        break;
      }
      case 'save-import': {
        el.disabled = true;
        let saved = 0, failed = 0;
        const result = document.getElementById('importResult');
        for (const row of ui.imported.filter(row => !row.error && !row.saved)) {
          const { error } = await L.db.from('companies').insert(row.record);
          if (error) { failed++; row.failure = error.message; } else { row.saved = true; saved++; }
          result.textContent = `${saved} saved${failed ? ` · ${failed} could not be saved` : ''}…`;
        }
        await L.loadStore();
        result.textContent = `${saved} companies saved. ${failed ? `${failed} could not be saved. Retry imports only the remaining rows. First error: ${ui.imported.find(row=>row.failure)?.failure}` : 'Open Companies to see your accounts.'}`;
        el.disabled = !failed; el.textContent = failed ? 'Retry unsaved companies' : 'Import complete';
        if (saved) await W.track('import_completed'); break;
      }
    }
  }

  function install() {
    Object.assign(L.routes, {
      home: { title: 'Today', render: renderHome }, companies: { title: 'Companies', render: renderCompanies },
      newCompany: { title: 'Add company', render: renderNewCompany }, account: { title: 'Account', render: renderAccount },
      newOpportunity: { title: 'Add opportunity', render: renderOpportunity }, newFollowup: { title: 'Next action', render: renderFollowup },
      workspace: { title: 'Workspace', render: renderWorkspace }, importCompanies: { title: 'Import companies', render: renderImport },
      onboarding: { title: 'Get started', render: target => { target.innerHTML = head('Make TARKIT your team’s workspace', 'Build an actionable account with the information you already have.', button('Import CSV', 'import')) + checklist(); } },
      billing: { title: 'Usage & plan', render: renderUsage },
    });
    L.nav.splice(0, L.nav.length,
      { label: 'Workspace', key: 'work', items: [{ key: 'home', label: 'Today', icon: icon('home') }, { key:'crm', label:'Pipeline', icon:icon('kanban') }, { key:'companies', label:'Companies', icon:icon('building') }, { key:'people', label:'Contacts', icon:icon('users') }, { key:'activities', label:'Activities', icon:icon('activity') }] },
      { label: 'Insights', key: 'insights', items: [{key:'reportCRM',label:'Sales analytics',icon:icon('chart')},{key:'reportActivity',label:'Activity progress',icon:icon('activity')},{key:'reportCC',label:'Account analytics',icon:icon('reportUsers')},{key:'csm',label:'Customer success',icon:icon('handshake')},{key:'reportCSM',label:'Customer analytics',icon:icon('chart')}] },
      { label:'Manage',key:'manage',items:[{key:'onboarding',label:'Get started',icon:icon('check')},{key:'workspace',label:'Team & workspace',icon:icon('users')},{key:'icp',label:'Customer profile',icon:icon('icp')},{key:'target',label:'Sales targets',icon:icon('target')},{key:'integrations',label:'Integrations',icon:icon('bolt')},{key:'billing',label:'Usage & plan',icon:icon('wallet')}] }
    );
    L.nav.forEach(group => group.items.forEach(item => item.tip = item.label));
    const originalGo = L.router.go.bind(L.router);
    L.router.go = key => {
      if (W.state.installed && !W.state.active) key = 'workspace';
      if (!L.routes[key]) key = 'home';
      originalGo(key); updateShell();
      document.getElementById('app').classList.remove('nav-open');
      document.getElementById('mobileMenu').setAttribute('aria-expanded', 'false');
      const url = key === 'account' && ui.companyId ? `#account/${encodeURIComponent(ui.companyId)}` : `#${key}`;
      if (!location.hash.startsWith('#invite/')) history.replaceState(null, '', url);
      page().querySelector('h1')?.setAttribute('tabindex','-1');
    };
    document.getElementById('workspaceSwitcher').addEventListener('click', () => L.router.go('workspace'));
    document.getElementById('mobileMenu').addEventListener('click', () => {
      const open = document.getElementById('app').classList.toggle('nav-open'); document.getElementById('mobileMenu').setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.getElementById('app').classList.remove('nav-open'); document.getElementById('mobileMenu').setAttribute('aria-expanded','false'); } });
    page().addEventListener('click', event => {
      const el = event.target.closest('[data-action]');
      if (el && !el.disabled) handleAction(el.dataset.action, el).catch(error => L.toast(error.message || 'Unable to complete this action. Try again.', 'danger'));
    });
    page().addEventListener('input', event => {
      if (event.target.id !== 'companySearch') return;
      const value = event.target.value, position = event.target.selectionStart;
      ui.query = value; renderCompanies(page()); const input = document.getElementById('companySearch'); input.focus(); input.setSelectionRange(position, position);
    });
    page().addEventListener('change', async event => {
      if (event.target.id !== 'csvFile') return;
      const file = event.target.files?.[0]; if (!file) return;
      try { if (file.size > 2_000_000) throw new Error('Use a file smaller than 2 MB.'); ui.parsed = parseCSV(await file.text()); document.getElementById('importMessage').textContent = ''; document.getElementById('importPreview').innerHTML = ''; mappingForm(); }
      catch (error) { document.getElementById('importMessage').textContent = error.message; }
    });
    page().addEventListener('submit', event => {
      event.preventDefault(); const form = event.target;
      submit(form, async values => {
        if (form.id === 'companyForm') {
          const name = values.name.trim(); if (!name) throw new Error('Enter a company name.');
          if (L.store.companies.some(c => normalizeName(c.name) === normalizeName(name))) throw new Error('A company with this name already exists. Open it from Companies or use a more specific name.');
          if (values.website && !safeWebsite(values.website)) throw new Error('Enter a valid website, such as example.com.');
          const { data, error } = await L.db.from('companies').insert({ name, website: values.website.trim(), industry: values.industry.trim(), country: values.country, type: 'Private', status: 'Cold', erp_current: 'Unknown' }).select('id').single();
          if (error) throw error; await L.loadStore(); await W.track('company_created', data.id); L.toast('Company saved'); openAccount(data.id);
        } else if (form.id === 'opportunityForm') await saveOpportunity(values, form);
        else if (form.id === 'followupForm') {
          if (!values.next.trim()) throw new Error('Enter a next action.');
          const { data, error } = await L.db.from('activities').insert({ company_id: ui.companyId, deal_id: values.deal || null, type: values.type, activity_date: localDate(), summary: 'Next action scheduled', next_action: values.next.trim(), next_action_due: values.due }).select('id').single();
          if (error) throw error; await L.loadStore(); await W.track('next_action_scheduled', data.id); L.toast('Next action saved'); L.router.go('account');
        } else if (form.id === 'workspaceForm') { L.router.current = 'home'; await W.create(values.name, values.country, Boolean(values.adopt)); }
        else if (form.id === 'inviteForm') {
          const link = await W.invite(values.email);
          form.querySelector('[data-invite-result]').innerHTML = `<label class="field"><span>Invitation link — copy and share with ${e(values.email)}</span><input class="input" readonly value="${e(link)}" aria-label="Invitation link"></label>`;
        } else if (form.id === 'mappingForm') previewImport(values);
      });
    });
  }
  return { install, openAccount, renderUsage, updateShell };
}

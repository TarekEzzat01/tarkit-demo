/* ---------- Auth gate ---------- */
function showLogin(msg){
  document.getElementById('authErr').textContent = msg || '';
  document.getElementById('authGate').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function hideLogin(){
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('app').style.display = '';
}
function showLoading(on){
  document.getElementById('loadingOverlay').style.display = on ? 'flex' : 'none';
}

function renderAccountCard(){
  if (!session?.user) return;
  const email = session.user.email || '';
  const meta = session.user.user_metadata || {};
  const name = meta.full_name || meta.name || email.split('@')[0] || 'User';
  const initials = name.split(/\s+/).map(p=>p[0]||'').join('').slice(0,2).toUpperCase() || 'U';
  const nameEl = document.getElementById('accountName');
  const avEl   = document.getElementById('accountAvatar');
  if (nameEl) nameEl.textContent = name;
  if (avEl)   avEl.textContent = initials;
}

async function seedFirstRun(){
  // If this user has no ICP / weekly targets / annual target yet, insert defaults.
  // Idempotent — safe to call on every boot; inserts are skipped if rows exist.
  if (!userId) return;

  // 1. ICP profile
  const { data: existingIcp } = await db.from('icp_profiles')
    .select('id').eq('is_default', true).maybeSingle();
  if (!existingIcp) {
    await db.from('icp_profiles').insert({ ...DEFAULT_ICP, owner_id: userId, is_default: true });
  }

  // 2. Weekly activity targets (6 default types from the schema seed)
  const DEFAULT_WEEKLY = { Call:0, Meeting:0, LinkedIn:0, Email:0, Proposal:0, Demo:0 };
  const { data: existingTgts } = await db.from('activity_targets')
    .select('activity_type').eq('period_type', 'Weekly');
  const present = new Set((existingTgts || []).map(r => r.activity_type));
  const missing = Object.entries(DEFAULT_WEEKLY)
    .filter(([t]) => !present.has(t))
    .map(([activity_type, target_count]) => ({ owner_id: userId, period_type: 'Weekly', activity_type, target_count }));
  if (missing.length) await db.from('activity_targets').insert(missing);

  // 3. Annual target for current year
  const year = new Date().getFullYear();
  const { data: existingAnnual } = await db.from('annual_targets')
    .select('id').eq('year', year).maybeSingle();
  if (!existingAnnual) {
    await db.from('annual_targets').insert({ owner_id: userId, year, target_sar: 0 });
  }
}

async function bootApp(){
  showLoading(true);
  try {
    renderAccountCard();
    if (!await window.TarkitWorkspace.initialize()) { renderNav(); router.go('workspace'); return; }
    await seedFirstRun();
    await loadStore();
    await window.TarkitPlatform?.initialize();
    renderNav();
    router.go(router.current || 'home');
  } catch (error) {
    document.getElementById('page').innerHTML = '<div class="empty-state"><h2>Your workspace could not load</h2><p>Check your connection and try again.</p><button class="btn btn-primary" onclick="bootApp()">Try again</button></div>';
    console.error('Workspace load failed', error.code || error.name);
  } finally {
    showLoading(false);
  }
}

let authMode = 'signin'; // 'signin' | 'signup'
function setAuthMode(mode){
  authMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('authSub').textContent = isSignup ? 'Create your account' : 'Sign in to continue';
  document.getElementById('authSubmit').textContent = isSignup ? 'Create account' : 'Sign in';
  document.getElementById('authNameField').style.display = isSignup ? '' : 'none';
  document.getElementById('authToggleLabel').textContent = isSignup ? 'Already have an account?' : 'New here?';
  document.getElementById('authToggle').textContent = isSignup ? 'Sign in' : 'Create an account';
  document.getElementById('authPassword').setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
  document.getElementById('authErr').textContent = '';
}
document.getElementById('authToggle').addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  const btn = document.getElementById('authSubmit');
  const errEl = document.getElementById('authErr');
  errEl.textContent = '';
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = authMode === 'signup' ? 'Creating account…' : 'Signing in…';

  try {
    if (authMode === 'signup') {
      const { data, error } = await db.auth.signUp({
        email, password,
        options: { data: { full_name: name || email.split('@')[0] } }
      });
      if (error) { errEl.textContent = error.message; return; }
      // If email confirmation is enabled in Supabase, data.session will be null.
      if (!data.session) {
        errEl.style.color = '#10B981';
        setAuthMode('signin');
        errEl.textContent = 'Account created. Check your inbox to confirm your email, then sign in.';
        return;
      }
      session = data.session; userId = data.user.id;
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) { errEl.textContent = error.message; return; }
      session = data.session; userId = data.user.id;
    }
    hideLogin();
    await bootApp();
  } catch (error) {
    errEl.textContent = 'Unable to sign in. Check your connection and try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

async function signOut(){
  await db.auth.signOut();
  session = null; userId = null;
  // reset UI-only state by reloading to ensure clean slate
  location.reload();
}

db.auth.onAuthStateChange((_event, s) => {
  session = s;
  userId  = s?.user?.id || null;
  if (!s) { setStatus(''); showLogin(); }
});

/* ---------- Boot ---------- */
document.documentElement.dataset.theme = store.ui.theme || 'light';
if (store.ui.sidebarCollapsed) document.getElementById('app').classList.add('sidebar-collapsed');

// Hydrate static `<i data-lucide="...">` placeholders in the HTML body.
if (window.lucide?.createIcons) {
  window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
}

/* ---------- A2Z H: keyboard shortcuts ----------
   `/` focuses search · `Ctrl/Cmd+K` opens quick-add · `?` shows shortcuts · ESC closes modals.
   Skips when the user is already typing in an input/textarea. */
function isTypingInForm() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
document.addEventListener('keydown', (e) => {
  // Quick Capture overlay handles its own keys when open.
  const qcOpen = document.getElementById('qcOverlay')?.style.display === 'flex';
  if (qcOpen) {
    if (e.key === 'Escape') { e.preventDefault(); closeQuickCapture(); }
    else if (e.key === 'Enter') { e.preventDefault(); submitQuickCapture(); }
    return;
  }
  // ESC is already handled by openModal's listener.
  if (isTypingInForm()) return;
  // `q` → Quick Capture
  if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    openQuickCapture();
    return;
  }
  // `/` focus search
  if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
    const s = document.getElementById('globalSearch');
    if (s) { e.preventDefault(); s.focus(); }
    return;
  }
  // Ctrl/Cmd+K → quick add
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const btn = document.getElementById('quickAddBtn');
    if (btn) btn.click();
    return;
  }
  // `?` show shortcut list
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    showShortcutsModal();
  }
});

/* Live-preview wiring + click-outside-to-close for Quick Capture. */
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'qcInput') updateQuickCapturePreview();
});
document.addEventListener('click', (e) => {
  const ov = document.getElementById('qcOverlay');
  if (!ov || ov.style.display !== 'flex') return;
  if (e.target === ov) closeQuickCapture();
});

function showShortcutsModal() {
  openModal(`
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="shortcutsTitle">
      <div class="modal-header">
        <div class="modal-title" id="shortcutsTitle">Keyboard shortcuts</div>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Close">${I.x}</button>
      </div>
      <div class="modal-body">
        <table style="width:100%; font-size:14px;">
          <tbody>
            <tr><td style="padding:6px 0"><kbd>q</kbd></td><td>Quick capture (log activity)</td></tr>
            <tr><td style="padding:6px 0"><kbd>/</kbd></td><td>Focus search</td></tr>
            <tr><td style="padding:6px 0"><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd></td><td>Quick add</td></tr>
            <tr><td style="padding:6px 0"><kbd>?</kbd></td><td>Show this list</td></tr>
            <tr><td style="padding:6px 0"><kbd>Esc</kbd></td><td>Close modal</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `);
}

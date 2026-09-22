export function createWorkspaceService(legacy) {
  let state = { installed: false, active: null, memberships: [], members: [], error: null, userId: null };
  const selectionKey = () => `tarkit.workspace.${legacy.userId}`;
  async function initialize() {
    if (state.userId === legacy.userId && (state.active || !state.installed) && state.checked) return true;
    state = { installed: false, active: null, memberships: [], members: [], error: null, userId: legacy.userId, checked: false };
    const result = await legacy.rawDb.from('tarkit_memberships').select('*,tarkit_workspaces(id,name,country,created_at)').eq('user_id', legacy.userId);
    if (result.error) {
      // Only a genuinely missing migration permits owner-scoped compatibility mode.
      if (!['PGRST205', '42P01'].includes(result.error.code)) throw result.error;
      state.checked = true;
      window.TarkitData.setScope({ userId: legacy.userId, workspaceId: null, installed: false });
      return true;
    }
    state.installed = true;
    state.memberships = result.data || [];
    let selected; try { selected = localStorage.getItem(selectionKey()); } catch {}
    const membership = state.memberships.find(row => row.workspace_id === selected) || state.memberships[0];
    state.active = membership ? { ...membership.tarkit_workspaces, role: membership.role } : null;
    window.TarkitData.setScope({ userId: legacy.userId, workspaceId: state.active?.id || null, installed: true });
    if (state.active) {
      const { data, error } = await legacy.rawDb.rpc('tarkit_team_members', { p_workspace_id: state.active.id });
      if (error) throw error;
      state.members = data || [];
    }
    state.checked = true;
    return Boolean(state.active);
  }
  async function select(id) {
    if (!state.memberships.some(row => row.workspace_id === id)) throw new Error('You are not a member of that workspace.');
    localStorage.setItem(selectionKey(), id);
    state.checked = false;
    legacy.store.companies = []; legacy.store.contacts = []; legacy.store.deals = []; legacy.store.activities = [];
    await initialize();
    await legacy.bootApp();
  }
  async function create(name, country, adopt) {
    if (!state.installed) throw new Error('Team workspaces are not enabled yet. Your personal CRM is available.');
    const { data, error } = await legacy.rawDb.rpc('tarkit_create_workspace', { p_name: name.trim(), p_country: country, p_adopt_personal: adopt });
    if (error) throw error;
    localStorage.setItem(selectionKey(), data);
    state.checked = false;
    await legacy.bootApp();
  }
  async function accept(token) {
    const { data, error } = await legacy.rawDb.rpc('tarkit_accept_invitation', { p_token: token });
    if (error) throw error;
    localStorage.setItem(selectionKey(), data);
    state.checked = false;
    await legacy.bootApp();
  }
  async function invite(email) {
    if (!state.active || !['owner', 'admin'].includes(state.active.role)) throw new Error('Only workspace owners and admins can invite teammates.');
    const { data, error } = await legacy.rawDb.rpc('tarkit_invite_member', { p_workspace_id: state.active.id, p_email: email.trim().toLowerCase() });
    if (error) throw error;
    return `${location.origin}${location.pathname}#invite/${data}`;
  }
  async function track(name, objectId = null) {
    if (!state.active) return;
    const { error } = await legacy.rawDb.rpc('tarkit_record_event', { p_workspace_id: state.active.id, p_name: name, p_object_id: objectId });
    if (error) console.warn('Product event unavailable:', error.code);
  }
  return { initialize, create, select, invite, accept, track, get state() { return state; } };
}

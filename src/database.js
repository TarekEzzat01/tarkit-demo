/* All retained CRM queries pass through one workspace boundary.
   This filter improves correctness; database RLS is the authorization boundary. */
window.TarkitData = (() => {
  const tenantTables = new Set(['companies', 'contacts', 'deals', 'activities', 'icp_profiles', 'annual_targets', 'activity_targets']);
  let scope = { userId: null, workspaceId: null, installed: false };
  function setScope(next) { scope = { ...next }; }
  function create(client) {
    return new Proxy(client, {
      get(target, key) {
        if (key !== 'from') return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
        return table => {
          const base = target.from(table);
          if (!tenantTables.has(table)) return base;
          const current = { ...scope };
          if (!current.userId) throw new Error('Sign in before accessing CRM records.');
          const filter = query => current.workspaceId
            ? query.eq('workspace_id', current.workspaceId)
            : current.installed ? query.eq('owner_id', current.userId).is('workspace_id', null) : query.eq('owner_id', current.userId);
          const stagePayload = row => table === 'deals' && row.stage === 'Qualification' && !window.TARKIT_DEMO_CLIENT && window.TARKIT_QUALIFICATION_DB_VALUE ? {...row,stage:window.TARKIT_QUALIFICATION_DB_VALUE} : row;
          const stamp = row => ({ ...stagePayload(row), owner_id: current.userId, ...(current.installed ? { workspace_id: current.workspaceId } : {}) });
          return new Proxy(base, {
            get(builder, method) {
              if (method === 'select' || method === 'delete') return (...args) => filter(builder[method](...args));
              if (method === 'update') return (payload, ...args) => {
                const { owner_id, workspace_id, ...safe } = payload;
                return filter(builder.update(stagePayload(safe), ...args));
              };
              if (method === 'insert' || method === 'upsert') return (payload, options) => {
                const rows = Array.isArray(payload) ? payload.map(stamp) : stamp(payload);
                const opts = current.workspaceId && options?.onConflict
                  ? { ...options, onConflict: options.onConflict.replace('owner_id', 'workspace_id') } : options;
                return builder[method](rows, opts);
              };
              return typeof builder[method] === 'function' ? builder[method].bind(builder) : builder[method];
            },
          });
        };
      },
    });
  }
  return { create, setScope, get scope() { return { ...scope }; } };
})();

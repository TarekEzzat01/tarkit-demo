async function startOriginalApp() {
  const { data: { session: existing } } = await db.auth.getSession();
  if (existing) {
    session = existing;
    userId = existing.user.id;
    hideLogin();
    await bootApp();
  } else {
    showLogin();
  }
}
window.TarkitLegacy = {
  get store(){ return store; }, get session(){ return session; }, get userId(){ return userId; },
  db, rawDb, router, routes: ROUTES, nav: NAV, icons: I, loadStore, renderNav, toast,
  openCompanyModal, openContactModal, openDealModal, openActivityModal, openModal, closeModal,
  seedFirstRun, bootApp, startOriginalApp, scoreCompany,
  get stages(){ return STAGES; },
};

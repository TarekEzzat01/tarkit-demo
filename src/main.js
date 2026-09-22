import { createWorkspaceService } from './features/workspace.js';
import { createExperience } from './features/experience.js';
import { createPlatform } from './features/platform.js';

const legacy = window.TarkitLegacy;
const workspace = createWorkspaceService(legacy);
window.TarkitWorkspace = workspace;
const experience = createExperience(legacy, workspace);
window.TarkitExperience = experience;
experience.install();
const platform = createPlatform(legacy, workspace, experience);
window.TarkitPlatform = platform;
platform.install();

const initialRoute = location.hash.slice(1);
if (initialRoute.startsWith('account/')) {
  legacy.router.current = 'home';
} else if (legacy.routes[initialRoute]) legacy.router.current = initialRoute;

await legacy.startOriginalApp();
if (legacy.userId && initialRoute.startsWith('account/')) experience.openAccount(decodeURIComponent(initialRoute.slice(8)));
if (initialRoute.startsWith('invite/')) {
  if (!legacy.userId) {
    document.getElementById('authSub').textContent = 'Sign in with your invited email, then reopen your invitation link.';
  } else {
    const host = document.getElementById('page');
    host.innerHTML = '<section class="product-form"><h1>Join your team</h1><p>Accept this invitation to access the team’s shared workspace.</p><button class="btn btn-primary" id="acceptInvite">Accept invitation</button><p id="inviteError" role="alert"></p></section>';
    document.getElementById('acceptInvite').addEventListener('click', async event => {
      event.target.disabled = true;
      try { await workspace.accept(initialRoute.slice(7)); history.replaceState(null, '', '#home'); legacy.router.go('home'); }
      catch (error) { document.getElementById('inviteError').textContent = error.message || 'This invitation could not be accepted. Ask your team for a new link.'; event.target.disabled = false; }
    });
  }
}

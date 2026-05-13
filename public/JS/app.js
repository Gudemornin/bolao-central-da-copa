import { loginUser } from './auth.js';
import { loadUsers } from './storage.js';
import { currentUser, setCurrentUser } from './state.js';
import './admin.js';
import './gamemanager.js';
import './ranking.js';
import './bets.js';
import { getUserPoints } from './ranking.js';
import { initModalClosers, showToast } from './ui.js';
import { switchTab } from './navigation.js';

export function updateSidebar() {
  if (!currentUser) return;
  const pts = getUserPoints(currentUser.id);
  document.getElementById('sidebarName').textContent = currentUser.profileName;
  document.getElementById('sidebarPts').textContent = pts + ' pts';
  document.getElementById('sidebarAvatar').textContent = currentUser.profileName.charAt(0).toUpperCase();
}

window.updateSidebar = updateSidebar;

function init() {
  initModalClosers();
  const sid = localStorage.getItem('bc26_session');
  console.log('Sessão encontrada:', sid);  // ← Adicione este log
  
  if (sid) {
    const users = loadUsers();
    const user = users.find(u => u.id === sid);
    console.log('Usuário encontrado:', user);  // ← Adicione este log
    
    if (user) {
      loginUser(user);
      return;
    }
  }
  document.getElementById('authScreen').style.display = '';
}

init();
window.toggleSidebar = () => {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
};

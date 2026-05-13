// app.js
import { loginUser } from './auth.js';  // ← agora funciona porque exportamos
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
  // Resolver a Promise corretamente
  getUserPoints(currentUser.id).then(pts => {
    document.getElementById('sidebarName').textContent = currentUser.profileName;
    document.getElementById('sidebarPts').textContent = pts + ' pts';
    document.getElementById('sidebarAvatar').textContent = currentUser.profileName.charAt(0).toUpperCase();
  }).catch(err => {
    console.error('Erro ao obter pontos:', err);
    document.getElementById('sidebarPts').textContent = '0 pts';
  });
}

window.updateSidebar = updateSidebar;

// Função para controlar menu mobile
function updateMobileMenu() {
  const mobileAdmin = document.getElementById('mobileNavAdmin');
  if (mobileAdmin) {
    mobileAdmin.style.display = currentUser?.isAdmin ? 'flex' : 'none';
  }
}

async function init() {
  initModalClosers();
  const sid = localStorage.getItem('bc26_session');
  console.log('🔍 Sessão encontrada:', sid);
  
  if (sid) {
    try {
      const users = await loadUsers();
      console.log('👥 Usuários carregados:', users);
      
      const user = users.find(u => u.id === sid);
      console.log('👤 Usuário encontrado:', user);
      
      if (user) {
        loginUser(user);
        updateMobileMenu();
        return;
      }
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
    }
  }
  document.getElementById('authScreen').style.display = '';
}

// Aguardar DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.toggleSidebar = () => {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
};

export { updateMobileMenu };
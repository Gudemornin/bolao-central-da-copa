import { loadUsers } from './storage.js';
import { currentUser, setCurrentUser } from './state.js';
import './admin.js';
import './gamemanager.js';
import './ranking.js';
import './bets.js';
import { getUserPoints } from './ranking.js';
import { initModalClosers } from './ui.js';
import { switchTab } from './navigation.js';
import './auth.js';

export function updateSidebar() {
  if (!currentUser) {
    console.warn('⚠️ updateSidebar: currentUser é undefined');
    document.getElementById('sidebarName').textContent = '?';
    document.getElementById('sidebarPts').textContent = '0 pts';
    document.getElementById('sidebarAvatar').textContent = '?';
    return;
  }
  
  getUserPoints(currentUser.id).then(pts => {
    document.getElementById('sidebarName').textContent = currentUser.profileName || currentUser.profile_name || 'Usuário';
    document.getElementById('sidebarPts').textContent = pts + ' pts';
    document.getElementById('sidebarAvatar').textContent = (currentUser.profileName || currentUser.profile_name || 'U').charAt(0).toUpperCase();
  }).catch(err => {
    console.error('Erro ao obter pontos:', err);
    document.getElementById('sidebarPts').textContent = '0 pts';
  });
}

window.updateSidebar = updateSidebar;

async function init() {
  initModalClosers();
  
  const sid = localStorage.getItem('bc26_session');
  console.log('🔍 Sessão encontrada:', sid);
  
  if (sid) {
    try {
      // Carregar usuários do localStorage PRIMEIRO (fallback rápido)
      let users = [];
      const localUsers = localStorage.getItem('bc26_users');
      if (localUsers) {
        users = JSON.parse(localUsers);
      }
      
      // Se não achou no localStorage, tenta da API
      if (!users.length) {
        users = await loadUsers();
      } else {
        // Atualiza em background com a API (opcional)
        loadUsers().then(apiUsers => {
          if (apiUsers.length) {
            localStorage.setItem('bc26_users', JSON.stringify(apiUsers));
          }
        }).catch(console.error);
      }
      
      console.log('👥 Usuários carregados:', users);
      
      let user = users.find(u => u.id === sid);
      
      // Fallback para admin
      if (!user && sid === 'admin_default') {
        user = users.find(u => u.profileName === 'eVagabundoTaLa11223' || u.profile_name === 'eVagabundoTaLa11223');
      }
      
      console.log('👤 Usuário encontrado:', user);
      
      if (user) {
        setCurrentUser(user);
        // Renova a sessão
        localStorage.setItem('bc26_session', user.id);
        
        // Esconder auth e mostrar app
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appLayout').classList.add('show');
        
        // Mostrar admin se for admin
        const navAdmin = document.getElementById('navAdmin');
        if (navAdmin) navAdmin.style.display = user.isAdmin ? 'flex' : 'none';
        
        updateSidebar();
        if (typeof updateMobileMenu === 'function') updateMobileMenu();
        switchTab('games');
        return;
      }
    } catch (error) {
      console.error('❌ Erro ao restaurar sessão:', error);
    }
  }
  
  // Se chegou aqui, não há sessão válida
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

export function updateMobileMenu() {
  const mobileAdmin = document.getElementById('mobileNavAdmin');
  if (mobileAdmin) {
    mobileAdmin.style.display = currentUser?.isAdmin ? 'flex' : 'none';
  }
}

// Função para marcar o item ativo no menu inferior
export function updateMobileActiveTab(tab) {
  const mobileItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
  mobileItems.forEach(item => {
    if (item.getAttribute('data-tab') === tab) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

}

window.updateMobileMenu = updateMobileMenu;
window.updateMobileActiveTab = updateMobileActiveTab;

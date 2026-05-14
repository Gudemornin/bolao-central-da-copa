import { loadUsers } from './storage.js';
import { currentUser, setCurrentUser } from './state.js';
import './admin.js';
import './gamemanager.js';
import './ranking.js';
import './bets.js';
import { getUserPoints } from './ranking.js';
import { initModalClosers, showToast } from './ui.js';
import { switchTab } from './navigation.js';
import './auth.js';
import {
  startFdAutoUpdate,
  stopFdAutoUpdate,
} from './syncFootballData.js';

// Importar funções necessárias para a atualização automática (que são exportadas)
import { renderGames } from './gamemanager.js';
import { renderRanking } from './ranking.js';
import { renderBets } from './bets.js';
import { renderCommunityBets } from './communityBets.js';
import { GAMES_STATE } from './state.js';
// renderWorldCupGames NÃO é exportada, mas está disponível em window (ver navigation.js)

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

// =============================================
// ATUALIZAÇÃO AUTOMÁTICA DE RESULTADOS (5 em 5 min)
// =============================================
let autoUpdateInterval = null;

function shouldFetchAutoUpdate() {
  if (!Array.isArray(GAMES_STATE) || GAMES_STATE.length === 0) return true;

  const now = Date.now();
  const windowBeforeMs = 30 * 60 * 1000; // 30 min antes
  const windowAfterMs  = 180 * 60 * 1000; // 3 h depois

  return GAMES_STATE.some(game => {
    if (!game.date || !game.time) return false;
    const start = Date.parse(`${game.date}T${game.time}:00Z`);
    if (Number.isNaN(start)) return false;

    const status = String(game.status || '').toLowerCase();
    if (status === 'live') return true;
    if (status === 'upcoming') {
      return now >= start - windowBeforeMs && now <= start + windowAfterMs;
    }
    return false;
  });
}

export function startAutoResultUpdater() {
  startFdAutoUpdate(['WC', 'PD']); // Copa + La Liga (ajuste conforme necessário)

  // Reagir a resultados atualizados (atualiza as abas abertas sem reload)
  window.addEventListener('fd:results-updated', async ({ detail }) => {
    console.log(`🔔 ${detail.updated} resultado(s) atualizado(s)`);
    const activeTab = document.querySelector('.tab-content.active')?.id;
    if (activeTab === 'tabGames')    await renderGames();
    if (activeTab === 'tabRanking')  await renderRanking();
    if (activeTab === 'tabBets')     await renderBets();
    if (activeTab === 'tabWorldcup' && typeof window.renderWorldCupGames === 'function') {
      await window.renderWorldCupGames();
    }
    if (typeof updateSidebar === 'function') updateSidebar();
  });
}

export function stopAutoResultUpdater() {
  stopFdAutoUpdate();
}

// Disponibilizar globalmente para ser chamado pelo auth.js
window.stopAutoResultUpdater = stopAutoResultUpdater;
window.startAutoResultUpdater = startAutoResultUpdater;

// =============================================
// INICIALIZAÇÃO
// =============================================
async function init() {
  initModalClosers();
  
  const sid = localStorage.getItem('bc26_session');
  console.log('🔍 Sessão encontrada:', sid);
  
  if (sid) {
    try {
      let users = [];
      const localUsers = localStorage.getItem('bc26_users');
      if (localUsers) {
        users = JSON.parse(localUsers);
      }
      
      if (!users.length) {
        users = await loadUsers();
      } else {
        loadUsers().then(apiUsers => {
          if (apiUsers.length) {
            localStorage.setItem('bc26_users', JSON.stringify(apiUsers));
          }
        }).catch(console.error);
      }
      
      console.log('👥 Usuários carregados:', users);
      
      let user = users.find(u => u.id === sid);
      
      if (!user && sid === 'admin_default') {
        user = users.find(u => u.profileName === 'eVagabundoTaLa11223' || u.profile_name === 'eVagabundoTaLa11223');
      }
      
      console.log('👤 Usuário encontrado:', user);
      
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('bc26_session', user.id);
        
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appLayout').classList.add('show');
        
        const navAdmin = document.getElementById('navAdmin');
        if (navAdmin) navAdmin.style.display = user.isAdmin ? 'flex' : 'none';
        
        updateSidebar();
        if (typeof updateMobileMenu === 'function') updateMobileMenu();
        switchTab('games');
        
        // ✅ INICIAR ATUALIZAÇÃO AUTOMÁTICA APÓS LOGIN
        startAutoResultUpdater();
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
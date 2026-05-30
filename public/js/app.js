import { loadUsers, loadGames } from './storage.js';
import { currentUser, setCurrentUser, setGamesState } from './state.js';
import './admin.js';
import './gamemanager.js';
import './ranking.js';
import './bets.js';
import { getUserPoints } from './ranking.js';
import { initModalClosers, showToast } from './ui.js';
import { switchTab } from './navigation.js';
import './auth.js';



// Importar funções necessárias para a atualização automática (que são exportadas)
import { renderGames } from './gamemanager.js';
import { renderRanking } from './ranking.js';
import { renderBets } from './bets.js';
import { renderCommunityBets } from './communityBets.js';
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

export function startAutoResultUpdater() {
  if (autoUpdateInterval) clearInterval(autoUpdateInterval);
  autoUpdateInterval = setInterval(async () => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/update-results', { method: 'POST' });
      const data = await response.json();
      if (data.success && data.updated > 0) {
        console.log(`🔄 ${data.updated} jogos atualizados automaticamente`);
        
        const activeTab = document.querySelector('.tab-content.active')?.id;
        if (activeTab === 'tabGames') await renderGames();
        if (activeTab === 'tabCommunity') await renderCommunityBets();
        if (activeTab === 'tabRanking') await renderRanking();
        // Agora usa window (já que a função está global)
        if (activeTab === 'tabWorldcup' && typeof window.renderWorldCupGames === 'function') {
          await window.renderWorldCupGames();
        }
        if (activeTab === 'tabBets') await renderBets();
        
        if (typeof updateSidebar === 'function') updateSidebar();
        showToast(`${data.updated} jogo(s) atualizado(s)`, 'green');
      }
    } catch (err) {
      console.error('Erro na atualização automática:', err);
    }
  }, 300000);
}

export function stopAutoResultUpdater() {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
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
      //  startAutoResultUpdater();
        return;
      }
    } catch (error) {
      console.error('❌ Erro ao restaurar sessão:', error);
    }
  }
  
  // Se chegou aqui, não há sessão válida
  document.getElementById('authScreen').style.display = '';
}

const games = await loadGames();
setGamesState(games);

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

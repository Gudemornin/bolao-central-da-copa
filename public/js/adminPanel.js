// adminPanel.js - VERSÃO EXTREMAMENTE SIMPLES E DIRETA
import { loadUsers, saveUsers, loadBets, clearAllData } from './storage.js';
import { renderRanking } from './ranking.js';
import { currentUser } from './state.js';
import { showToast, openModal, closeModal } from './ui.js';

function isAdmin() {
  if (!currentUser || !currentUser.isAdmin) {
    showToast('Acesso negado. Apenas administradores.', 'red');
    return false;
  }
  return true;
}

export async function renderAdminPanel() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;

  if (!currentUser || !currentUser.isAdmin) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;"><div style="font-size:48px;">🔒</div><h3>Acesso Restrito</h3><p style="color:var(--text-d);">Apenas administradores podem acessar esta área.</p></div>`;
    return;
  }

  const users = await loadUsers();
  const bets = await loadBets();

  if (!users || !Array.isArray(users)) {
    container.innerHTML = '<div style="padding:40px;text-align:center;">Erro ao carregar usuários.</div>';
    return;
  }

  let html = `
    <div style="margin-bottom:24px;">
      <div class="page-title">⚙️ Painel de Administração</div>
      <div class="page-subtitle">Gerencie usuários, senhas e pontuações</div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
      <button id="adminClearGamesBtn" style="background:#F59E0B;" class="admin-action-btn">🗑️ Limpar Apenas Jogos</button>
      <button id="adminClearAllBtn" style="background:#EF4444;" class="admin-action-btn">⚠️ LIMPAR TUDO</button>
      <button id="adminForceSyncBtn" style="background:#3B82F6;" class="admin-action-btn">🔄 Forçar Sincronização</button>
    </div>
    <div class="ranking-wrap">
      <table class="ranking-table">
        <thead><tr><th>Usuário</th><th>Palpites</th><th>Status</th><th style="text-align:center;">Ações</th></tr></thead>
        <tbody id="adminUsersTableBody">
        </tbody>
      </table>
    </div>
    <div class="modal-overlay" id="modalEditUser">
      <div class="modal">
        <div class="modal-header"><div class="modal-title">✏️ Editar Usuário</div><button class="modal-close" onclick="closeModal('modalEditUser')">✕</button></div>
        <div class="modal-body" id="modalEditUserBody"></div>
      </div>
    </div>
  `;
  container.innerHTML = html;

  // Preenche a tabela
  const tbody = document.getElementById('adminUsersTableBody');
  for (const user of users) {
    const userBets = bets[user.id] || {};
    const betsCount = Object.keys(userBets).length;
    const isCurrentUser = user.id === currentUser?.id;
    const hasEmail = user.email || 'Sem e-mail';
    
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>
        <div class="rank-user">
          <div class="rank-avatar">${(user.profileName || 'U').charAt(0).toUpperCase()}</div>
          <div>
            <div class="rank-name">${user.profileName || 'Sem nome'}${user.isAdmin ? ' 👑' : ''}${isCurrentUser ? ' (você)' : ''}</div>
            <div style="font-size:11px;color:var(--text-d);">${hasEmail}</div>
          </div>
        </div>
      </td>
      <td>${betsCount}</td>
      <td>${user.passwordResetPending ? '<span style="color:var(--gold);">⚠️ Troca pendente</span>' : '<span style="color:var(--green-l);">✅ Normal</span>'}</td>
      <td style="text-align:center;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
          <button class="edit-user-btn admin-action-btn" data-id="${user.id}" style="background:var(--blue);">✏️ Editar</button>
          <button class="reset-user-btn admin-action-btn" data-id="${user.id}" style="background:var(--gold);color:#000;">🔑 Reset Senha</button>
          ${!user.isAdmin && !isCurrentUser ? `<button class="delete-user-btn admin-action-btn" data-id="${user.id}" style="background:var(--red);">🗑️ Remover</button>` : ''}
        </div>
      </td>
    `;
  }

  // ========== EVENTOS GLOBAIS VIA DELEGAÇÃO ==========
  // Usamos um único listener no document para capturar cliques nos botões dinâmicos
  const handleClick = async (e) => {
    const btn = e.target.closest('.admin-action-btn');
    if (!btn) return;

if (btn.id === 'adminClearGamesBtn') {
  if (!confirm('Limpar APENAS os jogos do banco de dados?')) return;
  try {
    const res = await fetch('/api/clear-games', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Jogos removidos do banco! Recarregue a página.', 'green');
      setTimeout(() => location.reload(), 1500);
    } else {
      showToast('Erro ao limpar jogos', 'red');
    }
  } catch (err) {
    showToast('Erro de conexão', 'red');
  }
}
  
    else if (btn.id === 'adminClearAllBtn') {
      if (!confirm('⚠️ APAGAR TUDO?') || !confirm('ÚLTIMA CHANCE!')) return;
      await clearAllData();
      showToast('Dados removidos!', 'red');
      setTimeout(() => location.reload(), 2000);
    }
    }
    else if (btn.classList.contains('edit-user-btn')) {
      const userId = btn.getAttribute('data-id');
      await window.adminShowEditUserModal(userId);
    }
    else if (btn.classList.contains('reset-user-btn')) {
      const userId = btn.getAttribute('data-id');
      await window.adminResetUserPassword(userId);
    }
    else if (btn.classList.contains('delete-user-btn')) {
      const userId = btn.getAttribute('data-id');
      console.log('🔴 Delete button clicked for user ID:', userId);
      if (!confirm('⚠️ Remover este usuário permanentemente?')) return;
      
      try {
        showToast('🔄 Removendo...', 'blue');
        // Busca o ID completo (segurança)
        const response = await fetch('/api/users');
        const data = await response.json();
        let realId = userId;
        if (data.users) {
          const found = data.users.find(u => u.id === userId);
          if (found) realId = found.id;
          else {
            // Tenta por prefixo
            const partial = data.users.find(u => u.id.startsWith(userId));
            if (partial) realId = partial.id;
          }
        }
        console.log('Real ID to delete:', realId);
        const deleteRes = await fetch(`/api/users/${realId}`, { method: 'DELETE' });
        const result = await deleteRes.json();
        if (!deleteRes.ok) throw new Error(result.error || 'Falha');
        showToast('✅ Usuário removido!', 'green');
        // Atualiza localStorage
        const localUsers = JSON.parse(localStorage.getItem('bc26_users') || '[]');
        localStorage.setItem('bc26_users', JSON.stringify(localUsers.filter(u => u.id !== realId)));
        if (realId === currentUser?.id) localStorage.removeItem('bc26_session');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        console.error(err);
        showToast(err.message, 'red');
      }
    }
  };
  document.removeEventListener('click', handleClick);
  document.addEventListener('click', handleClick);
}

// ========== FUNÇÕES AUXILIARES ==========
window.adminShowEditUserModal = async (userId) => {
  if (!isAdmin()) return;
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) { showToast('Usuário não encontrado', 'red'); return; }
  
  const body = document.getElementById('modalEditUserBody');
  body.innerHTML = `
    <div style="margin-bottom:20px;"><h3>${user.profileName || 'Sem nome'}</h3><p>ID: ${user.id}</p><p>Email: ${user.email || 'Não cadastrado'}</p></div>
    <div class="form-group"><label class="form-label">Nome de Perfil</label><input class="form-input" id="editProfileName" value="${user.profileName || ''}"></div>
    <div class="form-group"><label class="form-label">E-mail</label><input class="form-input" id="editEmail" value="${user.email || ''}"></div>
    <div class="form-group"><label class="form-label">Pontuação Manual</label><input class="form-input" id="editPoints" type="number" value="${user.adminOverrides?.manualPoints || ''}"></div>
    <div class="form-group"><label class="form-label">Craques</label><input class="form-input" id="editCraques" type="number" value="${user.adminOverrides?.manualCraques || ''}"></div>
    <div class="form-group"><label class="form-label">Tornar Admin</label><select class="form-input" id="editIsAdmin"><option value="false" ${!user.isAdmin ? 'selected' : ''}>Não</option><option value="true" ${user.isAdmin ? 'selected' : ''}>Sim</option></select></div>
    <div style="display:flex;gap:12px;margin-top:20px;"><button id="saveUserBtn" class="btn btn-blue" data-id="${user.id}">💾 Salvar</button><button class="btn-ghost" onclick="closeModal('modalEditUser')">Cancelar</button></div>
  `;
  document.getElementById('saveUserBtn')?.addEventListener('click', () => window.adminSaveUserEdits(user.id));
  openModal('modalEditUser');
};

window.adminSaveUserEdits = async (userId) => {
  if (!isAdmin()) return;
  const newProfileName = document.getElementById('editProfileName')?.value;
  const newEmail = document.getElementById('editEmail')?.value;
  const points = document.getElementById('editPoints')?.value;
  const craques = document.getElementById('editCraques')?.value;
  const isAdminValue = document.getElementById('editIsAdmin')?.value === 'true';
  
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) { showToast('Usuário não encontrado', 'red'); return; }
  if (newProfileName) users[idx].profileName = newProfileName;
  if (newEmail !== undefined) users[idx].email = newEmail || null;
  users[idx].isAdmin = isAdminValue;
  if (!users[idx].adminOverrides) users[idx].adminOverrides = {};
  if (points && points !== '') users[idx].adminOverrides.manualPoints = parseInt(points);
  if (craques && craques !== '') users[idx].adminOverrides.manualCraques = parseInt(craques);
  await saveUsers(users);
  showToast('Usuário atualizado!', 'green');
  closeModal('modalEditUser');
  await renderAdminPanel();
  if (window.renderRanking) await renderRanking();
};

window.adminResetUserPassword = async (userId) => {
  if (!isAdmin()) return;
  if (!confirm('Resetar senha deste usuário?')) return;
  if (window.adminResetUserPasswordOriginal) await window.adminResetUserPasswordOriginal(userId);
  else showToast('Função de reset não disponível', 'red');
  await renderAdminPanel();
};

console.log('✅ adminPanel.js carregado (event delegation)');

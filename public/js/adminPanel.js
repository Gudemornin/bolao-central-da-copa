// adminPanel.js - VERSÃO CORRIGIDA

// Remova estas importações que causam erro:
// import { adminRemoveUser, adminResetUserPassword, adminEditUserPoints, adminEditUserCraques } from './auth.js';

// Em vez disso, use as funções diretamente do window (já estão disponíveis)

import { loadUsers, saveUsers, loadBets } from './storage.js';
import { renderRanking } from './ranking.js';
import { currentUser } from './state.js';
import { showToast, openModal, closeModal } from './ui.js';

// =============================================
// FUNÇÕES ADMIN (usam window, não import)
// =============================================

// Verificar se é admin
function isAdmin() {
if (!currentUser || !currentUser.isAdmin) {
    showToast('Acesso negado. Apenas administradores.', 'red');
    return false;
}
return true;
}

export function renderAdminPanel() {
const container = document.getElementById('adminPanelContent');
if (!container) return;

if (!currentUser || !currentUser.isAdmin) {
    container.innerHTML = `
    <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <h3 style="font-family:Anton;margin-bottom:8px;">Acesso Restrito</h3>
        <p style="color:var(--text-d);">Apenas administradores podem acessar esta área.</p>
    </div>
    `;
    return;
}

const users = loadUsers(); // Pode ser síncrono ou assíncrono - ajuste
const bets = loadBets();

  // Se users for Promise (assíncrono), precisa usar await
  // Vou assumir que é síncrono por enquanto

let html = `
    <div style="margin-bottom:24px;">
    <div class="page-title">⚙️ Painel de Administração</div>
    <div class="page-subtitle">Gerencie usuários, senhas e pontuações</div>
    </div>
    
    <div class="ranking-wrap">
    <table class="ranking-table">
        <thead>
        <tr>
            <th>Usuário</th>
            <th>Palpites</th>
            <th>Status</th>
            <th style="text-align:center;">Ações</th>
        </tr>
        </thead>
        <tbody>
`;

users.forEach(user => {
    const userBets = bets[user.id] || {};
    const betsCount = Object.keys(userBets).length;
    const isCurrentUser = user.id === currentUser?.id;
    
    html += `
    <tr>
        <td>
        <div class="rank-user">
            <div class="rank-avatar">${user.profileName.charAt(0).toUpperCase()}</div>
            <div>
            <div class="rank-name">${user.profileName}${user.isAdmin ? ' 👑' : ''}${isCurrentUser ? ' (você)' : ''}</div>
            <div style="font-size:11px;color:var(--text-d);">${user.email || 'Sem e-mail'}</div>
            </div>
        </div>
        </td>
        <td>${betsCount}</td>
        <td>
        ${user.passwordResetPending ? '<span style="color:var(--gold);">⚠️ Troca pendente</span>' : '<span style="color:var(--green-l);">✅ Normal</span>'}
        </td>
        <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
            <button class="admin-action-btn" onclick="adminShowEditUserModal('${user.id}')" style="background:var(--blue);">
            ✏️ Editar
            </button>
            <button class="admin-action-btn" onclick="window.adminResetUserPassword('${user.id}')" style="background:var(--gold);color:#000;">
            🔑 Reset Senha
            </button>
            ${!user.isAdmin && !isCurrentUser ? `<button class="admin-action-btn" onclick="window.adminRemoveUser('${user.id}')" style="background:var(--red);">
            🗑️ Remover
            </button>` : ''}
        </div>
        </td>
    </tr>
    `;
});

html += `
        </tbody>
    </table>
    </div>
    
    <div class="modal-overlay" id="modalEditUser">
    <div class="modal">
        <div class="modal-header">
        <div class="modal-title">✏️ Editar Usuário</div>
        <button class="modal-close" onclick="closeModal('modalEditUser')">✕</button>
        </div>
        <div class="modal-body" id="modalEditUserBody"></div>
    </div>
    </div>
`;

container.innerHTML = html;
}

// Mostrar modal de edição
window.adminShowEditUserModal = (userId) => {
if (!isAdmin()) return;

const users = loadUsers();
const user = users.find(u => u.id === userId);
if (!user) return;

const body = document.getElementById('modalEditUserBody');
body.innerHTML = `
    <div style="margin-bottom:20px;">
    <h3>${user.profileName}</h3>
    <p style="font-size:12px;color:var(--text-d);">ID: ${user.id.substring(0,8)}...</p>
    <p style="font-size:12px;color:var(--text-d);">Email: ${user.email || 'Não cadastrado'}</p>
    </div>
    
    <div class="form-group">
    <label class="form-label">Pontuação Manual (override)</label>
    <input class="form-input" id="editPoints" type="number" value="${user.adminOverrides?.manualPoints || ''}" placeholder="Deixe em branco para usar cálculo automático">
    </div>
    
    <div class="form-group">
    <label class="form-label">Craques Acertados (override)</label>
    <input class="form-input" id="editCraques" type="number" value="${user.adminOverrides?.manualCraques || ''}" placeholder="Deixe em branco">
    </div>
    
    <div class="form-group">
    <label class="form-label">Tornar Admin</label>
    <select class="form-input" id="editIsAdmin">
        <option value="false" ${!user.isAdmin ? 'selected' : ''}>Não</option>
        <option value="true" ${user.isAdmin ? 'selected' : ''}>Sim</option>
    </select>
    </div>
    
    <div style="display:flex;gap:12px;margin-top:20px;">
    <button class="btn btn-blue" onclick="adminSaveUserEdits('${user.id}')">💾 Salvar</button>
    <button class="btn-ghost" onclick="closeModal('modalEditUser')">Cancelar</button>
    </div>
`;

openModal('modalEditUser');
};

// Salvar edições
window.adminSaveUserEdits = async (userId) => {
if (!isAdmin()) return;

const points = document.getElementById('editPoints')?.value;
const craques = document.getElementById('editCraques')?.value;
const isAdminValue = document.getElementById('editIsAdmin')?.value === 'true';

const users = loadUsers();
const userIndex = users.findIndex(u => u.id === userId);

if (userIndex !== -1) {
    if (points !== undefined && points !== '') {
    if (!users[userIndex].adminOverrides) users[userIndex].adminOverrides = {};
    users[userIndex].adminOverrides.manualPoints = parseInt(points);
    }
    
    if (craques !== undefined && craques !== '') {
    if (!users[userIndex].adminOverrides) users[userIndex].adminOverrides = {};
    users[userIndex].adminOverrides.manualCraques = parseInt(craques);
    }
    
    users[userIndex].isAdmin = isAdminValue;
    
    saveUsers(users);
    showToast('Usuário atualizado com sucesso!', 'green');
}

closeModal('modalEditUser');
renderAdminPanel();
if (window.renderRanking) renderRanking();
};

// Registrar funções no window
window.adminRemoveUser = async (userId) => {
if (!isAdmin()) return;
if (confirm('Tem certeza que deseja remover este usuário? Esta ação é irreversível!')) {
    if (window.adminRemoveUserOriginal) {
    await window.adminRemoveUserOriginal(userId);
    }
    renderAdminPanel();
}
};

window.adminResetUserPassword = async (userId) => {
if (!isAdmin()) return;
if (confirm('Resetar senha deste usuário? Ele receberá uma senha temporária.')) {
    if (window.adminResetUserPasswordOriginal) {
    await window.adminResetUserPasswordOriginal(userId);
    }
    renderAdminPanel();
}
};
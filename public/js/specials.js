// js/specials.js
import { TEAMS } from './data/teams.js';
import { PLAYERS } from './data/players.js';
import { currentUser } from './state.js';
import { showToast } from './ui.js';
import { loadUsers } from './storage.js';
import { getPlayer } from './exportplayer.js';

let specialPicks = {}; // { userId: { champion, topScorer, mvp, revelation } }

const DEADLINE = new Date(2026, 5, 11, 0, 0, 0); // 11 de junho de 2026

// =============================================
// API calls
// =============================================
async function loadSpecialPicks() {
  try {
    const res = await fetch('/api/special-picks');
    if (res.ok) {
      const data = await res.json();
      specialPicks = data;
      return specialPicks;
    }
  } catch (error) {
    console.error('Erro ao carregar palpites especiais:', error);
  }
  return {};
}

async function saveSpecialPick(userId, picks) {
  try {
    const res = await fetch('/api/special-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, picks })
    });
    if (res.ok) {
      showToast('Palpite especial salvo!', 'green');
      return true;
    }
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showToast('Erro ao salvar', 'red');
  }
  return false;
}

// =============================================
// Renderização principal
// =============================================
export async function renderSpecials() {
  const container = document.getElementById('specialsContainer');
  if (!container) return;

  await loadSpecialPicks();
  const users = await loadUsers();
  const isBeforeDeadline = new Date() < DEADLINE;

  const currentUserPick = specialPicks[currentUser?.id] || {};

  // Formulário para o usuário atual (se antes do prazo)
  let formHtml = '';
  if (isBeforeDeadline && currentUser) {
    formHtml = `
      <div class="info-card" style="margin-bottom:24px;">
        <div class="info-card-title">✏️ Meu Palpite Especial</div>
        <div class="info-card-subtitle">Palpites para a Copa do Mundo 2026 (Prazo: 11/06/2026)</div>
        <div id="specialsForm">
          ${renderCategorySelect('Campeão', 'champion', currentUserPick.champion, TEAMS)}
          ${renderPlayerSelect('Artilheiro', 'topScorer', currentUserPick.topScorer, PLAYERS)}
          ${renderPlayerSelect('Craque do Campeonato', 'mvp', currentUserPick.mvp, PLAYERS)}
          ${renderPlayerSelect('Revelação', 'revelation', currentUserPick.revelation, PLAYERS)}
          <button id="saveSpecialsBtn" class="btn btn-green" style="margin-top:16px;">💾 Salvar Palpites</button>
        </div>
      </div>
    `;
  } else if (!isBeforeDeadline) {
    formHtml = `<div class="info-card" style="margin-bottom:24px; background:rgba(200,16,46,0.1);"><div class="info-card-title">⏰ Prazo encerrado</div><p>Os palpites especiais foram bloqueados após 11/06/2026.</p></div>`;
  }

  // Exibição dos palpites de todos os usuários (organizada)
  const allPicksHtml = renderAllPicks(users, specialPicks);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🎆 Bolão Especial</div>
        <div class="page-subtitle">Escolha o campeão, artilheiro, craque e revelação da Copa 2026</div>
      </div>
    </div>
    ${formHtml}
    <div class="info-card">
      <div class="info-card-title">👥 Palpites da Galera</div>
      <div id="allSpecialsContainer">
        ${allPicksHtml}
      </div>
    </div>
  `;

  if (isBeforeDeadline && currentUser) {
    document.getElementById('saveSpecialsBtn')?.addEventListener('click', () => saveUserSpecials(currentUser.id));
    attachSelectListeners();
  }
}

function renderCategorySelect(label, key, currentValue, items) {
  const options = Object.entries(items).map(([id, data]) => {
    const selected = (currentValue === id) ? 'selected' : '';
    return `<option value="${id}" ${selected}>${data.name || data}</option>`;
  }).join('');
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <select class="form-input" id="specials_${key}">
        <option value="">Selecione</option>
        ${options}
      </select>
    </div>
  `;
}

function renderPlayerSelect(label, key, currentValue, players) {
  // Agrupa jogadores por time para facilitar a busca (opcional)
  const options = players.map(p => {
    const team = TEAMS[p.team];
    const teamName = team?.name || p.team;
    const selected = (currentValue === p.id) ? 'selected' : '';
    return `<option value="${p.id}" ${selected}>${p.name} (${teamName})</option>`;
  }).join('');
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <select class="form-input" id="specials_${key}">
        <option value="">Selecione</option>
        ${options}
      </select>
    </div>
  `;
}

function attachSelectListeners() {
  // Pode ser necessário inicializar selects customizados, mas o padrão já funciona
}

async function saveUserSpecials(userId) {
  const picks = {
    champion: document.getElementById('specials_champion')?.value || null,
    topScorer: document.getElementById('specials_topScorer')?.value || null,
    mvp: document.getElementById('specials_mvp')?.value || null,
    revelation: document.getElementById('specials_revelation')?.value || null
  };
  // Validação básica
  if (!picks.champion) { showToast('Selecione um campeão', 'red'); return; }
  if (!picks.topScorer) { showToast('Selecione um artilheiro', 'red'); return; }
  if (!picks.mvp) { showToast('Selecione um craque', 'red'); return; }
  if (!picks.revelation) { showToast('Selecione uma revelação', 'red'); return; }
  await saveSpecialPick(userId, picks);
  renderSpecials(); // recarrega a tela
}

function renderAllPicks(users, picks) {
  if (!users.length) return '<div>Nenhum usuário ainda.</div>';
  
  // Cria arrays para cada categoria
  const championPicks = [];
  const topScorerPicks = [];
  const mvpPicks = [];
  const revelationPicks = [];
  
  for (const user of users) {
    if (user.isHidden) continue;
    const userPicks = picks[user.id] || {};
    if (userPicks.champion) championPicks.push({ name: user.profileName, pick: userPicks.champion });
    if (userPicks.topScorer) topScorerPicks.push({ name: user.profileName, pick: userPicks.topScorer });
    if (userPicks.mvp) mvpPicks.push({ name: user.profileName, pick: userPicks.mvp });
    if (userPicks.revelation) revelationPicks.push({ name: user.profileName, pick: userPicks.revelation });
  }
  
  const renderTable = (title, picksArray, getName) => {
    if (!picksArray.length) return `<div class="rule-item">${title}: Nenhum palpite ainda.</div>`;
    const rows = picksArray.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${getName(p.pick)}</td>
      </tr>
    `).join('');
    return `
      <div style="margin-bottom:24px;">
        <h4 style="font-family:Anton; margin-bottom:8px;">${title}</h4>
        <div class="ranking-wrap">
          <table class="ranking-table">
            <thead><tr><th>Participante</th><th>Palpite</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  };
  
  const getTeamName = (id) => TEAMS[id]?.name || id;
  const getPlayerName = (id) => {
    const p = getPlayer(id);
    return p ? `${p.name} (${TEAMS[p.team]?.name || p.team})` : id;
  };
  
  return `
    <div style="display:flex; flex-wrap:wrap; gap:16px; justify-content:space-between;">
      <div style="flex:1; min-width:200px;">
        ${renderTable('🏆 Campeão', championPicks, getTeamName)}
      </div>
      <div style="flex:1; min-width:200px;">
        ${renderTable('⚽ Artilheiro', topScorerPicks, getPlayerName)}
      </div>
      <div style="flex:1; min-width:200px;">
        ${renderTable('⭐ Craque', mvpPicks, getPlayerName)}
      </div>
      <div style="flex:1; min-width:200px;">
        ${renderTable('🌟 Revelação', revelationPicks, getPlayerName)}
      </div>
    </div>
  `;
}
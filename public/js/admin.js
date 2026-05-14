import { TEAMS } from './data/teams.js';
import { showToast } from './ui.js';
import { getPlayer, getPlayersByTeams } from './exportplayer.js';
import { saveGames, loadGames, loadBets } from './storage.js';
import { GAMES_STATE, setGamesState } from './state.js';
import { formatDate, teamFlagImg } from './utils.js';
import { renderAdminPanel } from './adminPanel.js';

// Array para armazenar eventos temporários por jogo
const tempScorers = {};
const tempAssists = {};
const tempCards = {};
const tempPenaltySaves = {};

export async function renderAdmin() {
  const container = document.getElementById('adminGamesList');
  if (!container) return;
  
  // Verificar se é admin
  if (!window.currentUser?.isAdmin) {
    container.innerHTML = '<div style="text-align:center;padding:60px;">🔒 Acesso restrito</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="admin-tabs" style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--border);">
      <button class="admin-tab-btn active" onclick="showAdminTab('users', this)">👥 Usuários</button>
      <button class="admin-tab-btn" onclick="showAdminTab('games', this)">⚽ Resultados</button>
    </div>
    <div id="adminTabContent"></div>
  `;
  
  // Mostrar aba de usuários por padrão
  const firstButton = container.querySelector('.admin-tab-btn');
  if (firstButton) {
    showAdminTab('users', firstButton);
  }
}

window.showAdminTab = (tab, button) => {
  const content = document.getElementById('adminTabContent');
  if (!content) return;
  
  // Atualizar estilo das abas
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (button) button.classList.add('active');
  
  if (tab === 'users') {
    renderAdminPanel();
  } else if (tab === 'games') {
    renderAdminGames(); // Função original do admin.js para resultados
  }
};

export async function renderAdminGames() {
  const el = document.getElementById('adminTabContent');
  if (!el) return;

  // Garantir que GAMES_STATE está atualizado
  const games = GAMES_STATE.length ? GAMES_STATE : await loadGames();
  if (games.length && !GAMES_STATE.length) setGamesState(games);

  el.innerHTML = GAMES_STATE.map(g => {
    const t1 = TEAMS[g.home], t2 = TEAMS[g.away];
    const r = g.result || {};
    const gamePlayers = getPlayersByTeams(g.home, g.away);
    
    // Inicializar tempScorers para este jogo se não existir
    if (!tempScorers[g.id]) {
      tempScorers[g.id] = r.scorers ? [...r.scorers] : [];
    }
    if (!tempAssists[g.id]) {
      tempAssists[g.id] = (r.events || []).filter(e => e.type === 'assist').map(e => ({ playerId: e.playerId || '', minute: e.minute || '' }));
    }
    if (!tempCards[g.id]) {
      tempCards[g.id] = (r.events || []).filter(e => e.type === 'yellow_card' || e.type === 'red_card')
        .map(e => ({ playerId: e.playerId || '', cardType: e.type, minute: e.minute || '' }));
    }
    if (!tempPenaltySaves[g.id]) {
      tempPenaltySaves[g.id] = (r.events || []).filter(e => e.type === 'penalty_saved')
        .map(e => ({ playerId: e.playerId || '', count: e.value || 1, minute: e.minute || '' }));
    }

    // Lista de goleadores atuais
    const scorersList = tempScorers[g.id] || [];
    const assistsList = tempAssists[g.id] || [];
    const cardsList = tempCards[g.id] || [];
    const penaltyList = tempPenaltySaves[g.id] || [];
    
    return `
      <div class="admin-game-row" id="admin-game-${g.id}">
        <h4>
          ${teamFlagImg(t1, 22)} ${t1?.name} × ${teamFlagImg(t2, 22)} ${t2?.name} — ${formatDate(g.date)} ${g.time}
          <span class="status-badge ${g.status === 'completed' ? 'status-completed' : 'status-upcoming'}" style="margin-left:8px;">
            ${g.status === 'completed' ? 'Finalizado' : 'Aguardando'}
          </span>
        </h4>
        
        <!-- Resultado do jogo -->
        <div class="admin-section">
          <div class="admin-label">Resultado</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <input class="admin-input" type="number" id="homeScore_${g.id}" value="${r.homeScore !== undefined ? r.homeScore : ''}" placeholder="0" min="0" max="99" style="width:70px;">
            <span style="font-size:20px;">:</span>
            <input class="admin-input" type="number" id="awayScore_${g.id}" value="${r.awayScore !== undefined ? r.awayScore : ''}" placeholder="0" min="0" max="99" style="width:70px;">
          </div>
        </div>
        
        <!-- Múltiplos Goleadores -->
        <div class="admin-section">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>⚽ Goleadores (múltiplos)</span>
            <button type="button" class="admin-add-btn" onclick="adminAddScorer('${g.id}')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Goleador
            </button>
          </div>
          <div id="scorers-list-${g.id}" style="margin-top:10px;">
            ${renderScorersList(g.id, scorersList, gamePlayers)}
          </div>
        </div>
        
        <!-- Assistências -->
        <div class="admin-section">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🅰️ Assistências</span>
            <button type="button" class="admin-add-btn" onclick="adminAddAssist('${g.id}')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Assistência
            </button>
          </div>
          <div id="assists-list-${g.id}" style="margin-top:10px;">
            ${renderAssistsList(g.id, assistsList, gamePlayers)}
          </div>
        </div>

        <!-- Cartões -->
        <div class="admin-section">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🟥 Cartões</span>
            <button type="button" class="admin-add-btn" onclick="adminAddCard('${g.id}')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Cartão
            </button>
          </div>
          <div id="cards-list-${g.id}" style="margin-top:10px;">
            ${renderCardsList(g.id, cardsList, gamePlayers)}
          </div>
        </div>

        <!-- Pênaltis defendidos -->
        <div class="admin-section">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🧤 Pênaltis defendidos</span>
            <button type="button" class="admin-add-btn" onclick="adminAddPenaltySave('${g.id}')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Defesa
            </button>
          </div>
          <div id="penalties-list-${g.id}" style="margin-top:10px;">
            ${renderPenaltySavesList(g.id, penaltyList, gamePlayers)}
          </div>
        </div>

        <!-- Craque do Jogo -->
        <div class="admin-section">
          <div class="admin-label">⭐ Craque do Jogo</div>
          <select class="admin-input admin-input-wide" id="craque_${g.id}" style="width:auto;margin-top:6px;">
            <option value="">Nenhum</option>
            ${gamePlayers.map(p => `<option value="${p.id}" ${r.craqueId === p.id ? 'selected' : ''}>${TEAMS[p.team]?.flag} ${p.name}</option>`).join('')}
          </select>
        </div>
        
        <!-- Botão Salvar -->
        <div style="margin-top:20px;">
          <button class="admin-save-btn" onclick="adminSaveGame('${g.id}')">💾 SALVAR TODAS AS INFORMAÇÕES</button>
        </div>
      </div>
      <hr style="margin:20px 0;border-color:var(--border);">
    `;
  }).join('');
}

function renderScorersList(gameId, scorers, gamePlayers) {
  if (!scorers.length) {
    return '<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhum goleador adicionado ainda.</div>';
  }
  
  return scorers.map((scorer, idx) => {
    const player = getPlayer(scorer.playerId);
    const team = player ? TEAMS[player.team] : null;
    return `
      <div class="scorer-item" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;">
        <span style="font-weight:600;min-width:30px;">${idx + 1}º</span>
        <select class="admin-input admin-input-wide" id="scorer_player_${gameId}_${idx}" style="width:180px;">
          <option value="">Selecione</option>
          ${gamePlayers.map(p => `<option value="${p.id}" ${scorer.playerId === p.id ? 'selected' : ''}>${TEAMS[p.team]?.flag} ${p.name}</option>`).join('')}
        </select>
        <input type="number" class="admin-input" id="scorer_goals_${gameId}_${idx}" value="${scorer.goals || 1}" min="1" max="9" style="width:60px;text-align:center;">
        <span>gol(s)</span>
        <button class="admin-remove-btn" onclick="adminRemoveScorer('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
      </div>
    `;
  }).join('');
}

function renderAssistsList(gameId, assists, gamePlayers) {
  if (!assists.length) {
    return '<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhuma assistência adicionada ainda.</div>';
  }

  return assists.map((assist, idx) => `
    <div class="assistance-item" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;">
      <span style="font-weight:600;min-width:30px;">${idx + 1}º</span>
      <select class="admin-input admin-input-wide" id="assist_player_${gameId}_${idx}" style="width:220px;">
        <option value="">Selecione</option>
        ${gamePlayers.map(p => `<option value="${p.id}" ${assist.playerId === p.id ? 'selected' : ''}>${TEAMS[p.team]?.flag} ${p.name}</option>`).join('')}
      </select>
      <button class="admin-remove-btn" onclick="adminRemoveAssist('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
  `).join('');
}

function renderCardsList(gameId, cards, gamePlayers) {
  if (!cards.length) {
    return '<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhum cartão adicionado ainda.</div>';
  }

  return cards.map((card, idx) => `
    <div class="card-item" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;">
      <span style="font-weight:600;min-width:30px;">${idx + 1}º</span>
      <select class="admin-input admin-input-wide" id="card_player_${gameId}_${idx}" style="width:180px;">
        <option value="">Selecione</option>
        ${gamePlayers.map(p => `<option value="${p.id}" ${card.playerId === p.id ? 'selected' : ''}>${TEAMS[p.team]?.flag} ${p.name}</option>`).join('')}
      </select>
      <select class="admin-input" id="card_type_${gameId}_${idx}" style="width:120px;">
        <option value="yellow_card" ${card.cardType === 'yellow_card' ? 'selected' : ''}>Amarelo</option>
        <option value="red_card" ${card.cardType === 'red_card' ? 'selected' : ''}>Vermelho</option>
      </select>
      <button class="admin-remove-btn" onclick="adminRemoveCard('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
  `).join('');
}

function renderPenaltySavesList(gameId, penalties, gamePlayers) {
  if (!penalties.length) {
    return '<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhuma defesa de pênalti adicionada ainda.</div>';
  }

  return penalties.map((item, idx) => `
    <div class="penalty-item" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;">
      <span style="font-weight:600;min-width:30px;">${idx + 1}º</span>
      <select class="admin-input admin-input-wide" id="penalty_player_${gameId}_${idx}" style="width:220px;">
        <option value="">Selecione</option>
        ${gamePlayers.map(p => `<option value="${p.id}" ${item.playerId === p.id ? 'selected' : ''}>${TEAMS[p.team]?.flag} ${p.name}</option>`).join('')}
      </select>
      <input type="number" class="admin-input" id="penalty_count_${gameId}_${idx}" value="${item.count || 1}" min="1" max="10" style="width:60px;text-align:center;">
      <span>defesa(s)</span>
      <button class="admin-remove-btn" onclick="adminRemovePenaltySave('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
  `).join('');
}

window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  renderAdminGames();
};

window.adminRemoveScorer = (gameId, index) => {
  if (tempScorers[gameId]) {
    tempScorers[gameId].splice(index, 1);
    renderAdminGames();
  }
};

window.adminAddAssist = (gameId) => {
  if (!tempAssists[gameId]) tempAssists[gameId] = [];
  tempAssists[gameId].push({ playerId: '', minute: '' });
  renderAdminGames();
};

window.adminRemoveAssist = (gameId, index) => {
  if (tempAssists[gameId]) {
    tempAssists[gameId].splice(index, 1);
    renderAdminGames();
  }
};

window.adminAddCard = (gameId) => {
  if (!tempCards[gameId]) tempCards[gameId] = [];
  tempCards[gameId].push({ playerId: '', cardType: 'yellow_card', minute: '' });
  renderAdminGames();
};

window.adminRemoveCard = (gameId, index) => {
  if (tempCards[gameId]) {
    tempCards[gameId].splice(index, 1);
    renderAdminGames();
  }
};

window.adminAddPenaltySave = (gameId) => {
  if (!tempPenaltySaves[gameId]) tempPenaltySaves[gameId] = [];
  tempPenaltySaves[gameId].push({ playerId: '', count: 1, minute: '' });
  renderAdminGames();
};

window.adminRemovePenaltySave = (gameId, index) => {
  if (tempPenaltySaves[gameId]) {
    tempPenaltySaves[gameId].splice(index, 1);
    renderAdminGames();
  }
};

window.adminSaveGame = async (gameId) => {
  const idx = GAMES_STATE.findIndex(g => g.id === gameId);
  if (idx === -1) return;
  
  // Pegar placar
  const homeScore = parseInt(document.getElementById(`homeScore_${gameId}`)?.value);
  const awayScore = parseInt(document.getElementById(`awayScore_${gameId}`)?.value);
  
  if (isNaN(homeScore) || isNaN(awayScore)) {
    showToast('Informe o placar do resultado.', 'red');
    return;
  }
  
  // Pegar craque do jogo
  const craqueId = document.getElementById(`craque_${gameId}`)?.value || null;
  
  // Pegar todos os goleadores - capturar valores atuais do DOM
  const scorersList = tempScorers[gameId] || [];
  const updatedScorers = [];
  for (let i = 0; i < scorersList.length; i++) {
    const playerId = document.getElementById(`scorer_player_${gameId}_${i}`)?.value;
    const goals = parseInt(document.getElementById(`scorer_goals_${gameId}_${i}`)?.value);
    if (playerId && playerId !== '') {
      updatedScorers.push({ playerId, goals: goals || 1 });
    }
  }

  const updatedAssists = [];
  const assistsList = tempAssists[gameId] || [];
  for (let i = 0; i < assistsList.length; i++) {
    const playerId = document.getElementById(`assist_player_${gameId}_${i}`)?.value;
    if (playerId && playerId !== '') {
      updatedAssists.push({ type: 'assist', playerId, playerName: getPlayer(playerId)?.name || '', minute: null });
    }
  }

  const updatedCards = [];
  const cardsList = tempCards[gameId] || [];
  for (let i = 0; i < cardsList.length; i++) {
    const playerId = document.getElementById(`card_player_${gameId}_${i}`)?.value;
    const cardType = document.getElementById(`card_type_${gameId}_${i}`)?.value;
    if (playerId && playerId !== '') {
      updatedCards.push({ type: cardType || 'yellow_card', playerId, playerName: getPlayer(playerId)?.name || '', minute: null });
    }
  }

  const updatedPenaltySaves = [];
  const penaltyList = tempPenaltySaves[gameId] || [];
  for (let i = 0; i < penaltyList.length; i++) {
    const playerId = document.getElementById(`penalty_player_${gameId}_${i}`)?.value;
    const count = parseInt(document.getElementById(`penalty_count_${gameId}_${i}`)?.value);
    if (playerId && playerId !== '' && count > 0) {
      updatedPenaltySaves.push({ type: 'penalty_saved', playerId, playerName: getPlayer(playerId)?.name || '', minute: null, value: count });
    }
  }

  const prevResult = GAMES_STATE[idx].result || {};
  GAMES_STATE[idx].status = 'completed';
  GAMES_STATE[idx].result = {
    ...prevResult,
    homeScore,
    awayScore,
    scorers: updatedScorers,
    events: [...updatedAssists, ...updatedCards, ...updatedPenaltySaves],
    craqueId: craqueId || null
  };

  // Salvar no localStorage via API
  await saveGames(GAMES_STATE);
  
  showToast('Resultado salvo com sucesso! ✅', 'green');
  renderAdminGames(); // ← mudou para renderAdminGames
};

// Exportar função principal
export function renderAdminPage() {
  renderAdmin();
}
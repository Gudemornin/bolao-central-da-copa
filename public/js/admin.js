import { TEAMS } from './data/teams.js';
import { showToast } from './ui.js';
import { getPlayer, getPlayersByTeams, filterPlayers} from './exportplayer.js';
import { saveGames, loadGames, loadBets } from './storage.js';
import { GAMES_STATE, setGamesState } from './state.js';
import { formatDate, teamFlagImg } from './utils.js';
import { renderAdminPanel } from './adminPanel.js';

// Array para armazenar goleadores temporariamente (por jogo)
const tempScorers = {};
const tempEvents = {};

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
    if (!tempEvents[g.id]) {
      tempEvents[g.id] = r.events ? [...r.events] : [];
    }
    
    // Lista de goleadores atuais
    const scorersList = tempScorers[g.id] || [];
    
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

        <!-- Eventos do Jogo -->
        <div class="admin-section">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🅰️ Assistências</span>
            <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','assist')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Assistência
            </button>
          </div>
          <div id="event_section_assist_${g.id}" style="margin-top:10px;">
            ${renderEventSection(g.id, 'assist', 'Assistência', gamePlayers)}
          </div>
        </div>

        <div class="admin-section" style="margin-top:14px;">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🟨 Cartões Amarelos</span>
            <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','yellow_card')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Cartão
            </button>
          </div>
          <div id="event_section_yellow_card_${g.id}" style="margin-top:10px;">
            ${renderEventSection(g.id, 'yellow_card', 'Cartão Amarelo', gamePlayers)}
          </div>
        </div>

        <div class="admin-section" style="margin-top:14px;">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🟥 Cartões Vermelhos</span>
            <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','red_card')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Cartão
            </button>
          </div>
          <div id="event_section_red_card_${g.id}" style="margin-top:10px;">
            ${renderEventSection(g.id, 'red_card', 'Cartão Vermelho', gamePlayers)}
          </div>
        </div>

        <div class="admin-section" style="margin-top:14px;">
          <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🧤 Pênaltis Defendidos</span>
            <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','penalty_saved')" style="background:var(--green);padding:4px 10px;font-size:11px;">
              + Adicionar Defesa
            </button>
          </div>
          <div id="event_section_penalty_saved_${g.id}" style="margin-top:10px;">
            ${renderEventSection(g.id, 'penalty_saved', 'Penalti Defendido', gamePlayers, true)}
          </div>
        </div>

        <!-- Craque do Jogo -->
        <div class="admin-section">
          <div class="admin-label">⭐ Craque do Jogo</div>
          <select class="admin-input admin-input-wide" id="craque_${g.id}" style="width:auto;margin-top:6px;">
            <option value="">Nenhum</option>
            ${gamePlayers.map(p => `<option value="${p.id}" ${r.craqueId === p.id ? 'selected' : ''}>${p.name} (${TEAMS[p.team]?.name || p.team})</option>`).join('')}
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

function renderPlayerSearchControl(gameId, itemType, idx, selectedPlayerId, gamePlayers, onlyGoalkeepers = false) {
  const player = selectedPlayerId ? getPlayer(selectedPlayerId) : null;
  const placeholderLabel = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  const selectedValue = player ? player.name : '';

  return `
    <div class="player-search-wrapper" style="position:relative;width:100%;">
      <input
        type="text"
        class="admin-input player-search-input"
        id="player_search_${gameId}_${itemType}_${idx}"
        placeholder="Buscar jogador..."
        autocomplete="off"
        value="${selectedValue}"
        oninput="filterAdminPlayers('${gameId}','${itemType}',${idx}, ${onlyGoalkeepers})"
        onfocus="showAdminPlayerResults('${gameId}','${itemType}',${idx}, ${onlyGoalkeepers})"
        style="width:100%;"
      />
      <input type="hidden" id="player_selected_${gameId}_${itemType}_${idx}" value="${selectedPlayerId || ''}" />
      <div class="player-search-results" id="player_results_${gameId}_${itemType}_${idx}" style="position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--bg);border:1px solid var(--border);border-top:none;max-height:220px;overflow:auto;"></div>
    </div>
  `;
}

function renderScorersList(gameId, scorers, gamePlayers) {
  if (!scorers.length) {
    return '<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhum goleador adicionado ainda.</div>';
  }
  
  return scorers.map((scorer, idx) => {
    return `
      <div class="scorer-item" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;">
        <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
        <div style="flex:1;min-width:220px;">
          ${renderPlayerSearchControl(gameId, 'scorer', idx, scorer.playerId, gamePlayers, false)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" class="admin-input" id="scorer_goals_${gameId}_${idx}" value="${scorer.goals || 1}" min="1" max="9" style="width:60px;text-align:center;">
          <span style="white-space:nowrap;">gol(s)</span>
          <button class="admin-remove-btn" onclick="adminRemoveScorer('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function getTypeEvents(gameId, type) {
  return (tempEvents[gameId] || []).filter(event => event.type === type);
}

function renderEventSection(gameId, eventType, label, gamePlayers, onlyGoalkeepers = false) {
  const events = getTypeEvents(gameId, eventType);
  if (!events.length) {
    return `<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhum ${label.toLowerCase()} adicionado ainda.</div>`;
  }

  return events.map((event, idx) => {
    return `
      <div class="event-item" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;">
        <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
        <div style="flex:1;min-width:220px;">
          ${renderPlayerSearchControl(gameId, `${eventType}`, idx, event.playerId, gamePlayers, onlyGoalkeepers)}
        </div>
        <button class="admin-remove-btn" onclick="adminRemoveEvent('${gameId}', '${eventType}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
      </div>
    `;
  }).join('');
}

window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  renderAdminGames();
};

window.adminAddEvent = (gameId, eventType) => {
  if (!tempEvents[gameId]) tempEvents[gameId] = [];
  tempEvents[gameId].push({ type: eventType, playerId: '' });
  renderAdminGames();
};

window.adminRemoveScorer = (gameId, index) => {
  if (tempScorers[gameId]) {
    tempScorers[gameId].splice(index, 1);
    renderAdminGames();
  }
};

window.adminRemoveEvent = (gameId, eventType, index) => {
  if (!tempEvents[gameId]) return;
  let currentIndex = -1;
  tempEvents[gameId] = tempEvents[gameId].filter(event => {
    if (event.type !== eventType) return true;
    currentIndex += 1;
    return currentIndex !== index;
  });
  renderAdminGames();
};

function normalizeBoolean(value) {
  return value === true || value === 'true';
}

window.filterAdminPlayers = (gameId, itemType, idx, onlyGoalkeepers) => {
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) return;
  const input = document.getElementById(`player_search_${gameId}_${itemType}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  if (!input || !results) return;

  const q = input.value;
  let players = filterPlayers(q, [game.home, game.away]);
  if (normalizeBoolean(onlyGoalkeepers)) {
    players = players.filter(p => p.pos === 'GOL');
  }

  results.innerHTML = players.map(p => `
    <div class="player-search-item" onclick="selectAdminPlayer('${gameId}','${itemType}',${idx},'${p.id}')" style="padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.08);">
      <span>${p.name} (${TEAMS[p.team]?.name || p.team})</span>
      <span style="opacity:.7;font-size:12px;">${p.pos}</span>
    </div>
  `).join('') || '<div style="padding:8px 12px;font-size:12px;color:var(--text-d);">Nenhum resultado</div>';
  results.style.display = 'block';
};

window.showAdminPlayerResults = (gameId, itemType, idx, onlyGoalkeepers) => {
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  if (!results) return;
  results.style.display = 'block';
  filterAdminPlayers(gameId, itemType, idx, onlyGoalkeepers);
};

window.selectAdminPlayer = (gameId, itemType, idx, playerId) => {
  const input = document.getElementById(`player_search_${gameId}_${itemType}_${idx}`);
  const hidden = document.getElementById(`player_selected_${gameId}_${itemType}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  const player = getPlayer(playerId);
  if (input) input.value = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  if (hidden) hidden.value = playerId;
  if (results) results.style.display = 'none';
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
    const playerId = document.getElementById(`player_selected_${gameId}_scorer_${i}`)?.value;
    const goals = parseInt(document.getElementById(`scorer_goals_${gameId}_${i}`)?.value);
    if (playerId && playerId !== '') {
      updatedScorers.push({ playerId, goals: goals || 1 });
    }
  }

  const updatedEvents = [];
  const eventList = tempEvents[gameId] || [];
  for (let i = 0; i < eventList.length; i++) {
    const event = eventList[i];
    const playerId = document.getElementById(`player_selected_${gameId}_${event.type}_${i}`)?.value;
    if (!playerId) continue;
    const player = getPlayer(playerId);
    if (!player) continue;
    updatedEvents.push({
      type: event.type,
      playerId,
      playerName: player.name,
      team: player.team
    });
  }
  
function createScorerItem(gameId, idx, scorer = { playerId: '', goals: 1 }) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = getPlayersByTeams(game.home, game.away);
  const div = document.createElement('div');
  div.className = 'scorer-item';
  div.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;';
  div.innerHTML = `
    <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
    <div style="flex:1;min-width:220px;">
      ${renderPlayerSearchControl(gameId, 'scorer', idx, scorer.playerId, gamePlayers, false)}
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="number" class="admin-input" id="scorer_goals_${gameId}_${idx}" value="${scorer.goals || 1}" min="1" max="9" style="width:60px;text-align:center;">
      <span style="white-space:nowrap;">gol(s)</span>
      <button class="admin-remove-btn" onclick="adminRemoveScorer('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
  `;
  return div;
}

function createEventItem(gameId, eventType, idx, event = { playerId: '' }) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = getPlayersByTeams(game.home, game.away);
  const onlyGoalkeepers = (eventType === 'penalty_saved');
  const div = document.createElement('div');
  div.className = 'event-item';
  div.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;';
  div.innerHTML = `
    <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
    <div style="flex:1;min-width:220px;">
      ${renderPlayerSearchControl(gameId, eventType, idx, event.playerId, gamePlayers, onlyGoalkeepers)}
    </div>
    <button class="admin-remove-btn" onclick="adminRemoveEvent('${gameId}', '${eventType}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
  `;
  return div;
}

window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  const newIdx = tempScorers[gameId].length;
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (container) {
    const newItem = createScorerItem(gameId, newIdx, { playerId: '', goals: 1 });
    container.appendChild(newItem);
    // Atualizar o número da posição de todos os itens (opcional, mas mantém a contagem)
    const items = container.querySelectorAll('.scorer-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

window.adminRemoveScorer = (gameId, index) => {
  if (!tempScorers[gameId]) return;
  tempScorers[gameId].splice(index, 1);
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (container) {
    // Remover o elemento visual correspondente
    const items = container.querySelectorAll('.scorer-item');
    if (items[index]) items[index].remove();
    // Renumerar os restantes
    const remaining = container.querySelectorAll('.scorer-item');
    remaining.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
      // Atualizar o id do input de gols e os event listeners (se necessário)
      const goalsInput = item.querySelector(`input[id^="scorer_goals_${gameId}_"]`);
      if (goalsInput) {
        const oldId = goalsInput.id;
        const newId = `scorer_goals_${gameId}_${i}`;
        goalsInput.id = newId;
      }
      // Atualizar os campos de busca (player_search)
      const searchDiv = item.querySelector('.player-search-wrapper');
      if (searchDiv) {
        const searchInput = searchDiv.querySelector('input[type="text"]');
        const hiddenInput = searchDiv.querySelector('input[type="hidden"]');
        if (searchInput) {
          const oldId = searchInput.id;
          const newId = `player_search_${gameId}_scorer_${i}`;
          searchInput.id = newId;
          searchInput.setAttribute('oninput', `filterAdminPlayers('${gameId}','scorer',${i}, false)`);
          searchInput.setAttribute('onfocus', `showAdminPlayerResults('${gameId}','scorer',${i}, false)`);
        }
        if (hiddenInput) {
          hiddenInput.id = `player_selected_${gameId}_scorer_${i}`;
        }
        const resultsDiv = searchDiv.querySelector('.player-search-results');
        if (resultsDiv) {
          resultsDiv.id = `player_results_${gameId}_scorer_${i}`;
        }
      }
    });
  }
};

window.adminAddEvent = (gameId, eventType) => {
  if (!tempEvents[gameId]) tempEvents[gameId] = [];
  const newIdx = tempEvents[gameId].filter(e => e.type === eventType).length;
  tempEvents[gameId].push({ type: eventType, playerId: '' });
  const container = document.getElementById(`event_section_${eventType}_${gameId}`);
  if (container) {
    const newItem = createEventItem(gameId, eventType, newIdx, { playerId: '' });
    container.appendChild(newItem);
    // Renumerar os itens do mesmo tipo
    const items = container.querySelectorAll('.event-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

window.adminRemoveEvent = (gameId, eventType, index) => {
  if (!tempEvents[gameId]) return;
  // Remover do array temporário
  let filtered = [];
  let currentIndex = -1;
  for (const ev of tempEvents[gameId]) {
    if (ev.type === eventType) {
      currentIndex++;
      if (currentIndex !== index) filtered.push(ev);
    } else {
      filtered.push(ev);
    }
  }
  tempEvents[gameId] = filtered;
  // Remover do DOM
  const container = document.getElementById(`event_section_${eventType}_${gameId}`);
  if (container) {
    const items = container.querySelectorAll('.event-item');
    if (items[index]) items[index].remove();
    // Renumerar os restantes
    const remaining = container.querySelectorAll('.event-item');
    remaining.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
      // Atualizar IDs dos campos
      const searchDiv = item.querySelector('.player-search-wrapper');
      if (searchDiv) {
        const searchInput = searchDiv.querySelector('input[type="text"]');
        const hiddenInput = searchDiv.querySelector('input[type="hidden"]');
        if (searchInput) {
          const oldId = searchInput.id;
          const newId = `player_search_${gameId}_${eventType}_${i}`;
          searchInput.id = newId;
          searchInput.setAttribute('oninput', `filterAdminPlayers('${gameId}','${eventType}',${i}, ${eventType === 'penalty_saved'})`);
          searchInput.setAttribute('onfocus', `showAdminPlayerResults('${gameId}','${eventType}',${i}, ${eventType === 'penalty_saved'})`);
        }
        if (hiddenInput) hiddenInput.id = `player_selected_${gameId}_${eventType}_${i}`;
        const resultsDiv = searchDiv.querySelector('.player-search-results');
        if (resultsDiv) resultsDiv.id = `player_results_${gameId}_${eventType}_${i}`;
      }
    });
  }
};

  // Atualizar GAMES_STATE
  GAMES_STATE[idx].status = 'completed';
  GAMES_STATE[idx].result = {
    homeScore,
    awayScore,
    scorers: updatedScorers,
    craqueId: craqueId || null,
    events: updatedEvents
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

window.filterPlayers = filterPlayers;
window.getPlayer = getPlayer;
window.getPlayersByTeams = getPlayersByTeams;
window.TEAMS = TEAMS;
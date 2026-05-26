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

  // 🔥 CORREÇÃO: Carregar games ANTES de usá-lo
  const games = GAMES_STATE.length ? GAMES_STATE : await loadGames();
  if (games.length && !GAMES_STATE.length) setGamesState(games);

  // Agora podemos usar games com segurança
  // Agrupar jogos por data
  const gamesByDate = {};
  games.forEach(game => {
    if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
    gamesByDate[game.date].push(game);
  });

  const sortedDates = Object.keys(gamesByDate).sort();

  let html = `
    <div class="admin-date-filter" style="margin-bottom:20px;">
      <label class="form-label">Filtrar por data:</label>
      <select id="adminDateFilter" class="form-input" style="width:auto;display:inline-block;margin-left:10px;">
        <option value="all">Todas as datas</option>
        ${sortedDates.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
    </div>
    <div id="adminGamesContainer"></div>
  `;
  el.innerHTML = html;

  const renderGamesByDate = (selectedDate) => {
    const container = document.getElementById('adminGamesContainer');
    const gamesToShow = selectedDate === 'all' ? games : games.filter(g => g.date === selectedDate);
    
    // Gera o HTML dos cards usando os dados de gamesToShow
    container.innerHTML = gamesToShow.map(g => {
      const t1 = TEAMS[g.home], t2 = TEAMS[g.away];
      const r = g.result || {};
      const gamePlayers = getPlayersByTeams(g.home, g.away);
      
      // Inicializar tempScorers e tempEvents se necessário
      if (!tempScorers[g.id]) tempScorers[g.id] = r.scorers ? [...r.scorers] : [];
      if (!tempEvents[g.id]) tempEvents[g.id] = r.events ? [...r.events] : [];
      
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
    
    // Reatribuir eventos após renderização (se necessário)
    document.querySelectorAll('.admin-remove-btn, .admin-add-btn, .admin-save-btn').forEach(btn => {
      const onclickAttr = btn.getAttribute('onclick');
      if (onclickAttr) {
        const funcName = onclickAttr.split('(')[0];
        if (window[funcName]) btn.onclick = window[funcName].bind(null, ...onclickAttr.match(/'(.*?)'/g)?.map(s => s.replace(/'/g, '')) || []);
      }
    });
  };
  
  const dateFilter = document.getElementById('adminDateFilter');
  if (dateFilter) {
    dateFilter.addEventListener('change', (e) => {
      renderGamesByDate(e.target.value);
    });
  }
  
  renderGamesByDate('all');
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

export function filterAdminPlayers(gameId, itemType, idx, onlyGoalkeepers) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) {
    console.warn(`Jogo ${gameId} não encontrado em GAMES_STATE`);
    return;
  }
  const input = document.getElementById(`player_search_${gameId}_${itemType}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  if (!input || !results) return;

  const q = input.value.trim();
  if (!q) {
    results.style.display = 'none';
    return;
  }

  let players = filterPlayers(q, [game.home, game.away]);
  if (onlyGoalkeepers === true || onlyGoalkeepers === 'true') {
    players = players.filter(p => p.pos === 'GOL');
  }

  results.innerHTML = players.map(p => `
    <div class="player-search-item" onclick="selectAdminPlayer('${gameId}','${itemType}',${idx},'${p.id}')" style="padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);">
      <span>${p.name} (${TEAMS[p.team]?.name || p.team})</span>
      <span style="opacity:0.7;">${p.pos}</span>
    </div>
  `).join('') || '<div style="padding:8px 12px;">Nenhum jogador encontrado</div>';

  results.style.display = 'block';
}

export function showAdminPlayerResults(gameId, itemType, idx, onlyGoalkeepers) {
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  if (!results) return;
  results.style.display = 'block';
  filterAdminPlayers(gameId, itemType, idx, onlyGoalkeepers);
}

export function selectAdminPlayer(gameId, itemType, idx, playerId) {
  const input = document.getElementById(`player_search_${gameId}_${itemType}_${idx}`);
  const hidden = document.getElementById(`player_selected_${gameId}_${itemType}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  const player = getPlayer(playerId);
  if (input) input.value = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  if (hidden) hidden.value = playerId;
  if (results) results.style.display = 'none';
}

// Expor globalmente (para os eventos inline)
window.filterAdminPlayers = filterAdminPlayers;
window.showAdminPlayerResults = showAdminPlayerResults;
window.selectAdminPlayer = selectAdminPlayer;

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
    // Atualizar os números de todos os itens
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
    const items = container.querySelectorAll('.scorer-item');
    if (items[index]) items[index].remove();
    // Renumerar e atualizar IDs
    const remaining = container.querySelectorAll('.scorer-item');
    remaining.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
      // Atualizar IDs dos inputs de gol
      const goalsInput = item.querySelector(`input[id^="scorer_goals_${gameId}_"]`);
      if (goalsInput) goalsInput.id = `scorer_goals_${gameId}_${i}`;
      // Atualizar IDs dos campos de busca
      const searchDiv = item.querySelector('.player-search-wrapper');
      if (searchDiv) {
        const searchInput = searchDiv.querySelector('input[type="text"]');
        const hiddenInput = searchDiv.querySelector('input[type="hidden"]');
        if (searchInput) {
          searchInput.id = `player_search_${gameId}_scorer_${i}`;
          searchInput.setAttribute('oninput', `filterAdminPlayers('${gameId}','scorer',${i}, false)`);
          searchInput.setAttribute('onfocus', `showAdminPlayerResults('${gameId}','scorer',${i}, false)`);
        }
        if (hiddenInput) hiddenInput.id = `player_selected_${gameId}_scorer_${i}`;
        const resultsDiv = searchDiv.querySelector('.player-search-results');
        if (resultsDiv) resultsDiv.id = `player_results_${gameId}_scorer_${i}`;
      }
    });
  }
};

window.adminAddEvent = (gameId, eventType) => {
  if (!tempEvents[gameId]) tempEvents[gameId] = [];
  const currentOfType = tempEvents[gameId].filter(e => e.type === eventType).length;
  tempEvents[gameId].push({ type: eventType, playerId: '' });
  const container = document.getElementById(`event_section_${eventType}_${gameId}`);
  if (container) {
    const newItem = createEventItem(gameId, eventType, currentOfType, { playerId: '' });
    container.appendChild(newItem);
    // Renumerar
    const items = container.querySelectorAll('.event-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

window.adminRemoveEvent = (gameId, eventType, index) => {
  if (!tempEvents[gameId]) return;
  // Remover do array
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
    const remaining = container.querySelectorAll('.event-item');
    remaining.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
      // Atualizar IDs
      const searchDiv = item.querySelector('.player-search-wrapper');
      if (searchDiv) {
        const searchInput = searchDiv.querySelector('input[type="text"]');
        const hiddenInput = searchDiv.querySelector('input[type="hidden"]');
        if (searchInput) {
          searchInput.id = `player_search_${gameId}_${eventType}_${i}`;
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

window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  const newIdx = tempScorers[gameId].length;
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (container) {
    const newItem = createScorerItem(gameId, newIdx, { playerId: '', goals: 1 });
    container.appendChild(newItem);
    // renumera
    const items = container.querySelectorAll('.scorer-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

async function adminSaveGame(gameId) {
  console.log('🔍 Salvando jogo:', gameId);
  
  const idx = GAMES_STATE.findIndex(g => g.id === gameId);
  if (idx === -1) {
    console.error('Jogo não encontrado em GAMES_STATE');
    showToast('Erro: jogo não encontrado', 'red');
    return;
  }

  // Pegar placar
  const homeScoreInput = document.getElementById(`homeScore_${gameId}`);
  const awayScoreInput = document.getElementById(`awayScore_${gameId}`);
  
  if (!homeScoreInput || !awayScoreInput) {
    console.error('Campos de placar não encontrados');
    showToast('Erro: campos de placar não encontrados', 'red');
    return;
  }

  const homeScore = parseInt(homeScoreInput.value);
  const awayScore = parseInt(awayScoreInput.value);
  
  if (isNaN(homeScore) || isNaN(awayScore)) {
    showToast('Informe o placar do resultado.', 'red');
    return;
  }

  // Pegar craque do jogo
  const craqueSelect = document.getElementById(`craque_${gameId}`);
  const craqueId = craqueSelect ? craqueSelect.value : null;

  // Coletar goleadores
  const scorersList = tempScorers[gameId] || [];
  const updatedScorers = [];
  for (let i = 0; i < scorersList.length; i++) {
    const playerIdField = document.getElementById(`player_selected_${gameId}_scorer_${i}`);
    const goalsField = document.getElementById(`scorer_goals_${gameId}_${i}`);
    if (playerIdField && playerIdField.value) {
      const goals = goalsField ? parseInt(goalsField.value) : 1;
      updatedScorers.push({ playerId: playerIdField.value, goals: isNaN(goals) ? 1 : goals });
    }
  }

  // Coletar eventos (assistências, cartões, pênaltis)
  const updatedEvents = [];
  const eventList = tempEvents[gameId] || [];
  for (let i = 0; i < eventList.length; i++) {
    const event = eventList[i];
    const playerIdField = document.getElementById(`player_selected_${gameId}_${event.type}_${i}`);
    if (playerIdField && playerIdField.value) {
      const player = getPlayer(playerIdField.value);
      if (player) {
        updatedEvents.push({
          type: event.type,
          playerId: player.id,
          playerName: player.name,
          team: player.team
        });
      }
    }

    await saveGames(GAMES_STATE);
showToast('Resultado salvo com sucesso! ✅', 'green');
renderAdminGames();

// Força atualização do ranking se estiver visível
if (document.getElementById('tabRanking').classList.contains('active')) {
  if (typeof renderRanking === 'function') await renderRanking();
}
  }

  // Atualizar GAMES_STATE
  GAMES_STATE[idx].status = 'completed';
  GAMES_STATE[idx].result = {
    homeScore,
    awayScore,
    scorers: updatedScorers,
    craqueId: craqueId || null,
    events: updatedEvents
  };

  try {
    await saveGames(GAMES_STATE);
    showToast('Resultado salvo com sucesso! ✅', 'green');
    // Recarregar a interface de admin para refletir os dados salvos
    renderAdminGames();
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showToast('Erro ao salvar: ' + error.message, 'red');
  }
}

// Exportar função principal
export function renderAdminPage() {
  renderAdmin();
}

window.adminSaveGame           = adminSaveGame;
window.adminAddScorer          = adminAddScorer;
window.adminRemoveScorer       = adminRemoveScorer;
window.adminAddEvent           = adminAddEvent;
window.adminRemoveEvent        = adminRemoveEvent;
window.filterAdminPlayers      = filterAdminPlayers;
window.showAdminPlayerResults  = showAdminPlayerResults;
window.selectAdminPlayer       = selectAdminPlayer;
window.showAdminTab            = showAdminTab; 

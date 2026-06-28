// admin.js
import { TEAMS } from './data/teams.js';
import { showToast } from './ui.js';
import { getPlayer, getPlayersByTeams, filterPlayers } from './exportplayer.js';
import { saveGames, loadGames } from './storage.js';
import { GAMES_STATE, setGamesState } from './state.js';
import { formatDate, teamFlagImg } from './utils.js';
import { renderAdminPanel } from './adminPanel.js';

// Arrays temporários para cada jogo (não salvos até clicar em SALVAR)
let tempScorers = {};
let tempAssists = {};
let tempRedCards = {};

// =============================================
// RENDERIZAÇÃO PRINCIPAL (Admin -> Resultados)
// =============================================
export async function renderAdminGames() {
  const el = document.getElementById('adminTabContent');
  if (!el) {
    console.error('Elemento adminTabContent não encontrado');
    return;
  }

  // Carregar jogos do estado ou do backend
  let games = GAMES_STATE;
  if (!games || !games.length) {
    games = await loadGames();
    if (games && games.length) setGamesState(games);
  }

  if (!games || !games.length) {
    el.innerHTML = '<div class="empty-state">Nenhum jogo cadastrado ainda.</div>';
    return;
  }

  // Agrupar por data para filtro
  const gamesByDate = {};
  games.forEach(game => {
    if (!game.date) return;
    if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
    gamesByDate[game.date].push(game);
  });
  const sortedDates = Object.keys(gamesByDate).sort();

  // Montar HTML do filtro + container
  el.innerHTML = `
    <div class="admin-date-filter" style="margin-bottom:20px;">
      <label class="form-label">Filtrar por data:</label>
      <select id="adminDateFilter" class="form-input" style="width:auto;display:inline-block;margin-left:10px;">
        <option value="all">Todas as datas</option>
        ${sortedDates.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
    </div>
    <div id="adminGamesContainer"></div>
  `;

  // Função para renderizar os cards de acordo com a data selecionada
  const renderGamesByDate = (selectedDate) => {
    const container = document.getElementById('adminGamesContainer');
    const gamesToShow = selectedDate === 'all' ? games : games.filter(g => g.date === selectedDate);
    if (!gamesToShow.length) {
      container.innerHTML = '<div class="empty-state">Nenhum jogo nesta data.</div>';
      return;
    }

    // Inicializa arrays temporários para cada jogo (se não existirem)
    for (const game of gamesToShow) {
      const result = game.result || {};
      if (!tempScorers[game.id]) tempScorers[game.id] = result.scorers ? [...result.scorers] : [];
      if (!tempAssists[game.id]) tempAssists[game.id] = result.assists ? [...result.assists] : [];
      if (!tempRedCards[game.id]) tempRedCards[game.id] = result.redCards ? [...result.redCards] : [];
    }

    container.innerHTML = gamesToShow.map(game => renderAdminGameCard(game)).join('');

    document.querySelectorAll('.admin-game-row').forEach(row => {
      const gameId = row.id.replace('admin-game-', '');
      const homeInput = document.getElementById(`homeScore_${gameId}`);
      const awayInput = document.getElementById(`awayScore_${gameId}`);
      const penaltyArea = document.getElementById(`admin_penalty_area_${gameId}`);
      const overtimeCheck = document.getElementById(`overtime_${gameId}`);

      if (homeInput && awayInput && penaltyArea) {
        const updatePenaltyVisibility = () => {
          const h = parseInt(homeInput.value) || 0;
          const a = parseInt(awayInput.value) || 0;
          // Mostra apenas se houver valor em ambos os campos e forem iguais
          const show = homeInput.value !== '' && awayInput.value !== '' && h === a;
          penaltyArea.style.display = show ? 'inline-block' : 'none';
        };
        homeInput.addEventListener('input', updatePenaltyVisibility);
        awayInput.addEventListener('input', updatePenaltyVisibility);
        // Executa uma vez para sincronizar o estado inicial (caso o placar já esteja preenchido)
        updatePenaltyVisibility();
      }
    });

    // Reatribui eventos dos botões dinâmicos (necessário porque o innerHTML os remove)
    document.querySelectorAll('.admin-remove-btn, .admin-add-btn, .admin-save-btn').forEach(btn => {
      const onclickAttr = btn.getAttribute('onclick');
      if (onclickAttr) {
        const funcName = onclickAttr.split('(')[0];
        if (window[funcName]) btn.onclick = (e) => window[funcName](...onclickAttr.match(/'(.*?)'|\d+|true|false/g)?.map(v => isNaN(v) ? v.replace(/'/g, '') : Number(v)) || []);
      }
    });
  };

  const dateFilter = document.getElementById('adminDateFilter');
  if (dateFilter) dateFilter.addEventListener('change', (e) => renderGamesByDate(e.target.value));
  renderGamesByDate('all');
}

// =============================================
// CARD DE CADA JOGO (HTML)
// =============================================

function renderAdminGameCard(game) {
  const t1 = TEAMS[game.home];
  const t2 = TEAMS[game.away];
  const isKnockout = game.group === 'knockout';
  const result = game.result || {};
  const gamePlayers = getPlayersByTeams(game.home, game.away);
  const scorers = tempScorers[game.id] || [];
  const assists = tempAssists[game.id] || [];
  const redCards = tempRedCards[game.id] || [];

  // Valores existentes no resultado
  const homeScore = result.homeScore ?? '';
  const awayScore = result.awayScore ?? '';
  const overtime = result.overtime || false;
  const penaltyWinner = result.penaltyWinner || '';

  return `
    <div class="admin-game-row" id="admin-game-${game.id}" style="margin-bottom:24px; background:var(--navy-2); border-radius:16px; padding:16px;">
      <h4 style="margin-bottom:16px;">${teamFlagImg(t1, 24)} ${t1?.name} ✖️ ${teamFlagImg(t2, 24)} ${t2?.name} — ${game.date} ${game.time}</h4>

      <!-- Placar + Knockout extras -->
      <div class="admin-section" style="margin-bottom:16px;">
        <div class="admin-label">RESULTADO</div>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <input class="admin-input" type="number" id="homeScore_${game.id}" value="${homeScore}" placeholder="0" style="width:70px;">
          <span style="font-size:20px;">:</span>
          <input class="admin-input" type="number" id="awayScore_${game.id}" value="${awayScore}" placeholder="0" style="width:70px;">

          ${isKnockout ? `
            <label style="display:flex; align-items:center; gap:6px; margin-left:12px; font-size:13px;">
              <input type="checkbox" id="overtime_${game.id}" ${overtime ? 'checked' : ''}>
              ⏱️ Prorrogação
            </label>
           <div id="admin_penalty_area_${game.id}" style="display:none; margin-left:12px;">
              <label style="font-size:13px;">🏆 Vencedor nos pênaltis:</label>
              <select id="penalty_winner_${game.id}" class="admin-input" style="width:auto;">
                <option value="">--</option>
                <option value="home" ${penaltyWinner === 'home' ? 'selected' : ''}>${t1?.name || 'Casa'}</option>
                <option value="away" ${penaltyWinner === 'away' ? 'selected' : ''}>${t2?.name || 'Visitante'}</option>
              </select>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Goleadores -->
      <div class="admin-section" style="margin-bottom:16px;">
        <div class="admin-label" style="display:flex; justify-content:space-between;">
          <span>⚽ GOLEADORES</span>
          <button type="button" class="admin-add-btn" onclick="adminAddScorer('${game.id}')" style="background:var(--green); padding:4px 12px; border-radius:20px;">+ Adicionar Goleador</button>
        </div>
        <div id="scorers-list-${game.id}" style="margin-top:8px;">
          ${renderScorersList(game.id, scorers, gamePlayers)}
        </div>
      </div>

      <!-- Assistências -->
      <div class="admin-section" style="margin-bottom:16px;">
        <div class="admin-label" style="display:flex; justify-content:space-between;">
          <span>🎯 ASSISTÊNCIAS</span>
          <button type="button" class="admin-add-btn" onclick="adminAddAssist('${game.id}')" style="background:var(--green); padding:4px 12px; border-radius:20px;">+ Adicionar Assistência</button>
        </div>
        <div id="assists-list-${game.id}" style="margin-top:8px;">
          ${renderAssistsList(game.id, assists, gamePlayers)}
        </div>
      </div>

      <!-- Cartões Vermelhos -->
      <div class="admin-section" style="margin-bottom:16px;">
        <div class="admin-label" style="display:flex; justify-content:space-between;">
          <span>🟥 CARTÕES VERMELHOS</span>
          <button type="button" class="admin-add-btn" onclick="adminAddRedCard('${game.id}')" style="background:var(--green); padding:4px 12px; border-radius:20px;">+ Adicionar Expulsão</button>
        </div>
        <div id="redcards-list-${game.id}" style="margin-top:8px;">
          ${renderRedCardsList(game.id, redCards, gamePlayers)}
        </div>
      </div>

      <!-- Craque do Jogo -->
      <div class="admin-section" style="margin-bottom:16px;">
        <div class="admin-label">⭐ CRAQUE DO JOGO</div>
        <select class="admin-input" id="craque_${game.id}" style="width:auto; min-width:200px;">
          <option value="">Nenhum</option>
          ${gamePlayers.map(p => `<option value="${p.id}" ${result.craqueId === p.id ? 'selected' : ''}>${p.name} (${TEAMS[p.team]?.name || p.team})</option>`).join('')}
        </select>
      </div>

      <!-- Botões Salvar / Resetar -->
      <button class="admin-save-btn" onclick="adminSaveGame('${game.id}')" style="background:var(--blue); padding:8px 20px; border-radius:8px; font-weight:bold;">💾 SALVAR TODAS AS INFORMAÇÕES</button>
      <button class="admin-reset-btn" onclick="adminResetGame('${game.id}')" style="background:var(--red); padding:8px 20px; border-radius:8px; font-weight:bold; margin-left:10px;">🔄 Resetar Jogo</button>
    </div>
  `;
}

// =============================================
// RENDERIZAÇÃO DAS LISTAS (Goleadores, Assistências, Cartões)
// =============================================
function renderScorersList(gameId, scorers, gamePlayers) {
  if (!scorers.length) return '<div style="color:var(--text-d); padding:6px 0;">Nenhum goleador adicionado ainda.</div>';
  return scorers.map((scorer, idx) => `
    <div class="scorer-item" style="display:flex; gap:12px; align-items:center; margin-bottom:12px; background:var(--navy-3); padding:8px 12px; border-radius:12px;">
      <span style="font-weight:bold; min-width:30px;">${idx+1}º</span>
      <div style="flex:1; min-width:180px;">
        ${playerSearchControl(gameId, 'scorer', idx, scorer.playerId, gamePlayers, false)}
      </div>
      <input type="number" id="scorer_goals_${gameId}_${idx}" value="${scorer.goals || 1}" min="1" max="9" style="width:70px; text-align:center;" class="admin-input">
      <span>gol(s)</span>
      <button class="admin-remove-btn" onclick="adminRemoveScorer('${gameId}', ${idx})" style="background:var(--red); padding:4px 8px; border-radius:8px;">✕</button>
    </div>
  `).join('');
}

function renderAssistsList(gameId, assists, gamePlayers) {
  if (!assists.length) return '<div style="color:var(--text-d); padding:6px 0;">Nenhuma assistência registrada.</div>';
  return assists.map((assist, idx) => `
    <div class="assist-item" style="display:flex; gap:12px; align-items:center; margin-bottom:12px; background:var(--navy-3); padding:8px 12px; border-radius:12px;">
      <span style="font-weight:bold; min-width:30px;">${idx+1}º</span>
      <div style="flex:1; min-width:180px;">
        ${playerSearchControl(gameId, 'assist', idx, assist.playerId, gamePlayers, false)}
      </div>
      <input type="number" id="assist_count_${gameId}_${idx}" value="${assist.assists || 1}" min="1" max="9" style="width:70px; text-align:center;" class="admin-input">
      <span>assist(s)</span>
      <button class="admin-remove-btn" onclick="adminRemoveAssist('${gameId}', ${idx})" style="background:var(--red); padding:4px 8px; border-radius:8px;">✕</button>
    </div>
  `).join('');
}

function renderRedCardsList(gameId, redCards, gamePlayers) {
  if (!redCards.length) return '<div style="color:var(--text-d); padding:6px 0;">Nenhum cartão vermelho.</div>';
  return redCards.map((card, idx) => `
    <div class="redcard-item" style="display:flex; gap:12px; align-items:center; margin-bottom:12px; background:var(--navy-3); padding:8px 12px; border-radius:12px;">
      <span style="font-weight:bold; min-width:30px;">${idx+1}º</span>
      <div style="flex:1; min-width:180px;">
        ${playerSearchControl(gameId, 'redcard', idx, card.playerId, gamePlayers, false)}
      </div>
      <button class="admin-remove-btn" onclick="adminRemoveRedCard('${gameId}', ${idx})" style="background:var(--red); padding:4px 8px; border-radius:8px;">✕</button>
    </div>
  `).join('');
}

// =============================================
// CONTROLE DE BUSCA DE JOGADOR
// =============================================
function playerSearchControl(gameId, type, idx, selectedPlayerId, gamePlayers, onlyGoalkeepers = false) {
  const player = selectedPlayerId ? getPlayer(selectedPlayerId) : null;
  const displayValue = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  return `
    <div class="player-search-wrapper" style="position:relative;">
      <input type="text" class="admin-input player-search-input" id="player_search_${gameId}_${type}_${idx}"
        placeholder="Buscar jogador..." autocomplete="off" value="${displayValue}"
        oninput="filterAdminPlayers('${gameId}','${type}',${idx}, ${onlyGoalkeepers})"
        onfocus="showAdminPlayerResults('${gameId}','${type}',${idx}, ${onlyGoalkeepers})"
        style="width:100%;">
      <input type="hidden" id="player_selected_${gameId}_${type}_${idx}" value="${selectedPlayerId || ''}">
      <div class="player-search-results" id="player_results_${gameId}_${type}_${idx}" style="position:absolute; top:100%; left:0; right:0; z-index:100; background:var(--navy-3); border:1px solid var(--border); border-radius:8px; max-height:200px; overflow:auto; display:none;"></div>
    </div>
  `;
}

export function filterAdminPlayers(gameId, type, idx, onlyGoalkeepers) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) return;
  const input = document.getElementById(`player_search_${gameId}_${type}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${type}_${idx}`);
  if (!input || !results) return;
  const q = input.value.trim();
  if (!q) {
    results.style.display = 'none';
    return;
  }
  let players = filterPlayers(q, [game.home, game.away]);
  if (onlyGoalkeepers === true || onlyGoalkeepers === 'true') players = players.filter(p => p.pos === 'GOL');
  if (!players.length) {
    results.innerHTML = '<div style="padding:8px 12px;">Nenhum jogador encontrado</div>';
    results.style.display = 'block';
    return;
  }
  results.innerHTML = players.map(p => `
    <div class="player-search-item" onclick="selectAdminPlayer('${gameId}','${type}',${idx},'${p.id}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border);">
      <span>${p.name} (${TEAMS[p.team]?.name || p.team})</span> <span style="font-size:11px; opacity:0.7;">${p.pos}</span>
    </div>
  `).join('');
  results.style.display = 'block';
}
export function showAdminPlayerResults(gameId, type, idx, onlyGoalkeepers) {
  const results = document.getElementById(`player_results_${gameId}_${type}_${idx}`);
  if (results) results.style.display = 'block';
  filterAdminPlayers(gameId, type, idx, onlyGoalkeepers);
}
export function selectAdminPlayer(gameId, type, idx, playerId) {
  const input = document.getElementById(`player_search_${gameId}_${type}_${idx}`);
  const hidden = document.getElementById(`player_selected_${gameId}_${type}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${type}_${idx}`);
  const player = getPlayer(playerId);
  if (input) input.value = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  if (hidden) hidden.value = playerId;
  if (results) results.style.display = 'none';
}

// =============================================
// MANIPULAÇÃO DAS LISTAS TEMPORÁRIAS (Add/Remove)
// =============================================
window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  refreshScorersList(gameId);
};
window.adminRemoveScorer = (gameId, idx) => {
  tempScorers[gameId].splice(idx, 1);
  refreshScorersList(gameId);
};
window.adminAddAssist = (gameId) => {
  if (!tempAssists[gameId]) tempAssists[gameId] = [];
  tempAssists[gameId].push({ playerId: '', assists: 1 });
  refreshAssistsList(gameId);
};
window.adminRemoveAssist = (gameId, idx) => {
  tempAssists[gameId].splice(idx, 1);
  refreshAssistsList(gameId);
};
window.adminAddRedCard = (gameId) => {
  if (!tempRedCards[gameId]) tempRedCards[gameId] = [];
  tempRedCards[gameId].push({ playerId: '' });
  refreshRedCardsList(gameId);
};
window.adminRemoveRedCard = (gameId, idx) => {
  tempRedCards[gameId].splice(idx, 1);
  refreshRedCardsList(gameId);
};

function refreshScorersList(gameId) {
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (!container) return;
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = game ? getPlayersByTeams(game.home, game.away) : [];
  container.innerHTML = renderScorersList(gameId, tempScorers[gameId] || [], gamePlayers);
  // Re-ligar eventos dos botões de remoção (já que o DOM foi recriado)
  document.querySelectorAll(`#scorers-list-${gameId} .admin-remove-btn`).forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) btn.onclick = new Function('event', onclickAttr);
  });
}
function refreshAssistsList(gameId) {
  const container = document.getElementById(`assists-list-${gameId}`);
  if (!container) return;
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = game ? getPlayersByTeams(game.home, game.away) : [];
  container.innerHTML = renderAssistsList(gameId, tempAssists[gameId] || [], gamePlayers);
  document.querySelectorAll(`#assists-list-${gameId} .admin-remove-btn`).forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) btn.onclick = new Function('event', onclickAttr);
  });
}
function refreshRedCardsList(gameId) {
  const container = document.getElementById(`redcards-list-${gameId}`);
  if (!container) return;
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = game ? getPlayersByTeams(game.home, game.away) : [];
  container.innerHTML = renderRedCardsList(gameId, tempRedCards[gameId] || [], gamePlayers);
  document.querySelectorAll(`#redcards-list-${gameId} .admin-remove-btn`).forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) btn.onclick = new Function('event', onclickAttr);
  });
}

// =============================================
// SALVAR JOGO (persistir no backend/localStorage)
// =============================================
window.adminSaveGame = async (gameId) => {
  const idx = GAMES_STATE.findIndex(g => g.id === gameId);
  if (idx === -1) {
    showToast('Jogo não encontrado', 'red');
    return;
  }

  const game = GAMES_STATE[idx];
  const isKnockout = game.group === 'knockout';

  // Captura placar
  const homeScore = parseInt(document.getElementById(`homeScore_${game.id}`)?.value);
  const awayScore = parseInt(document.getElementById(`awayScore_${game.id}`)?.value);
  if (isNaN(homeScore) || isNaN(awayScore)) {
    showToast('Informe o placar do resultado.', 'red');
    return;
  }

  // Captura campos knockout
  let overtime = false;
  let penaltyWinner = null;
  if (isKnockout) {
    overtime = document.getElementById(`overtime_${game.id}`)?.checked || false;
    penaltyWinner = document.getElementById(`penalty_winner_${game.id}`)?.value || null;
    // Se placar empatado e não selecionou vencedor, alertar
    if (homeScore === awayScore && !penaltyWinner) {
      showToast('Para empate, selecione o time que avança nos pênaltis.', 'red');
      return;
    }
    // Se placar não empatado, ignorar penaltyWinner (não deve ser usado)
    if (homeScore !== awayScore) penaltyWinner = null;
  }

  const craqueId = document.getElementById(`craque_${game.id}`)?.value || null;

  // Coletar goleadores
  const scorers = [];
  for (let i = 0; i < (tempScorers[gameId] || []).length; i++) {
    const playerId = document.getElementById(`player_selected_${gameId}_scorer_${i}`)?.value;
    const goals = parseInt(document.getElementById(`scorer_goals_${gameId}_${i}`)?.value || 1);
    if (playerId && goals > 0) scorers.push({ playerId, goals });
  }

  // Coletar assistências
  const assists = [];
  for (let i = 0; i < (tempAssists[gameId] || []).length; i++) {
    const playerId = document.getElementById(`player_selected_${gameId}_assist_${i}`)?.value;
    const count = parseInt(document.getElementById(`assist_count_${gameId}_${i}`)?.value || 1);
    if (playerId && count > 0) assists.push({ playerId, assists: count });
  }

  // Coletar cartões vermelhos
  const redCards = [];
  for (let i = 0; i < (tempRedCards[gameId] || []).length; i++) {
    const playerId = document.getElementById(`player_selected_${gameId}_redcard_${i}`)?.value;
    if (playerId) redCards.push({ playerId });
  }

  // Montar objeto result
  GAMES_STATE[idx].status = 'completed';
  GAMES_STATE[idx].result = {
    homeScore,
    awayScore,
    scorers,
    assists,
    redCards,
    craqueId,
    ...(isKnockout && { overtime, penaltyWinner })
  };

  // Salvar no banco
  await saveGames(GAMES_STATE);
  showToast('Resultado salvo com sucesso! ✅', 'green');

  // Recarregar lista admin e ranking
  renderAdminGames();
  if (document.getElementById('tabRanking')?.classList.contains('active') && window.renderRanking) window.renderRanking();
  if (document.getElementById('tabStandings')?.classList.contains('active') && window.renderStandings) window.renderStandings();
  if (document.getElementById('tabTopscorers')?.classList.contains('active') && window.renderTopScorers) window.renderTopScorers();
};

window.adminResetGame = async (gameId) => {
  if (!confirm('⚠️ Tem certeza que deseja resetar este jogo?\n\nO resultado será removido e o jogo voltará ao status "Aguardando".\nOs palpites dos usuários serão mantidos, mas a pontuação será recalculada.')) return;
  
  const idx = GAMES_STATE.findIndex(g => g.id === gameId);
  if (idx === -1) {
    showToast('Jogo não encontrado', 'red');
    return;
  }
  
  // Resetar o jogo
  GAMES_STATE[idx].status = 'upcoming';
  GAMES_STATE[idx].result = null;
  
  // Limpar temporários locais
  if (tempScorers[gameId]) delete tempScorers[gameId];
  if (tempAssists[gameId]) delete tempAssists[gameId];
  if (tempRedCards[gameId]) delete tempRedCards[gameId];
  
  await saveGames(GAMES_STATE);
  showToast('✅ Jogo resetado com sucesso!', 'green');
  
  // Recarregar a lista de admin
  renderAdminGames();
  
  // Se a aba de ranking estiver ativa, recarregar
  if (document.getElementById('tabRanking')?.classList.contains('active') && window.renderRanking) {
    await window.renderRanking();
  }
};

// =============================================
// RENDER ADMIN PRINCIPAL (chamado pelo navigation.js)
// =============================================
export async function renderAdmin() {
  const container = document.getElementById('adminGamesList');
  if (!container) {
    console.error('Elemento adminGamesList não encontrado');
    return;
  }

  // Verifica se é admin
  if (!window.currentUser?.isAdmin) {
    container.innerHTML = '<div style="text-align:center;padding:60px;">🔒 Acesso restrito</div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-tabs" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border);">
      <button class="admin-tab-btn active" onclick="window.showAdminTab('users', this)">👥 Usuários</button>
      <button class="admin-tab-btn" onclick="window.showAdminTab('games', this)">⚽ Resultados</button>
    </div>
    <div id="adminTabContent"></div>
  `;

  // Carregar a aba de usuários por padrão
  const firstBtn = container.querySelector('.admin-tab-btn');
  if (firstBtn) window.showAdminTab('users', firstBtn);
}

// =============================================
// EXPORTAÇÃO DAS FUNÇÕES GLOBAIS (para onclick)
// =============================================
window.filterAdminPlayers = filterAdminPlayers;
window.showAdminPlayerResults = showAdminPlayerResults;
window.selectAdminPlayer = selectAdminPlayer;
window.adminAddScorer = window.adminAddScorer;
window.adminRemoveScorer = window.adminRemoveScorer;
window.adminAddAssist = window.adminAddAssist;
window.adminRemoveAssist = window.adminRemoveAssist;
window.adminAddRedCard = window.adminAddRedCard;
window.adminRemoveRedCard = window.adminRemoveRedCard;
window.adminSaveGame = window.adminSaveGame;
window.renderAdminGames = renderAdminGames;
window.showAdminTab = (tab, btn) => {
  const content = document.getElementById('adminTabContent');
  if (!content) return;
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'users') renderAdminPanel();
  else if (tab === 'games') renderAdminGames();
};

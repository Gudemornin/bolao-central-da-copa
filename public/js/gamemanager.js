import { TEAMS } from './data/teams.js';
import { showToast, openModal, closeModal } from './ui.js';
import { filterPlayers, getPlayer, getPlayersByTeams } from './exportplayer.js';
import { loadBets, saveBets, loadGames, saveGames } from './storage.js';
import { formatDate, sign, playerDisplayName, teamFlagImg } from './utils.js';
import {
  GAMES_STATE,
  currentUser,
  currentDate,
  setCurrentDate,
  editingPlayerSel,
  setEditingPlayerSel,
  editingGameId,
  setEditingGameId,
  setGamesState
} from './state.js';
import { renderBets } from './bets.js';
import { syncGamesWithAPI } from './sync.js';
import { GAMES as MANUAL_GAMES } from './data/games.js';
import { calcBetPoints as calculateBetPoints } from './ranking.js';

const USE_API = true;

const gamePlayerSelections = {};

export function getBadge(bet, game) {
  if (!game.result) return { cls: 'rb-loss', txt: 'Aguardando' };
  const r = game.result;
  if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) {
    return { cls: 'rb-exact', txt: 'Placar Exato' };
  }
  const betRes = sign(bet.homeScore - bet.awayScore);
  const realRes = sign(r.homeScore - r.awayScore);
  if (betRes === realRes) {
    return { cls: 'rb-win', txt: 'Resultado Certo' };
  }
  return { cls: 'rb-loss', txt: 'Errou' };
}

export function isGameLocked(game) {
  const now = new Date();
  const gameStart = new Date(game.date + 'T' + game.time + ':00');
  return now >= gameStart || game.status === 'completed';
}

function getUniqueDates() {
  let games = GAMES_STATE;
  if (!Array.isArray(games)) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return [...new Set(games
    .filter(g => new Date(g.date) >= today || g.status === 'upcoming')
    .map(g => g.date))]
    .sort();
}

export async function renderGames() {
  // await syncGamesWithAPI();
  
  const dates = getUniqueDates();
  if (!currentDate && dates.length) setCurrentDate(dates[0]);
  
  const sel = document.getElementById('dateSelector');
  if (!sel) return;
  
  sel.innerHTML = dates.map(d => {
    const dt = new Date(d + 'T12:00:00');
    const day = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').substring(0, 3);
    const num = dt.getDate();
    const mon = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').substring(0, 3);
    const isActive = d === currentDate;
    return `
      <button class="date-btn ${isActive ? 'active' : ''}" onclick="selectDate('${d}')">
        <span class="dnum">${num}</span>
        <span class="dname">${day}</span>
        <span class="dmonth">${mon}</span>
      </button>
    `;
  }).join('');
  
  sel.addEventListener('wheel', (e) => {
    e.preventDefault();
    sel.scrollLeft += e.deltaY;
  }, { passive: false });
  
  await renderGameList();
}

export async function selectDate(d) {
  setCurrentDate(d);
  await renderGameList();
}

async function renderGameList() {
   let gamesState = await loadGames();  // loadGames já chama a API
  setGamesState(gamesState);
  
  if (!Array.isArray(gamesState)) {
    console.error('❌ gamesState ainda não é array');
    return;
  }
  
  const sortedGames = [...gamesState].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}:00`);
    const dateB = new Date(`${b.date}T${b.time}:00`);
    return dateA - dateB;
  });

// ----- Use apenas o filtro pela data selecionada -----
const games = sortedGames.filter(g => g.date === currentDate);

  
/*  const games = sortedGames.filter(g => {
    if (!g || !g.date) return false;
    const gameDate = new Date(g.date);
    gameDate.setHours(0, 0, 0, 0);
    return gameDate >= yesterday && g.date === currentDate;
  }); */
  
  const list = document.getElementById('gamesList');
  if (!list) return;
  
  if (!games.length) {
    list.innerHTML = '<div class="no-games-msg">📅 Nenhum jogo disponível para palpites nesta data.</div>';
    return;
  }
  
  const bets = await loadBets();
  const userBets = bets[currentUser?.id] || {};

  list.innerHTML = games.map(game => {
    const t1 = TEAMS[game.home];
    const t2 = TEAMS[game.away];
    const locked = isGameLocked(game);
    const bet = userBets[game.id] || {};
    const selP = bet.playerId ? getPlayer(bet.playerId) : null;
    const groupDisplay = game.group === 'Ligue 1' ? '🏆 Ligue 1' : game.group === 'La Liga' ? '🏆 La Liga' : `🌍 Copa do Mundo - Grupo ${game.group}`;
    
    return `
      <div class="game-card${locked ? ' locked' : ''}" id="gc_${game.id}">
        <div class="game-card-header">
          <div class="game-card-header-left">
            <span class="game-badge">${groupDisplay}</span>
            <span class="game-time">⏰ ${game.time}</span>
            <span class="game-venue">📍 ${game.venue || 'Estádio'}</span>
          </div>
          <div class="game-card-header-right">
            ${locked ? '<span class="locked-badge">🔒 Fechado</span>' : '<span class="game-badge-open">Aberto</span>'}
          </div>
        </div>
        <div class="game-card-body">
          <div class="game-teams">
            <div class="team-home">
              <div class="team-flag">${teamFlagImg(t1, 50)}</div>
              <div class="team-name">${t1?.name || game.home}</div>
            </div>
            <div class="game-score">
              <div class="score-box">
                <input class="score-input" type="number" min="0" max="99" id="s1_${game.id}" 
                  value="${bet.homeScore !== undefined ? bet.homeScore : ''}" 
                  placeholder="0" ${locked ? 'disabled' : ''}>
                <span class="score-separator">:</span>
                <input class="score-input" type="number" min="0" max="99" id="s2_${game.id}" 
                  value="${bet.awayScore !== undefined ? bet.awayScore : ''}" 
                  placeholder="0" ${locked ? 'disabled' : ''}>
              </div>
${game.result && game.status === 'completed' ? `
  <div class="real-score-info" style="margin-top:8px;padding:8px;background:rgba(0,0,0,0.3);border-radius:8px;">
    <div>📊 Resultado real: <strong>${game.result.homeScore} : ${game.result.awayScore}</strong></div>
    ${bet.homeScore !== undefined ? `
      <div>🎯 Seus pontos: <strong>${calculateBetPoints(bet, game)}</strong> pts</div>
    ` : ''}
  </div>
` : ''}
              <div class="vs-text">VS</div>
            </div>
            <div class="team-away">
              <div class="team-flag">${teamFlagImg(t2, 50)}</div>
              <div class="team-name">${t2?.name || game.away}</div>
            </div>
          </div>
          <div class="player-section">
            <div class="player-label">⭐ SELECIONAR JOGADOR REPRESENTANTE</div>
            ${locked ? 
              `<div class="selected-player-display">${selP ? playerDisplayName(selP) : 'Nenhum jogador selecionado'}</div>` :
              `
                <div class="player-search-wrapper">
                  <input type="text" class="player-search-input" 
                    placeholder="Buscar jogador das duas seleções..." 
                    id="gpinp_${game.id}"
                    oninput="filterGamePlayers('${game.id}')"
                    onfocus="showGameResults('${game.id}')">
                  <div class="player-search-results" id="gpr_${game.id}"></div>
                </div>
                <div class="selected-player-badge${selP ? ' show' : ''}" id="spb_${game.id}">
                  <span class="star-icon">⭐</span>
                  <span id="spb_name_${game.id}" class="player-name">
                    ${selP ? `<img src="${TEAMS[selP.team]?.flag}" class="player-flag"> ${selP.name} (${TEAMS[selP.team]?.name || selP.team})` : ''}
                  </span>
                  <button class="remove-player" onclick="clearGamePlayer('${game.id}')">✕</button>
                </div>
                <div class="knockout-extra" style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
  <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
    <input type="checkbox" id="ot_${game.id}" ${bet.overtime ? 'checked' : ''} ${locked ? 'disabled' : ''}>
    ⏱️ Prorrogação
  </label>
  <div id="penalty_area_${game.id}" style="display:none; margin-top:8px;">
    <label style="font-size:13px; color:var(--text-d);">🏆 Quem avança nos pênaltis?</label>
    <select id="pw_${game.id}" class="form-input" style="width:auto; margin-left:8px;" ${locked ? 'disabled' : ''}>
      <option value="">--</option>
      <option value="home" ${bet.penaltyWinner === 'home' ? 'selected' : ''}>${t1?.name || game.home}</option>
      <option value="away" ${bet.penaltyWinner === 'away' ? 'selected' : ''}>${t2?.name || game.away}</option>
    </select>
  </div>
</div>
               <div class="save-bet-area" style="display:flex; gap:10px; align-items:center;">
  <button class="save-bet-btn" onclick="saveBet('${game.id}')">💾 SALVAR PALPITE</button>
  <span class="saved-indicator${bet.homeScore !== undefined ? ' show' : ''}" id="bsm_${game.id}">✓ Palpite salvo</span>
</div>
              `
            }
          </div>
        </div>
      </div>
    `;
  }).join('');

document.querySelectorAll('.game-card').forEach(card => {
  const gameId = card.id.replace('gc_', '');
  const s1 = document.getElementById(`s1_${gameId}`);
  const s2 = document.getElementById(`s2_${gameId}`);
  const penaltyArea = document.getElementById(`penalty_area_${gameId}`);
  if (penaltyArea) {
    const updatePenaltyVisibility = () => {
      const h = parseInt(s1?.value) || 0;
      const a = parseInt(s2?.value) || 0;
      penaltyArea.style.display = (h === a) ? 'block' : 'none';
    };
    s1?.addEventListener('input', updatePenaltyVisibility);
    s2?.addEventListener('input', updatePenaltyVisibility);
    updatePenaltyVisibility();
  }
});

  for (const game of games) {
    if (!isGameLocked(game)) {
      const bets = await loadBets();
      const bet = (bets[currentUser?.id] || {})[game.id] || {};
      if (bet.playerId) {
        const p = getPlayer(bet.playerId);
        if (p) setGamePlayerDisplay(game.id, p);
      }
    }
  }
}

export async function deleteBet(gameId) {
  if (!currentUser) {
    showToast('Faça login primeiro', 'red');
    return;
  }
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) return;
  if (isGameLocked(game)) {
    showToast('❌ Não é possível excluir palpite de jogo já iniciado/finalizado.', 'red');
    return;
  }
  if (!confirm('⚠️ Excluir permanentemente este palpite?')) return;

  try {
    // 🔥 1. Busca dados diretamente da API (sem usar loadBets() que pode ter cache)
    const response = await fetch('/api/bets');
    const data = await response.json();
    let bets = data.bets || {};

    if (!bets[currentUser.id] || !bets[currentUser.id][gameId]) {
      showToast('Palpite não encontrado', 'red');
      return;
    }

    // 2. Remove
    delete bets[currentUser.id][gameId];
    if (Object.keys(bets[currentUser.id]).length === 0) delete bets[currentUser.id];

    // 3. Envia para o servidor (DELETE + INSERT)
    const saveRes = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bets })
    });
    if (!saveRes.ok) throw new Error('Falha ao salvar exclusão');

    // 4. Limpa interface local
    gamePlayerSelections[gameId] = null;
    const badge = document.getElementById('spb_' + gameId);
    if (badge) badge.classList.remove('show');
    const nameSpan = document.getElementById('spb_name_' + gameId);
    if (nameSpan) nameSpan.innerHTML = '';
    const s1 = document.getElementById('s1_' + gameId);
    const s2 = document.getElementById('s2_' + gameId);
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    const savedIndicator = document.getElementById('bsm_' + gameId);
    if (savedIndicator) savedIndicator.classList.remove('show');

    showToast('✅ Palpite excluído!', 'green');

    // 5. Recarrega tudo forçando busca nova
    await renderGameList();  // recarrega jogos e palpites
    if (window.renderBets) await window.renderBets();
    if (window.updateSidebar) await window.updateSidebar();
    if (window.renderRanking) await window.renderRanking();

  } catch (error) {
    console.error('Erro ao excluir:', error);
    showToast(error.message, 'red');
  }
}

function setGamePlayerDisplay(gameId, p) {
  const badge = document.getElementById('spb_' + gameId);
  const nameSpan = document.getElementById('spb_name_' + gameId);
  if (badge) badge.classList.add('show');
  if (nameSpan) {
    const team = TEAMS[p.team];
    const flagImg = team?.flag ? `<img src="${team.flag}" style="width:20px;height:14px;vertical-align:middle;margin-right:6px;border-radius:2px;">` : '';
    nameSpan.innerHTML = `${flagImg} ${p.name} (${team?.name || p.team})`;
  }
}

export function filterGamePlayers(gameId) {
  console.log('filterGamePlayers chamado para', gameId);
  console.log('GAMES_STATE atual:', GAMES_STATE.length);
  
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) {
    console.error('Jogo não encontrado:', gameId);
    return;
  }
  
  const inp = document.getElementById('gpinp_' + gameId);
  const res = document.getElementById('gpr_' + gameId);
  if (!inp || !res) {
    console.error('Elementos não encontrados');
    return;
  }
  
  const query = inp.value.trim();
  console.log('Busca por:', query);
  
  if (query === '') {
    res.classList.remove('open');
    return;
  }
  
  const players = filterPlayers(query, [game.home, game.away]);
  console.log('Jogadores encontrados:', players.length);
  
  if (!players.length) {
    res.innerHTML = '<div style="padding:10px; color:var(--text-d);">Nenhum jogador</div>';
    res.classList.add('open');
    return;
  }
  
  res.innerHTML = players.map(p => {
    const team = TEAMS[p.team];
    const flag = team?.flag ? `<img src="${team.flag}" style="width:20px;height:14px;margin-right:6px;">` : '';
    return `
      <div class="game-pitem" onclick="selectGamePlayer('${gameId}','${p.id}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
        <span>${flag} ${p.name}</span>
        <span style="font-size:12px; color:var(--text-d);">${team?.name || p.team} - ${p.pos}</span>
      </div>
    `;
  }).join('');

res.classList.add('open');
res.style.display = 'block';
}

export function showGameResults(gameId) {
  console.log('🎯 showGameResults chamado para', gameId);
  // Filtra imediatamente se houver texto, senão apenas limpa
  const inp = document.getElementById('gpinp_' + gameId);
  if (inp && inp.value.trim() !== '') {
    filterGamePlayers(gameId);
  } else {
    const res = document.getElementById('gpr_' + gameId);
    if (res) {
      res.classList.remove('open');
      res.innerHTML = '';
    }
  }
}
export function selectGamePlayer(gameId, playerId) {
  const p = getPlayer(playerId);
  if (!p) return;
  
  gamePlayerSelections[gameId] = p;
  setGamePlayerDisplay(gameId, p);
  
  const res = document.getElementById('gpr_' + gameId);
  if (res) res.classList.remove('open');
  const inp = document.getElementById('gpinp_' + gameId);
  if (inp) inp.value = '';
  
  const team = TEAMS[p.team];
  showToast(`${p.name} (${team?.name || p.team}) selecionado! ⭐`, 'green');
}

export function clearGamePlayer(gameId) {
  gamePlayerSelections[gameId] = null;
  const badge = document.getElementById('spb_' + gameId);
  if (badge) badge.classList.remove('show');
  const inp = document.getElementById('gpinp_' + gameId);
  if (inp) inp.value = '';
}


export async function saveBet(gameId) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  const isKnockout = game?.group === 'knockout';
  
  // Coletar dados
  const homeScore = parseInt(document.getElementById(`s1_${gameId}`)?.value);
  const awayScore = parseInt(document.getElementById(`s2_${gameId}`)?.value);
  const overtime = isKnockout ? (document.getElementById(`ot_${gameId}`)?.checked || false) : false;
  const penaltyWinner = isKnockout ? (document.getElementById(`pw_${gameId}`)?.value || null) : null;
  
  // Montar objeto
  const betData = {
    homeScore,
    awayScore,
    playerId: selectedPlayerId,
    savedAt: Date.now(),
    overtime,
    penaltyWinner
  };
  
  // Salvar
  const bets = await loadBets();
  bets[currentUser.id][gameId] = betData;
  await saveBets(bets);
}
export function openEditBet(gameId) {
  setEditingGameId(gameId);
  const g = GAMES_STATE.find(x => x.id === gameId);
  if (!g) return;
  const bets = loadBets();
  const bet = (bets[currentUser?.id] || {})[gameId] || {};
  const t1 = TEAMS[g.home], t2 = TEAMS[g.away];
  const selP = bet.playerId ? getPlayer(bet.playerId) : null;
  setEditingPlayerSel(selP || null);

  document.getElementById('modalEditBody').innerHTML = `
    <div class="edit-modal-game">${teamFlagImg(t1,20)} ${t1?.name} × ${teamFlagImg(t2,20)} ${t2?.name} — ${formatDate(g.date)} ${g.time}</div>
    <div class="form-group">
      <label class="form-label">Placar do Jogo</label>
      <div style="display:flex;align-items:center;gap:10px;">
        <input class="form-input" style="width:80px;text-align:center;font-family:Anton,sans-serif;font-size:22px;" type="number" id="edit_s1" value="${bet.homeScore||0}" min="0" max="99">
        <span style="font-family:Anton,sans-serif;font-size:22px;color:var(--text-d)">:</span>
        <input class="form-input" style="width:80px;text-align:center;font-family:Anton,sans-serif;font-size:22px;" type="number" id="edit_s2" value="${bet.awayScore||0}" min="0" max="99">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Jogador Representante</label>
      <div class="psearch-wrap">
        <input class="form-input" id="edit_psearch" placeholder="Buscar jogador..." autocomplete="off">
        <div class="psearch-results" id="edit_presults"></div>
      </div>
      <div class="selected-player${selP?' show':''}" id="edit_selp">
        <span id="edit_sel_flag">${selP ? teamFlagImg(TEAMS[selP.team], 18) : ''}</span>
        <span id="edit_sel_name">${selP ? selP.name : ''}</span>
        <span class="sel-remove" onclick="clearEditPlayer()">✕</span>
      </div>
    </div>
    <button class="btn btn-green" onclick="saveEditBet()" style="margin-top:8px;">💾 SALVAR ALTERAÇÕES</button>
  `;
  openModal('modalEditBet');

  const inp2 = document.getElementById('edit_psearch');
  const res2 = document.getElementById('edit_presults');
  inp2.addEventListener('input', () => {
    const found = filterPlayers(inp2.value, [g.home, g.away]);
    res2.innerHTML = found.map(p => `<div class="psearch-item" onclick="selectEditPlayer('${p.id}')">
      <span class="pflag">${teamFlagImg(TEAMS[p.team], 16)}</span>
      <span class="pname">${p.name}</span>
      <span class="pteam">${TEAMS[p.team]?.name||p.team}</span>
      <span class="ppos">${p.pos}</span>
    </div>`).join('');
    res2.classList.toggle('open', !!found.length && !!inp2.value);
  });
  document.addEventListener('click', function hdl(e) {
    if (!inp2.contains(e.target) && !res2.contains(e.target)) {
      res2.classList.remove('open');
      document.removeEventListener('click', hdl);
    }
  });
}

export async function saveEditBet() {
  if (!editingGameId || !currentUser) return;
  const s1 = parseInt(document.getElementById('edit_s1')?.value);
  const s2 = parseInt(document.getElementById('edit_s2')?.value);
  const bets = await loadBets();
  if (!bets[currentUser.id]) bets[currentUser.id] = {};
  bets[currentUser.id][editingGameId] = {
    homeScore: isNaN(s1) ? 0 : s1,
    awayScore: isNaN(s2) ? 0 : s2,
    playerId: editingPlayerSel?.id || null,
    savedAt: Date.now()
  };
  await saveBets(bets);
  closeModal('modalEditBet');
  renderBets();
  window.updateSidebar?.();
  showToast('Palpite atualizado! ✅', 'green');
}

export function selectEditPlayer(pid) {
  const p = getPlayer(pid);
  if (!p) return;
  setEditingPlayerSel(p);
  document.getElementById('edit_sel_flag').innerHTML = teamFlagImg(TEAMS[p.team], 18);
  document.getElementById('edit_sel_name').textContent = p.name;
  document.getElementById('edit_selp').classList.add('show');
  document.getElementById('edit_presults').classList.remove('open');
  document.getElementById('edit_psearch').value = '';
}

export function clearEditPlayer() {
  setEditingPlayerSel(null);
  document.getElementById('edit_selp').classList.remove('show');
}

let isRefreshing = false;

export async function refreshAfterAutoUpdate() {
  if (isRefreshing) return;
  isRefreshing = true;
  
  try {
    console.log('🔄 Recarregando dados após atualização automática...');
    
    // Recarregar jogos do backend
    const games = await loadGames();
    setGamesState(games);
    
    // Recarregar palpites
    const bets = await loadBets();
    
    // Se a aba atual for Jogos, re-renderizar a lista
    const activeTab = document.querySelector('.tab-content.active')?.id;
    
    if (activeTab === 'tabGames') {
      await renderGameList(); // re-renderiza sem recarregar a página
    }
    
    if (activeTab === 'tabCommunity' && window.renderCommunityBets) {
      await window.renderCommunityBets();
    }
    
    if (activeTab === 'tabRanking' && window.renderRanking) {
      await window.renderRanking();
    }
    
    if (activeTab === 'tabWorldcup' && window.renderWorldCupGames) {
      await window.renderWorldCupGames();
    }
    
    // Atualizar sidebar (pontos podem ter mudado)
    if (window.updateSidebar) window.updateSidebar();
    
    // Se o usuário estiver na aba "Palpites Ativos", re-renderizar
    if (activeTab === 'tabBets' && window.renderBets) {
      await window.renderBets();
    }
    
  } catch (error) {
    console.error('Erro ao atualizar interface após update automático:', error);
  } finally {
    isRefreshing = false;
  }
}

export async function cleanOldGames() {
  console.log('🧹 Limpando jogos antigos...');
  try {
    const games = await loadGames();
    if (!games || !games.length) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filteredGames = games.filter(game => {
      const gameDate = new Date(game.date);
      gameDate.setHours(0, 0, 0, 0);
      if (gameDate >= today) return true;
      if (game.status === 'completed' && game.result) return true;
      return false;
    });
    if (filteredGames.length !== games.length) {
      await saveGames(filteredGames);
      setGamesState(filteredGames);
      console.log(`🧹 Removidos ${games.length - filteredGames.length} jogos antigos`);
    }
  } catch (error) {
    console.error('Erro ao limpar jogos antigos:', error);
  }
}

// cleanOldGames(); // Descomente se quiser ativar a limpeza automática

// Tornar funções globais (para onclick no HTML)
window.deleteBet = deleteBet;
window.saveBet = saveBet;
window.filterGamePlayers = filterGamePlayers;
window.selectGamePlayer = selectGamePlayer;
window.clearGamePlayer = clearGamePlayer;
window.openEditBet = openEditBet;
window.selectEditPlayer = selectEditPlayer;
window.clearEditPlayer = clearEditPlayer;
window.saveEditBet = saveEditBet;
window.selectDate = selectDate;
window.showGameResults = showGameResults;
window.openModal = openModal;
window.closeModal = closeModal;

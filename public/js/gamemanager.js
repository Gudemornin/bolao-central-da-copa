import { TEAMS } from './data/teams.js';
import { showToast, openModal, closeModal } from './ui.js';
import { filterPlayers, getPlayer, getPlayersByTeams } from './exportplayer.js';
import { loadBets, saveBets, loadGames } from './storage.js';
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

// Função para garantir que GAMES_STATE é um array
async function ensureGamesState() {
  let games = GAMES_STATE;
  if (!games || !Array.isArray(games)) {
    games = await loadGames();
    setGamesState(games);
  }
  return games;
}

function getUniqueDates(games) {
  if (!games || !Array.isArray(games)) return [];
  return [...new Set(games.map(g => g.date))].sort();
}

export async function renderGames() {
  const games = await ensureGamesState();
  
  const dates = getUniqueDates(games);
  if (!currentDate && dates.length > 0) setCurrentDate(dates[0]);
  
  const sel = document.getElementById('dateSelector');
  if (!sel) return;
  
  sel.innerHTML = dates.map(d => {
    const dt = new Date(d + 'T12:00:00');
    const day = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const num = dt.getDate();
    const mon = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `<div class="date-btn${d === currentDate ? ' active' : ''}" onclick="selectDate('${d}')">
      <span class="dnum">${num}</span>
      <span class="dname">${day}</span>
      <span class="dmonth">${mon}</span>
    </div>`;
  }).join('');

  await renderGameList(games);
}

export async function selectDate(d) {
  setCurrentDate(d);
  await renderGames();
}

export function isGameLocked(game) {
  const now = new Date();
  const gameStart = new Date(game.date + 'T' + game.time + ':00');
  return now >= gameStart || game.status === 'completed';
}

export function getBadge(bet, game) {
  if (!game.result) return { cls: 'rb-loss', txt: 'Aguardando' };
  const r = game.result;
  if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) return { cls: 'rb-exact', txt: 'Placar Exato' };
  const betRes = sign(bet.homeScore - bet.awayScore), realRes = sign(r.homeScore - r.awayScore);
  if (betRes === realRes) return { cls: 'rb-win', txt: 'Resultado Certo' };
  return { cls: 'rb-loss', txt: 'Errou' };
}

async function renderGameList(gamesState) {
  const games = gamesState.filter(g => g.date === currentDate);
  const list = document.getElementById('gamesList');
  if (!list) return;
  
  if (!games.length) {
    list.innerHTML = '<div class="no-games-msg"><div class="icon">📅</div><p>Sem jogos para esta data.</p></div>';
    return;
  }
  
  const bets = await loadBets();
  const userBets = bets[currentUser?.id] || {};

  list.innerHTML = games.map(game => {
    const t1 = TEAMS[game.home], t2 = TEAMS[game.away];
    const locked = isGameLocked(game);
    const bet = userBets[game.id] || {};
    const selP = bet.playerId ? getPlayer(bet.playerId) : null;

    return `<div class="game-card${locked ? ' locked' : ''}" id="gc_${game.id}">
      <div class="game-card-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="game-badge">Grupo ${game.group}</span>
          <span>⏰ ${game.time} | 📍 ${game.venue}</span>
        </div>
        <div>
          ${locked ? `<span class="locked-badge">${game.status==='completed'?'✅ Finalizado':'🔒 Fechado'}</span>` : '<span class="game-badge">Aberto</span>'}
        </div>
      </div>
      <div class="game-card-body">
        <div class="game-teams">
          <div class="team-side">
            <div class="team-flag">${teamFlagImg(t1, 38)}</div>
            <div class="team-name-lbl">${t1?.name || game.home}</div>
          </div>
          <div class="vs-area">
            <div class="vs-lbl">VS</div>
            <div class="score-inputs">
              <input class="score-input" type="number" min="0" max="99" id="s1_${game.id}" value="${bet.homeScore!==undefined?bet.homeScore:''}" placeholder="0" ${locked?'disabled':''} oninput="this.value=Math.max(0,Math.min(99,parseInt(this.value)||0))">
              <span class="score-sep">:</span>
              <input class="score-input" type="number" min="0" max="99" id="s2_${game.id}" value="${bet.awayScore!==undefined?bet.awayScore:''}" placeholder="0" ${locked?'disabled':''} oninput="this.value=Math.max(0,Math.min(99,parseInt(this.value)||0))">
            </div>
          </div>
          <div class="team-side">
            <div class="team-flag">${teamFlagImg(t2, 38)}</div>
            <div class="team-name-lbl">${t2?.name || game.away}</div>
          </div>
        </div>
        <div class="player-select-area">
          <div class="ps-lbl">⭐ Selecionar Jogador Representante</div>
          ${locked ? `<div style="font-size:13px;color:var(--text-d)">${selP?playerDisplayName(selP):'Nenhum jogador selecionado'}</div>` :
            `<div class="game-psearch" id="gps_${game.id}">
              <input class="game-psearch-input" placeholder="Buscar jogador das duas seleções..." id="gpinp_${game.id}"
                oninput="filterGamePlayers('${game.id}')"
                onfocus="showGameResults('${game.id}')">
              <div class="game-presults" id="gpr_${game.id}"></div>
            </div>
            <div class="sel-player-badge${selP?' show':''}" id="spb_${game.id}">
              <span class="spb-star">⭐</span>
              <span id="spb_name_${game.id}">${selP ? `<img src="${TEAMS[selP.team]?.flag}" style="width:20px;height:14px;vertical-align:middle;margin-right:6px;border-radius:2px;"> ${selP.name} (${TEAMS[selP.team]?.name || selP.team})` : ''}</span>
              <span class="spb-remove" onclick="clearGamePlayer('${game.id}')">✕</span>
            </div>
            <div class="save-bet-row">
              <button class="save-bet-btn" onclick="saveBet('${game.id}')">SALVAR PALPITE</button>
              <div class="bet-saved-msg${bet.homeScore!==undefined?' show':''}" id="bsm_${game.id}">✓ Palpite salvo</div>
            </div>`
          }
        </div>
      </div>
    </div>`;
  }).join('');

  // Inicializar seleções anteriores
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

const gamePlayerSelections = {};

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
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) return;
  const inp = document.getElementById('gpinp_' + gameId);
  const res = document.getElementById('gpr_' + gameId);
  if (!inp || !res) return;
  const q = inp.value;
  const players = filterPlayers(q, [game.home, game.away]);
  res.innerHTML = players.map(p => `
    <div class="game-pitem" onclick="selectGamePlayer('${gameId}','${p.id}')">
      <span class="gpi-name">${teamFlagImg(TEAMS[p.team], 16)} ${p.name}</span>
      <span class="gpi-right">
        <span class="gpi-team">${TEAMS[p.team]?.name||p.team}</span>
        <span class="gpi-pos">${p.pos}</span>
      </span>
    </div>`).join('') || '<div style="padding:8px 12px;font-size:12px;color:var(--text-d)">Nenhum resultado</div>';
  res.classList.add('open');
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

function showGameResults(gameId) {
  filterGamePlayers(gameId);
}

export async function saveBet(gameId) {
  const s1 = document.getElementById('s1_' + gameId)?.value;
  const s2 = document.getElementById('s2_' + gameId)?.value;
  if (s1 === '' || s2 === '') { showToast('Informe o placar antes de salvar.', 'red'); return; }
  
  const bets = await loadBets();
  if (!bets[currentUser.id]) bets[currentUser.id] = {};
  const selP = gamePlayerSelections[gameId] || (bets[currentUser.id][gameId]?.playerId ? getPlayer(bets[currentUser.id][gameId].playerId) : null);
  bets[currentUser.id][gameId] = {
    homeScore: parseInt(s1), 
    awayScore: parseInt(s2),
    playerId: selP?.id || null,
    savedAt: Date.now()
  };
  await saveBets(bets);
  
  document.getElementById('bsm_' + gameId)?.classList.add('show');
  window.updateSidebar?.();
  showToast('Palpite salvo com sucesso! ⚽', 'green');
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

// Tornar funções globais (necessário para onclick)
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
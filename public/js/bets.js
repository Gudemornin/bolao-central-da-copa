import { TEAMS } from './data/teams.js';
import { currentUser, GAMES_STATE } from './state.js';
import { getPlayer } from './exportplayer.js';          // corrigido
import { formatDate, playerDisplayName, teamFlagImg } from './utils.js';
import { calcBetPoints } from './ranking.js';          // precisa exportar calcBetPoints
import { isGameLocked, getBadge } from './gamemanager.js'; // precisa exportar
import { loadBets, saveBets } from './storage.js';

export async function renderBets(){
  const bets = await loadBets();
  const userBets = bets[currentUser?.id]||{};
  const gameIds  = Object.keys(userBets);
  const activeBets = gameIds.filter(gid=>{
    const g = GAMES_STATE.find(x=>x.id===gid);
    return g && !isGameLocked(g);
  });
  const el = document.getElementById('betsList');
  if(!activeBets.length){
    el.innerHTML=`<div class="empty-state">
      <div class="es-icon">📋</div>
      <h3>Nenhum palpite ativo</h3>
      <p>Faça seus palpites na aba Jogos!</p>
    </div>`;
    return;
  }
  el.innerHTML = activeBets.map(gid=>{
    const g = GAMES_STATE.find(x=>x.id===gid);
    if(!g) return '';
    const bet = userBets[gid];
    const p = bet.playerId ? getPlayer(bet.playerId) : null;
    const t1=TEAMS[g.home], t2=TEAMS[g.away];
    return `<div class="bet-card">
      <div class="bet-match-info">
        <div class="bet-match-name">${teamFlagImg(t1, 22)} ${t1?.name} × ${teamFlagImg(t2, 22)} ${t2?.name}</div>
        <div class="bet-date-time">📅 ${formatDate(g.date)} às ${g.time}</div>
      </div>
      <div class="bet-score-disp">${bet.homeScore} : ${bet.awayScore}</div>
      <div class="bet-player-info">
        <div class="bet-player-label">Jogador</div>
        <div class="bet-player-name">${p?p.name:'—'}</div>
      </div>
      <button class="edit-bet-btn" onclick="openEditBet('${gid}')">✏️ Editar</button>
    </div>`;
  }).join('');
}

// Movida para fora de renderBets e exportada / global
export async function openFinalizedModal(){
  const bets = await loadBets();
  const userBets = bets[currentUser?.id]||{};
  const finalized = Object.keys(userBets).filter(gid=>{
    const g = GAMES_STATE.find(x=>x.id===gid);
    return g && g.status==='completed';
  });
  const body = document.getElementById('modalFinalizedBody');
  if(!finalized.length){
    body.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-d);font-size:14px;">Nenhum palpite finalizado ainda.<br>Os resultados aparecerão aqui após o encerramento das partidas.</div>';
  } else {
    body.innerHTML = finalized.map(gid=>{
      const g = GAMES_STATE.find(x=>x.id===gid);
      const bet = userBets[gid];
      const pts = calcBetPoints(bet, g);
      const t1=TEAMS[g.home], t2=TEAMS[g.away];
      const badge = getBadge(bet, g);
      return `<div class="fin-bet-item">
        <div class="fin-bet-main">
          <div class="fin-bet-match">${teamFlagImg(t1, 22)} ${t1?.name} × ${teamFlagImg(t2, 22)} ${t2?.name}</div>
          <div class="fin-bet-score">Seu palpite: ${bet.homeScore} : ${bet.awayScore} | Resultado: ${g.result?.homeScore} : ${g.result?.awayScore}</div>
        </div>
        <span class="result-badge ${badge.cls}">${badge.txt}</span>
        <div class="fin-bet-pts">${pts} pts</div>
      </div>`;
    }).join('');
  }
  openModal('modalFinalized');
}

window.deleteActiveBet = async (gameId) => {
  if (!currentUser) return;
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (game && game.status === 'completed') {
    showToast('❌ Jogo finalizado, não pode excluir', 'red');
    return;
  }
  if (!confirm('Excluir permanentemente?')) return;

  try {
    const response = await fetch('/api/bets');
    const data = await response.json();
    let bets = data.bets || {};
    if (!bets[currentUser.id] || !bets[currentUser.id][gameId]) {
      showToast('Palpite não encontrado', 'red');
      return;
    }
    delete bets[currentUser.id][gameId];
    if (Object.keys(bets[currentUser.id]).length === 0) delete bets[currentUser.id];

    await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bets })
    });

    showToast('✅ Excluído', 'green');
    await renderBets();
    if (window.renderGameList) await window.renderGameList();
    if (window.updateSidebar) await window.updateSidebar();
  } catch (err) {
    showToast('Erro', 'red');
  }
};

window.openFinalizedModal = openFinalizedModal;

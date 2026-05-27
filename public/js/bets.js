import { TEAMS } from './data/teams.js';
import { currentUser, GAMES_STATE } from './state.js';
import { loadBets } from './storage.js';
import { getPlayer } from './exportplayer.js';          // corrigido
import { formatDate, playerDisplayName, teamFlagImg } from './utils.js';
import { calcBetPoints } from './ranking.js';          // precisa exportar calcBetPoints
import { isGameLocked, getBadge } from './gamemanager.js'; // precisa exportar

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
      <button class="delete-bet-btn" onclick="deleteActiveBet('${gid}')">🗑️ Excluir</button>
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
  if (!currentUser) {
    showToast('Faça login primeiro', 'red');
    return;
  }
  
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (game && isGameLocked(game)) {
    showToast('❌ Não é possível excluir palpite de um jogo já iniciado ou finalizado.', 'red');
    return;
  }
  
  if (!confirm('⚠️ Excluir permanentemente este palpite?\n\nEsta ação não pode ser desfeita.')) return;
  
  // Carregar palpites
  const bets = await loadBets();
  
  // Verificar se o palpite existe
  if (!bets[currentUser.id] || !bets[currentUser.id][gameId]) {
    showToast('Palpite não encontrado', 'red');
    return;
  }
  
  // REMOVER COMPLETAMENTE
  delete bets[currentUser.id][gameId];
  
  // Se não houver mais palpites, remover a entrada do usuário
  if (Object.keys(bets[currentUser.id]).length === 0) {
    delete bets[currentUser.id];
  }
  
  // Salvar
  await saveBets(bets);
  
  showToast('✅ Palpite excluído permanentemente!', 'green');
  
  // Recarregar a lista de palpites ativos
  await renderBets();
  
  // Atualizar sidebar
  if (window.updateSidebar) window.updateSidebar();
  
  // Se a aba de jogos estiver aberta, recarregar para remover o indicador
  if (document.getElementById('tabGames')?.classList.contains('active')) {
    await window.renderGameList();
  }
  
  // Recarregar ranking se estiver visível
  if (document.getElementById('tabRanking')?.classList.contains('active') && window.renderRanking) {
    await window.renderRanking();
  }
};

window.openFinalizedModal = openFinalizedModal;

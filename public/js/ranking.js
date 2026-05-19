import { loadBets, loadUsers } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { sign } from './utils.js';
import { updateSidebar } from './app.js';
import { getPlayer } from './exportplayer.js';
import { TEAMS } from './data/teams.js';

export function calcBetPoints(bet, game, gameEvents = null) {
  if (!game.result) return 0;
  
  const r = game.result;
  let pts = 0;
  
  // 1. RESULTADO DA PARTIDA
  const betWinner = sign(bet.homeScore - bet.awayScore);
  const realWinner = sign(r.homeScore - r.awayScore);
  if (betWinner === realWinner) pts += 6;
  
  // 2. PLACAR EXATO
  if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) pts += 4;
  
  // 3. EVENTOS (gols, assistências, cartões, etc.)
  const events = gameEvents || r.events || [];
  
  // Jogadores do palpite (suporta até 2)
  const players = [
    { id: bet.playerId, role: bet.playerRole || 'field' },
    { id: bet.player2Id, role: bet.player2Role || 'field' }
  ].filter(p => p.id);
  
  for (const player of players) {
    const p = getPlayer(player.id);
    if (!p) {
      console.warn(`Jogador não encontrado: ${player.id}`);
      continue;
    }
    
    const playerEvents = events.filter(e => e.playerId === player.id);
    const isGoalkeeper = player.role === 'goleiro' || p.pos === 'GOL';
    const isDefender = player.role === 'zagueiro' || p.pos === 'DEF';
    
    // GOLS
    const goals = playerEvents.filter(e => e.type === 'goal').length;
    if (goals > 0) {
      pts += 2;                       // base
      pts += (goals - 1) * 2;         // +2 por gol adicional
    }
    
    // ASSISTÊNCIAS
    const assists = playerEvents.filter(e => e.type === 'assist').length;
    if (assists > 0) {
      pts += assists * 1;             // 1 ponto por assistência
      console.log(`✅ Assistência para ${p.name}: +${assists} ponto(s)`);
    }
    
    // CARTÕES
    const redCards = playerEvents.filter(e => e.type === 'red_card').length;
    pts -= redCards * 2;


  }
  
  // 4. CRAQUE DO JOGO
  if (bet.playerId === r.craqueId || bet.player2Id === r.craqueId) pts += 2;
  
  return pts;
}

// =============================================
// BUSCAR EVENTOS DO JOGO (da API)
// =============================================

export async function fetchGameEvents(gameId) {
  try {
    // Tentar buscar da TheSportsDB
    const response = await fetch(`/api/tsdb?endpoint=event_timeline&id=${gameId}`);
    const data = await response.json();
    
    if (data && data.timeline) {
      return parseEventsFromTimeline(data.timeline);
    }
  } catch (error) {
    console.error(`Erro ao buscar eventos do jogo ${gameId}:`, error);
  }
  return [];
}

function parseEventsFromTimeline(timeline) {
  const events = [];
  for (const ev of timeline) {
    const type = ev.type?.toLowerCase();
    if (type === 'goal') {
      events.push({
        type: 'goal',
        playerId: ev.player_id || ev.player,
        playerName: ev.player,
        minute: ev.minute,
        team: ev.team
      });
    } else if (type === 'card') {
      events.push({
        type: ev.card === 'yellow' ? 'yellow_card' : 'red_card',
        playerId: ev.player_id || ev.player,
        playerName: ev.player,
        minute: ev.minute
      });
    } else if (type === 'subst' || type === 'substitution') {
      // Registrar minutos jogados
      events.push({
        type: 'minutes_played',
        playerId: ev.player_out_id,
        playerName: ev.player_out,
        value: 90 - (ev.minute || 0)
      });
    }
  }
  return events;
}

// =============================================
// CÁLCULO DE ESTATÍSTICAS DO USUÁRIO
// =============================================

async function getUserStats(userId) {
  const users = await loadUsers();
  const user = users.find(u => u && u.id === userId);
  const bets = await loadBets();
  const userBets = bets[userId] || {};
  let pts = 0, jp = 0, victories = 0, exactScores = 0, motm = 0;

  for (const [gid, bet] of Object.entries(userBets)) {
    const g = GAMES_STATE.find(x => x && x.id === gid);
    if (!g || !g.result) continue;

    jp++;
    try {
      // Usar os eventos que já estão salvos no jogo (se existirem)
      const events = g.result.events || [];
      const p = calcBetPoints(bet, g, events);
      pts += p;

      const betWinner = sign(bet.homeScore - bet.awayScore);
      const realWinner = sign(g.result.homeScore - g.result.awayScore);
      if (betWinner === realWinner) victories++;
      if (bet.homeScore === g.result.homeScore && bet.awayScore === g.result.awayScore) exactScores++;
      if (bet.playerId === g.result.craqueId || bet.player2Id === g.result.craqueId) motm++;
    } catch (err) {
      console.error(`Erro ao calcular pontos para ${userId}, jogo ${gid}:`, err);
    }
  }

  const avg = jp > 0 ? pts / jp : 0;
  if (user && user.adminOverrides) {
    if (user.adminOverrides.manualPoints !== undefined) pts = user.adminOverrides.manualPoints;
    if (user.adminOverrides.manualCraques !== undefined) motm = user.adminOverrides.manualCraques;
  }
  return { pts, jp, victories, exactScores, motm, avg };
}

export async function getUserPoints(userId) { 
  const stats = await getUserStats(userId);
  return stats ? stats.pts : 0; 
}

export async function renderRanking() {
  console.log('📊 Renderizando ranking...');
  
  let users = [];
  try {
    users = await loadUsers();
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
  
  if (!users || !Array.isArray(users) || users.length === 0) {
    const rankingBody = document.getElementById('rankingBody');
    if (rankingBody) {
      rankingBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Nenhum participante ainda.</td></tr>';
    }
    return;
  }
  
  const visibleUsers = users.filter(u => {
    if (!u) return false;
    if (u.isHidden === true) return false;
    if (!u.profileName || u.profileName.trim() === '' || u.profileName === 'u') return false;
    return true;
  });
  
  const rowsWithStats = [];
  for (const user of visibleUsers) {
    try {
      const stats = await getUserStats(user.id);
      rowsWithStats.push({ user, ...stats });
    } catch (error) {
      console.error(`Erro ao buscar stats para ${user.id}:`, error);
    }
  }
  
  // Ordenar por pontuação
  rowsWithStats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.motm !== a.motm) return b.motm - a.motm;
    return b.avg - a.avg;
  });
  
  const rankingBody = document.getElementById('rankingBody');
  if (!rankingBody) return;
  
  if (rowsWithStats.length === 0) {
    rankingBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Nenhum participante ainda.</td></tr>';
    return;
  }
  
  rankingBody.innerHTML = rowsWithStats.map((r, i) => {
    const pos = i + 1;
    const isMe = r.user && r.user.id === currentUser?.id;
    let displayName = r.user?.profileName || 'Jogador';
    const avatarChar = displayName.charAt(0).toUpperCase();
    
    let rankDisplay = pos;
    let rankClass = '';
    if (pos === 1) { rankDisplay = '🥇'; rankClass = 'gold'; }
    else if (pos === 2) { rankDisplay = '🥈'; rankClass = 'silver'; }
    else if (pos === 3) { rankDisplay = '🥉'; rankClass = 'bronze'; }
    
    return `<tr class="${isMe ? 'my-row' : ''}">
      <td class="center"><span class="rank-pos ${rankClass}">${rankDisplay}</span></td>
      <td>
        <div class="rank-user">
          <div class="rank-avatar">${avatarChar}</div>
          <div><div class="rank-name">${escapeHtml(displayName)}${isMe ? '<span class="rank-you"> (você)</span>' : ''}</div></div>
        </div>
      </td>
      <td class="center rank-stat"><span class="rank-pts">${r.pts || 0}</span></td>
      <td class="center rank-stat">${r.jp || 0}</td>
      <td class="center rank-stat">${r.victories || 0}</td>
      <td class="center rank-stat">${r.exactScores || 0}</td>
      <td class="center rank-stat">${r.motm || 0}</td>
    </tr>`;
  }).join('');
  
  if (typeof updateSidebar === 'function') updateSidebar();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Forçar recarga do ranking se necessário
window.refreshRanking = async () => {
  console.log('🔄 Forçando recarga do ranking...');
  await renderRanking();
};
import { loadBets, loadUsers } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { sign } from './utils.js';
import { updateSidebar } from './app.js'

export function calcBetPoints(bet, game) {
  if (!game.result) return 0;
  const r = game.result;
  let pts = 0;
  
  // Placar exato
  if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) {
    pts += 7;
  } 
  // Resultado certo (vencedor/empate)
  else if (sign(bet.homeScore - bet.awayScore) === sign(r.homeScore - r.awayScore)) {
    pts += 5;
  }
  
  // MARCADOR - verifica em múltiplos goleadores
  if (bet.playerId && r.scorers && Array.isArray(r.scorers)) {
    const scorerFound = r.scorers.find(s => s.playerId === bet.playerId);
    if (scorerFound) {
      pts += 3 + (scorerFound.goals - 1);
    }
  }
  
  // CRAQUE DO JOGO
  if (bet.playerId && r.craqueId === bet.playerId) {
    pts += 4;
  }
  
  return pts;
}

// Tornar getUserStats assíncrona
async function getUserStats(userId) {
  const users = await loadUsers(); // ← AWAIT
  const user = users.find(u => u.id === userId);
  
  // Cálculo normal
  const bets = await loadBets(); // ← AWAIT
  const userBets = bets[userId] || {};
  let pts = 0, jp = 0, mc = 0, craque = 0;
  
  Object.entries(userBets).forEach(([gid, bet]) => {
    const g = GAMES_STATE.find(x => x.id === gid);
    if (!g) return;
    jp++;
    if (!g.result) return;
    
    const p = calcBetPoints(bet, g);
    pts += p;
    
    const r = g.result;
    
    // VERIFICAÇÃO DE MARCADOR (MÚLTIPLOS GOLEADORES)
    if (bet.playerId && r.scorers && Array.isArray(r.scorers)) {
      const scorerFound = r.scorers.find(s => s.playerId === bet.playerId);
      if (scorerFound && scorerFound.goals > 0) {
        mc++;
      }
    }
    
    // VERIFICAÇÃO DE CRAQUE
    if (bet.playerId && r.craqueId === bet.playerId) {
      craque++;
    }
  });
  
  const avg = jp > 0 ? (pts / jp) : 0;
  
  // Aplicar overrides do admin se existirem
  if (user?.adminOverrides) {
    if (user.adminOverrides.manualPoints !== undefined) {
      pts = user.adminOverrides.manualPoints;
    }
    if (user.adminOverrides.manualCraques !== undefined) {
      craque = user.adminOverrides.manualCraques;
    }
  }
  
  return { pts, jp, mc, craque, avg };
}
  
// getUserPoints também precisa ser assíncrona
export async function getUserPoints(userId) { 
  const stats = await getUserStats(userId);
  return stats.pts; 
}

// renderRanking também precisa ser assíncrona
export async function renderRanking() {
  const users = await loadUsers(); // ← AWAIT
  const visibleUsers = users.filter(u => u.profileName !== 'eVagabundoTaLa11223');

  // Mapear stats para cada usuário (Promise.all para aguardar todos)
  const rows = await Promise.all(
    visibleUsers.map(async (u) => ({
      user: u,
      ...(await getUserStats(u.id))
    }))
  );
  
  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.craque !== a.craque) return b.craque - a.craque;
    if (b.mc !== a.mc) return b.mc - a.mc;
    return b.avg - a.avg;
  });

  const medals = ['gold', 'silver', 'bronze'];
  const rankingBody = document.getElementById('rankingBody');
  
  if (!rankingBody) return;
  
  rankingBody.innerHTML = rows.map((r, i) => {
    const pos = i + 1;
    const isMe = r.user.id === currentUser?.id;
    return `<tr class="${isMe ? 'my-row' : ''}">
      <td><span class="rank-pos${pos <= 3 ? ' ' + medals[i] : ''}">${pos <= 3 ? ['🥇', '🥈', '🥉'][i] : pos}</span></td>
      <td>
        <div class="rank-user">
          <div class="rank-avatar">${r.user.profileName.charAt(0).toUpperCase()}</div>
          <div>
            <div class="rank-name">${r.user.profileName}${isMe ? '<span class="rank-you">(você)</span>' : ''}</div>
          </div>
        </div>
      </td>
      <td><span class="rank-pts">${r.pts}</span></td>
      <td class="rank-stat">${r.jp}</td>
      <td class="rank-stat" style="color:var(--gold)">${r.craque}</td>
      <td class="rank-stat">${r.mc}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-d)">Nenhum participante ainda.</td></tr>';
  
  updateSidebar();
}
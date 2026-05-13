import { loadBets, loadUsers } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { sign } from './utils.js';
import { updateSidebar } from './app.js';

export function calcBetPoints(bet, game) {
  if (!game.result) return 0;
  const r = game.result;
  let pts = 0;
  
  if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) {
    pts += 7;
  } 
  else if (sign(bet.homeScore - bet.awayScore) === sign(r.homeScore - r.awayScore)) {
    pts += 5;
  }
  
  if (bet.playerId && r.scorers && Array.isArray(r.scorers)) {
    const scorerFound = r.scorers.find(s => s.playerId === bet.playerId);
    if (scorerFound) {
      pts += 3 + (scorerFound.goals - 1);
    }
  }
  
  if (bet.playerId && r.craqueId === bet.playerId) {
    pts += 4;
  }
  
  return pts;
}

async function getUserStats(userId) {
  const users = await loadUsers();
  const user = users.find(u => u && u.id === userId);
  
  const bets = await loadBets();
  const userBets = bets[userId] || {};
  let pts = 0, jp = 0, mc = 0, craque = 0;
  
  Object.entries(userBets).forEach(([gid, bet]) => {
    const g = GAMES_STATE.find(x => x && x.id === gid);
    if (!g) return;
    jp++;
    if (!g.result) return;
    const p = calcBetPoints(bet, g);
    pts += p;
    const r = g.result;
    if (bet.playerId && r.scorers && Array.isArray(r.scorers)) {
      const scorerFound = r.scorers.find(s => s.playerId === bet.playerId);
      if (scorerFound && scorerFound.goals > 0) mc++;
    }
    if (bet.playerId && r.craqueId === bet.playerId) craque++;
  });
  
  const avg = jp > 0 ? (pts / jp) : 0;
  
  if (user && user.adminOverrides) {
    if (user.adminOverrides.manualPoints !== undefined) pts = user.adminOverrides.manualPoints;
    if (user.adminOverrides.manualCraques !== undefined) craque = user.adminOverrides.manualCraques;
  }
  
  return { pts, jp, mc, craque, avg };
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
    console.log('👥 Usuários carregados:', users);
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
  
  if (!users || !Array.isArray(users) || users.length === 0) {
    const rankingBody = document.getElementById('rankingBody');
    if (rankingBody) {
      rankingBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">Nenhum participante ainda.</td></tr>';
    }
    return;
  }
  
  // Filtrar usuários válidos (com nome) e não ocultos
  const visibleUsers = users.filter(u => {
    if (!u) return false;
    if (u.isHidden === true) return false;
    if (!u.profileName || u.profileName.trim() === '' || u.profileName === 'u') return false;
    return true;
  });
  
  console.log('👥 Usuários visíveis:', visibleUsers.length);
  
  // Mapear stats para cada usuário
  const rowsWithStats = [];
  for (const user of visibleUsers) {
    try {
      const stats = await getUserStats(user.id);
      rowsWithStats.push({
        user: user,
        ...stats
      });
    } catch (error) {
      console.error(`Erro ao buscar stats para ${user.id}:`, error);
    }
  }
  
  // Ordenar por pontuação
  rowsWithStats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.craque !== a.craque) return b.craque - a.craque;
    if (b.mc !== a.mc) return b.mc - a.mc;
    return b.avg - a.avg;
  });
  
  const medals = ['gold', 'silver', 'bronze'];
  const rankingBody = document.getElementById('rankingBody');
  if (!rankingBody) return;
  
  if (rowsWithStats.length === 0) {
    rankingBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">Nenhum participante ainda.</td></tr>';
    return;
  }
  
  rankingBody.innerHTML = rowsWithStats.map((r, i) => {
    const pos = i + 1;
    const isMe = r.user && r.user.id === currentUser?.id;
    
    // Garantir nome válido
    let displayName = r.user?.profileName || 'Jogador';
    if (displayName === 'u' || displayName === 'Usuário' || displayName.length < 2) {
      displayName = `Jogador_${(r.user?.id || 'xxxx').substring(0, 4)}`;
    }
    
    // Garantir avatar (primeira letra em maiúsculo)
    const avatarChar = displayName.charAt(0).toUpperCase();
    
    // Medalhas ou número
    let rankDisplay = pos;
    let rankClass = '';
    if (pos === 1) {
      rankDisplay = '🥇';
      rankClass = 'gold';
    } else if (pos === 2) {
      rankDisplay = '🥈';
      rankClass = 'silver';
    } else if (pos === 3) {
      rankDisplay = '🥉';
      rankClass = 'bronze';
    }
    
    return `<tr class="${isMe ? 'my-row' : ''}">
      <td class="center"><span class="rank-pos ${rankClass}">${rankDisplay}</span></td>
      <td>
        <div class="rank-user">
          <div class="rank-avatar">${avatarChar}</div>
          <div>
            <div class="rank-name">${escapeHtml(displayName)}${isMe ? '<span class="rank-you"> (você)</span>' : ''}</div>
          </div>
        </div>
      </td>
      <td class="center rank-stat"><span class="rank-pts">${r.pts || 0}</span></td>
      <td class="center rank-stat">${r.jp || 0}</td>
      <td class="center rank-stat" style="color:var(--gold); font-weight:bold;">${r.craque || 0}</td>
      <td class="center rank-stat">${r.mc || 0}</td>
    </tr>`;
  }).join('');
  
  // Atualizar sidebar se necessário
  if (typeof updateSidebar === 'function') {
    updateSidebar();
  }
}

// Função auxiliar para escapar HTML (evita injeção)
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
import { loadBets, loadUsers } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { sign } from './utils.js';
import { updateSidebar } from './app.js';
import { getPlayer } from './exportplayer.js';

export function calcBetPoints(bet, game) {
  if (!game.result) return 0;
  const r = game.result;
  let pts = 0;

  const betWinner = sign(bet.homeScore - bet.awayScore);
  const realWinner = sign(r.homeScore - r.awayScore);
  const exact = (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore);

  const isKnockout = game.group === 'knockout';

  if (isKnockout) {
    // =============================================
    // LÓGICA EXCLUSIVA PARA MATA‑MATA (KNOCKOUT)
    // =============================================

    // 1. Pontos por resultado (vitória/empate) – base 5
    if (betWinner === realWinner) {
      pts += 5;
    }

    // 2. Bônus por acertar a ocorrência de prorrogação
    //    (se houve prorrogação e o usuário marcou, ou não houve e ele não marcou)
    if (r.overtime !== undefined && bet.overtime === r.overtime) {
      pts += 3;
    }

    // 3. Bônus por acertar o vencedor nos pênaltis
    //    (somente se o placar final foi empate)
    if (betWinner === 0 && r.penaltyWinner && bet.penaltyWinner === r.penaltyWinner) {
      pts += 4;
    }

    // 4. Placar exato – só vale se a previsão de prorrogação estiver correta
    if (exact && bet.overtime === r.overtime) {
      pts += 14;
    }

  } else {
    // =============================================
    // LÓGICA ORIGINAL PARA FASE DE GRUPOS (e outros)
    // =============================================

    if (exact) {
      pts += 10;          // Placar exato
    } else if (betWinner === realWinner) {
      pts += 6;           // Resultado certo (vencedor/empate)
    }
    // Campos knockout (overtime, penaltyWinner) são ignorados
  }

  // =============================================
  // PONTOS DE JOGADOR (comuns a ambos os formatos)
  // =============================================

  // Gols do jogador representante (2 pts cada)
  if (bet.playerId && r.scorers) {
    const playerGoals = r.scorers
      .filter(s => s.playerId === bet.playerId)
      .reduce((sum, s) => sum + (s.goals || 1), 0);
    pts += playerGoals * 2;
  }

  // Assistências (1 pt cada)
  if (bet.playerId && r.assists) {
    const playerAssists = r.assists
      .filter(a => a.playerId === bet.playerId)
      .reduce((sum, a) => sum + (a.assists || 1), 0);
    pts += playerAssists;
  }

  // Cartão vermelho (-3 pts)
  if (bet.playerId && r.redCards) {
    const hasRed = r.redCards.some(card => card.playerId === bet.playerId);
    if (hasRed) pts -= 3;
  }

  // Craque do jogo (+3 pts)
  if (bet.playerId && r.craqueId === bet.playerId) {
    pts += 3;
  }

  return pts;
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
    const p = calcBetPoints(bet, g);
    pts += p;

    const betWinner = sign(bet.homeScore - bet.awayScore);
    const realWinner = sign(g.result.homeScore - g.result.awayScore);
    if (betWinner === realWinner) victories++;
    if (bet.homeScore === g.result.homeScore && bet.awayScore === g.result.awayScore) exactScores++;
    if (bet.playerId === g.result.craqueId) motm++;
  }

  const avg = jp > 0 ? pts / jp : 0;
  if (user && user.adminOverrides) {
    if (user.adminOverrides.manualPoints !== undefined) pts += user.adminOverrides.manualPoints;
    if (user.adminOverrides.manualCraques !== undefined) motm += user.adminOverrides.manualCraques;
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


export { getUserStats };

window.refreshRanking = async () => {
  console.log('🔄 Forçando recarga do ranking...');
  await renderRanking();
};

// js/communityBets.js
import { TEAMS } from './data/teams.js';
import { loadBets, loadUsers, loadGames } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { formatDate, teamFlagImg } from './utils.js';
import { getPlayer } from './exportplayer.js';
import { sign } from './utils.js';
import { calcBetPoints } from './ranking.js'; // 🔥 usa a mesma lógica do ranking

let currentCommunityDate = null;

// =============================================
// RENDERIZA PRINCIPAL
// =============================================
export async function renderCommunityBets() {
  const container = document.getElementById('communityBetsContainer');
  if (!container) return;

  const [bets, users, games] = await Promise.all([
    loadBets(),
    loadUsers(),
    loadGames()
  ]);

  if (!bets || Object.keys(bets).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">📋</div>
        <h3>Nenhum palpite ainda</h3>
        <p>Os palpites dos participantes aparecerão aqui.</p>
      </div>
    `;
    return;
  }

  const allGames = (games.length ? games : GAMES_STATE);
  const relevantGames = allGames.filter(g => {
    return (g.date && g.date.startsWith('2026-06')) || g.group === 'La Liga' || g.group === 'knockout';
  });

  if (relevantGames.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🏆</div>
        <h3>Aguardando jogos</h3>
        <p>Os jogos da Copa, La Liga e mata‑mata aparecerão aqui.</p>
      </div>
    `;
    return;
  }

  const gamesByDate = {};
  relevantGames.forEach(game => {
    if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
    gamesByDate[game.date].push(game);
  });

  const sortedDates = Object.keys(gamesByDate).sort();
  if (!currentCommunityDate && sortedDates.length) {
    currentCommunityDate = sortedDates[0];
  }

  const usersMap = {};
  users.forEach(u => { usersMap[u.id] = u; });

  const dateSelectorHtml = renderDateSelector(sortedDates);
  const gamesHtml = await renderGamesForDate(
    currentCommunityDate,
    gamesByDate,
    bets,
    usersMap
  );

  container.innerHTML = `
    <div class="community-bets-header">
      <div class="page-header">
        <div>
          <div class="page-title">👥 Palpites da Galera</div>
          <div class="page-subtitle">Veja os palpites de todos os participantes e estatísticas</div>
        </div>
      </div>
      <div class="date-selector community-date-selector" id="communityDateSelector">
        ${dateSelectorHtml}
      </div>
    </div>
    <div class="community-games-list" id="communityGamesList">
      ${gamesHtml}
    </div>
  `;

  const dateSelector = document.getElementById('communityDateSelector');
  if (dateSelector) {
    dateSelector.addEventListener('wheel', (e) => {
      e.preventDefault();
      dateSelector.scrollLeft += e.deltaY;
    }, { passive: false });
  }
}

// =============================================
// RENDERIZA SELECTOR DE DATAS
// =============================================
function renderDateSelector(dates) {
  return dates.map(date => {
    const dt = new Date(date + 'T12:00:00');
    const day = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').substring(0, 3);
    const num = dt.getDate();
    const mon = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').substring(0, 3);
    const isActive = date === currentCommunityDate;
    return `
      <button class="date-btn ${isActive ? 'active' : ''}" onclick="selectCommunityDate('${date}')">
        <span class="dnum">${num}</span>
        <span class="dname">${day}</span>
        <span class="dmonth">${mon}</span>
      </button>
    `;
  }).join('');
}

// =============================================
// RENDERIZA JOGOS DA DATA SELECIONADA
// =============================================
async function renderGamesForDate(date, gamesByDate, bets, usersMap) {
  const games = gamesByDate[date] || [];
  if (games.length === 0) return '<div class="empty-state">Nenhum jogo nesta data.</div>';

  let html = '';

  for (const game of games) {
    const t1 = TEAMS[game.home];
    const t2 = TEAMS[game.away];
    const gameId = game.id;
    const isKnockout = game.group === 'knockout';

    const gameStart = new Date(`${game.date}T${game.time}:00`);
    const hasStarted = gameStart <= new Date() || game.status !== 'upcoming';

    const gameBets = [];
    for (const [userId, userBets] of Object.entries(bets)) {
      if (userBets[gameId]) {
        const user = usersMap[userId];
        if (user && !user.isHidden) {
          gameBets.push({
            user: user,
            bet: userBets[gameId]
          });
        }
      }
    }

    gameBets.sort((a, b) => {
      if (a.user.id === currentUser?.id) return -1;
      if (b.user.id === currentUser?.id) return 1;
      return a.user.profileName.localeCompare(b.user.profileName);
    });

    const betsCount = gameBets.length;
    const hasResult = game.status === 'completed' && game.result;
    const resultText = hasResult ? `${game.result.homeScore} : ${game.result.awayScore}` : 'Aguardando';

    // Estatísticas
    let homeWins = 0, draws = 0, awayWins = 0;
    const scoreCount = new Map();
    const playerCount = new Map();

    for (const { bet } of gameBets) {
      if (bet.homeScore > bet.awayScore) homeWins++;
      else if (bet.homeScore === bet.awayScore) draws++;
      else awayWins++;
      const scoreKey = `${bet.homeScore}-${bet.awayScore}`;
      scoreCount.set(scoreKey, (scoreCount.get(scoreKey) || 0) + 1);
      if (bet.playerId) playerCount.set(bet.playerId, (playerCount.get(bet.playerId) || 0) + 1);
    }

    const total = gameBets.length;
    const homePercent = total ? Math.round((homeWins / total) * 100) : 0;
    const drawPercent = total ? Math.round((draws / total) * 100) : 0;
    const awayPercent = total ? Math.round((awayWins / total) * 100) : 0;

    let mostFrequentScore = 'Nenhum palpite';
    let maxScoreCount = 0;
    for (const [score, count] of scoreCount.entries()) {
      if (count > maxScoreCount) {
        maxScoreCount = count;
        mostFrequentScore = score.replace('-', ' : ');
      }
    }
    if (total === 0) mostFrequentScore = '—';

    let mostFrequentPlayer = '—';
    let maxPlayerCount = 0;
    for (const [playerId, count] of playerCount.entries()) {
      if (count > maxPlayerCount) {
        maxPlayerCount = count;
        const player = getPlayer(playerId);
        mostFrequentPlayer = player ? player.name : '?';
      }
    }

    const showBets = hasStarted;
    const betsBody = showBets
      ? renderBetsList(gameBets, game)
      : '<div class="no-bets-msg">⏳ Os palpites serão exibidos após o início da partida.</div>';

    html += `
      <div class="community-game-card" data-game-id="${gameId}">
        <div class="community-game-header" onclick="toggleCommunityGame('${gameId}')">
          <div class="community-game-info">
            <div class="community-teams">
              <div class="community-team">
                ${teamFlagImg(t1, 30)}
                <span class="community-team-name">${t1?.name || game.home}</span>
              </div>
              <div class="community-vs">VS</div>
              <div class="community-team">
                ${teamFlagImg(t2, 30)}
                <span class="community-team-name">${t2?.name || game.away}</span>
              </div>
            </div>
            <div class="community-game-meta">
              <span class="game-badge">${isKnockout ? '🏆 Mata‑Mata' : game.group === 'La Liga' ? '🏆 La Liga' : `🌍 Copa - Grupo ${game.group}`}</span>
              <span>⏰ ${game.time}</span>
              <span class="result-badge ${hasResult ? 'rb-exact' : 'rb-loss'}">${resultText}</span>
            </div>
            <div class="community-stats" style="display:flex; gap:16px; margin-top:8px; font-size:12px; color:var(--text-d); flex-wrap:wrap;">
              <div>📊 Resultados: <span style="color:var(--green-l);">${homePercent}%</span> | <span style="color:var(--gold);">${drawPercent}%</span> | <span style="color:var(--red-l);">${awayPercent}%</span></div>
              <div>🎯 Placar mais votado: ${mostFrequentScore} (${maxScoreCount} palpites)</div>
              <div>⭐ Craque mais escolhido: ${mostFrequentPlayer}</div>
            </div>
          </div>
          <div class="community-game-stats">
            <span class="bets-count">📋 ${betsCount} palpite${betsCount !== 1 ? 's' : ''}</span>
            <span class="expand-icon">▼</span>
          </div>
        </div>
        <div class="community-game-body" id="community-game-${gameId}" style="display: none;">
          ${betsBody}
        </div>
      </div>
    `;
  }
  return html;
}

// =============================================
// RENDERIZA LISTA DE PALPITES DE UM JOGO
// =============================================
function renderBetsList(gameBets, game) {
  if (gameBets.length === 0) {
    return '<div class="no-bets-msg">Nenhum palpite para este jogo ainda.</div>';
  }

  const isKnockout = game.group === 'knockout';

  return `
    <table class="community-bets-table">
      <thead>
        <tr>
          <th>Participante</th>
          <th>Palpite</th>
          ${isKnockout ? '<th>Detalhes</th>' : ''}
          <th>Jogador</th>
          <th class="pts-col">Pontos</th>
        </tr>
      </thead>
      <tbody>
        ${gameBets.map(({ user, bet }) => {
          const player = bet.playerId ? getPlayer(bet.playerId) : null;
          const isCurrentUser = user.id === currentUser?.id;
          const pts = game.result ? calcBetPoints(bet, game) : '-'; // usa a função do ranking

          let playersDisplay = player ? player.name : '—';

          // Monta detalhes extras para knockout
          let detailsHtml = '';
          if (isKnockout) {
            const overtimeText = bet.overtime ? '⏱️ Sim' : '⏱️ Não';
            const penaltyText = bet.penaltyWinner
              ? `🏆 ${bet.penaltyWinner === 'home' ? TEAMS[game.home]?.name || 'Casa' : TEAMS[game.away]?.name || 'Visitante'}`
              : '—';
            detailsHtml = `<div style="font-size:11px; color:var(--text-d);">Prorrogação: ${overtimeText}<br>Pênaltis: ${penaltyText}</div>`;
          }

          return `
            <tr class="${isCurrentUser ? 'current-user-bet' : ''}">
              <td class="user-cell">
                <div class="user-avatar-small">${user.profileName.charAt(0).toUpperCase()}</div>
                <span class="user-name">${user.profileName}${isCurrentUser ? ' (você)' : ''}</span>
              </td>
              <td class="score-cell">
                <strong>${bet.homeScore} : ${bet.awayScore}</strong>
              </td>
              ${isKnockout ? `<td class="details-cell">${detailsHtml}</td>` : ''}
              <td class="player-cell">${playersDisplay}</td>
              <td class="pts-cell">
                <span class="pts-value">${pts}</span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// =============================================
// FUNÇÕES GLOBAIS
// =============================================
window.selectCommunityDate = async (date) => {
  currentCommunityDate = date;
  await renderCommunityBets();
};

window.toggleCommunityGame = (gameId) => {
  const body = document.getElementById(`community-game-${gameId}`);
  if (body) {
    const isVisible = body.style.display === 'block';
    body.style.display = isVisible ? 'none' : 'block';
    const header = body.previousElementSibling;
    const icon = header?.querySelector('.expand-icon');
    if (icon) {
      icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  }
};

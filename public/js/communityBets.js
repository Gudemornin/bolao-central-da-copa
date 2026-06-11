// js/communityBets.js
import { TEAMS } from './data/teams.js';
import { loadBets, loadUsers, loadGames } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { formatDate, teamFlagImg } from './utils.js';
import { getPlayer } from './exportplayer.js';
import { sign } from './utils.js';

let currentCommunityDate = null;

// =============================================
// RENDERIZA PRINCIPAL
// =============================================
export async function renderCommunityBets() {
  const container = document.getElementById('communityBetsContainer');
  if (!container) return;

  // Carregar dados
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

  // 🔥 ALTERAÇÃO: Incluir jogos da La Liga também (não apenas Copa)
  const allGames = (games.length ? games : GAMES_STATE);
  const relevantGames = allGames.filter(g => {
    // Jogos da Copa (datas junho/2026) OU jogos da La Liga (group 'La Liga')
    return (g.date && g.date.startsWith('2026-06')) || g.group === 'Champions League Final';
  });

  if (relevantGames.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🏆</div>
        <h3>Aguardando jogos</h3>
        <p>Os jogos da Copa e da La Liga aparecerão aqui.</p>
      </div>
    `;
    return;
  }

  // Agrupar jogos por data
  const gamesByDate = {};
  relevantGames.forEach(game => {
    if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
    gamesByDate[game.date].push(game);
  });

  // Ordenar datas
  const sortedDates = Object.keys(gamesByDate).sort();
  if (!currentCommunityDate && sortedDates.length) {
    currentCommunityDate = sortedDates[0];
  }

  // Mapear usuários por ID
  const usersMap = {};
  users.forEach(u => { usersMap[u.id] = u; });

  // Renderizar seletor de datas
  const dateSelectorHtml = renderDateSelector(sortedDates);

  // Renderizar jogos da data selecionada
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

  // Adicionar evento de scroll nas datas
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

    // Verificar se a partida já começou ou já foi finalizada
    const gameStart = new Date(`${game.date}T${game.time}:00`);
    const hasStarted = gameStart <= new Date() || game.status !== 'upcoming';

    // Coletar todos os palpites para este jogo
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

    // Ordenar palpites (primeiro os do usuário logado, depois por nome)
    gameBets.sort((a, b) => {
      if (a.user.id === currentUser?.id) return -1;
      if (b.user.id === currentUser?.id) return 1;
      return a.user.profileName.localeCompare(b.user.profileName);
    });

    const betsCount = gameBets.length;
    const hasResult = game.status === 'completed' && game.result;
    const resultText = hasResult ? `${game.result.homeScore} : ${game.result.awayScore}` : 'Aguardando';

    // =============================================
    // CALCULAR ESTATÍSTICAS DOS PALPITES (opcional)
    // =============================================
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
      if (bet.player2Id) playerCount.set(bet.player2Id, (playerCount.get(bet.player2Id) || 0) + 1);
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

    // Corpo do card (expansível) – mostra palpites APENAS se a partida já começou
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
              <span class="game-badge">${game.group === 'La Liga' ? '🏆 La Liga' : `🌍 Copa - Grupo ${game.group}`}</span>
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

  return `
    <table class="community-bets-table">
      <thead>
        <tr>
          <th>Participante</th>
          <th>Palpite</th>
          <th>Jogador</th>
          <th class="pts-col">Pontos</th>
        </tr>
      </thead>
      <tbody>
        ${gameBets.map(({ user, bet }) => {
          const player = bet.playerId ? getPlayer(bet.playerId) : null;
          const player2 = bet.player2Id ? getPlayer(bet.player2Id) : null;
          const isCurrentUser = user.id === currentUser?.id;
          const pts = game.result ? calculateBetPoints(bet, game) : '-';

          let playersDisplay = '';
          if (player && player2) {
            playersDisplay = `${player.name} / ${player2.name}`;
          } else if (player) {
            playersDisplay = player.name;
          } else {
            playersDisplay = '—';
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
              <td class="player-cell">
                ${playersDisplay}
               </td>
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
// CALCULA PONTOS (mesma lógica do ranking)
// =============================================
function calculateBetPoints(bet, game) {
  if (!game || !game.result) return 0;
  const r = game.result;
  let pts = 0;

  // 1. Pontos por resultado da partida
  const betWinner = Math.sign(bet.homeScore - bet.awayScore);
  const realWinner = Math.sign(r.homeScore - r.awayScore);
  const exact = (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore);

  if (exact) {
    pts += 10;               // placar exato
  } else if (betWinner === realWinner) {
    pts += 6;                // apenas resultado correto (vitória/empate)
  }

  // Se não há jogador representante, retorna apenas os pontos do resultado
  if (!bet.playerId) {
    return pts;
  }

  // 2. Gols do jogador (2 pts por gol)
  if (r.scorers && Array.isArray(r.scorers)) {
    const playerGoals = r.scorers
      .filter(s => s.playerId === bet.playerId)
      .reduce((sum, s) => sum + (s.goals || 1), 0);
    pts += playerGoals * 2;
  }

  // 3. Assistências (1 pt cada)
  if (r.assists && Array.isArray(r.assists)) {
    const playerAssists = r.assists
      .filter(a => a.playerId === bet.playerId)
      .reduce((sum, a) => sum + (a.assists || 1), 0);
    pts += playerAssists;
  }

  // 4. Cartão vermelho (-3 pts)
  if (r.redCards && Array.isArray(r.redCards)) {
    const hasRed = r.redCards.some(card => card.playerId === bet.playerId);
    if (hasRed) pts -= 3;
  }

  // 5. Craque do jogo (+3 pts)
  if (r.craqueId === bet.playerId) {
    pts += 3;
  }

  return pts;
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

}

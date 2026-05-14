// js/communityBets.js
import { TEAMS } from './data/teams.js';
import { loadBets, loadUsers, loadGames } from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { formatDate, teamFlagImg, getPlayer } from './utils.js';

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

  // Filtrar apenas jogos da Copa (data junho/2026)
const worldCupGames = (games.length ? games : GAMES_STATE).filter(g => 
    g.date && g.date.startsWith('2026-06')
);

if (worldCupGames.length === 0) {
    container.innerHTML = `
    <div class="empty-state">
        <div class="es-icon">🏆</div>
        <h3>Aguardando jogos da Copa</h3>
        <p>Os jogos começarão em junho de 2026.</p>
    </div>
    `;
    return;
}

  // Agrupar jogos por data
const gamesByDate = {};
worldCupGames.forEach(game => {
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
        <div class="page-subtitle">Veja os palpites de todos os participantes</div>
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

if (games.length === 0) {
    return '<div class="empty-state">Nenhum jogo nesta data.</div>';
}

let html = '';

for (const game of games) {
    const t1 = TEAMS[game.home];
    const t2 = TEAMS[game.away];
    const gameId = game.id;
    
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
            <span class="game-badge">Grupo ${game.group}</span>
            <span>⏰ ${game.time}</span>
            <span class="result-badge ${hasResult ? 'rb-exact' : 'rb-loss'}">${resultText}</span>
            </div>
        </div>
        <div class="community-game-stats">
            <span class="bets-count">📋 ${betsCount} palpite${betsCount !== 1 ? 's' : ''}</span>
            <span class="expand-icon">▼</span>
        </div>
        </div>
        <div class="community-game-body" id="community-game-${gameId}" style="display: none;">
        ${renderBetsList(gameBets, game)}
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
        const isCurrentUser = user.id === currentUser?.id;
        const pts = game.result ? calculateBetPoints(bet, game) : '-';
        
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
                ${player ? `${player.name}` : '—'}
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
if (!game.result) return 0;
const r = game.result;
let pts = 0;

if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) {
    pts += 7;
} else if (Math.sign(bet.homeScore - bet.awayScore) === Math.sign(r.homeScore - r.awayScore)) {
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
    // Rotacionar ícone
    const header = body.previousElementSibling;
    const icon = header?.querySelector('.expand-icon');
    if (icon) {
    icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}
};
import { TEAMS } from './data/teams.js';
import { showToast } from './ui.js';
import { getPlayer, getPlayersByTeams, filterPlayers} from './exportplayer.js';
import { saveGames, loadGames, loadBets } from './storage.js';
import { GAMES_STATE, setGamesState } from './state.js';
import { formatDate, teamFlagImg } from './utils.js';
import { renderAdminPanel } from './adminPanel.js';

// Array para armazenar goleadores temporariamente (por jogo)
const tempScorers = {};
const tempEvents = {};

export async function renderAdmin() {
  const container = document.getElementById('adminGamesList');
  if (!container) return;
  
  // Verificar se é admin
  if (!window.currentUser?.isAdmin) {
    container.innerHTML = '<div style="text-align:center;padding:60px;">🔒 Acesso restrito</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="admin-tabs" style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--border);">
<button class="admin-tab-btn active" onclick="showAdminTab('users', this)">👥 Usuários</button>
    <button class="admin-tab-btn" onclick="showAdminTab('games', this)">⚽ Resultados</button>
    <button class="admin-tab-btn" onclick="showAdminTab('matches', this)">📅 Partidas</button>
      <button class="admin-tab-btn" onclick="showAdminTab('bets', this)">📋 Palpites</button>
  <button class="admin-tab-btn" onclick="showAdminTab('specials', this)">🏆 Especiais</button>
    </div>
    <div id="adminTabContent"></div>
  `;
  
  // Mostrar aba de usuários por padrão
  const firstButton = container.querySelector('.admin-tab-btn');
  if (firstButton) {
    showAdminTab('users', firstButton);
  }
}

window.showAdminTab = (tab, button) => {
  const content = document.getElementById('adminTabContent');
  if (!content) return;
  
  // Atualizar estilo das abas
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (button) button.classList.add('active');
  
  if (tab === 'users') {
    renderAdminPanel();
  } else if (tab === 'games') {
    renderAdminGames(); // Função original do admin.js para resultados
  }
};

export async function renderAdminGames() {
  const el = document.getElementById('adminTabContent');
  if (!el) return;

  // 🔥 CORREÇÃO: Carregar games ANTES de usá-lo
  const games = GAMES_STATE.length ? GAMES_STATE : await loadGames();
  if (games.length && !GAMES_STATE.length) setGamesState(games);

  // Agora podemos usar games com segurança
  // Agrupar jogos por data
  const gamesByDate = {};
  games.forEach(game => {
    if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
    gamesByDate[game.date].push(game);
  });

  const sortedDates = Object.keys(gamesByDate).sort();

  let html = `
    <div class="admin-date-filter" style="margin-bottom:20px;">
      <label class="form-label">Filtrar por data:</label>
      <select id="adminDateFilter" class="form-input" style="width:auto;display:inline-block;margin-left:10px;">
        <option value="all">Todas as datas</option>
        ${sortedDates.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
    </div>
    <div id="adminGamesContainer"></div>
  `;
  el.innerHTML = html;

  const renderGamesByDate = (selectedDate) => {
    const container = document.getElementById('adminGamesContainer');
    const gamesToShow = selectedDate === 'all' ? games : games.filter(g => g.date === selectedDate);
    
    // Gera o HTML dos cards usando os dados de gamesToShow
    container.innerHTML = gamesToShow.map(g => {
      const t1 = TEAMS[g.home], t2 = TEAMS[g.away];
      const r = g.result || {};
      const gamePlayers = getPlayersByTeams(g.home, g.away);
      
      // Inicializar tempScorers e tempEvents se necessário
      if (!tempScorers[g.id]) tempScorers[g.id] = r.scorers ? [...r.scorers] : [];
      if (!tempEvents[g.id]) tempEvents[g.id] = r.events ? [...r.events] : [];
      
      const scorersList = tempScorers[g.id] || [];
      
      return `
        <div class="admin-game-row" id="admin-game-${g.id}">
          <h4>
            ${teamFlagImg(t1, 22)} ${t1?.name} × ${teamFlagImg(t2, 22)} ${t2?.name} — ${formatDate(g.date)} ${g.time}
            <span class="status-badge ${g.status === 'completed' ? 'status-completed' : 'status-upcoming'}" style="margin-left:8px;">
              ${g.status === 'completed' ? 'Finalizado' : 'Aguardando'}
            </span>
          </h4>
          
          <!-- Resultado do jogo -->
          <div class="admin-section">
            <div class="admin-label">Resultado</div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
              <input class="admin-input" type="number" id="homeScore_${g.id}" value="${r.homeScore !== undefined ? r.homeScore : ''}" placeholder="0" min="0" max="99" style="width:70px;">
              <span style="font-size:20px;">:</span>
              <input class="admin-input" type="number" id="awayScore_${g.id}" value="${r.awayScore !== undefined ? r.awayScore : ''}" placeholder="0" min="0" max="99" style="width:70px;">
            </div>
          </div>
          
          <!-- Múltiplos Goleadores -->
          <div class="admin-section">
            <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>⚽ Goleadores (múltiplos)</span>
              <button type="button" class="admin-add-btn" onclick="adminAddScorer('${g.id}')" style="background:var(--green);padding:4px 10px;font-size:11px;">
                + Adicionar Goleador
              </button>
            </div>
            <div id="scorers-list-${g.id}" style="margin-top:10px;">
              ${renderScorersList(g.id, scorersList, gamePlayers)}
            </div>
          </div>

          <!-- Eventos do Jogo -->
          <div class="admin-section">
            <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>🅰️ Assistências</span>
              <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','assist')" style="background:var(--green);padding:4px 10px;font-size:11px;">
                + Adicionar Assistência
              </button>
            </div>
            <div id="event_section_assist_${g.id}" style="margin-top:10px;">
              ${renderEventSection(g.id, 'assist', 'Assistência', gamePlayers)}
            </div>
          </div>

          <div class="admin-section" style="margin-top:14px;">
            <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>🟨 Cartões Amarelos</span>
              <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','yellow_card')" style="background:var(--green);padding:4px 10px;font-size:11px;">
                + Adicionar Cartão
              </button>
            </div>
            <div id="event_section_yellow_card_${g.id}" style="margin-top:10px;">
              ${renderEventSection(g.id, 'yellow_card', 'Cartão Amarelo', gamePlayers)}
            </div>
          </div>

          <div class="admin-section" style="margin-top:14px;">
            <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>🟥 Cartões Vermelhos</span>
              <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','red_card')" style="background:var(--green);padding:4px 10px;font-size:11px;">
                + Adicionar Cartão
              </button>
            </div>
            <div id="event_section_red_card_${g.id}" style="margin-top:10px;">
              ${renderEventSection(g.id, 'red_card', 'Cartão Vermelho', gamePlayers)}
            </div>
          </div>

          <div class="admin-section" style="margin-top:14px;">
            <div class="admin-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>🧤 Pênaltis Defendidos</span>
              <button type="button" class="admin-add-btn" onclick="adminAddEvent('${g.id}','penalty_saved')" style="background:var(--green);padding:4px 10px;font-size:11px;">
                + Adicionar Defesa
              </button>
            </div>
            <div id="event_section_penalty_saved_${g.id}" style="margin-top:10px;">
              ${renderEventSection(g.id, 'penalty_saved', 'Penalti Defendido', gamePlayers, true)}
            </div>
          </div>

          <!-- Craque do Jogo -->
          <div class="admin-section">
            <div class="admin-label">⭐ Craque do Jogo</div>
            <select class="admin-input admin-input-wide" id="craque_${g.id}" style="width:auto;margin-top:6px;">
              <option value="">Nenhum</option>
              ${gamePlayers.map(p => `<option value="${p.id}" ${r.craqueId === p.id ? 'selected' : ''}>${p.name} (${TEAMS[p.team]?.name || p.team})</option>`).join('')}
            </select>
          </div>
          
          <!-- Botão Salvar -->
          <div style="margin-top:20px;">
            <button class="admin-save-btn" onclick="adminSaveGame('${g.id}')">💾 SALVAR TODAS AS INFORMAÇÕES</button>
          </div>
        </div>
        <hr style="margin:20px 0;border-color:var(--border);">
      `;
    }).join('');
    
    // Reatribuir eventos após renderização (se necessário)
    document.querySelectorAll('.admin-remove-btn, .admin-add-btn, .admin-save-btn').forEach(btn => {
      const onclickAttr = btn.getAttribute('onclick');
      if (onclickAttr) {
        const funcName = onclickAttr.split('(')[0];
        if (window[funcName]) btn.onclick = window[funcName].bind(null, ...onclickAttr.match(/'(.*?)'/g)?.map(s => s.replace(/'/g, '')) || []);
      }
    });
  };
  
  const dateFilter = document.getElementById('adminDateFilter');
  if (dateFilter) {
    dateFilter.addEventListener('change', (e) => {
      renderGamesByDate(e.target.value);
    });
  }
  
  renderGamesByDate('all');
}

async function renderAdminBets() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;
  const res = await fetch('/api/bets');
  const data = await res.json();
  const bets = data.bets || {};
  const usersRes = await fetch('/api/users');
  const usersData = await usersRes.json();
  const users = usersData.users || [];
  const games = await loadGames(); // função já existente

  let html = `<div class="ranking-wrap"><table class="ranking-table"><thead><tr><th>Usuário</th><th>Jogo</th><th>Placar</th><th>Jogador</th><th>Data do Palpite</th></tr></thead><tbody>`;
  for (const [userId, userBets] of Object.entries(bets)) {
    const user = users.find(u => u.id === userId);
    const userName = user ? user.profileName : userId;
    for (const [gameId, bet] of Object.entries(userBets)) {
      const game = games.find(g => g.id === gameId);
      const gameTitle = game ? `${game.home} x ${game.away}` : gameId;
      const player = bet.playerId ? getPlayer(bet.playerId) : null;
      const playerName = player ? player.name : '—';
      html += `<tr>
        <td>${userName}</td>
        <td>${gameTitle}</td>
        <td>${bet.homeScore} : ${bet.awayScore}</td>
        <td>${playerName}</td>
        <td>${new Date(bet.savedAt).toLocaleString()}</td>
      </tr>`;
    }
  }
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

async function renderAdminSpecials() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;
  const res = await fetch('/api/special-picks/all');
  const data = await res.json();
  const picks = data.picks || [];

  let html = `<div class="ranking-wrap"><table class="ranking-table"><thead><tr><th>Usuário</th><th>Campeão</th><th>Craque (MVP)</th><th>Revelação</th><th>Atualizado em</th></tr></thead><tbody>`;
  for (const pick of picks) {
    const championTeam = pick.champion_team ? (TEAMS[pick.champion_team]?.name || pick.champion_team) : '—';
    const mvp = pick.mvp_player_id ? (getPlayer(pick.mvp_player_id)?.name || pick.mvp_player_id) : '—';
    const revelation = pick.revelation_player_id ? (getPlayer(pick.revelation_player_id)?.name || pick.revelation_player_id) : '—';
    html += `<tr>
      <td>${pick.profile_name}</td>
      <td>${championTeam}</td>
      <td>${mvp}</td>
      <td>${revelation}</td>
      <td>${new Date(pick.updated_at).toLocaleString()}</td>
    </tr>`;
  }
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

async function renderAdminTeams() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;

  // Carregar times do backend
  const response = await fetch('/api/teams');
  const data = await response.json();
  const teams = data.teams || [];

  let html = `
    <div style="margin-bottom: 20px;">
      <button class="btn btn-blue" onclick="showCreateTeamModal()">+ Nova Equipe</button>
    </div>
    <div class="ranking-wrap">
      <table class="ranking-table">
        <thead><tr><th>ID</th><th>Nome</th><th>Bandeira</th><th>Grupo</th><th>Ações</th></tr></thead>
        <tbody>
          ${teams.map(team => `
            <tr>
              <td>${team.id}</td>
              <td>${team.name}</td>
              <td>${team.flag ? `<img src="${team.flag}" style="width:24px;height:18px;">` : '—'}</td>
              <td>${team.group_name || '—'}</td>
              <td>
                <button class="admin-action-btn" onclick="editTeam('${team.id}')" style="background:var(--blue);">✏️ Editar</button>
                <button class="admin-action-btn" onclick="deleteTeam('${team.id}')" style="background:var(--red);">🗑️ Remover</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <!-- Modais para criar/editar time -->
    <div id="teamModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Equipe</span><button class="modal-close" onclick="closeModal('teamModal')">✕</button></div>
        <div class="modal-body">
          <input type="hidden" id="teamId">
          <div class="form-group"><label class="form-label">ID (ex: valencia)</label><input class="form-input" id="teamIdInput"></div>
          <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="teamName"></div>
          <div class="form-group"><label class="form-label">URL da Bandeira</label><input class="form-input" id="teamFlag"></div>
          <div class="form-group"><label class="form-label">Cor (opcional)</label><input class="form-input" id="teamColor"></div>
          <div class="form-group"><label class="form-label">Grupo/Liga</label><input class="form-input" id="teamGroup"></div>
          <button class="btn btn-green" onclick="saveTeam()">Salvar</button>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

// Funções globais para times
window.showCreateTeamModal = () => {
  document.getElementById('teamId').value = '';
  document.getElementById('teamIdInput').value = '';
  document.getElementById('teamName').value = '';
  document.getElementById('teamFlag').value = '';
  document.getElementById('teamColor').value = '';
  document.getElementById('teamGroup').value = '';
  openModal('teamModal');
};

window.editTeam = async (teamId) => {
  const res = await fetch('/api/teams');
  const data = await res.json();
  const team = data.teams.find(t => t.id === teamId);
  if (team) {
    document.getElementById('teamId').value = team.id;
    document.getElementById('teamIdInput').value = team.id;
    document.getElementById('teamName').value = team.name;
    document.getElementById('teamFlag').value = team.flag || '';
    document.getElementById('teamColor').value = team.color || '';
    document.getElementById('teamGroup').value = team.group_name || '';
    openModal('teamModal');
  }
};

window.saveTeam = async () => {
  const id = document.getElementById('teamId').value;
  const newId = document.getElementById('teamIdInput').value;
  const name = document.getElementById('teamName').value;
  const flag = document.getElementById('teamFlag').value;
  const color = document.getElementById('teamColor').value;
  const group = document.getElementById('teamGroup').value;
  if (!newId || !name) { showToast('ID e nome são obrigatórios', 'red'); return; }
  const payload = { id: newId, name, flag, color, group };
  if (id) {
    // update
    await fetch(`/api/teams/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    showToast('Equipe atualizada!', 'green');
  } else {
    // create
    await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    showToast('Equipe criada!', 'green');
  }
  closeModal('teamModal');
  renderAdminTeams();
};

window.deleteTeam = async (teamId) => {
  if (!confirm('Remover esta equipe permanentemente?')) return;
  const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Equipe removida', 'green');
    renderAdminTeams();
  } else {
    const error = await res.json();
    showToast(error.error || 'Erro ao remover', 'red');
  }
};

async function renderAdminMatches() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;

  // Carregar times e partidas
  const [teamsRes, gamesRes] = await Promise.all([
    fetch('/api/teams'),
    fetch('/api/games-structured')
  ]);
  const teamsData = await teamsRes.json();
  const gamesData = await gamesRes.json();
  const teams = teamsData.teams || [];
  const games = gamesData.games || [];

  let html = `
    <div style="margin-bottom: 20px;">
      <button class="btn btn-blue" onclick="showCreateMatchModal()">+ Nova Partida</button>
    </div>
    <div class="ranking-wrap">
      <table class="ranking-table">
        <thead><tr><th>Data</th><th>Horário</th><th>Mandante</th><th>Visitante</th><th>Grupo</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${games.map(game => {
            const home = teams.find(t => t.id === game.home_team)?.name || game.home_team;
            const away = teams.find(t => t.id === game.away_team)?.name || game.away_team;
            return `
              <tr>
                <td>${game.date}</td>
                <td>${game.time}</td>
                <td>${home}</td>
                <td>${away}</td>
                <td>${game.group_name || '—'}</td>
                <td>${game.status === 'completed' ? 'Finalizado' : 'Agendado'}</td>
                <td>
                  <button class="admin-action-btn" onclick="editMatch('${game.id}')" style="background:var(--blue);">✏️ Editar</button>
                  <button class="admin-action-btn" onclick="deleteMatch('${game.id}')" style="background:var(--red);">🗑️ Remover</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <!-- Modal para criar/editar partida -->
    <div id="matchModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Partida</span><button class="modal-close" onclick="closeModal('matchModal')">✕</button></div>
        <div class="modal-body">
          <input type="hidden" id="matchId">
          <div class="form-group"><label class="form-label">ID</label><input class="form-input" id="matchIdInput"></div>
          <div class="form-group"><label class="form-label">Data (YYYY-MM-DD)</label><input class="form-input" id="matchDate"></div>
          <div class="form-group"><label class="form-label">Horário (HH:MM)</label><input class="form-input" id="matchTime"></div>
          <div class="form-group"><label class="form-label">Time Mandante</label>
            <select class="form-input" id="matchHome">
              <option value="">Selecione</option>
              ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Time Visitante</label>
            <select class="form-input" id="matchAway">
              <option value="">Selecione</option>
              ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Grupo/Liga</label><input class="form-input" id="matchGroup"></div>
          <div class="form-group"><label class="form-label">Estádio</label><input class="form-input" id="matchVenue"></div>
          <button class="btn btn-green" onclick="saveMatch()">Salvar</button>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

window.showCreateMatchModal = () => {
  document.getElementById('matchId').value = '';
  document.getElementById('matchIdInput').value = '';
  document.getElementById('matchDate').value = '';
  document.getElementById('matchTime').value = '12:00';
  document.getElementById('matchHome').value = '';
  document.getElementById('matchAway').value = '';
  document.getElementById('matchGroup').value = '';
  document.getElementById('matchVenue').value = '';
  openModal('matchModal');
};

window.editMatch = async (matchId) => {
  const res = await fetch('/api/games-structured');
  const data = await res.json();
  const match = data.games.find(g => g.id === matchId);
  if (match) {
    document.getElementById('matchId').value = match.id;
    document.getElementById('matchIdInput').value = match.id;
    document.getElementById('matchDate').value = match.date;
    document.getElementById('matchTime').value = match.time || '12:00';
    document.getElementById('matchHome').value = match.home_team;
    document.getElementById('matchAway').value = match.away_team;
    document.getElementById('matchGroup').value = match.group_name || '';
    document.getElementById('matchVenue').value = match.venue || '';
    openModal('matchModal');
  }
};

window.saveMatch = async () => {
  const id = document.getElementById('matchId').value;
  const newId = document.getElementById('matchIdInput').value;
  const date = document.getElementById('matchDate').value;
  const time = document.getElementById('matchTime').value;
  const home_team = document.getElementById('matchHome').value;
  const away_team = document.getElementById('matchAway').value;
  const group_name = document.getElementById('matchGroup').value;
  const venue = document.getElementById('matchVenue').value;
  if (!newId || !date || !home_team || !away_team) {
    showToast('Preencha ID, data e os dois times', 'red');
    return;
  }
  const payload = { id: newId, date, time, home_team, away_team, group_name, venue };
  if (id) {
    await fetch(`/api/games-structured/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    showToast('Partida atualizada!', 'green');
  } else {
    await fetch('/api/games-structured', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    showToast('Partida criada!', 'green');
  }
  closeModal('matchModal');
  renderAdminMatches();
};

window.deleteMatch = async (matchId) => {
  if (!confirm('Remover esta partida? Todos os palpites associados também serão removidos.')) return;
  const res = await fetch(`/api/games-structured/${matchId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Partida removida', 'green');
    renderAdminMatches();
  } else {
    const error = await res.json();
    showToast(error.error || 'Erro ao remover', 'red');
  }
};

function renderPlayerSearchControl(gameId, itemType, idx, selectedPlayerId, gamePlayers, onlyGoalkeepers = false) {
  const player = selectedPlayerId ? getPlayer(selectedPlayerId) : null;
  const placeholderLabel = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  const selectedValue = player ? player.name : '';

  return `
    <div class="player-search-wrapper" style="position:relative;width:100%;">
      <input
        type="text"
        class="admin-input player-search-input"
        id="player_search_${gameId}_${itemType}_${idx}"
        placeholder="Buscar jogador..."
        autocomplete="off"
        value="${selectedValue}"
        oninput="filterAdminPlayers('${gameId}','${itemType}',${idx}, ${onlyGoalkeepers})"
        onfocus="showAdminPlayerResults('${gameId}','${itemType}',${idx}, ${onlyGoalkeepers})"
        style="width:100%;"
      />
      <input type="hidden" id="player_selected_${gameId}_${itemType}_${idx}" value="${selectedPlayerId || ''}" />
      <div class="player-search-results" id="player_results_${gameId}_${itemType}_${idx}" style="position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--bg);border:1px solid var(--border);border-top:none;max-height:220px;overflow:auto;"></div>
    </div>
  `;
}

function renderScorersList(gameId, scorers, gamePlayers) {
  if (!scorers.length) {
    return '<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhum goleador adicionado ainda.</div>';
  }
  
  return scorers.map((scorer, idx) => {
    return `
      <div class="scorer-item" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;">
        <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
        <div style="flex:1;min-width:220px;">
          ${renderPlayerSearchControl(gameId, 'scorer', idx, scorer.playerId, gamePlayers, false)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" class="admin-input" id="scorer_goals_${gameId}_${idx}" value="${scorer.goals || 1}" min="1" max="9" style="width:60px;text-align:center;">
          <span style="white-space:nowrap;">gol(s)</span>
          <button class="admin-remove-btn" onclick="adminRemoveScorer('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function getTypeEvents(gameId, type) {
  return (tempEvents[gameId] || []).filter(event => event.type === type);
}

function renderEventSection(gameId, eventType, label, gamePlayers, onlyGoalkeepers = false) {
  const events = getTypeEvents(gameId, eventType);
  if (!events.length) {
    return `<div style="color:var(--text-d);font-size:12px;padding:8px;">Nenhum ${label.toLowerCase()} adicionado ainda.</div>`;
  }

  return events.map((event, idx) => {
    return `
      <div class="event-item" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;">
        <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
        <div style="flex:1;min-width:220px;">
          ${renderPlayerSearchControl(gameId, `${eventType}`, idx, event.playerId, gamePlayers, onlyGoalkeepers)}
        </div>
        <button class="admin-remove-btn" onclick="adminRemoveEvent('${gameId}', '${eventType}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
      </div>
    `;
  }).join('');
}

export function filterAdminPlayers(gameId, itemType, idx, onlyGoalkeepers) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  if (!game) {
    console.warn(`Jogo ${gameId} não encontrado em GAMES_STATE`);
    return;
  }
  const input = document.getElementById(`player_search_${gameId}_${itemType}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  if (!input || !results) return;

  const q = input.value.trim();
  if (!q) {
    results.style.display = 'none';
    return;
  }

  let players = filterPlayers(q, [game.home, game.away]);
  if (onlyGoalkeepers === true || onlyGoalkeepers === 'true') {
    players = players.filter(p => p.pos === 'GOL');
  }

  results.innerHTML = players.map(p => `
    <div class="player-search-item" onclick="selectAdminPlayer('${gameId}','${itemType}',${idx},'${p.id}')" style="padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);">
      <span>${p.name} (${TEAMS[p.team]?.name || p.team})</span>
      <span style="opacity:0.7;">${p.pos}</span>
    </div>
  `).join('') || '<div style="padding:8px 12px;">Nenhum jogador encontrado</div>';

  results.style.display = 'block';
}

export function showAdminPlayerResults(gameId, itemType, idx, onlyGoalkeepers) {
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  if (!results) return;
  results.style.display = 'block';
  filterAdminPlayers(gameId, itemType, idx, onlyGoalkeepers);
}

export function selectAdminPlayer(gameId, itemType, idx, playerId) {
  const input = document.getElementById(`player_search_${gameId}_${itemType}_${idx}`);
  const hidden = document.getElementById(`player_selected_${gameId}_${itemType}_${idx}`);
  const results = document.getElementById(`player_results_${gameId}_${itemType}_${idx}`);
  const player = getPlayer(playerId);
  if (input) input.value = player ? `${player.name} (${TEAMS[player.team]?.name || player.team})` : '';
  if (hidden) hidden.value = playerId;
  if (results) results.style.display = 'none';
}

// Expor globalmente (para os eventos inline)
window.filterAdminPlayers = filterAdminPlayers;
window.showAdminPlayerResults = showAdminPlayerResults;
window.selectAdminPlayer = selectAdminPlayer;

function createScorerItem(gameId, idx, scorer = { playerId: '', goals: 1 }) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = getPlayersByTeams(game.home, game.away);
  const div = document.createElement('div');
  div.className = 'scorer-item';
  div.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;';
  div.innerHTML = `
    <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
    <div style="flex:1;min-width:220px;">
      ${renderPlayerSearchControl(gameId, 'scorer', idx, scorer.playerId, gamePlayers, false)}
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="number" class="admin-input" id="scorer_goals_${gameId}_${idx}" value="${scorer.goals || 1}" min="1" max="9" style="width:60px;text-align:center;">
      <span style="white-space:nowrap;">gol(s)</span>
      <button class="admin-remove-btn" onclick="adminRemoveScorer('${gameId}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
  `;
  return div;
}

function createEventItem(gameId, eventType, idx, event = { playerId: '' }) {
  const game = GAMES_STATE.find(g => g.id === gameId);
  const gamePlayers = getPlayersByTeams(game.home, game.away);
  const onlyGoalkeepers = (eventType === 'penalty_saved');
  const div = document.createElement('div');
  div.className = 'event-item';
  div.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;background:var(--navy-3);padding:8px;border-radius:6px;position:relative;';
  div.innerHTML = `
    <span style="font-weight:600;min-width:30px;margin-top:8px;">${idx + 1}º</span>
    <div style="flex:1;min-width:220px;">
      ${renderPlayerSearchControl(gameId, eventType, idx, event.playerId, gamePlayers, onlyGoalkeepers)}
    </div>
    <button class="admin-remove-btn" onclick="adminRemoveEvent('${gameId}', '${eventType}', ${idx})" style="background:var(--red);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
  `;
  return div;
}

window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  const newIdx = tempScorers[gameId].length;
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (container) {
    const newItem = createScorerItem(gameId, newIdx, { playerId: '', goals: 1 });
    container.appendChild(newItem);
    // Atualizar os números de todos os itens
    const items = container.querySelectorAll('.scorer-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

window.adminRemoveScorer = (gameId, index) => {
  if (!tempScorers[gameId]) return;
  tempScorers[gameId].splice(index, 1);
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (container) {
    const items = container.querySelectorAll('.scorer-item');
    if (items[index]) items[index].remove();
    // Renumerar e atualizar IDs
    const remaining = container.querySelectorAll('.scorer-item');
    remaining.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
      // Atualizar IDs dos inputs de gol
      const goalsInput = item.querySelector(`input[id^="scorer_goals_${gameId}_"]`);
      if (goalsInput) goalsInput.id = `scorer_goals_${gameId}_${i}`;
      // Atualizar IDs dos campos de busca
      const searchDiv = item.querySelector('.player-search-wrapper');
      if (searchDiv) {
        const searchInput = searchDiv.querySelector('input[type="text"]');
        const hiddenInput = searchDiv.querySelector('input[type="hidden"]');
        if (searchInput) {
          searchInput.id = `player_search_${gameId}_scorer_${i}`;
          searchInput.setAttribute('oninput', `filterAdminPlayers('${gameId}','scorer',${i}, false)`);
          searchInput.setAttribute('onfocus', `showAdminPlayerResults('${gameId}','scorer',${i}, false)`);
        }
        if (hiddenInput) hiddenInput.id = `player_selected_${gameId}_scorer_${i}`;
        const resultsDiv = searchDiv.querySelector('.player-search-results');
        if (resultsDiv) resultsDiv.id = `player_results_${gameId}_scorer_${i}`;
      }
    });
  }
};

window.adminAddEvent = (gameId, eventType) => {
  if (!tempEvents[gameId]) tempEvents[gameId] = [];
  const currentOfType = tempEvents[gameId].filter(e => e.type === eventType).length;
  tempEvents[gameId].push({ type: eventType, playerId: '' });
  const container = document.getElementById(`event_section_${eventType}_${gameId}`);
  if (container) {
    const newItem = createEventItem(gameId, eventType, currentOfType, { playerId: '' });
    container.appendChild(newItem);
    // Renumerar
    const items = container.querySelectorAll('.event-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

window.adminRemoveEvent = (gameId, eventType, index) => {
  if (!tempEvents[gameId]) return;
  // Remover do array
  let filtered = [];
  let currentIndex = -1;
  for (const ev of tempEvents[gameId]) {
    if (ev.type === eventType) {
      currentIndex++;
      if (currentIndex !== index) filtered.push(ev);
    } else {
      filtered.push(ev);
    }
  }
  tempEvents[gameId] = filtered;
  // Remover do DOM
  const container = document.getElementById(`event_section_${eventType}_${gameId}`);
  if (container) {
    const items = container.querySelectorAll('.event-item');
    if (items[index]) items[index].remove();
    const remaining = container.querySelectorAll('.event-item');
    remaining.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
      // Atualizar IDs
      const searchDiv = item.querySelector('.player-search-wrapper');
      if (searchDiv) {
        const searchInput = searchDiv.querySelector('input[type="text"]');
        const hiddenInput = searchDiv.querySelector('input[type="hidden"]');
        if (searchInput) {
          searchInput.id = `player_search_${gameId}_${eventType}_${i}`;
          searchInput.setAttribute('oninput', `filterAdminPlayers('${gameId}','${eventType}',${i}, ${eventType === 'penalty_saved'})`);
          searchInput.setAttribute('onfocus', `showAdminPlayerResults('${gameId}','${eventType}',${i}, ${eventType === 'penalty_saved'})`);
        }
        if (hiddenInput) hiddenInput.id = `player_selected_${gameId}_${eventType}_${i}`;
        const resultsDiv = searchDiv.querySelector('.player-search-results');
        if (resultsDiv) resultsDiv.id = `player_results_${gameId}_${eventType}_${i}`;
      }
    });
  }
};

window.adminAddScorer = (gameId) => {
  if (!tempScorers[gameId]) tempScorers[gameId] = [];
  const newIdx = tempScorers[gameId].length;
  tempScorers[gameId].push({ playerId: '', goals: 1 });
  const container = document.getElementById(`scorers-list-${gameId}`);
  if (container) {
    const newItem = createScorerItem(gameId, newIdx, { playerId: '', goals: 1 });
    container.appendChild(newItem);
    // renumera
    const items = container.querySelectorAll('.scorer-item');
    items.forEach((item, i) => {
      const numSpan = item.querySelector('span:first-child');
      if (numSpan) numSpan.textContent = `${i + 1}º`;
    });
  }
};

async function adminSaveGame(gameId) {
  console.log('🔍 Salvando jogo:', gameId);
  
  const idx = GAMES_STATE.findIndex(g => g.id === gameId);
  if (idx === -1) {
    console.error('Jogo não encontrado em GAMES_STATE');
    showToast('Erro: jogo não encontrado', 'red');
    return;
  }

  // Pegar placar
  const homeScoreInput = document.getElementById(`homeScore_${gameId}`);
  const awayScoreInput = document.getElementById(`awayScore_${gameId}`);
  
  if (!homeScoreInput || !awayScoreInput) {
    console.error('Campos de placar não encontrados');
    showToast('Erro: campos de placar não encontrados', 'red');
    return;
  }

  const homeScore = parseInt(homeScoreInput.value);
  const awayScore = parseInt(awayScoreInput.value);
  
  if (isNaN(homeScore) || isNaN(awayScore)) {
    showToast('Informe o placar do resultado.', 'red');
    return;
  }

  // Pegar craque do jogo
  const craqueSelect = document.getElementById(`craque_${gameId}`);
  const craqueId = craqueSelect ? craqueSelect.value : null;

  // Coletar goleadores
  const scorersList = tempScorers[gameId] || [];
  const updatedScorers = [];
  for (let i = 0; i < scorersList.length; i++) {
    const playerIdField = document.getElementById(`player_selected_${gameId}_scorer_${i}`);
    const goalsField = document.getElementById(`scorer_goals_${gameId}_${i}`);
    if (playerIdField && playerIdField.value) {
      const goals = goalsField ? parseInt(goalsField.value) : 1;
      updatedScorers.push({ playerId: playerIdField.value, goals: isNaN(goals) ? 1 : goals });
    }
  }

  // Coletar eventos (assistências, cartões, pênaltis)
  const updatedEvents = [];
  const eventList = tempEvents[gameId] || [];
  for (let i = 0; i < eventList.length; i++) {
    const event = eventList[i];
    const playerIdField = document.getElementById(`player_selected_${gameId}_${event.type}_${i}`);
    if (playerIdField && playerIdField.value) {
      const player = getPlayer(playerIdField.value);
      if (player) {
        updatedEvents.push({
          type: event.type,
          playerId: player.id,
          playerName: player.name,
          team: player.team
        });
      }
    }

    await saveGames(GAMES_STATE);
showToast('Resultado salvo com sucesso! ✅', 'green');
renderAdminGames();

// Força atualização do ranking se estiver visível
if (document.getElementById('tabRanking').classList.contains('active')) {
  if (typeof renderRanking === 'function') await renderRanking();
}
  }

  // Atualizar GAMES_STATE
  GAMES_STATE[idx].status = 'completed';
  GAMES_STATE[idx].result = {
    homeScore,
    awayScore,
    scorers: updatedScorers,
    craqueId: craqueId || null,
    events: updatedEvents
  };

  try {
    await saveGames(GAMES_STATE);
    showToast('Resultado salvo com sucesso! ✅', 'green');
    // Recarregar a interface de admin para refletir os dados salvos
    renderAdminGames();
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showToast('Erro ao salvar: ' + error.message, 'red');
  }
}

// Exportar função principal
export function renderAdminPage() {
  renderAdmin();
}

window.adminSaveGame           = adminSaveGame;
window.adminAddScorer          = adminAddScorer;
window.adminRemoveScorer       = adminRemoveScorer;
window.adminAddEvent           = adminAddEvent;
window.adminRemoveEvent        = adminRemoveEvent;
window.filterAdminPlayers      = filterAdminPlayers;
window.showAdminPlayerResults  = showAdminPlayerResults;
window.selectAdminPlayer       = selectAdminPlayer;
window.showAdminTab = (tab, button) => {
  // ... código existente ...
  
  if (tab === 'users') renderAdminPanel();
  else if (tab === 'games') renderAdminGames();
  else if (tab === 'matches') renderAdminMatches();
  else if (tab === 'teams') renderAdminTeams();
  else if (tab === 'bets') renderAdminBets();
  else if (tab === 'specials') renderAdminSpecials();
};
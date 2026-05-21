// js/specials.js - VERSÃO CORRIGIDA COM LOGS
import { TEAMS } from './data/teams.js';
import { currentUser } from './state.js';
import { showToast } from './ui.js';
import { filterPlayers, getPlayer } from './exportplayer.js';
import { teamFlagImg } from './utils.js';

let selectedChampionTeam = null;
let selectedMvp = null;
let selectedRevelation = null;

export async function renderSpecials() {
  console.log('🎆 renderSpecials chamado');
  
  // 1. Verificar container
  const container = document.getElementById('tabSpecials');
  if (!container) {
    console.error('❌ Container #tabSpecials não encontrado');
    return;
  }
  container.classList.add('active');
  console.log('✅ Container encontrado e ativado');

  // 2. Verificar usuário logado
  const user = currentUser || window.currentUser;
  if (!user) {
    console.error('❌ Usuário não encontrado em currentUser');
    container.innerHTML = '<div class="empty-state">Faça login para acessar.</div>';
    return;
  }
  console.log('✅ Usuário logado:', user.id, 'currentUser:', currentUser, 'window.currentUser:', window.currentUser);

  // 3. Tenta carregar picks atuais
  let picks = { championTeam: null, mvpPlayerId: null, revelationPlayerId: null };
  try {
    picks = await loadSpecialPicks(user.id);
    console.log('✅ Picks carregados:', picks);
  } catch (err) {
    console.error('❌ Erro ao carregar picks:', err);
    container.innerHTML = '<div class="empty-state">❌ Erro ao carregar suas escolhas. Tente novamente.</div>';
    return;
  }

  // 4. Injeta o HTML (mesmo se picks estiver vazio)
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🏆 Bolão Especial</div>
        <div class="page-subtitle">Escolha o campeão, o craque e a revelação da Copa do Mundo 2026</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-title">🏆 Campeão</div>
        <div class="form-group">
          <label class="form-label">Selecione o time campeão</label>
          <div class="team-search-wrapper">
            <input type="text" class="form-input" id="championSearch" placeholder="Buscar time..." autocomplete="off">
            <div class="player-search-results" id="championResults"></div>
          </div>
          <div class="selected-player" id="championSelected" style="display:none;">
            <span id="championFlag"></span>
            <span id="championName"></span>
            <span class="sel-remove" onclick="clearChampion()">✕</span>
          </div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-title">⭐ Craque do Campeonato</div>
        <div class="form-group">
          <label class="form-label">Selecione o jogador (MVP)</label>
          <div class="player-search-wrapper">
            <input type="text" class="form-input" id="mvpSearch" placeholder="Buscar jogador..." autocomplete="off">
            <div class="player-search-results" id="mvpResults"></div>
          </div>
          <div class="selected-player" id="mvpSelected" style="display:none;">
            <span id="mvpFlag"></span>
            <span id="mvpName"></span>
            <span class="sel-remove" onclick="clearMvp()">✕</span>
          </div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-title">🌟 Revelação do Campeonato</div>
        <div class="form-group">
          <label class="form-label">Selecione o jogador revelação</label>
          <div class="player-search-wrapper">
            <input type="text" class="form-input" id="revelationSearch" placeholder="Buscar jogador..." autocomplete="off">
            <div class="player-search-results" id="revelationResults"></div>
          </div>
          <div class="selected-player" id="revelationSelected" style="display:none;">
            <span id="revelationFlag"></span>
            <span id="revelationName"></span>
            <span class="sel-remove" onclick="clearRevelation()">✕</span>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top: 24px; text-align: center;">
      <button class="btn btn-green" id="saveSpecialsBtn">💾 Salvar Escolhas</button>
    </div>
  `;
  console.log('✅ HTML injetado');

  // 5. Inicializar seleções com dados carregados
  if (picks.championTeam) {
    const team = TEAMS[picks.championTeam];
    if (team) setChampionDisplay(team);
  }
  if (picks.mvpPlayerId) {
    const player = getPlayer(picks.mvpPlayerId);
    if (player) setMvpDisplay(player);
  }
  if (picks.revelationPlayerId) {
    const player = getPlayer(picks.revelationPlayerId);
    if (player) setRevelationDisplay(player);
  }

  // 6. Configurar buscas
  setupTeamSearch('championSearch', 'championResults', (team) => setChampionDisplay(team));
  setupPlayerSearch('mvpSearch', 'mvpResults', (player) => setMvpDisplay(player));
  setupPlayerSearch('revelationSearch', 'revelationResults', (player) => setRevelationDisplay(player));

  // 7. Configurar botão salvar
  const saveBtn = document.getElementById('saveSpecialsBtn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      await saveSpecialPicks();
    };
  }
  console.log('✅ Renderização concluída');
}

async function loadSpecialPicks(userId) {
  try {
    const res = await fetch(`/api/special-picks/${userId}`);
    if (!res.ok) return { championTeam: null, mvpPlayerId: null, revelationPlayerId: null };
    return await res.json();
  } catch (error) {
    console.error('Erro ao carregar especiais:', error);
    return {};
  }
}

async function saveSpecialPicks() {
  if (!currentUser) return;
  const payload = {
    userId: currentUser.id,
    championTeam: selectedChampionTeam ? selectedChampionTeam.id : null,
    mvpPlayerId: selectedMvp ? selectedMvp.id : null,
    revelationPlayerId: selectedRevelation ? selectedRevelation.id : null
  };
  try {
    const res = await fetch('/api/special-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Escolhas salvas com sucesso!', 'green');
    } else {
      showToast('Erro ao salvar', 'red');
    }
  } catch (error) {
    console.error(error);
    showToast('Erro de conexão', 'red');
  }
}

function setupTeamSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length === 0) {
      results.classList.remove('open');
      return;
    }
    const matches = Object.entries(TEAMS)
      .filter(([, team]) => team.name.toLowerCase().includes(query))
      .map(([id, team]) => ({ ...team, id }));

    results.innerHTML = matches.map(team => `
      <div class="psearch-item" data-team-id="${team.id}">
        <span class="pflag">${teamFlagImg(team, 20)}</span>
        <span class="pname">${team.name}</span>
      </div>
    `).join('');
    results.classList.add('open');

    results.querySelectorAll('.psearch-item').forEach(el => {
      el.addEventListener('click', () => {
        const teamId = el.dataset.teamId;
        const team = TEAMS[teamId];
        if (team) {
          onSelect({ ...team, id: teamId });
          input.value = '';
          results.classList.remove('open');
        }
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('open');
    }
  });
}

function setupPlayerSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const query = input.value.trim();
    const found = filterPlayers(query);
    results.innerHTML = found.map(p => {
      const team = TEAMS[p.team];
      const flag = team ? teamFlagImg(team, 20) : '';
      return `
        <div class="psearch-item" data-player-id="${p.id}">
          <span class="pflag">${flag}</span>
          <span class="pname">${p.name}</span>
          <span class="pteam">${team?.name || p.team}</span>
          <span class="ppos">${p.pos}</span>
        </div>
      `;
    }).join('');
    results.classList.toggle('open', found.length > 0 && query.length > 0);
    if (found.length === 0 && query.length > 0) {
      results.innerHTML = '<div class="psearch-item">Nenhum jogador encontrado</div>';
      results.classList.add('open');
    }

    results.querySelectorAll('.psearch-item[data-player-id]').forEach(el => {
      el.addEventListener('click', () => {
        const playerId = el.dataset.playerId;
        const player = getPlayer(playerId);
        if (player) {
          onSelect(player);
          input.value = '';
          results.classList.remove('open');
        }
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('open');
    }
  });
}

function setChampionDisplay(team) {
  selectedChampionTeam = team;
  const container = document.getElementById('championSelected');
  document.getElementById('championFlag').innerHTML = teamFlagImg(team, 24);
  document.getElementById('championName').innerHTML = team.name;
  container.style.display = 'flex';
}

function setMvpDisplay(player) {
  selectedMvp = player;
  const container = document.getElementById('mvpSelected');
  const team = TEAMS[player.team];
  document.getElementById('mvpFlag').innerHTML = team ? teamFlagImg(team, 24) : '';
  document.getElementById('mvpName').innerHTML = `${player.name} (${team?.name || player.team})`;
  container.style.display = 'flex';
}

function setRevelationDisplay(player) {
  selectedRevelation = player;
  const container = document.getElementById('revelationSelected');
  const team = TEAMS[player.team];
  document.getElementById('revelationFlag').innerHTML = team ? teamFlagImg(team, 24) : '';
  document.getElementById('revelationName').innerHTML = `${player.name} (${team?.name || player.team})`;
  container.style.display = 'flex';
}

window.clearChampion = () => {
  selectedChampionTeam = null;
  document.getElementById('championSelected').style.display = 'none';
  document.getElementById('championSearch').value = '';
};
window.clearMvp = () => {
  selectedMvp = null;
  document.getElementById('mvpSelected').style.display = 'none';
  document.getElementById('mvpSearch').value = '';
};
window.clearRevelation = () => {
  selectedRevelation = null;
  document.getElementById('revelationSelected').style.display = 'none';
  document.getElementById('revelationSearch').value = '';
};
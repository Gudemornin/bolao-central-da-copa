// public/js/specials.js
import { TEAMS } from './data/teams.js';
import { currentUser } from './state.js';
import { showToast } from './ui.js';
import { filterPlayers, getPlayer } from './exportplayer.js';

let selectedChampion = null;
let selectedTopScorer = null;
let selectedMVP = null;
let selectedRevelation = null;

const DEADLINE = new Date(2026, 5, 11, 0, 0, 0); // 11 de junho de 2026

function isDeadlinePassed() {
  return new Date() > DEADLINE;
}

export async function renderSpecials() {
  const container = document.getElementById('tabSpecials');
  if (!container) return;

  // Fallback: exibe mensagem amigável se API falhar
  let userPicks = { championTeam: null, topScorerId: null, mvpId: null, revelationId: null };
if (currentUser) {
  try {
    const res = await fetch(`/api/special-picks/${currentUser.id}`);
    if (res.ok) userPicks = await res.json();
    else console.warn('Falha ao carregar seus palpites, usando vazio');
  } catch (e) { console.error(e); }
}

let allPicks = {};
try {
  const res = await fetch('/api/all-special-picks');
  if (res.ok) allPicks = await res.json();
  else console.warn('Falha ao carregar palpites de todos');
} catch (e) { console.error(e); }



  try {
    const res = await fetch('/api/all-special-picks');
    if (res.ok) allPicks = await res.json();
    else console.warn('Erro ao carregar palpites de todos:', res.status);
  } catch (e) {
    console.error('Falha ao carregar all special picks:', e);
  }

  const deadlinePassed = isDeadlinePassed();

  // Carregar picks do usuário
  if (currentUser) {
    try {
      const res = await fetch(`/api/special-picks/${currentUser.id}`);
      if (res.ok) userPicks = await res.json();
    } catch (e) { console.error(e); }
  }

  // Carregar picks de todos
  try {
    const res = await fetch('/api/all-special-picks');
    if (res.ok) allPicks = await res.json();
  } catch (e) { console.error(e); }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🌟 Palpites Especiais</div>
        <div class="page-subtitle">Campeão, Artilheiro, Craque e Revelação da Copa 2026</div>
        ${deadlinePassed ? '<div class="deadline-warning" style="color:var(--red-l); margin-top:8px;">⛔ Prazo encerrado em 11/06/2026. Palpites não podem mais ser alterados.</div>' : '<div class="deadline-info" style="color:var(--gold); margin-top:8px;">📅 Você pode alterar seus palpites até 11/06/2026.</div>'}
      </div>
    </div>

    <div class="specials-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:20px; margin-bottom:30px;">
      <!-- Campeão -->
      <div class="info-card">
        <div class="info-card-title">🏆 Campeão</div>
        <div class="form-group">
          <label class="form-label">Selecione o time campeão</label>
          <input type="text" class="form-input" id="championSearch" placeholder="Digite o nome do time..." autocomplete="off" ${deadlinePassed ? 'disabled' : ''}>
          <div class="player-search-results" id="championResults"></div>
          <div class="selected-player" id="championSelected" style="${userPicks.championTeam ? 'display:flex;' : 'display:none;'}">
            <span id="championFlag"></span>
            <span id="championName"></span>
            <span class="sel-remove" onclick="clearChampion()" ${deadlinePassed ? 'style="display:none;"' : ''}>✕</span>
          </div>
        </div>
      </div>

      <!-- Artilheiro -->
      <div class="info-card">
        <div class="info-card-title">⚽ Artilheiro</div>
        <div class="form-group">
          <label class="form-label">Selecione o jogador artilheiro</label>
          <input type="text" class="form-input" id="topScorerSearch" placeholder="Buscar jogador..." autocomplete="off" ${deadlinePassed ? 'disabled' : ''}>
          <div class="player-search-results" id="topScorerResults"></div>
          <div class="selected-player" id="topScorerSelected" style="${userPicks.topScorerId ? 'display:flex;' : 'display:none;'}">
            <span id="topScorerFlag"></span>
            <span id="topScorerName"></span>
            <span class="sel-remove" onclick="clearTopScorer()" ${deadlinePassed ? 'style="display:none;"' : ''}>✕</span>
          </div>
        </div>
      </div>

      <!-- Craque -->
      <div class="info-card">
        <div class="info-card-title">⭐ Craque do Campeonato</div>
        <div class="form-group">
          <label class="form-label">Selecione o jogador craque (MVP)</label>
          <input type="text" class="form-input" id="mvpSearch" placeholder="Buscar jogador..." autocomplete="off" ${deadlinePassed ? 'disabled' : ''}>
          <div class="player-search-results" id="mvpResults"></div>
          <div class="selected-player" id="mvpSelected" style="${userPicks.mvpId ? 'display:flex;' : 'display:none;'}">
            <span id="mvpFlag"></span>
            <span id="mvpName"></span>
            <span class="sel-remove" onclick="clearMVP()" ${deadlinePassed ? 'style="display:none;"' : ''}>✕</span>
          </div>
        </div>
      </div>

      <!-- Revelação -->
      <div class="info-card">
        <div class="info-card-title">🌟 Revelação</div>
        <div class="form-group">
          <label class="form-label">Selecione o jogador revelação</label>
          <input type="text" class="form-input" id="revelationSearch" placeholder="Buscar jogador..." autocomplete="off" ${deadlinePassed ? 'disabled' : ''}>
          <div class="player-search-results" id="revelationResults"></div>
          <div class="selected-player" id="revelationSelected" style="${userPicks.revelationId ? 'display:flex;' : 'display:none;'}">
            <span id="revelationFlag"></span>
            <span id="revelationName"></span>
            <span class="sel-remove" onclick="clearRevelation()" ${deadlinePassed ? 'style="display:none;"' : ''}>✕</span>
          </div>
        </div>
      </div>
    </div>

    ${!deadlinePassed ? `<div style="text-align:center; margin-bottom:30px;"><button class="btn btn-green" id="saveSpecialsBtn">💾 Salvar Palpites Especiais</button></div>` : ''}

    <div class="specials-list">
      <div class="page-title" style="font-size:20px;">👥 Palpites dos Participantes</div>
      <div class="page-subtitle">Veja o que cada jogador apostou para os especiais</div>
      <div id="allSpecialsList"></div>
    </div>
  `;

  // Restaurar seleções
  if (userPicks.championTeam) setChampionDisplay(userPicks.championTeam);
  if (userPicks.topScorerId) setTopScorerDisplay(userPicks.topScorerId);
  if (userPicks.mvpId) setMVPDisplay(userPicks.mvpId);
  if (userPicks.revelationId) setRevelationDisplay(userPicks.revelationId);

  // Configurar buscas
  setupTeamSearch('championSearch', 'championResults', (teamId) => setChampionDisplay(teamId));
  setupPlayerSearch('topScorerSearch', 'topScorerResults', (playerId) => setTopScorerDisplay(playerId));
  setupPlayerSearch('mvpSearch', 'mvpResults', (playerId) => setMVPDisplay(playerId));
  setupPlayerSearch('revelationSearch', 'revelationResults', (playerId) => setRevelationDisplay(playerId));

  const saveBtn = document.getElementById('saveSpecialsBtn');
  if (saveBtn) saveBtn.onclick = saveSpecialsPicks;

  renderAllSpecialsList(allPicks);
}

function renderAllSpecialsList(allPicks) {
  const container = document.getElementById('allSpecialsList');
  if (!container) return;
  const usersArray = Object.values(allPicks);
  if (!usersArray.length) {
    container.innerHTML = '<div class="empty-state">Nenhum palpite especial registrado ainda.</div>';
    return;
  }

  let html = '<div class="specials-accordion">';
  for (const user of usersArray) {
    const picks = user.specialPicks || {};
    const champion = picks.championTeam ? TEAMS[picks.championTeam]?.name : '—';
    const topScorer = picks.topScorerId ? getPlayer(picks.topScorerId)?.name : '—';
    const mvp = picks.mvpId ? getPlayer(picks.mvpId)?.name : '—';
    const revelation = picks.revelationId ? getPlayer(picks.revelationId)?.name : '—';

    html += `
      <div class="specials-user-card" style="background:var(--navy-2); border:1px solid var(--border); border-radius:12px; margin-bottom:12px; overflow:hidden;">
        <div class="specials-user-header" style="padding:12px 16px; background:var(--navy-3); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="toggleSpecialsUser(this)">
          <div><strong>${user.profileName}</strong> <span style="font-size:12px; color:var(--text-d); margin-left:12px;">🏆 ${champion}</span></div>
          <span class="expand-icon">▼</span>
        </div>
        <div class="specials-user-body" style="display:none; padding:16px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div><strong>🏆 Campeão:</strong> ${champion}</div>
            <div><strong>⚽ Artilheiro:</strong> ${topScorer}</div>
            <div><strong>⭐ Craque:</strong> ${mvp}</div>
            <div><strong>🌟 Revelação:</strong> ${revelation}</div>
          </div>
        </div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

window.toggleSpecialsUser = (header) => {
  const body = header.nextElementSibling;
  const icon = header.querySelector('.expand-icon');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    body.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
};

// ========== Buscas com autocomplete ==========
function setupTeamSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) { results.classList.remove('open'); return; }
    const matches = Object.entries(TEAMS).filter(([, t]) => t.name.toLowerCase().includes(query)).map(([id, t]) => ({ id, name: t.name, flag: t.flag }));
    results.innerHTML = matches.map(t => `<div class="psearch-item" data-team-id="${t.id}" style="padding:8px 12px; cursor:pointer; display:flex; align-items:center; gap:8px;"><img src="${t.flag}" style="width:20px;"> ${t.name}</div>`).join('');
    results.classList.add('open');
    results.querySelectorAll('.psearch-item').forEach(el => {
      el.addEventListener('click', () => { onSelect(el.dataset.teamId); input.value = ''; results.classList.remove('open'); });
    });
  });
  document.addEventListener('click', (e) => { if (!input.contains(e.target) && !results.contains(e.target)) results.classList.remove('open'); });
}

function setupPlayerSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;
  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query.length < 2) { results.classList.remove('open'); return; }
    const players = filterPlayers(query);
    results.innerHTML = players.map(p => {
      const team = TEAMS[p.team];
      const flag = team?.flag ? `<img src="${team.flag}" style="width:20px;">` : '';
      return `<div class="psearch-item" data-player-id="${p.id}" style="padding:8px 12px; cursor:pointer; display:flex; justify-content:space-between;"><span>${flag} ${p.name}</span><span style="font-size:11px;">${team?.name || p.team}</span></div>`;
    }).join('');
    results.classList.add('open');
    results.querySelectorAll('.psearch-item').forEach(el => {
      el.addEventListener('click', () => { onSelect(el.dataset.playerId); input.value = ''; results.classList.remove('open'); });
    });
  });
  document.addEventListener('click', (e) => { if (!input.contains(e.target) && !results.contains(e.target)) results.classList.remove('open'); });
}

// ========== Displays ==========
function setChampionDisplay(teamId) {
  selectedChampion = teamId;
  const team = TEAMS[teamId];
  document.getElementById('championFlag').innerHTML = team?.flag ? `<img src="${team.flag}" style="width:24px;">` : '';
  document.getElementById('championName').innerHTML = team?.name || '';
  document.getElementById('championSelected').style.display = 'flex';
}
function setTopScorerDisplay(playerId) {
  selectedTopScorer = playerId;
  const p = getPlayer(playerId);
  const team = TEAMS[p?.team];
  document.getElementById('topScorerFlag').innerHTML = team?.flag ? `<img src="${team.flag}" style="width:24px;">` : '';
  document.getElementById('topScorerName').innerHTML = `${p?.name} (${team?.name || ''})`;
  document.getElementById('topScorerSelected').style.display = 'flex';
}
function setMVPDisplay(playerId) {
  selectedMVP = playerId;
  const p = getPlayer(playerId);
  const team = TEAMS[p?.team];
  document.getElementById('mvpFlag').innerHTML = team?.flag ? `<img src="${team.flag}" style="width:24px;">` : '';
  document.getElementById('mvpName').innerHTML = `${p?.name} (${team?.name || ''})`;
  document.getElementById('mvpSelected').style.display = 'flex';
}
function setRevelationDisplay(playerId) {
  selectedRevelation = playerId;
  const p = getPlayer(playerId);
  const team = TEAMS[p?.team];
  document.getElementById('revelationFlag').innerHTML = team?.flag ? `<img src="${team.flag}" style="width:24px;">` : '';
  document.getElementById('revelationName').innerHTML = `${p?.name} (${team?.name || ''})`;
  document.getElementById('revelationSelected').style.display = 'flex';
}

// Limpeza
window.clearChampion = () => { selectedChampion = null; document.getElementById('championSelected').style.display = 'none'; document.getElementById('championSearch').value = ''; };
window.clearTopScorer = () => { selectedTopScorer = null; document.getElementById('topScorerSelected').style.display = 'none'; document.getElementById('topScorerSearch').value = ''; };
window.clearMVP = () => { selectedMVP = null; document.getElementById('mvpSelected').style.display = 'none'; document.getElementById('mvpSearch').value = ''; };
window.clearRevelation = () => { selectedRevelation = null; document.getElementById('revelationSelected').style.display = 'none'; document.getElementById('revelationSearch').value = ''; };

async function saveSpecialsPicks() {
  if (!currentUser) { showToast('Faça login primeiro', 'red'); return; }
  if (isDeadlinePassed()) { showToast('Prazo encerrado! Não é mais possível alterar palpites especiais.', 'red'); return; }
  const payload = {
    userId: currentUser.id,
    championTeam: selectedChampion || null,
    topScorerId: selectedTopScorer || null,
    mvpId: selectedMVP || null,
    revelationId: selectedRevelation || null
  };
  try {
    const res = await fetch('/api/special-picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { showToast('Palpites especiais salvos!', 'green'); renderSpecials(); }
    else showToast('Erro ao salvar', 'red');
  } catch(e) { showToast('Erro de conexão', 'red'); }
}
// navigation.js - COMPLETO E CORRIGIDO
import { cap } from './utils.js';
import { setCurrentTab, currentUser } from './state.js';
import { renderGames } from './gamemanager.js';
import { renderRanking } from './ranking.js';
import { renderAdmin } from './admin.js';
import { renderBets } from './bets.js';
import { renderCommunityBets } from './communityBets.js';
import { renderSpecials } from './specials.js';
import { loadGames, loadUsers } from './storage.js';
import { GAMES_STATE, setGamesState } from './state.js';
import { TEAMS } from './data/teams.js';
import { getPlayer } from './exportplayer.js';
import { updateMobileActiveTab } from './app.js';
import { fetchFdStandings, fetchFdScorers } from './syncFootballData.js';

// ==================== JOGOS DA COPA ====================
async function renderWorldCupGames() {
  const container = document.getElementById('worldcupGamesList');
  if (!container) return;
  console.log('🌍 Renderizando Jogos da Copa...');
  try {
    let games = GAMES_STATE;
    if (!games.length) games = await loadGames();
    if (!games.length) {
      container.innerHTML = '<div class="empty-state">Nenhum jogo encontrado.</div>';
      return;
    }
    const worldCupGames = games.filter(g => g.date && g.date.startsWith('2026-06'));
    if (!worldCupGames.length) {
      container.innerHTML = '<div class="empty-state">📅 Calendário da Copa 2026 será exibido em breve.</div>';
      return;
    }
    const gamesByDate = {};
    worldCupGames.forEach(game => {
      if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
      gamesByDate[game.date].push(game);
    });
    const sortedDates = Object.keys(gamesByDate).sort();
    let html = `<div style="margin-bottom:24px;"><p style="color:var(--text-d);">📅 Calendário completo da Copa do Mundo 2026</p></div>`;
    for (const date of sortedDates) {
      const gamesOnDate = gamesByDate[date];
      const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      html += `<div style="margin-bottom:32px;"><h3 style="font-family:Anton;font-size:16px;color:var(--gold);">📅 ${formattedDate}</h3><div style="display:flex;flex-direction:column;gap:12px;">`;
      for (const game of gamesOnDate) {
        const t1 = TEAMS[game.home];
        const t2 = TEAMS[game.away];
        const result = game.result ? `${game.result.homeScore} : ${game.result.awayScore}` : '—';
        const statusClass = game.status === 'completed' ? 'status-completed' : 'status-upcoming';
        const statusText = game.status === 'completed' ? '✅ Finalizado' : '📅 Agendado';
        html += `
          <div class="game-card">
            <div class="game-card-header">
              <span class="game-badge">Grupo ${game.group}</span>
              <span>⏰ ${game.time}</span>
              <span>📍 ${game.venue || 'Estádio'}</span>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div style="padding:20px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
              <div style="text-align:center; flex:1;"><div>${t1?.flag ? `<img src="${t1.flag}" style="width:56px;height:42px;">` : '🏆'}</div><div>${t1?.name || game.home}</div></div>
              <div style="text-align:center; min-width:100px;"><div style="font-family:Anton;font-size:36px;color:var(--gold);">${result}</div><div>VS</div></div>
              <div style="text-align:center; flex:1;"><div>${t2?.flag ? `<img src="${t2.flag}" style="width:56px;height:42px;">` : '🏆'}</div><div>${t2?.name || game.away}</div></div>
            </div>
          </div>`;
      }
      html += `</div></div>`;
    }
    container.innerHTML = html;
  } catch (err) {
    console.error('Erro em renderWorldCupGames:', err);
    container.innerHTML = '<div class="empty-state">❌ Erro ao carregar jogos da Copa.</div>';
  }
}

// ==================== CLASSIFICAÇÃO (usando football-data.org) ====================
async function renderStandings() {
  const container = document.getElementById('standingsContainer');
  if (!container) return;
  console.log('📊 Renderizando Classificação via football-data.org...');
  try {
    // Buscar classificação da Copa do Mundo (código 'WC')
    const groups = await fetchFdStandings('WC', 2026);
    if (!groups || !groups.length) {
      container.innerHTML = '<div class="empty-state">🏆 Classificação será exibida quando disponível.</div>';
      return;
    }
    let html = `<div class="page-header"><div class="page-title">📊 Classificação dos Grupos</div><div class="page-subtitle">Copa do Mundo 2026</div></div>`;
    for (const group of groups) {
      html += `<h3 style="margin-top:20px; font-family:Anton;">${group.label}</h3>
               <div class="ranking-wrap"><table class="ranking-table">
               <thead><tr><th>#</th><th>Seleção</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead><tbody>`;
      group.table.forEach((team, idx) => {
        const teamName = team.team || '—';
        const flagUrl = team.logo || `https://flagcdn.com/32x24/${team.teamKey?.substring(0,2)}.png`;
        html += `<tr>
          <td>${idx+1}</td>
          <td><div style="display:flex;align-items:center;gap:8px;"><img src="${flagUrl}" style="width:24px;height:16px;"> ${teamName}</div></td>
          <td>${team.points}</td>
          <td>${team.played}</td>
          <td>${team.won}</td>
          <td>${team.draw}</td>
          <td>${team.lost}</td>
          <td>${team.goalsFor}</td>
          <td>${team.goalsAgainst}</td>
          <td>${team.goalDiff > 0 ? '+' : ''}${team.goalDiff}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    container.innerHTML = html;
  } catch (err) {
    console.error('Erro em renderStandings:', err);
    container.innerHTML = '<div class="empty-state">❌ Erro ao carregar classificação.</div>';
  }
}

// ==================== ARTILHARIA (usando football-data.org) ====================
async function renderTopScorers() {
  const container = document.getElementById('topscorersList');
  if (!container) return;
  console.log('⚽ Renderizando Artilharia via football-data.org...');
  try {
    const scorers = await fetchFdScorers('WC', 2026, 20);
    if (!scorers || !scorers.length) {
      container.innerHTML = '<div class="empty-state">⚽ Artilharia será exibida quando os gols começarem.</div>';
      return;
    }
    let html = `<div class="page-header"><div class="page-title">⚽ Artilharia da Copa</div><div class="page-subtitle">Goleadores</div></div>
                <div class="ranking-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Jogador</th><th>Seleção</th><th>Gols</th></tr></thead><tbody>`;
    scorers.forEach((s, i) => {
      const flag = s.teamCrest || `https://flagcdn.com/32x24/${s.teamKey?.substring(0,2)}.png`;
      html += `<tr>
        <td>${i+1}</td>
        <td>${s.name}</td>
        <td><img src="${flag}" style="width:20px;height:14px;"> ${s.team}</td>
        <td><strong>${s.goals}</strong></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('Erro em renderTopScorers:', err);
    container.innerHTML = '<div class="empty-state">❌ Erro ao carregar artilharia.</div>';
  }
}

// ==================== PERFIL ====================
function renderProfile() {
  const container = document.getElementById('tabProfile');
  if (!container) return;
  console.log('👤 Renderizando Perfil...');
  if (!currentUser) {
    container.innerHTML = '<div class="empty-state">Faça login para ver seu perfil.</div>';
    return;
  }
  container.innerHTML = `
    <div class="page-header"><div class="page-title">👤 Meu Perfil</div></div>
    <div class="info-grid">
      <div class="info-card"><div class="info-card-title">📋 Informações</div>
        <div class="rule-item"><strong>Nome:</strong> ${escapeHtml(currentUser.profileName)}</div>
        <div class="rule-item"><strong>E-mail:</strong> ${currentUser.email || 'Não informado'}</div>
        <div class="rule-item"><strong>Admin:</strong> ${currentUser.isAdmin ? 'Sim' : 'Não'}</div>
      </div>
      <div class="info-card"><div class="info-card-title">🔐 Segurança</div>
        <button class="btn btn-blue" onclick="window.changePassword()">Alterar Senha</button>
        <button class="btn-ghost" onclick="window.logout()">Sair</button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== SWITCH TAB PRINCIPAL ====================
export async function switchTab(tab) {
  console.log('🔄 switchTab chamado para:', tab);
  setCurrentTab(tab);
  
  // Atualizar menus
  document.querySelectorAll('.sidebar .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  if (typeof updateMobileActiveTab === 'function') updateMobileActiveTab(tab);
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === 'tab' + cap(tab));
  });
  
  // Fechar sidebar no mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('open');
  }
  
  // Aba admin
  if (tab === 'admin') {
    if (currentUser && currentUser.isAdmin) {
      await renderAdmin();
    } else {
      const adminContainer = document.getElementById('adminGamesList');
      if (adminContainer) adminContainer.innerHTML = '<div class="empty-state">🔒 Acesso restrito.</div>';
    }
    return;
  }
  
  // Outras abas
  try {
    if (tab === 'games') await renderGames();
    if (tab === 'bets') await renderBets();
    if (tab === 'community') await renderCommunityBets();
    if (tab === 'ranking') await renderRanking();
    if (tab === 'worldcup') await renderWorldCupGames();
    if (tab === 'standings') await renderStandings();
    if (tab === 'topscorers') await renderTopScorers();
    if (tab === 'profile') renderProfile();
    if (tab === 'specials') await renderSpecials();
  } catch (err) {
    console.error(`❌ Erro ao renderizar aba ${tab}:`, err);
  }
}

// Registrar funções globais
window.switchTab = switchTab;
window.renderProfile = renderProfile;
window.renderWorldCupGames = renderWorldCupGames;
window.renderStandings = renderStandings;
window.renderTopScorers = renderTopScorers;

console.log('✅ navigation.js carregado com football-data.org');
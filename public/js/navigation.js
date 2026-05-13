// navigation.js - COMPLETO E CORRIGIDO
import { cap } from './utils.js';
import { setCurrentTab, currentUser } from './state.js';
import { renderGames } from './gamemanager.js';
import { renderRanking } from './ranking.js';
import { renderAdmin } from './admin.js';
import { renderBets } from './bets.js';
import { renderStandings, renderTopScorers } from './worldcupData.js';
import { TEAMS } from './data/teams.js';
import { GAMES_STATE, setGamesState } from './state.js';
import { loadGames } from './storage.js';
import { getPlayer } from './exportplayer.js';
import { updateMobileActiveTab, updateMobileMenu } from './app.js';

// =============================================
// FUNÇÃO PARA EXIBIR "JOGOS DA COPA"
// =============================================
async function renderWorldCupGames() {
  const container = document.getElementById('worldcupGamesList');
  if (!container) return;
  
  // Garantir que temos os jogos carregados
  let games = GAMES_STATE;
  if (!games || !games.length) {
    games = await loadGames();
    if (games.length) setGamesState(games);
  }
  
  if (!games || !games.length) {
    container.innerHTML = '<div class="empty-state">Nenhum jogo encontrado.</div>';
    return;
  }

  // Filtrar apenas jogos da Copa (data em junho/2026)
  const worldCupGames = games.filter(g => g.date && g.date.startsWith('2026-06'));
  
  if (worldCupGames.length === 0) {
    container.innerHTML = '<div class="empty-state">📅 Calendário da Copa do Mundo 2026 será publicado em breve.</div>';
    return;
  }

  // Agrupar jogos por data
  const gamesByDate = {};
  worldCupGames.forEach(game => {
    if (!gamesByDate[game.date]) gamesByDate[game.date] = [];
    gamesByDate[game.date].push(game);
  });

  // Ordenar as datas
  const sortedDates = Object.keys(gamesByDate).sort();

  let html = `
    <div style="margin-bottom:24px;">
      <p style="color:var(--text-d); font-size:14px;">📅 Calendário completo da Copa do Mundo 2026</p>
      <p style="color:var(--text-m); font-size:12px; margin-top:4px;">🏆 48 seleções | 12 grupos | 104 jogos</p>
    </div>
  `;

  for (const date of sortedDates) {
    const gamesOnDate = gamesByDate[date];
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    html += `
      <div style="margin-bottom:32px;">
        <h3 style="font-family:Anton;font-size:16px;color:var(--gold);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--border);">
          📅 ${formattedDate}
        </h3>
        <div style="display:flex;flex-direction:column;gap:12px;">
    `;

    gamesOnDate.forEach(game => {
      const t1 = TEAMS[game.home];
      const t2 = TEAMS[game.away];
      const result = game.result ? `${game.result.homeScore} : ${game.result.awayScore}` : '—';
      const statusClass = game.status === 'completed' ? 'status-completed' : 'status-upcoming';
      const statusText = game.status === 'completed' ? '✅ Finalizado' : '📅 Agendado';
      
      // Buscar nome do goleador se existir
      let scorerName = '—';
      if (game.result && game.result.scorers && game.result.scorers.length) {
        const scorerNames = game.result.scorers.map(s => {
          const player = getPlayer(s.playerId);
          return player ? `${player.name} (${s.goals}g)` : '?';
        }).join(', ');
        scorerName = scorerNames;
      }
      
      html += `
        <div class="game-card" style="background:var(--navy-2);border-radius:var(--r);overflow:hidden;">
          <div class="game-card-header" style="padding:12px 16px;background:var(--navy-3);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <span class="game-badge">Grupo ${game.group}</span>
              <span>⏰ ${game.time}</span>
              <span>📍 ${game.venue || 'Estádio'}</span>
            </div>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <div style="padding:20px 16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
              <!-- Time Mandante -->
              <div style="flex:1;text-align:center;min-width:100px;">
                <div style="margin-bottom:8px;">
                  ${t1?.flag ? `<img src="${t1.flag}" alt="${t1.name}" style="width:56px;height:42px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">` : '🏆'}
                </div>
                <div style="font-weight:600;font-size:14px;">${t1?.name || game.home}</div>
              </div>
              
              <!-- Placar -->
              <div style="text-align:center;min-width:100px;">
                <div style="font-family:Anton;font-size:36px;color:var(--gold);letter-spacing:4px;">
                  ${result}
                </div>
                <div style="font-size:11px;color:var(--text-d);margin-top:4px;">VS</div>
              </div>
              
              <!-- Time Visitante -->
              <div style="flex:1;text-align:center;min-width:100px;">
                <div style="margin-bottom:8px;">
                  ${t2?.flag ? `<img src="${t2.flag}" alt="${t2.name}" style="width:56px;height:42px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">` : '🏆'}
                </div>
                <div style="font-weight:600;font-size:14px;">${t2?.name || game.away}</div>
              </div>
            </div>
            
            <!-- Detalhes adicionais -->
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:center;gap:24px;font-size:12px;color:var(--text-d);flex-wrap:wrap;">
              ${game.result && game.result.scorers && game.result.scorers.length ? `<span>⚽ Goleador(es): ${scorerName}</span>` : ''}
              ${game.result && game.result.craqueId ? `<span>⭐ Craque: ${getPlayer(game.result.craqueId)?.name || '—'}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// =============================================
// FUNÇÃO PARA EXIBIR PERFIL DO USUÁRIO
// =============================================
function renderProfile() {
  const container = document.getElementById('tabProfile');
  if (!container) return;
  
  if (!currentUser) {
    container.innerHTML = '<div style="text-align:center;padding:60px;">Faça login para ver seu perfil.</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">👤 Meu Perfil</div>
        <div class="page-subtitle">Gerencie suas informações pessoais</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-title">📋 Informações da Conta</div>
        <div class="rule-item"><strong>Nome:</strong> ${currentUser.profileName}</div>
        <div class="rule-item"><strong>E-mail:</strong> ${currentUser.email || 'Não informado'}</div>
        <div class="rule-item"><strong>ID:</strong> ${currentUser.id}</div>
        <div class="rule-item"><strong>Admin:</strong> ${currentUser.isAdmin ? 'Sim 👑' : 'Não'}</div>
        <div class="rule-item"><strong>Conta criada:</strong> ${new Date(currentUser.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="info-card">
        <div class="info-card-title">🔐 Segurança</div>
        <div class="rule-item"><strong>Autenticação 2FA:</strong> ${currentUser.secureAuth ? '✅ Ativada' : '❌ Desativada'}</div>
        <button class="btn btn-blue" onclick="changePassword()" style="margin-top:16px;">🔑 Alterar Senha</button>
        <button class="btn-ghost" onclick="logout()" style="margin-top:8px;width:100%;">🚪 Sair da Conta</button>
      </div>
    </div>
  `;
}

// =============================================
// SWITCH TAB PRINCIPAL
// =============================================
export async function switchTab(tab) {
  console.log('🔄 Switch tab para:', tab);
  setCurrentTab(tab);
  
  // Atualizar sidebar (desktop)
  document.querySelectorAll('.sidebar .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  
  // Atualizar menu inferior (mobile)
  if (typeof updateMobileActiveTab === 'function') {
    updateMobileActiveTab(tab);
  }
  
  // Atualizar conteúdo das abas
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === 'tab' + cap(tab));
  });
  
  // Fechar sidebar no mobile após clicar
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('show');
  }
  
  // ADMIN - verificar se é admin antes de renderizar
  if (tab === 'admin') {
    if (currentUser && currentUser.isAdmin) {
      await renderAdmin();
    } else {
      const adminContainer = document.getElementById('adminGamesList');
      if (adminContainer) {
        adminContainer.innerHTML = `
          <div style="text-align:center;padding:60px 20px;">
            <div style="font-size:48px;margin-bottom:16px;">🔒</div>
            <h3 style="font-family:Anton;margin-bottom:8px;">Acesso Restrito</h3>
            <p style="color:var(--text-d);">Apenas administradores podem acessar esta área.</p>
          </div>
        `;
      }
    }
    return;
  }
  
  // Outras abas
  if (tab === 'games') await renderGames();
  if (tab === 'bets') await renderBets();
  if (tab === 'ranking') await renderRanking();
  if (tab === 'worldcup') await renderWorldCupGames();
  if (tab === 'standings') await renderStandings();
  if (tab === 'topscorers') await renderTopScorers();
  if (tab === 'profile') renderProfile();
}

// =============================================
// FUNÇÃO PARA TROCAR SENHA
// =============================================
window.changePassword = () => {
  alert('Funcionalidade de troca de senha em desenvolvimento.\n\nPor enquanto, solicite ao administrador uma nova senha temporária.');
};

// =============================================
// EXPORTAÇÕES E REGISTROS
// =============================================
window.switchTab = switchTab;
window.renderProfile = renderProfile;
window.renderWorldCupGames = renderWorldCupGames;

console.log('✅ navigation.js carregado');
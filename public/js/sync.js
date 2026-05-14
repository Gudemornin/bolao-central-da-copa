// sync.js - Merge inteligente com TheSportsDB usando data+times como chave
import { TEAMS } from './data/teams.js';
import { loadGames, saveGames, loadBets, saveBets } from './storage.js';
import { setGamesState } from './state.js';
import { GAMES as MANUAL_GAMES } from './data/games.js';

// Mapeamento de nomes de times (já existentes no TEAMS)
const teamNameMapping = {
  'Valencia CF': 'valencia',
  'Valencia': 'valencia',
  'Rayo Vallecano': 'rayo_vallecano',
  'Rayo Vallecano de Madrid': 'rayo_vallecano',
  'Girona FC': 'girona',
  'Girona': 'girona',
  'Real Sociedad': 'real_sociedad',
  'Real Sociedad de Fútbol': 'real_sociedad',
  'Real Madrid': 'real_madrid',
  'Real Madrid CF': 'real_madrid',
  'Real Oviedo': 'oviedo',
  'Oviedo': 'oviedo',
  // Times da Copa (já existentes)
  'Brazil': 'brazil',
  'Argentina': 'argentina',
  'France': 'france',
  'Portugal': 'portugal',
  'England': 'england',
  'Spain': 'spain',
  'Germany': 'germany',
  'Mexico': 'mexico',
  'Netherlands': 'netherlands',
  'USA': 'usa',
  'Morocco': 'morocco',
  'Japan': 'japan',
  'South Korea': 'south_korea',
  'Australia': 'australia',
  'Switzerland': 'switzerland',
  'Senegal': 'senegal',
  'Ghana': 'ghana',
  'Cameroon': 'cameroon',
  'Ecuador': 'ecuador',
  'Serbia': 'serbia',
  'Poland': 'poland',
  'Canada': 'canada',
  'Iran': 'iran',
  'Saudi Arabia': 'saudi_arabia',
  'Tunisia': 'tunisia',
  'Uruguay': 'uruguay',
  'Colombia': 'colombia',
  'Croatia': 'croatia',
  'Belgium': 'belgium'
};

function mapTeamName(apiName) {
  if (teamNameMapping[apiName]) return teamNameMapping[apiName];
  return apiName.toLowerCase().replace(/\s/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function fetchFromTheSportsDB(endpoint, params = {}) {
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const url = `/api/tsdb?${query}`;
  try {
    const response = await fetch(url);
    const text = await response.text();
    // Verifica se a resposta é HTML (erro)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error(`❌ API retornou HTML (chave inválida ou endpoint errado): ${url}`);
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`❌ JSON inválido: ${text.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Erro na TheSportsDB (${endpoint}):`, error);
    return null;
  }
}

// Extrai goleadores da timeline
function extractScorersFromTimeline(timelineData) {
  const scorers = [];
  if (!timelineData?.timeline) return scorers;
  for (const ev of timelineData.timeline) {
    if (ev.type && ev.type.toLowerCase() === 'goal') {
      scorers.push({
        playerName: ev.player,
        teamName: ev.team,
        minute: ev.minute,
        goals: 1
      });
    }
  }
  // Agrupa por jogador
  const grouped = {};
  for (const s of scorers) {
    if (!grouped[s.playerName]) grouped[s.playerName] = { ...s, goals: 0 };
    grouped[s.playerName].goals++;
  }
  return Object.values(grouped).map(s => ({
    playerId: s.playerName,  // por enquanto usa nome; depois pode ser mapeado para ID real
    playerName: s.playerName,
    team: s.teamName,
    goals: s.goals
  }));
}

// Função principal que busca jogos da La Liga e faz merge com os manuais
export async function syncGamesWithAPI() {
  console.log('🔄 Sincronizando com TheSportsDB (apenas eventos da data dos manuais)...');

  let existingGames = await loadGames();
  if (!Array.isArray(existingGames)) existingGames = [];

  // Preservar jogos da Copa
  const worldCupGames = existingGames.filter(g => g.date && g.date.startsWith('2026-06'));

  // Carregar jogos manuais da La Liga (do arquivo games.js)
  const manualLaLigaGames = MANUAL_GAMES.filter(g => g.group === 'La Liga');

  let apiLaLigaGames = [];

  try {
    const data = await fetchFromTheSportsDB('events_season', { leagueId: 4335 });
    if (data && data.events && data.events.length) {
      // --- FILTRO: manter apenas eventos com data igual a 2026-05-14 (ou qualquer data que você queira)
      const targetDate = '2026-05-14';
      const filteredEvents = data.events.filter(event => event.dateEvent === targetDate);

      console.log(`📅 Eventos totais da API: ${data.events.length}, apenas ${targetDate}: ${filteredEvents.length}`);

      for (const event of filteredEvents) {
        const homeKey = mapTeamName(event.strHomeTeam);
        const awayKey = mapTeamName(event.strAwayTeam);
        const homeExists = TEAMS[homeKey];
        const awayExists = TEAMS[awayKey];
        if (!homeExists || !awayExists) continue;

        const existingGame = existingGames.find(g => g.id === event.idEvent);
        const gameObj = {
  id: event.idEvent, // ou mantém o id manual? Melhor usar o idEvent como identificador único
  apiId: event.idEvent, // guarda o ID da API
  date: event.dateEvent,
  time: event.strTime || '12:00',
  home: homeKey,
  away: awayKey,
  group: 'La Liga',
  venue: event.strVenue || 'Estádio',
  status: event.strStatus === 'FT' ? 'completed' : 'upcoming',
  result: existingGame?.result || null
};
        apiLaLigaGames.push(gameObj);
      }
    }
  } catch (error) {
    console.warn('⚠️ Erro ao buscar eventos da API:', error);
  }

  // Mesclar: jogos da Copa + jogos manuais da La Liga + jogos da API (filtrados)
  const existingIds = new Set([...worldCupGames.map(g => g.id), ...manualLaLigaGames.map(g => g.id)]);
  const newApiGames = apiLaLigaGames.filter(g => !existingIds.has(g.id));
  const mergedGames = [...worldCupGames, ...manualLaLigaGames, ...newApiGames];

  mergedGames.sort((a, b) => new Date(a.date) - new Date(b.date));

  await saveGames(mergedGames);
  setGamesState(mergedGames);

  console.log(`✅ Sincronização concluída: ${worldCupGames.length} Copa, ${manualLaLigaGames.length} La Liga (manual), ${newApiGames.length} La Liga (API)`);
  return mergedGames;
}

// Funções globais para debug
window.forceSync = async () => {
  console.log('🔄 Forçando sincronização...');
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = '🔄 Sincronizando...';
    toast.className = 'show blue';
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
  await syncGamesWithAPI();
  location.reload();
};

window.syncLaLiga = window.forceSync;
window.syncWorldCup = window.forceSync;

console.log('✅ sync.js carregado (merge por data/times)');
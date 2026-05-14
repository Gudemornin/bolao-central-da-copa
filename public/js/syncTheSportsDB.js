import { TEAMS } from './data/teams.js';
import { loadGames, saveGames } from './storage.js';
import { setGamesState } from './state.js';

// IDs das ligas na TheSportsDB
const LEAGUE_IDS = {
  'La Liga': 4335,      // Spanish La Liga
  'Premier League': 4328,
  'Serie A': 4332,
  'Bundesliga': 4331,
  'Ligue 1': 4334,
  'World Cup': 4625      // Copa do Mundo
};

// Mapeamento de nomes de times para as chaves do TEAMS
const teamNameMapping = {
  // La Liga - Times reais
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
  
  // Times adicionais para testes
  'FC Barcelona': 'barcelona',
  'Barcelona': 'barcelona',
  'Atletico Madrid': 'atletico_madrid',
  'Atlético Madrid': 'atletico_madrid',
  'Athletic Bilbao': 'athletic_bilbao',
  'Sevilla FC': 'sevilla',
  'Sevilla': 'sevilla',
  'Villarreal CF': 'villarreal',
  'Villarreal': 'villarreal',
  'Real Betis': 'betis',
  'Real Betis Balompié': 'betis',
  
  // Copa do Mundo
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
  'Uruguay': 'uruguay',
  'Croatia': 'croatia',
  'Belgium': 'belgium',
  'Morocco': 'morocco',
  'Japan': 'japan',
  'Korea Republic': 'south_korea',
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
  'Costa Rica': 'costa_rica',
  'Denmark': 'denmark',
  'Wales': 'wales',
  'Scotland': 'scotland',
  'Czech Republic': 'czech_republic',
  'Austria': 'austria',
  'Norway': 'norway',
  'Sweden': 'sweden',
  'Turkey': 'turkey',
  'Ukraine': 'ukraine',
  'Russia': 'russia',
  'Nigeria': 'nigeria',
  'Egypt': 'egypt',
  'Algeria': 'algeria',
  'Ivory Coast': 'ivory_coast',
  'South Africa': 'south_africa',
  'Qatar': 'qatar',
  'Colombia': 'colombia',
  'New Zealand': 'new_zealand',
  'Iraq': 'iraq',
  'Jordan': 'jordan',
  'Uzbekistan': 'uzbekistan',
  'DR Congo': 'dr_congo',
  'Cape Verde': 'cape_verde',
  'Panama': 'panama',
  'Haiti': 'haiti',
  'Curacao': 'curacao',
  'Bosnia and Herzegovina': 'bosnia',
  'Bosnia': 'bosnia',
  'Paraguay': 'paraguay'
};

function mapTeamName(apiName) {
  if (teamNameMapping[apiName]) {
    return teamNameMapping[apiName];
  }
  return apiName.toLowerCase().replace(/\s/g, '_').replace(/[^a-z0-9_]/g, '');
}

// Converter status da TheSportsDB para o formato do sistema
function mapStatus(status) {
  if (status === 'FT' || status === 'AET' || status === 'PENS') return 'completed';
  if (status === 'LIVE' || status === 'Live' || status === '1H' || status === '2H' || status === 'HT') return 'live';
  if (status === 'NS') return 'upcoming';
  return 'upcoming';
}

// Extrair goleadores da timeline
function extractScorersFromTimeline(timelineData) {
  const scorers = [];
  if (!timelineData || !timelineData.timeline) return scorers;
  
  for (const event of timelineData.timeline) {
    // Eventos de gol na TheSportsDB têm type 'Goal' ou 'goal'
    if (event.type && (event.type.toLowerCase() === 'goal' || event.type === 'Goal')) {
      const playerName = event.player;
      const teamName = event.team;
      const minute = event.minute;
      
      // Tentar encontrar o jogador pelo nome (simplificado)
      // Idealmente você teria um mapeamento de nomes de jogadores
      scorers.push({
        playerName: playerName,
        teamName: teamName,
        minute: minute,
        goals: 1  // Cada evento é um gol
      });
    }
  }
  
  // Agrupar gols por jogador
  const groupedScorers = {};
  for (const scorer of scorers) {
    const key = scorer.playerName;
    if (!groupedScorers[key]) {
      groupedScorers[key] = { ...scorer, goals: 0 };
    }
    groupedScorers[key].goals++;
  }
  
  return Object.values(groupedScorers);
}

// Buscar eventos da TheSportsDB
export async function syncGamesFromTheSportsDB(leagueName = 'La Liga') {
  console.log(`🔄 Sincronizando ${leagueName} com TheSportsDB...`);
  
  const leagueId = LEAGUE_IDS[leagueName];
  if (!leagueId) {
    console.error(`❌ ID da liga não encontrado para: ${leagueName}`);
    return [];
  }
  
  try {
    // Buscar eventos da temporada atual
    const response = await fetch(`/api/tsdb?endpoint=events_season&leagueId=${leagueId}`);
    const data = await response.json();
    
    if (!data.events || !data.events.length) {
      console.log(`⚠️ Nenhum evento encontrado para ${leagueName}`);
      return [];
    }
    
    // Carregar jogos existentes
    let existingGames = await loadGames();
    if (!Array.isArray(existingGames)) existingGames = [];
    
    const existingGamesMap = new Map(existingGames.map(g => [g.id, g]));
    const newGames = [];
    
    for (const event of data.events) {
      const homeKey = mapTeamName(event.strHomeTeam);
      const awayKey = mapTeamName(event.strAwayTeam);
      
      const homeExists = TEAMS[homeKey];
      const awayExists = TEAMS[awayKey];
      
      // Se os times não existem, pular (mas adicionar log)
      if (!homeExists || !awayExists) {
        console.log(`⚠️ Time não cadastrado: ${event.strHomeTeam} (${homeKey}) vs ${event.strAwayTeam} (${awayKey})`);
        continue;
      }
      
      const gameId = event.idEvent || `${leagueName}_${event.dateEvent}_${homeKey}_${awayKey}`;
      const existingGame = existingGamesMap.get(gameId);
      
      // Buscar timeline (gols) se o jogo já aconteceu
      let scorers = [];
      let craqueId = null;
      
      if (event.strStatus === 'FT') {
        try {
          const timelineRes = await fetch(`/api/tsdb?endpoint=event_timeline&id=${event.idEvent}`);
          const timelineData = await timelineRes.json();
          scorers = extractScorersFromTimeline(timelineData);
          // TODO: mapear craque do jogo (se disponível)
        } catch (error) {
          console.error(`Erro ao buscar timeline do jogo ${event.idEvent}:`, error);
        }
      }
      
      const gameObj = {
        id: gameId,
        date: event.dateEvent,
        time: event.strTime || '12:00',
        home: homeKey,
        away: awayKey,
        group: leagueName === 'World Cup' ? event.strLeague : leagueName,
        venue: event.strVenue || 'Estádio',
        status: mapStatus(event.strStatus),
        result: event.intHomeScore && event.intAwayScore ? {
          homeScore: parseInt(event.intHomeScore),
          awayScore: parseInt(event.intAwayScore),
          scorers: scorers,
          craqueId: craqueId
        } : (existingGame?.result || null)
      };
      
      newGames.push(gameObj);
    }
    
    // Mesclar com jogos existentes (manuais)
    const existingIds = new Set(newGames.map(g => g.id));
    const preservedGames = existingGames.filter(g => !existingIds.has(g.id));
    const mergedGames = [...newGames, ...preservedGames];
    
    // Ordenar por data
    mergedGames.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    await saveGames(mergedGames);
    setGamesState(mergedGames);
    
    console.log(`✅ Sincronização concluída: ${newGames.length} jogos importados, ${preservedGames.length} mantidos`);
    return mergedGames;
    
  } catch (error) {
    console.error('❌ Erro na sincronização com TheSportsDB:', error);
    return [];
  }
}

// Forçar sincronização manual
window.syncTheSportsDB = async (league = 'La Liga') => {
  console.log(`🔄 Forçando sincronização da ${league}...`);
  const result = await syncGamesFromTheSportsDB(league);
  if (result.length) {
    showToast(`Sincronizado ${result.length} jogos da ${league}!`, 'green');
  }
  location.reload();
};
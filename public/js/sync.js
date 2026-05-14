// sync.js - Versão com validação de times
import { TEAMS } from './data/teams.js';
import { loadGames, saveGames } from './storage.js';
import { setGamesState } from './state.js';

// Mapeamento de nomes alternativos dos times
const teamNameMapping = {
  // Brest
  'Stade Brestois 29': 'brest',
  'Stade Brestois': 'brest',
  'brest': 'brest',
  'stade_brestois_29': 'brest',
  'Brest': 'brest',
  
  // Strasbourg
  'RC Strasbourg Alsace': 'strasbourg',
  'RC Strasbourg': 'strasbourg',
  'Strasbourg': 'strasbourg',
  'strasbourg': 'strasbourg',
  'rc_strasbourg_alsace': 'strasbourg',
  
  // Times da Copa (mapeamento adicional)
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
  'Costa Rica': 'costa_rica',
  'Denmark': 'denmark',
  'Wales': 'wales',
  'Scotland': 'scotland',
  'Czech Republic': 'czech_republic',
  'Austria': 'austria',
  'Hungary': 'hungary',
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
  'Uruguay': 'uruguay',
  'Colombia': 'colombia',
  'Croatia': 'croatia',
  'Belgium': 'belgium',
  'New Zealand': 'new_zealand',
  'Iraq': 'iraq',
  'Jordan': 'jordan',
  'Uzbekistan': 'uzbekistan',
  'DR Congo': 'dr_congo',
  'Cape Verde': 'cape_verde',
  'Panama': 'panama',
  'Haiti': 'haiti',
  'Curacao': 'curacao',
  'Bosnia': 'bosnia',
  'Paraguay': 'paraguay'
};

function mapTeamName(apiName) {
  // Primeiro tenta o mapeamento direto
  if (teamNameMapping[apiName]) {
    return teamNameMapping[apiName];
  }
  // Fallback: normalizar o nome
  return apiName.toLowerCase().replace(/\s/g, '_');
}

export async function syncGamesWithAPI() {
  console.log('🔄 Sincronizando jogos com a API...');
  
  // Carregar jogos existentes
  let existingGames = await loadGames();
  if (!Array.isArray(existingGames)) existingGames = [];
  
  // Separar jogos da Copa (data em junho/2026) - PRESERVAR
  const worldCupGames = existingGames.filter(g => g.date && g.date.startsWith('2026-06'));
  
  try {
    const response = await fetch('/api/football?endpoint=ligue1_fixtures');
    const data = await response.json();
    
    if (!data.matches || !data.matches.length) {
      console.log('⚠️ Nenhum jogo retornado da API');
      // Manter apenas jogos da Copa
      await saveGames(worldCupGames);
      setGamesState(worldCupGames);
      return worldCupGames;
    }
    
    const validLigue1Games = [];
    const skippedGames = [];
    
    for (const match of data.matches) {
      const homeKey = mapTeamName(match.homeTeam.name);
      const awayKey = mapTeamName(match.awayTeam.name);
      
      // VERIFICAR se os times EXISTEM no TEAMS
      const homeExists = TEAMS[homeKey];
      const awayExists = TEAMS[awayKey];
      
      if (!homeExists || !awayExists) {
        skippedGames.push(`${match.homeTeam.name} vs ${match.awayTeam.name}`);
        console.log(`⚠️ Jogo ignorado (time não cadastrado): ${match.homeTeam.name} (${homeKey}) vs ${match.awayTeam.name} (${awayKey})`);
        continue;
      }
      
      // Verificar se já existe jogo com este ID (para preservar resultados)
      const existingGame = existingGames.find(g => g.id === match.id.toString());
      
      const gameObj = {
        id: match.id.toString(),
        date: match.utcDate.split('T')[0],
        time: new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        home: homeKey,
        away: awayKey,
        group: 'Ligue 1',
        venue: match.venue || 'Estádio',
        status: match.status === 'FINISHED' ? 'completed' : 'upcoming',
        result: existingGame?.result || null
      };
      
      validLigue1Games.push(gameObj);
    }
    
    console.log(`✅ ${validLigue1Games.length} jogos do Ligue 1 importados`);
    console.log(`⚠️ ${skippedGames.length} jogos ignorados (times não cadastrados):`, skippedGames);
    
    // Mesclar: jogos da Copa + jogos válidos do Ligue 1
    const existingIds = new Set(worldCupGames.map(g => g.id));
    const newLigue1Games = validLigue1Games.filter(g => !existingIds.has(g.id));
    const mergedGames = [...worldCupGames, ...newLigue1Games];
    
    // Ordenar por data e hora
    mergedGames.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}:00`);
      const dateB = new Date(`${b.date}T${b.time}:00`);
      return dateA - dateB;
    });
    
    await saveGames(mergedGames);
    setGamesState(mergedGames);
    
    console.log(`✅ Sincronização concluída: ${worldCupGames.length} jogos da Copa + ${newLigue1Games.length} jogos do Ligue 1`);
    return mergedGames;
    
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    // Em caso de erro, manter apenas jogos da Copa
    await saveGames(worldCupGames);
    setGamesState(worldCupGames);
    return worldCupGames;
  }
}

// Forçar sincronização (apenas admin)
window.forceSync = async () => {
  console.log('🔄 Forçando sincronização...');
  await syncGamesWithAPI();
  location.reload();
};
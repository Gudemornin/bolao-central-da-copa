// sync.js – Versão corrigida com mapeamento de nomes
import { TEAMS } from './data/teams.js';
import { loadGames, saveGames } from './storage.js';
import { setGamesState } from './state.js';

// Mapeamento dos nomes da API para as chaves do TEAMS
const teamNameMapping = {
  // Brest
  'Stade Brestois 29': 'brest',
  'Stade Brestois': 'brest',
  'brest': 'brest',
  'stade_brestois_29': 'brest',
  
  // Strasbourg
  'RC Strasbourg Alsace': 'strasbourg',
  'RC Strasbourg': 'strasbourg',
  'Strasbourg': 'strasbourg',
  'strasbourg': 'strasbourg',
  'rc_strasbourg_alsace': 'strasbourg',
  
  // Times da Copa (já estão mapeados normalmente)
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

// sync.js - substitua a função syncGamesWithAPI

export async function syncGamesWithAPI() {
  console.log('🔄 Sincronizando jogos com a API...');

  try {
    const response = await fetch('/api/football?endpoint=ligue1_fixtures');
    const data = await response.json();

    if (!data.matches) return [];

    // Carregar jogos existentes
    let existingGames = await loadGames();
    if (!Array.isArray(existingGames)) {
      console.warn('⚠️ existingGames não é array, corrigindo...');
      existingGames = [];
    }
    
    const existingGamesMap = new Map(existingGames.map(g => [g.id, g]));
    const apiGames = [];

    for (const match of data.matches) {
      const homeKey = mapTeamName(match.homeTeam.name);
      const awayKey = mapTeamName(match.awayTeam.name);
      
      const homeExists = TEAMS[homeKey];
      const awayExists = TEAMS[awayKey];
      
      if (!homeExists || !awayExists) {
        console.log(`⚠️ Jogo ignorado (time não cadastrado): ${match.homeTeam.name} vs ${match.awayTeam.name}`);
        continue;
      }
      
      const gameObj = {
        id: match.id.toString(),
        date: match.utcDate.split('T')[0],
        time: new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        home: homeKey,
        away: awayKey,
        group: 'Ligue 1',
        venue: match.venue || 'Estádio',
        status: match.status === 'FINISHED' ? 'completed' : 'upcoming',
        result: null
      };
      
      const existing = existingGamesMap.get(gameObj.id);
      if (existing && existing.result) {
        gameObj.result = existing.result;
        gameObj.status = existing.status;
      }
      
      apiGames.push(gameObj);
    }
    
    // Mesclar: manter TODOS os jogos existentes que são válidos
    const mergedGames = [...apiGames];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const existing of existingGames) {
      const alreadyInApi = apiGames.some(g => g.id === existing.id);
      const gameDate = new Date(existing.date);
      gameDate.setHours(0, 0, 0, 0);
      
      // ✅ CORREÇÃO: Manter jogos de hoje, amanhã OU que já têm resultado
      const isTodayOrFuture = gameDate >= today;
      const hasResult = existing.result && existing.result.homeScore !== undefined;
      const isWorldCupGame = existing.date && existing.date.startsWith('2026-06');
      
      if (!alreadyInApi && (isTodayOrFuture || hasResult || isWorldCupGame)) {
        mergedGames.push(existing);
        console.log(`✅ Jogo preservado: ${existing.home} vs ${existing.away} (${existing.date})`);
      } else if (!alreadyInApi && !isTodayOrFuture && !hasResult && !isWorldCupGame) {
        console.log(`🗑️ Jogo removido (passado sem resultado): ${existing.home} vs ${existing.away} (${existing.date})`);
      }
    }
    
    await saveGames(mergedGames);
    setGamesState(mergedGames);
    
    console.log(`✅ Sincronizado ${mergedGames.length} jogos`);
    return mergedGames;
    
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return [];
  }
}
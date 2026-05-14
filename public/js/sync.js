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
  console.log('🔄 Sincronizando jogos...');
  
  // Carregar jogos existentes
  let existingGames = await loadGames();
  if (!Array.isArray(existingGames)) existingGames = [];
  
  // Separar jogos da Copa (preservar)
  const worldCupGames = existingGames.filter(g => g.date && g.date.startsWith('2026-06'));
  
  try {
    const response = await fetch('/api/football?endpoint=ligue1_fixtures');
    const data = await response.json();
    
    if (data.matches && data.matches.length) {
      const ligue1Games = data.matches.map(match => ({
        id: match.id.toString(),
        date: match.utcDate.split('T')[0],
        time: new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        home: mapTeamName(match.homeTeam.name),
        away: mapTeamName(match.awayTeam.name),
        group: 'Ligue 1',
        venue: match.venue || 'Estádio',
        status: match.status === 'FINISHED' ? 'completed' : 'upcoming',
        result: null
      }));
      
      // Mesclar: manter jogos da Copa + adicionar Ligue 1 (sem duplicar)
      const existingIds = new Set(worldCupGames.map(g => g.id));
      const newLigue1Games = ligue1Games.filter(g => !existingIds.has(g.id));
      const mergedGames = [...worldCupGames, ...newLigue1Games];
      
      // Ordenar por data
      mergedGames.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}:00`);
        const dateB = new Date(`${b.date}T${b.time}:00`);
        return dateA - dateB;
      });
      
      await saveGames(mergedGames);
      setGamesState(mergedGames);
      console.log(`✅ Sincronizado: ${worldCupGames.length} jogos da Copa + ${newLigue1Games.length} do Ligue 1`);
      return mergedGames;
    }
  } catch (error) {
    console.error('Erro na sincronização:', error);
  }
  
  // Se falhar, mantém só os jogos da Copa
  await saveGames(worldCupGames);
  setGamesState(worldCupGames);
  return worldCupGames;
}
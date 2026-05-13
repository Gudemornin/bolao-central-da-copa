// js/sync.js
import { TEAMS } from './data/teams.js';
import { loadGames, saveGames } from './storage.js';
import { setGamesState } from './state.js';

export async function syncGamesWithAPI() {
console.log('🔄 Sincronizando jogos com a API...');

try {
    const response = await fetch('/api/football?endpoint=ligue1_fixtures');
    const data = await response.json();
    
    if (!data.matches) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Carregar jogos existentes (incluindo manuais)
    const existingGames = await loadGames();
    const existingGamesMap = new Map(existingGames.map(g => [g.id, g]));
    
    // Filtrar e mapear jogos da API
    const newGames = [];
    
    for (const match of data.matches) {
      // Verificar se os dois times existem no TEAMS
    const homeKey = match.homeTeam.name.toLowerCase().replace(/\s/g, '_');
    const awayKey = match.awayTeam.name.toLowerCase().replace(/\s/g, '_');
    const homeExists = TEAMS[homeKey];
    const awayExists = TEAMS[awayKey];
    
    if (!homeExists || !awayExists) {
        console.log(`⚠️ Jogo ignorado (time não cadastrado): ${match.homeTeam.name} vs ${match.awayTeam.name}`);
        continue;
    }
    
      // Verificar se é futuro (opcional - pode manter passados para histórico)
    const matchDate = new Date(match.utcDate);
    matchDate.setHours(0, 0, 0, 0);
    
      // Só adicionar se for futuro OU se já existir no banco (preservar)
    const isFuture = matchDate >= today;
    const alreadyExists = existingGamesMap.has(match.id.toString());
    
    if (!isFuture && !alreadyExists) {
        console.log(`📅 Jogo passado ignorado (não existia): ${match.homeTeam.name} vs ${match.awayTeam.name}`);
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
    
      // Preservar resultado se já existia
    const existing = existingGamesMap.get(gameObj.id);
    if (existing && existing.result) {
        gameObj.result = existing.result;
        gameObj.status = existing.status;
    }
    
    newGames.push(gameObj);
    }
    
    // Mesclar com jogos manuais que não vieram da API (ex: jogo de 13/05)
    for (const existing of existingGames) {
    if (!newGames.some(g => g.id === existing.id)) {
        // Jogo manual, manter
        newGames.push(existing);
        console.log(`✅ Jogo manual preservado: ${existing.home} vs ${existing.away} (${existing.date})`);
    }
    }
    
    // Salvar
    await saveGames(newGames);
    setGamesState(newGames);
    
    console.log(`✅ Sincronizado ${newGames.length} jogos (futuros + manuais)`);
    return newGames;
    
} catch (error) {
    console.error('Erro na sincronização:', error);
    return [];
}
}
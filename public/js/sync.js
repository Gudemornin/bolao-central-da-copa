// sync.js – substitua a função syncGamesWithAPI
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
    
    const apiGames = [];
    
    for (const match of data.matches) {
    const homeKey = match.homeTeam.name.toLowerCase().replace(/\s/g, '_');
    const awayKey = match.awayTeam.name.toLowerCase().replace(/\s/g, '_');
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
    
    // Mesclar: manter TODOS os jogos existentes (mesmo os manuais e passados)
    const mergedGames = [...apiGames];
    
    for (const existing of existingGames) {
    const alreadyInApi = apiGames.some(g => g.id === existing.id);
    if (!alreadyInApi) {
        // Jogo manual – mantém independente da data
        mergedGames.push(existing);
        console.log(`✅ Jogo manual preservado: ${existing.home} vs ${existing.away} (${existing.date})`);
    }
    }
    
    await saveGames(mergedGames);
    setGamesState(mergedGames);
    
    console.log(`✅ Sincronizado ${mergedGames.length} jogos (${apiGames.length} da API + ${mergedGames.length - apiGames.length} manuais)`);
    return mergedGames;
    
} catch (error) {
    console.error('Erro na sincronização:', error);
    return [];
}
}
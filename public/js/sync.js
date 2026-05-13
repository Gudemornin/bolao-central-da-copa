// js/sync.js - Adicione ao seu projeto
let lastSyncTime = null;

export async function syncGamesWithAPI() {
const now = new Date();

  // Sincronizar a cada 1 hora (ou após cada jogo terminar)
  if (lastSyncTime && (now - lastSyncTime) < 60 * 60 * 1000) {
    console.log('⏳ Sincronização recente, pulando...');
    return;
}

try {
    console.log('🔄 Sincronizando jogos com a API...');
    const response = await fetch('/api/sync-games?competition=WC');
    const apiGames = await response.json();
    
    // Carregar jogos atuais do localStorage
    let localGames = JSON.parse(localStorage.getItem('bc26_games') || '[]');
    
    // Atualizar ou adicionar jogos
    apiGames.forEach(apiGame => {
    const existingIndex = localGames.findIndex(g => g.id === apiGame.id);
    
    if (existingIndex !== -1) {
        // Atualizar jogo existente (status, placar)
        localGames[existingIndex] = { 
        ...localGames[existingIndex], 
        ...apiGame,
          // Preservar palpites? Sim, eles ficam em outro localStorage
        };
    } else {
        // Adicionar novo jogo
        localGames.push(apiGame);
    }
    });
    
    // Salvar jogos atualizados
    localStorage.setItem('bc26_games', JSON.stringify(localGames));
    lastSyncTime = now;
    
    console.log(`✅ Sincronizado ${apiGames.length} jogos`);
    
    // Re-renderizar se necessário
    if (window.currentTab === 'games') {
    window.renderGames();
    }
} catch (error) {
    console.error('❌ Erro na sincronização:', error);
}
}

// Sincronizar automaticamente a cada hora
setInterval(syncGamesWithAPI, 60 * 60 * 1000);

// Sincronizar ao carregar a página
syncGamesWithAPI();
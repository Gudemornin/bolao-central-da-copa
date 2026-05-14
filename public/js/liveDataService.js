// js/liveDataService.js
const BASE_URL = '/api/tsdb';

export async function fetchFromAPI(endpoint, params = {}) {
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const url = `${BASE_URL}?${query}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Erro na API:', error);
    return null;
  }
}

// =============================================
// ESPECÍFICOS PARA COPA DO MUNDO
// =============================================

// Classificação dos grupos (TheSportsDB não tem para Copa 2026 ainda)
// Vamos retornar dados mockados ou usar fallback
export async function getStandings() {
  try {
    // Tentar buscar da API se existir leagueId para Copa 2026
    // ID da Copa do Mundo na TheSportsDB é 4625 (usar se disponível)
    const data = await fetchFromAPI('league_table', { leagueId: 4625, season: '2026' });
    if (data && data.table) {
      return data;
    }
  } catch (e) {
    console.warn('Não foi possível carregar classificação da API, usando dados locais');
  }
  // Fallback: dados mockados (para não quebrar a interface)
  return {
    standings: [
      { group: 'A', table: [] },
      { group: 'B', table: [] }
    ]
  };
}

// Partidas (fixtures) - usando events_season
export async function getFixtures(team = null, date = null) {
  const params = { endpoint: 'events_season', leagueId: 4625 }; // ID da Copa
  if (date) params.date = date;
  const data = await fetchFromAPI('events_season', { leagueId: 4625 });
  return data;
}

// Artilheiros (topscorers) - TheSportsDB não tem endpoint direto
// Vamos retornar vazio ou simular
export async function getTopScorers() {
  console.log('⚽ Artilharia: dados serão carregados quando disponíveis');
  return { scorers: [] };
}

export function startAutoUpdate(key, fetchFn, intervalMs = 300000) {
  console.log(`⏰ Auto-update iniciado para "${key}" a cada ${intervalMs / 1000}s`);
  fetchFn().then(data => {
    console.log(`✅ Dados iniciais de "${key}" carregados`);
  }).catch(console.error);
  
  const interval = setInterval(() => {
    fetchFn().then(data => {
      console.log(`🔄 Auto-update de "${key}" executado`);
    }).catch(console.error);
  }, intervalMs);
  
  return () => clearInterval(interval);
}
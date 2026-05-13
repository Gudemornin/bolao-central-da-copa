// js/liveDataService.js
const BASE_URL = '/api/football';

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

export async function getStandings() {
  return fetchFromAPI('standings');
}

export async function getFixtures(team) {
  return fetchFromAPI('fixtures', team ? { team } : {});
}

export async function getTopScorers() {
  return fetchFromAPI('topscorers');
}

export function startAutoUpdate(key, fetchFn, intervalMs = 300000) {
  console.log(`⏰ Auto-update iniciado para "${key}" a cada ${intervalMs / 1000}s`);
  // Executa imediatamente
  fetchFn().then(data => {
    console.log(`✅ Dados iniciais de "${key}" carregados`);
  }).catch(console.error);
  
  // Configura o intervalo
  const interval = setInterval(() => {
    fetchFn().then(data => {
      console.log(`🔄 Auto-update de "${key}" executado`);
    }).catch(console.error);
  }, intervalMs);
  
  // Retorna uma função para cancelar (opcional)
  return () => clearInterval(interval);
}
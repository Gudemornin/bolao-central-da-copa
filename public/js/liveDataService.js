// js/liveDataService.js — Cliente para API-SPORTS via proxy /api/football
//
// Ligas:
//   La Liga (teste): league=140, season=2024
//   Copa 2026:       league=1,   season=2026

const PROXY = '/api/football';

// ── Utilitário central ────────────────────────────────────────────────────────

/**
 * Chama o proxy /api/football com os parâmetros fornecidos.
 * Retorna o array `response` da API-SPORTS ou null em caso de erro.
 */
export async function fetchFromAPI(endpoint, params = {}) {
  const qs  = new URLSearchParams({ endpoint, ...params }).toString();
  const url = `${PROXY}?${qs}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.error) {
      console.error(`❌ API-SPORTS (${endpoint}):`, json.error);
      return null;
    }

    // A API-SPORTS sempre retorna { response: [...], results: N, ... }
    return json.response ?? null;

  } catch (err) {
    console.error(`❌ fetchFromAPI(${endpoint}):`, err.message);
    return null;
  }
}

// ── Fixtures / Jogos ──────────────────────────────────────────────────────────

/**
 * Busca fixtures de uma liga/temporada.
 * @param {number} league  - ID da liga (140 = La Liga, 1 = Copa do Mundo)
 * @param {number} season  - Ano da temporada (2024, 2026)
 * @param {string} [date]  - Filtrar por data 'YYYY-MM-DD' (opcional)
 * @param {string} [status]- 'NS' | 'FT' | 'LIVE' (opcional)
 */
export async function getFixtures(league, season, date = null, status = null) {
  const params = { league, season };
  if (date)   params.date   = date;
  if (status) params.status = status;
  return await fetchFromAPI('fixtures', params);
}

/**
 * Busca jogos ao vivo de uma liga.
 */
export async function getLiveFixtures(league) {
  return await fetchFromAPI('live', { league });
}

/**
 * Busca eventos (gols, cartões, substituições) de um fixture específico.
 * @param {number|string} fixtureId - ID do fixture na API-SPORTS (game.apiId)
 */
export async function getFixtureEvents(fixtureId) {
  return await fetchFromAPI('fixture_events', { fixture: fixtureId });
}

/**
 * Busca estatísticas de um fixture (posse, chutes, etc.).
 */
export async function getFixtureStats(fixtureId) {
  return await fetchFromAPI('fixture_stats', { fixture: fixtureId });
}

// ── Classificação ─────────────────────────────────────────────────────────────

/**
 * Busca a tabela de classificação.
 * @param {number} league - 140 (La Liga) ou 1 (Copa)
 * @param {number} season - 2024, 2026
 */
export async function getStandings(league, season) {
  const response = await fetchFromAPI('standings', { league, season });
  // API-SPORTS retorna [{ league: { standings: [[...]] } }]
  return response?.[0]?.league ?? null;
}

// ── Artilheiros ───────────────────────────────────────────────────────────────

/**
 * Busca os maiores artilheiros da competição.
 * @param {number} league
 * @param {number} season
 */
export async function getTopScorers(league, season) {
  return await fetchFromAPI('topscorers', { league, season });
}

// ── Auto-update ───────────────────────────────────────────────────────────────

/**
 * Inicia polling periódico de uma função de fetch.
 * @param {string}   key        - Label para log
 * @param {Function} fetchFn    - Função async sem args que busca os dados
 * @param {number}   intervalMs - Intervalo em ms (padrão: 5 min)
 * @returns {Function} - Função para cancelar o intervalo
 */
export function startAutoUpdate(key, fetchFn, intervalMs = 300_000) {
  console.log(`⏰ Auto-update "${key}" a cada ${intervalMs / 1000}s`);

  fetchFn().catch(console.error);

  const id = setInterval(() => {
    fetchFn().catch(err => console.error(`Auto-update "${key}":`, err));
  }, intervalMs);

  return () => {
    clearInterval(id);
    console.log(`⏹  Auto-update "${key}" cancelado`);
  };
}

// ── Constantes de liga para uso externo ──────────────────────────────────────

export const LEAGUES = {
  LA_LIGA:    { id: 140, season: 2026, name: 'La Liga'          },
  PREMIER:    { id: 39,  season: 2026, name: 'Premier League'   },
  BUNDESLIGA: { id: 78,  season: 2026, name: 'Bundesliga'       },
  SERIE_A:    { id: 135, season: 2026, name: 'Serie A'          },
  LIGUE_1:    { id: 61,  season: 2026, name: 'Ligue 1'          },
  WORLD_CUP:  { id: 1,   season: 2026, name: 'Copa do Mundo'    },
};

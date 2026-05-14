// js/syncFootballData.js
//
// Fonte primária: football-data.org (via proxy /api/fd, /api/sync-results)
// Fonte secundária: API-SPORTS (via /api/football — apenas eventos detalhados)
//
// Fluxo completo:
//   1. syncResultsFromFD()  — busca scores + gols + cartões de todas as competições
//   2. resolvePlayerIds()   — mapeia nomes da API → IDs locais de jogadores
//   3. updateGamesBatch()   — aplica os resultados no banco e no GAMES_STATE
//
// Uso no console do admin:
//   window.syncCopa()        — sincroniza Copa do Mundo 2026
//   window.syncLaLiga()      — sincroniza La Liga
//   window.syncTodas()       — sincroniza todas as ligas configuradas
//   window.syncManual('PL')  — sincroniza qualquer liga pelo código

import { loadGames, saveGames }  from './storage.js';
import { setGamesState }         from './state.js';
import { PLAYERS }               from './data/players.js';
import { TEAMS }                 from './data/teams.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DE COMPETIÇÕES
// ─────────────────────────────────────────────────────────────────────────────

export const FD_COMPETITIONS = {
  WC:  { code: 'WC',  season: 2026, name: 'Copa do Mundo 2026', group: 'Copa do Mundo' },
  PD:  { code: 'PD',  season: 2025, name: 'La Liga',            group: 'La Liga'        },
  PL:  { code: 'PL',  season: 2025, name: 'Premier League',     group: 'Premier League' },
  BL1: { code: 'BL1', season: 2025, name: 'Bundesliga',         group: 'Bundesliga'     },
  SA:  { code: 'SA',  season: 2025, name: 'Serie A',            group: 'Serie A'        },
  FL1: { code: 'FL1', season: 2025, name: 'Ligue 1',            group: 'Ligue 1'        },
  CL:  { code: 'CL',  season: 2025, name: 'Champions League',   group: 'Champions League' },
};

// Ligas sincronizadas automaticamente a cada 5 min
const AUTO_SYNC_COMPETITIONS = ['WC', 'PD'];

// ─────────────────────────────────────────────────────────────────────────────
// MAPEAMENTO DE TIMES (fd.org → chave local)
// ─────────────────────────────────────────────────────────────────────────────

const FD_TEAM_MAP = {
  'Mexico': 'mexico', 'South Africa': 'south_africa', 'Korea Republic': 'south_korea',
  'South Korea': 'south_korea', 'Czech Republic': 'czech_republic', 'Canada': 'canada',
  'Bosnia and Herzegovina': 'bosnia', 'Qatar': 'qatar', 'Switzerland': 'switzerland',
  'Brazil': 'brazil', 'Morocco': 'morocco', 'Haiti': 'haiti', 'Scotland': 'scotland',
  'United States': 'usa', 'USA': 'usa', 'Paraguay': 'paraguay', 'Australia': 'australia',
  'Turkey': 'turkey', 'Türkiye': 'turkey', 'Germany': 'germany', 'Curacao': 'curacao',
  "Côte d'Ivoire": 'ivory_coast', 'Ivory Coast': 'ivory_coast', 'Ecuador': 'ecuador',
  'Netherlands': 'netherlands', 'Japan': 'japan', 'Sweden': 'sweden', 'Tunisia': 'tunisia',
  'Belgium': 'belgium', 'Egypt': 'egypt', 'Iran': 'iran', 'New Zealand': 'new_zealand',
  'Spain': 'spain', 'Cape Verde': 'cape_verde', 'Saudi Arabia': 'saudi_arabia',
  'Uruguay': 'uruguay', 'France': 'france', 'Senegal': 'senegal', 'Iraq': 'iraq',
  'Norway': 'norway', 'Argentina': 'argentina', 'Algeria': 'algeria', 'Austria': 'austria',
  'Jordan': 'jordan', 'Portugal': 'portugal', 'DR Congo': 'dr_congo', 'Congo DR': 'dr_congo',
  'Uzbekistan': 'uzbekistan', 'Colombia': 'colombia', 'England': 'england',
  'Croatia': 'croatia', 'Ghana': 'ghana', 'Panama': 'panama', 'Poland': 'poland',
  'Serbia': 'serbia', 'Denmark': 'denmark', 'Wales': 'wales', 'Ukraine': 'ukraine',
  'Nigeria': 'nigeria', 'Cameroon': 'cameroon',
  // La Liga
  'Valencia CF': 'valencia', 'Valencia': 'valencia',
  'Rayo Vallecano': 'rayo_vallecano', 'Rayo Vallecano de Madrid': 'rayo_vallecano',
  'Girona FC': 'girona', 'Girona': 'girona',
  'Real Sociedad': 'real_sociedad',
  'Real Madrid CF': 'real_madrid', 'Real Madrid': 'real_madrid',
  'Real Oviedo': 'oviedo',
  'FC Barcelona': 'barcelona', 'Barcelona': 'barcelona',
  'Club Atlético de Madrid': 'atletico_madrid', 'Atlético Madrid': 'atletico_madrid',
  'Athletic Club': 'athletic_bilbao', 'Athletic Bilbao': 'athletic_bilbao',
  'Sevilla FC': 'sevilla', 'Sevilla': 'sevilla',
  'Villarreal CF': 'villarreal', 'Villarreal': 'villarreal',
  'Real Betis Balompié': 'betis', 'Real Betis': 'betis',
  'Celta Vigo': 'celta_vigo', 'RC Celta de Vigo': 'celta_vigo',
  'CA Osasuna': 'osasuna', 'Osasuna': 'osasuna',
  'Getafe CF': 'getafe', 'Getafe': 'getafe',
  'RCD Mallorca': 'mallorca', 'Mallorca': 'mallorca',
  'RCD Espanyol': 'espanyol', 'Espanyol': 'espanyol',
  'Deportivo Alavés': 'alaves', 'Alavés': 'alaves',
  'CD Leganés': 'leganes', 'Leganés': 'leganes',
  'UD Las Palmas': 'las_palmas', 'Las Palmas': 'las_palmas',
  'Real Valladolid': 'valladolid', 'Valladolid': 'valladolid',
};

export function mapFdTeam(name) {
  if (!name) return null;
  if (FD_TEAM_MAP[name]) return FD_TEAM_MAP[name];
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function mapFdStatus(status) {
  if (['FINISHED', 'AWARDED'].includes(status)) return 'completed';
  if (['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(status)) return 'live';
  return 'upcoming';
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING DE JOGADORES (nome da API → ID local)
// ─────────────────────────────────────────────────────────────────────────────

function normName(raw) {
  return (raw || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Tenta encontrar o jogador local que melhor casa com o nome da API.
 * Estratégias: exato → último sobrenome → inicial+sobrenome → sobrenome parcial.
 */
export function resolvePlayer(apiName, teamKey = null) {
  if (!apiName) return null;

  const candidates = teamKey
    ? PLAYERS.filter(p => p.team === teamKey)
    : PLAYERS;

  const norm  = normName(apiName);
  const parts = norm.split(' ').filter(Boolean);

  // 1. Exato
  let hit = candidates.find(p => normName(p.name) === norm);
  if (hit) return hit;

  // 2. Último sobrenome (> 3 letras)
  const last = parts[parts.length - 1];
  if (last?.length > 3) {
    hit = candidates.find(p => {
      const pp = normName(p.name).split(' ');
      return pp[pp.length - 1] === last;
    });
    if (hit) return hit;
  }

  // 3. Inicial + sobrenome ("F. Wirtz" → Florian Wirtz)
  if (parts.length >= 2) {
    const ini = parts[0].replace('.', '');
    hit = candidates.find(p => {
      const pp = normName(p.name).split(' ');
      return pp[0].startsWith(ini) && pp[pp.length - 1] === last;
    });
    if (hit) return hit;
  }

  // 4. Sobrenome contido no nome local (mais permissivo)
  if (last?.length > 4) {
    hit = candidates.find(p => normName(p.name).includes(last));
    if (hit) return hit;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMADA PRINCIPAL: BUSCAR PARTIDAS VIA /api/fd
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca partidas de uma competição diretamente da fd.org via proxy.
 * Retorna array de objetos de jogo no formato interno da plataforma.
 *
 * @param {string} code   - Código da competição (WC, PD, PL, …)
 * @param {string} status - 'FINISHED' | 'IN_PLAY' | null (todas)
 */
export async function fetchFdMatches(code, status = null) {
  const comp = FD_COMPETITIONS[code];
  if (!comp) throw new Error(`Código de competição desconhecido: ${code}`);

  const params = new URLSearchParams({ path: `/competitions/${code}/matches`, season: comp.season });
  if (status) params.set('status', status);

  // TTL: partidas ao vivo → 60 s / finalizadas → 30 min / outras → 5 min
  const ttl = status === 'IN_PLAY' ? 60 : status === 'FINISHED' ? 1800 : 300;
  params.set('ttl', ttl);

  const res  = await fetch(`/api/fd?${params}`);
  if (!res.ok) throw new Error(`/api/fd HTTP ${res.status}`);
  const data = await res.json();

  if (!data.matches?.length) return [];

  const result = [];
  for (const m of data.matches) {
    const homeKey = mapFdTeam(m.homeTeam?.name);
    const awayKey = mapFdTeam(m.awayTeam?.name);

    if (!homeKey || !awayKey) continue;
    if (!TEAMS[homeKey] || !TEAMS[awayKey]) {
      console.log(`⚠️ Time sem cadastro: ${m.homeTeam?.name} (${homeKey}) × ${m.awayTeam?.name} (${awayKey})`);
      continue;
    }

    const fdStatus   = m.status;
    const localStatus = mapFdStatus(fdStatus);
    const matchDate  = m.utcDate?.substring(0, 10);
    const matchTime  = m.utcDate?.substring(11, 16) ?? '12:00';

    // ── Goleadores ──────────────────────────────────────────────────────────
    const scorers = [];
    if (Array.isArray(m.goals)) {
      const goalMap = {};
      for (const g of m.goals) {
        if (g.type === 'OWN_GOAL') continue;
        const n = g.scorer?.name;
        if (!n) continue;
        if (!goalMap[n]) {
          const teamKey = g.team?.name ? mapFdTeam(g.team.name) : null;
          const local   = resolvePlayer(n, teamKey);
          goalMap[n] = { playerName: n, playerId: local?.id ?? null, goals: 0, minutes: [] };
        }
        goalMap[n].goals++;
        if (g.minute) goalMap[n].minutes.push(g.minute);
      }
      scorers.push(...Object.values(goalMap));
    }

    // ── Cartões ─────────────────────────────────────────────────────────────
    const events = [];
    if (Array.isArray(m.bookings)) {
      for (const b of m.bookings) {
        const teamKey = b.team?.name ? mapFdTeam(b.team.name) : null;
        const local   = resolvePlayer(b.player?.name, teamKey);
        events.push({
          type:       b.card === 'YELLOW_CARD' ? 'yellow_card' : 'red_card',
          playerName: b.player?.name ?? null,
          playerId:   local?.id ?? null,
          minute:     b.minute ?? 0,
          team:       teamKey,
        });
      }
    }

    result.push({
      fdId:   m.id,
      date:   matchDate,
      time:   matchTime,
      home:   homeKey,
      away:   awayKey,
      group:  comp.group,
      status: localStatus,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      scorers,
      events,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC COMPLETO (via endpoint do servidor)
//
// Mais eficiente: o servidor busca e salva diretamente no banco.
// O frontend apenas dispara o endpoint e recarrega o estado.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sincroniza resultados chamando o endpoint /api/sync-results.
 * @param {string[]} competitions - ex: ['WC', 'PD']
 * @returns {{ success, updated, details }}
 */
export async function syncResultsFromServer(competitions = AUTO_SYNC_COMPETITIONS) {
  const res = await fetch('/api/sync-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competitions }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC FRONTEND (atualiza GAMES_STATE local sem recarregar a página)
//
// Usado pelo auto-updater a cada 5 min.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca partidas via /api/fd e aplica os resultados no GAMES_STATE.
 * Só toca nos jogos que existem no banco local (não cria novos).
 *
 * @param {string[]} codes - Códigos de competição a sincronizar
 * @returns {number} Número de jogos atualizados
 */
export async function syncResultsFrontend(codes = AUTO_SYNC_COMPETITIONS) {
  let existingGames = await loadGames();
  if (!Array.isArray(existingGames)) existingGames = [];

  let updated = 0;

  for (const code of codes) {
    try {
      const matches = await fetchFdMatches(code);

      for (const m of matches) {
        if (m.homeScore == null) continue;

        const idx = existingGames.findIndex(g =>
          g.date === m.date &&
          ((g.home === m.home && g.away === m.away) ||
           (g.home === m.away && g.away === m.home))
        );

        if (idx === -1) continue;

        const prev = existingGames[idx];

        existingGames[idx] = {
          ...prev,
          status: m.status,
          fdId:   m.fdId ?? prev.fdId,
          result: {
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            scorers:  m.scorers.length ? m.scorers : (prev.result?.scorers ?? []),
            events:   m.events.length  ? m.events  : (prev.result?.events  ?? []),
            craqueId: prev.result?.craqueId ?? null,
          },
        };

        updated++;
      }
    } catch (err) {
      console.error(`❌ syncResultsFrontend(${code}):`, err.message);
    }
  }

  if (updated > 0) {
    await saveGames(existingGames);
    setGamesState(existingGames);
    console.log(`🔄 syncResultsFrontend: ${updated} jogos atualizados`);
  }

  // Compatibilidade global para o admin e scripts antigos
  window.syncGamesWithAPI = syncResultsFrontend;
  window.syncFootballData = {
    syncResultsFrontend,
    syncResultsFromServer,
    fetchFdMatches,
    fetchFdStandings,
    fetchFdScorers,
  };

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICAÇÃO (standings) via football-data.org
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca classificação formatada para renderização.
 * Retorna array de grupos, onde cada grupo tem array de times.
 *
 * @param {string} code   - WC | PD | PL | BL1 | SA | FL1
 * @param {number} season - 2026 (WC) ou 2024 (ligas)
 */
export async function fetchFdStandings(code, season) {
  const comp = FD_COMPETITIONS[code];
  season = season ?? comp?.season ?? 2024;

  const res = await fetch(
    `/api/fd?path=${encodeURIComponent(`/competitions/${code}/standings`)}&season=${season}&ttl=900`
  );

  if (!res.ok) throw new Error(`standings HTTP ${res.status}`);
  const data = await res.json();

  // fd.org retorna standings como array de grupos
  const rawGroups = data.standings ?? [];

  return rawGroups.map(group => ({
    label: group.stage === 'GROUP_STAGE' ? (group.group ?? 'Grupo') : (group.stage ?? group.type),
    table: (group.table ?? []).map(entry => ({
      position:     entry.position,
      team:         entry.team?.name,
      teamKey:      mapFdTeam(entry.team?.name),
      logo:         entry.team?.crest ?? null,
      played:       entry.playedGames ?? 0,
      won:          entry.won         ?? 0,
      draw:         entry.draw        ?? 0,
      lost:         entry.lost        ?? 0,
      goalsFor:     entry.goalsFor    ?? 0,
      goalsAgainst: entry.goalsAgainst ?? 0,
      goalDiff:     entry.goalDifference ?? 0,
      points:       entry.points      ?? 0,
      form:         entry.form        ?? '',
    })),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTILHEIROS via football-data.org
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca os top artilheiros de uma competição.
 * Retorna array com nome, time, gols, assistências.
 *
 * @param {string} code
 * @param {number} season
 * @param {number} limit - Máximo de artilheiros retornados
 */
export async function fetchFdScorers(code, season, limit = 20) {
  const comp = FD_COMPETITIONS[code];
  season = season ?? comp?.season ?? 2024;

  const res = await fetch(
    `/api/fd?path=${encodeURIComponent(`/competitions/${code}/scorers`)}&season=${season}&limit=${limit}&ttl=1800`
  );

  if (!res.ok) throw new Error(`scorers HTTP ${res.status}`);
  const data = await res.json();

  return (data.scorers ?? []).map(s => ({
    name:      s.player?.name ?? '—',
    photo:     s.player?.photo ?? null,
    team:      s.team?.name ?? '—',
    teamKey:   mapFdTeam(s.team?.name),
    teamCrest: s.team?.crest ?? null,
    goals:     s.goals ?? 0,
    assists:   s.assists ?? 0,
    penalties: s.penalties ?? 0,
    localPlayer: resolvePlayer(s.player?.name, mapFdTeam(s.team?.name)),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-UPDATER (substitui o /api/update-results anterior)
// ─────────────────────────────────────────────────────────────────────────────

let _autoUpdateTimer = null;

/**
 * Inicia o polling automático de resultados via football-data.org.
 * Chama o endpoint do servidor (/api/sync-results) a cada `intervalMs`.
 *
 * @param {string[]} competitions - Competições a monitorar
 * @param {number}   intervalMs   - Intervalo em ms (padrão: 5 min)
 * @returns {Function} - Cancela o polling quando chamada
 */
export function startFdAutoUpdate(
  competitions = AUTO_SYNC_COMPETITIONS,
  intervalMs = 300_000
) {
  stopFdAutoUpdate();

  console.log(`⏰ FD auto-update: ${competitions.join(', ')} a cada ${intervalMs / 1000}s`);

  const run = async () => {
    try {
      const result = await syncResultsFromServer(competitions);
      if (result.updated > 0) {
        console.log(`✅ Auto-update: ${result.updated} jogo(s) atualizado(s)`);
        // Disparar evento customizado para renderizadores reagirem
        window.dispatchEvent(new CustomEvent('fd:results-updated', {
          detail: { updated: result.updated, details: result.details },
        }));
      }
    } catch (err) {
      console.error('❌ FD auto-update falhou:', err.message);
    }
  };

  run(); // executa imediatamente na primeira vez
  _autoUpdateTimer = setInterval(run, intervalMs);

  return stopFdAutoUpdate;
}

export function stopFdAutoUpdate() {
  if (_autoUpdateTimer) {
    clearInterval(_autoUpdateTimer);
    _autoUpdateTimer = null;
    console.log('⏹ FD auto-update parado');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES GLOBAIS PARA O ADMIN (console do navegador)
// ─────────────────────────────────────────────────────────────────────────────

/** Mostra toast de sincronização */
function _toast(msg, color = 'blue') {
  if (typeof showToast === 'function') showToast(msg, color);
  else console.log('🔔', msg);
}

/** Sync + reload */
async function _syncAndReload(competitions, label) {
  _toast(`🔄 Sincronizando ${label}…`);
  try {
    const r = await syncResultsFromServer(competitions);
    _toast(`✅ ${label}: ${r.updated} jogos atualizados`, 'green');
    console.log('Detalhes:', r.details);
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    _toast(`❌ Erro: ${err.message}`, 'red');
    console.error(err);
  }
}

/** Sincronizar Copa do Mundo */
window.syncCopa    = () => _syncAndReload(['WC'],  'Copa do Mundo');

/** Sincronizar La Liga */
window.syncLaLiga  = () => _syncAndReload(['PD'],  'La Liga');

/** Sincronizar Premier League */
window.syncPremier = () => _syncAndReload(['PL'],  'Premier League');

/** Sincronizar Bundesliga */
window.syncBundesliga = () => _syncAndReload(['BL1'], 'Bundesliga');

/** Sincronizar Serie A */
window.syncSerieA  = () => _syncAndReload(['SA'],  'Serie A');

/** Sincronizar todas as competições configuradas */
window.syncTodas   = () => _syncAndReload(
  Object.keys(FD_COMPETITIONS),
  'Todas as competições'
);

/** Sincronizar competição específica pelo código */
window.syncManual  = (code) => {
  if (!FD_COMPETITIONS[code]) {
    console.error(`Código inválido. Disponíveis: ${Object.keys(FD_COMPETITIONS).join(', ')}`);
    return;
  }
  _syncAndReload([code], FD_COMPETITIONS[code].name);
};

/** Testar resolução de nome de jogador */
window.testPlayerName = (apiName, teamKey = null) => {
  const r = resolvePlayer(apiName, teamKey);
  console.log(`Resolução de "${apiName}" →`, r ?? 'NÃO ENCONTRADO');
  return r;
};

/** Ver classificação no console */
window.verClassificacao = async (code = 'WC') => {
  try {
    const groups = await fetchFdStandings(code);
    for (const g of groups) {
      console.group(`📊 ${g.label}`);
      console.table(g.table.map(t => ({
        '#': t.position, Time: t.team, J: t.played,
        V: t.won, E: t.draw, D: t.lost,
        GP: t.goalsFor, GC: t.goalsAgainst,
        SG: t.goalDiff, Pts: t.points,
      })));
      console.groupEnd();
    }
  } catch (err) {
    console.error('Erro:', err.message);
  }
};

/** Ver artilheiros no console */
window.verArtilheiros = async (code = 'WC') => {
  try {
    const scorers = await fetchFdScorers(code, FD_COMPETITIONS[code]?.season);
    console.table(scorers.slice(0, 10).map((s, i) => ({
      '#': i + 1, Jogador: s.name, Time: s.team,
      Gols: s.goals, Assist: s.assists, 'ID local': s.localPlayer?.id ?? '—',
    })));
  } catch (err) {
    console.error('Erro:', err.message);
  }
};

window.syncGamesWithAPI = syncResultsFrontend;
window.syncTodas = () => _syncAndReload(Object.keys(FD_COMPETITIONS), 'Todas as competições');
window.syncFootballData = {
  syncResultsFrontend,
  syncResultsFromServer,
  fetchFdMatches,
  fetchFdStandings,
  fetchFdScorers,
};

console.log('✅ syncFootballData.js carregado');
console.log('💡 Comandos: syncCopa() | syncLaLiga() | syncTodas() | syncManual("PL")');

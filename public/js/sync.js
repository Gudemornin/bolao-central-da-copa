// js/sync.js — Sincronização com API-SPORTS
// Para testes:   La Liga (league=140, season=2024)
// Para a Copa:   World Cup (league=1, season=2026)
//
// Fluxo:
//   1. Busca fixtures da liga/temporada no /api/football
//   2. Mapeia times da API → chaves locais do TEAMS
//   3. Faz merge com jogos manuais (preserva Copa + manuais existentes)
//   4. Salva resultado + atualiza GAMES_STATE

import { TEAMS }                     from './data/teams.js';
import { PLAYERS }                   from './data/players.js';
import { loadGames, saveGames }      from './storage.js';
import { setGamesState }             from './state.js';
import { GAMES as MANUAL_GAMES }     from './data/games.js';
import { getFixtures, LEAGUES }      from './liveDataService.js';
import { syncGamesFromTheSportsDB }  from './syncTheSportsDB.js';

// ── Configuração padrão de sincronização ─────────────────────────────────────

const SYNC_CONFIG = {
  // Altere aqui para mudar a liga de testes
  TEST_LEAGUE:  LEAGUES.LA_LIGA,
  // Copa do Mundo (ativa após 2026-06-11)
  CUP_LEAGUE:   LEAGUES.WORLD_CUP,
};

// ── Mapeamento de nomes (API-SPORTS → chave local) ───────────────────────────
// Adicione novos times conforme necessário

const TEAM_NAME_MAP = {
  // ── La Liga ──────────────────────────────────────────────────────────────
  'Valencia':               'valencia',
  'Valencia CF':            'valencia',
  'Rayo Vallecano':         'rayo_vallecano',
  'Rayo Vallecano de Madrid': 'rayo_vallecano',
  'Girona':                 'girona',
  'Girona FC':              'girona',
  'Real Sociedad':          'real_sociedad',
  'Real Sociedad de Fútbol': 'real_sociedad',
  'Real Madrid':            'real_madrid',
  'Real Madrid CF':         'real_madrid',
  'Real Oviedo':            'oviedo',
  'Oviedo':                 'oviedo',
  'FC Barcelona':           'barcelona',
  'Barcelona':              'barcelona',
  'Atletico Madrid':        'atletico_madrid',
  'Atlético Madrid':        'atletico_madrid',
  'Athletic Bilbao':        'athletic_bilbao',
  'Athletic Club':          'athletic_bilbao',
  'Sevilla':                'sevilla',
  'Sevilla FC':             'sevilla',
  'Villarreal':             'villarreal',
  'Villarreal CF':          'villarreal',
  'Real Betis':             'betis',
  'Real Betis Balompié':    'betis',
  'Celta Vigo':             'celta_vigo',
  'RC Celta de Vigo':       'celta_vigo',
  'Osasuna':                'osasuna',
  'CA Osasuna':             'osasuna',
  'Getafe':                 'getafe',
  'Getafe CF':              'getafe',
  'Mallorca':               'mallorca',
  'RCD Mallorca':           'mallorca',
  'Espanyol':               'espanyol',
  'RCD Espanyol':           'espanyol',
  'Deportivo Alavés':       'alaves',
  'Alavés':                 'alaves',
  'Leganés':                'leganes',
  'CD Leganés':             'leganes',
  'Las Palmas':             'las_palmas',
  'UD Las Palmas':          'las_palmas',
  'Valladolid':             'valladolid',
  'Real Valladolid':        'valladolid',

  // ── Copa do Mundo ─────────────────────────────────────────────────────────
  'Brazil':                 'brazil',
  'Argentina':              'argentina',
  'France':                 'france',
  'Portugal':               'portugal',
  'England':                'england',
  'Spain':                  'spain',
  'Germany':                'germany',
  'Mexico':                 'mexico',
  'Netherlands':            'netherlands',
  'USA':                    'usa',
  'United States':          'usa',
  'Morocco':                'morocco',
  'Japan':                  'japan',
  'Korea Republic':         'south_korea',
  'South Korea':            'south_korea',
  'Australia':              'australia',
  'Switzerland':            'switzerland',
  'Senegal':                'senegal',
  'Ghana':                  'ghana',
  'Ecuador':                'ecuador',
  'Serbia':                 'serbia',
  'Poland':                 'poland',
  'Canada':                 'canada',
  'Iran':                   'iran',
  'Saudi Arabia':           'saudi_arabia',
  'Tunisia':                'tunisia',
  'Uruguay':                'uruguay',
  'Colombia':               'colombia',
  'Croatia':                'croatia',
  'Belgium':                'belgium',
  'Denmark':                'denmark',
  'Scotland':               'scotland',
  'Turkey':                 'turkey',
  'Norway':                 'norway',
  'Sweden':                 'sweden',
  'Austria':                'austria',
  'Algeria':                'algeria',
  'Egypt':                  'egypt',
  'Ivory Coast':            'ivory_coast',
  "Côte d'Ivoire":          'ivory_coast',
  'South Africa':           'south_africa',
  'Qatar':                  'qatar',
  'New Zealand':            'new_zealand',
  'Iraq':                   'iraq',
  'Jordan':                 'jordan',
  'Uzbekistan':             'uzbekistan',
  'DR Congo':               'dr_congo',
  'Congo DR':               'dr_congo',
  'Cape Verde':             'cape_verde',
  'Panama':                 'panama',
  'Haiti':                  'haiti',
  'Curacao':                'curacao',
  'Bosnia and Herzegovina': 'bosnia',
  'Bosnia':                 'bosnia',
  'Paraguay':               'paraguay',
};

// ── Utilitários ───────────────────────────────────────────────────────────────

/** Converte nome da API → chave local, com fallback por slug */
function mapTeam(apiName) {
  if (!apiName) return null;
  if (TEAM_NAME_MAP[apiName]) return TEAM_NAME_MAP[apiName];
  // Fallback: slug simples
  const slug = apiName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug;
}

/** Extrai "YYYY-MM-DD" de uma data ISO ("2025-05-14T20:00:00+00:00") */
function toDate(isoStr) {
  return isoStr ? isoStr.substring(0, 10) : null;
}

/** Extrai "HH:MM" de uma data ISO */
function toTime(isoStr) {
  if (!isoStr) return '12:00';
  // Ex: "2025-05-14T20:00:00+00:00" → "20:00"
  const match = isoStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '12:00';
}

/** Converte status da API-SPORTS → nosso formato */
function mapStatus(apiStatus) {
  const finished = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
  const live     = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'];
  if (finished.includes(apiStatus)) return 'completed';
  if (live.includes(apiStatus))     return 'live';
  return 'upcoming';
}

/**
 * Normaliza um nome de jogador para comparação.
 * "R. Lewandowski" → "r lewandowski"
 */
function normName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tenta casar um nome da API com um jogador local (PLAYERS).
 * Tenta: exato → último sobrenome → 1ª inicial + sobrenome
 */
function matchPlayer(apiName, localPlayers = PLAYERS) {
  if (!apiName) return null;
  const norm = normName(apiName);
  const parts = norm.split(' ');

  // 1. Correspondência exata
  let found = localPlayers.find(p => normName(p.name) === norm);
  if (found) return found;

  // 2. Correspondência pelo último token (sobrenome)
  const lastName = parts[parts.length - 1];
  if (lastName.length > 3) {
    found = localPlayers.find(p => {
      const pp = normName(p.name).split(' ');
      return pp[pp.length - 1] === lastName;
    });
    if (found) return found;
  }

  // 3. Inicial + sobrenome (ex: "R. Lewandowski")
  if (parts.length >= 2) {
    const initial  = parts[0].replace('.', '');
    const surname  = parts[parts.length - 1];
    found = localPlayers.find(p => {
      const pp = normName(p.name).split(' ');
      return pp[0].startsWith(initial) && pp[pp.length - 1] === surname;
    });
    if (found) return found;
  }

  return null;
}

/**
 * Converte a lista de gols de eventos da API → formato interno:
 * [{ playerId, playerName, goals }]
 */
function parseScorers(events = []) {
  const map = {};
  for (const ev of events) {
    if (ev.type !== 'Goal' || ev.detail === 'Own Goal') continue;
    const apiName = ev.player?.name;
    if (!apiName) continue;

    if (!map[apiName]) {
      const local = matchPlayer(apiName);
      map[apiName] = {
        playerName: apiName,
        playerId:   local ? local.id : apiName, // usa ID local ou o nome como fallback
        goals:      0,
      };
    }
    map[apiName].goals++;
  }
  return Object.values(map);
}

// ── Conversão de fixture da API → objeto de jogo interno ────────────────────

function fixtureToGame(fix, leagueName) {
  const homeKey = mapTeam(fix.teams?.home?.name);
  const awayKey = mapTeam(fix.teams?.away?.name);

  // Ignorar times sem mapeamento local
  if (!homeKey || !awayKey) return null;
  if (!TEAMS[homeKey] || !TEAMS[awayKey]) {
    console.log(`⚠️  Time sem cadastro local: ${fix.teams?.home?.name} (${homeKey}) × ${fix.teams?.away?.name} (${awayKey})`);
    return null;
  }

  const apiStatus = fix.fixture?.status?.short;
  const status    = mapStatus(apiStatus);

  // Resultado só para jogos finalizados
  let result = null;
  if (status === 'completed' && fix.goals?.home != null) {
    result = {
      homeScore: fix.goals.home,
      awayScore: fix.goals.away,
      scorers:   [], // preenchido após buscar eventos
      craqueId:  null,
    };
  }

  return {
    // ID interno: prefixo + ID da API (garante unicidade sem colidir com IDs manuais)
    id:      `api_${fix.fixture.id}`,
    apiId:   fix.fixture.id,            // ← ID real da API-SPORTS (usado para buscar eventos)
    date:    toDate(fix.fixture.date),
    time:    toTime(fix.fixture.date),
    home:    homeKey,
    away:    awayKey,
    group:   leagueName,
    venue:   fix.fixture.venue?.name || 'Estádio',
    status,
    result,
  };
}

// ── Sync principal ─────────────────────────────────────────────────────────────

/**
 * Sincroniza jogos da liga escolhida com a API-SPORTS e faz merge com o banco.
 *
 * @param {'test'|'cup'} mode - 'test' = La Liga, 'cup' = Copa 2026
 * @param {string}  [date]   - Filtrar apenas uma data 'YYYY-MM-DD' (opcional)
 */
export async function syncGamesWithAPI(mode = 'test', date = null) {
  const leagueCfg = mode === 'cup' ? SYNC_CONFIG.CUP_LEAGUE : SYNC_CONFIG.TEST_LEAGUE;
  const { id: leagueId, season, name: leagueName } = leagueCfg;

  console.log(`🔄 Sync: ${leagueName} (league=${leagueId}, season=${season})${date ? ` | data=${date}` : ''}`);

  // ── 1. Carregar jogos atuais do banco ──────────────────────────────────────
  let existingGames = await loadGames();
  if (!Array.isArray(existingGames)) existingGames = [];

  // Preservar sempre:
  //   • Jogos manuais (id sem prefixo "api_")
  //   • Jogos da Copa quando mode=test
  const preserveFilter = (g) => {
    if (!g.id.startsWith('api_')) return true;          // manual sempre fica
    if (mode === 'test' && g.date?.startsWith('2026-06')) return true; // Copa fica no teste
    return false;
  };
  const preserved = existingGames.filter(preserveFilter);
  const preservedIds = new Set(preserved.map(g => g.id));

  // ── 2. Buscar fixtures da API ──────────────────────────────────────────────
  const fixtures = await getFixtures(leagueId, season, date);
  if (!fixtures?.length) {
    console.warn(`⚠️  Nenhum fixture retornado pela API (${leagueName}). Tentando fallback com TheSportsDB...`);
    const fallbackGames = await syncGamesFromTheSportsDB(leagueName);
    return fallbackGames.length ? fallbackGames : existingGames;
  }

  // ── 3. Converter e filtrar ─────────────────────────────────────────────────
  const apiGames = [];
  for (const fix of fixtures) {
    const game = fixtureToGame(fix, leagueName);
    if (!game)                        continue;
    if (preservedIds.has(game.id))    continue; // Não duplicar manuais

    // Se o jogo da API já existe no banco (atualização), preservar craque e result manual
    const existing = existingGames.find(g => g.id === game.id);
    if (existing) {
      // Preservar resultado definido manualmente (ex: craque escolhido pelo admin)
      if (existing.result?.craqueId) {
        game.result = { ...game.result, craqueId: existing.result.craqueId };
      }
      // Preservar apostas não-API não perdem dados
    }

    apiGames.push(game);
  }

  console.log(`📦 API retornou ${fixtures.length} fixture(s) → ${apiGames.length} mapeado(s)`);

  // ── 4. Merge e ordenar ─────────────────────────────────────────────────────
  const merged = [...preserved, ...apiGames];
  merged.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time}:00`);
    const db = new Date(`${b.date}T${b.time}:00`);
    return da - db;
  });

  // ── 5. Salvar ──────────────────────────────────────────────────────────────
  await saveGames(merged);
  setGamesState(merged);

  console.log(`✅ Sync concluído: ${preserved.length} preservados + ${apiGames.length} da API = ${merged.length} total`);
  return merged;
}

// ── Sync de data específica (chamado internamente a cada 5 min) ──────────────

/**
 * Sincroniza apenas os jogos de hoje para ambas as ligas configuradas.
 * Mais eficiente (usa menos créditos da API).
 */
export async function syncTodayGames() {
  const today = new Date().toISOString().substring(0, 10);
  const [testFixtures, cupFixtures] = await Promise.allSettled([
    getFixtures(SYNC_CONFIG.TEST_LEAGUE.id, SYNC_CONFIG.TEST_LEAGUE.season, today),
    getFixtures(SYNC_CONFIG.CUP_LEAGUE.id,  SYNC_CONFIG.CUP_LEAGUE.season,  today),
  ]);

  let existingGames = await loadGames();
  if (!Array.isArray(existingGames)) existingGames = [];

  const updates = [];

  const processFixtures = (fixtures, leagueName) => {
    if (!fixtures?.length) return;
    for (const fix of fixtures) {
      const game = fixtureToGame(fix, leagueName);
      if (!game) continue;
      updates.push(game);
    }
  };

  if (testFixtures.status === 'fulfilled') processFixtures(testFixtures.value, SYNC_CONFIG.TEST_LEAGUE.name);
  if (cupFixtures.status  === 'fulfilled') processFixtures(cupFixtures.value,  SYNC_CONFIG.CUP_LEAGUE.name);

  if (!updates.length) return existingGames;

  // Aplicar updates no banco
  const gameMap = new Map(existingGames.map(g => [g.id, g]));
  for (const upd of updates) {
    const prev = gameMap.get(upd.id);
    gameMap.set(upd.id, {
      ...prev,
      ...upd,
      // Preservar craque definido manualmente
      result: upd.result
        ? { ...upd.result, craqueId: prev?.result?.craqueId ?? null }
        : prev?.result ?? null,
    });
  }

  const merged = [...gameMap.values()].sort((a, b) =>
    new Date(`${a.date}T${a.time}:00`) - new Date(`${b.date}T${b.time}:00`)
  );

  await saveGames(merged);
  setGamesState(merged);
  return merged;
}

// ── Funções globais para uso no console/admin ─────────────────────────────────

window.syncLaLiga = async () => {
  showSyncToast('La Liga');
  await syncGamesWithAPI('test');
  location.reload();
};

window.syncWorldCup = async () => {
  showSyncToast('Copa do Mundo');
  await syncGamesWithAPI('cup');
  location.reload();
};

window.forceSync = window.syncLaLiga;

function showSyncToast(name) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = `🔄 Sincronizando ${name}…`;
    t.className   = 'show blue';
    setTimeout(() => t.classList.remove('show'), 2500);
  }
}

// Exporta o helper para uso em outros módulos (ex: ranking)
export { matchPlayer, normName, parseScorers };

console.log('✅ sync.js (API-SPORTS) carregado');

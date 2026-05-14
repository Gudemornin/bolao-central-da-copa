// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  INSTRUÇÕES DE INSTALAÇÃO                                                   ║
// ║                                                                              ║
// ║  1. Acesse https://www.football-data.org/client/register                    ║
// ║     Cadastro gratuito, API key chega no e-mail na hora.                     ║
// ║                                                                              ║
// ║  2. No Railway, adicione a variável de ambiente:                             ║
// ║       FD_API_KEY = <sua chave do football-data.org>                          ║
// ║                                                                              ║
// ║  3. Cole este bloco dentro do seu server.js, ANTES da linha:                ║
// ║       app.get('*', ...)   ← fallback do SPA                                 ║
// ║                                                                              ║
// ║  4. Dentro de initDatabase(), adicione a criação da tabela de cache:         ║
// ║     (cole o bloco marcado com "ADICIONE NO initDatabase()" abaixo)           ║
// ║                                                                              ║
// ║  Ligas suportadas (football-data.org):                                       ║
// ║    WC  = Copa do Mundo 2026  (season=2026)                                  ║
// ║    PD  = La Liga             (season=2024)                                  ║
// ║    PL  = Premier League      (season=2024)                                  ║
// ║    BL1 = Bundesliga          (season=2024)                                  ║
// ║    SA  = Serie A             (season=2024)                                  ║
// ║    FL1 = Ligue 1             (season=2024)                                  ║
// ║    CL  = Champions League    (season=2024)                                  ║
// ║                                                                              ║
// ║  Limites gratuitos: 10 requisições/minuto, sem limite diário.               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────────────────────
// ADICIONE NO initDatabase()  (dentro do try existente)
// ─────────────────────────────────────────────────────────────────────────────
/*
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_cache (
      cache_key  TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      fetched_at BIGINT NOT NULL
    )
  `);
*/

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('✅ PostgreSQL conectado');
} else {
  console.warn('⚠️ DATABASE_URL não encontrada. Cache em DB desabilitado.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────────────────────
// MAPEAMENTO: nome da API → chave local do TEAMS
// ─────────────────────────────────────────────────────────────────────────────
const FD_TEAM_MAP = {
  // ── Seleções Copa do Mundo ──────────────────────────────────────────────
  'Mexico':                  'mexico',
  'South Africa':            'south_africa',
  'Korea Republic':          'south_korea',
  'South Korea':             'south_korea',
  'Czech Republic':          'czech_republic',
  'Canada':                  'canada',
  'Bosnia and Herzegovina':  'bosnia',
  'Qatar':                   'qatar',
  'Switzerland':             'switzerland',
  'Brazil':                  'brazil',
  'Morocco':                 'morocco',
  'Haiti':                   'haiti',
  'Scotland':                'scotland',
  'United States':           'usa',
  'USA':                     'usa',
  'Paraguay':                'paraguay',
  'Australia':               'australia',
  'Turkey':                  'turkey',
  'Türkiye':                 'turkey',
  'Germany':                 'germany',
  'Curacao':                 'curacao',
  "Côte d'Ivoire":           'ivory_coast',
  'Ivory Coast':             'ivory_coast',
  'Ecuador':                 'ecuador',
  'Netherlands':             'netherlands',
  'Japan':                   'japan',
  'Sweden':                  'sweden',
  'Tunisia':                 'tunisia',
  'Belgium':                 'belgium',
  'Egypt':                   'egypt',
  'Iran':                    'iran',
  'New Zealand':             'new_zealand',
  'Spain':                   'spain',
  'Cape Verde':              'cape_verde',
  'Saudi Arabia':            'saudi_arabia',
  'Uruguay':                 'uruguay',
  'France':                  'france',
  'Senegal':                 'senegal',
  'Iraq':                    'iraq',
  'Norway':                  'norway',
  'Argentina':               'argentina',
  'Algeria':                 'algeria',
  'Austria':                 'austria',
  'Jordan':                  'jordan',
  'Portugal':                'portugal',
  'DR Congo':                'dr_congo',
  'Congo DR':                'dr_congo',
  'Uzbekistan':              'uzbekistan',
  'Colombia':                'colombia',
  'England':                 'england',
  'Croatia':                 'croatia',
  'Ghana':                   'ghana',
  'Panama':                  'panama',
  'Poland':                  'poland',
  'Serbia':                  'serbia',
  'Denmark':                 'denmark',
  'Wales':                   'wales',
  'Ukraine':                 'ukraine',
  'Nigeria':                 'nigeria',
  'Cameroon':                'cameroon',

  // ── La Liga ─────────────────────────────────────────────────────────────
  'Valencia CF':             'valencia',
  'Valencia':                'valencia',
  'Rayo Vallecano':          'rayo_vallecano',
  'Rayo Vallecano de Madrid':'rayo_vallecano',
  'Girona FC':               'girona',
  'Girona':                  'girona',
  'Real Sociedad':           'real_sociedad',
  'Real Madrid CF':          'real_madrid',
  'Real Madrid':             'real_madrid',
  'Real Oviedo':             'oviedo',
  'FC Barcelona':            'barcelona',
  'Barcelona':               'barcelona',
  'Club Atlético de Madrid': 'atletico_madrid',
  'Atlético Madrid':         'atletico_madrid',
  'Atletico Madrid':         'atletico_madrid',
  'Athletic Club':           'athletic_bilbao',
  'Athletic Bilbao':         'athletic_bilbao',
  'Sevilla FC':              'sevilla',
  'Sevilla':                 'sevilla',
  'Villarreal CF':           'villarreal',
  'Villarreal':              'villarreal',
  'Real Betis Balompié':     'betis',
  'Real Betis':              'betis',
  'Celta Vigo':              'celta_vigo',
  'RC Celta de Vigo':        'celta_vigo',
  'CA Osasuna':              'osasuna',
  'Osasuna':                 'osasuna',
  'Getafe CF':               'getafe',
  'Getafe':                  'getafe',
  'RCD Mallorca':            'mallorca',
  'Mallorca':                'mallorca',
  'RCD Espanyol':            'espanyol',
  'Espanyol':                'espanyol',
  'Deportivo Alavés':        'alaves',
  'Alavés':                  'alaves',
  'CD Leganés':              'leganes',
  'Leganés':                 'leganes',
  'UD Las Palmas':           'las_palmas',
  'Las Palmas':              'las_palmas',
  'Real Valladolid':         'valladolid',
  'Valladolid':              'valladolid',
};

function mapFdTeam(name) {
  if (!name) return null;
  if (FD_TEAM_MAP[name]) return FD_TEAM_MAP[name];
  // Fallback: slug simples
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function mapFdStatus(status) {
  const finished = ['FINISHED', 'AWARDED'];
  const live = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];
  if (finished.includes(status)) return 'completed';
  if (live.includes(status)) return 'live';
  return 'upcoming';
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS DE CACHE
// ─────────────────────────────────────────────────────────────────────────────

async function getCachedFD(pool, cacheKey, ttlMs) {
  if (!pool) return null;
  try {
    const r = await pool.query(
      'SELECT data, fetched_at FROM api_cache WHERE cache_key = $1',
      [cacheKey]
    );
    if (!r.rows.length) return null;
    const { data, fetched_at } = r.rows[0];
    return (Date.now() - Number(fetched_at) < ttlMs) ? data : null;
  } catch {
    return null;
  }
}

async function setCachedFD(pool, cacheKey, data) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO api_cache (cache_key, data, fetched_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE SET data = $2, fetched_at = $3`,
      [cacheKey, JSON.stringify(data), Date.now()]
    );
  } catch (e) {
    console.warn('⚠️ Cache write error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROXY: /api/fd   (football-data.org com cache automático)
//
// Parâmetros via query string:
//   path  - caminho da API, ex: /competitions/WC/matches
//   ttl   - tempo de cache em segundos (default: 300 = 5 min)
//   ...   - demais params são passados como query string para a API
//
// Exemplos de uso no frontend:
//   /api/fd?path=/competitions/WC/matches&status=FINISHED
//   /api/fd?path=/competitions/PD/standings&season=2024&ttl=900
//   /api/fd?path=/competitions/WC/scorers&season=2026
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/fd', async (req, res) => {
  const FD_KEY = process.env.FD_API_KEY;
  const { path: apiPath, ttl = '300', ...params } = req.query;

  if (!apiPath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório' });
  }

  if (!FD_KEY) {
    return res.status(500).json({
      error: 'FD_API_KEY não configurada',
      hint: 'Cadastre-se em football-data.org e adicione FD_API_KEY nas variáveis do Railway',
    });
  }

  const qs = new URLSearchParams(params).toString();
  const cacheKey = `fd:${apiPath}${qs ? ':' + qs : ''}`;
  const ttlMs = Math.max(30, parseInt(ttl) || 300) * 1000;

  // 1. Tenta cache
  const cached = await getCachedFD(pool, cacheKey, ttlMs);
  if (cached) {
    return res.json({ ...cached, _cached: true });
  }

  // 2. Busca na API
  const url = `https://api.football-data.org/v4${apiPath}${qs ? '?' + qs : ''}`;
  console.log(`📡 football-data.org: GET ${url}`);

  try {
    const fdRes = await fetch(url, {
      headers: { 'X-Auth-Token': FD_KEY },
    });

    // Rate limit: retorna cache antigo se disponível
    if (fdRes.status === 429) {
      console.warn('⚠️ football-data.org rate limit atingido');
      const stale = await getCachedFD(pool, cacheKey, Infinity); // qualquer cache serve
      if (stale) return res.json({ ...stale, _stale: true });
      return res.status(429).json({ error: 'Rate limit atingido. Tente novamente em 1 minuto.' });
    }

    if (!fdRes.ok) {
      const text = await fdRes.text().catch(() => '');
      console.error(`❌ football-data.org HTTP ${fdRes.status}:`, text.slice(0, 300));
      return res.status(fdRes.status).json({ error: `API retornou HTTP ${fdRes.status}` });
    }

    const data = await fdRes.json();

    // 3. Salva no cache
    await setCachedFD(pool, cacheKey, data);

    return res.json(data);
  } catch (err) {
    console.error('❌ Proxy /api/fd erro:', err.message);
    // Tenta retornar cache antigo em caso de erro de rede
    const stale = await getCachedFD(pool, cacheKey, Infinity);
    if (stale) return res.json({ ...stale, _stale: true, _error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYNC: /api/sync-results   (POST)
//
// Busca resultados, gols e cartões de uma ou mais competições e atualiza
// o banco automaticamente. Chamado pelo frontend a cada 5 min ou manualmente.
//
// Body (JSON):
//   { competitions: ['WC', 'PD'] }   ← padrão
//
// Response:
//   { success: true, updated: N, details: [...] }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/sync-results', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });

  const FD_KEY = process.env.FD_API_KEY;
  if (!FD_KEY) {
    return res.status(500).json({
      error: 'FD_API_KEY não configurada',
      hint: 'Adicione FD_API_KEY nas variáveis de ambiente do Railway',
    });
  }

  const { competitions = ['WC', 'PD'] } = req.body;

  // Season por competição
  const SEASON_MAP = {
    WC: 2026, PD: 2024, PL: 2024,
    BL1: 2024, SA: 2024, FL1: 2024, CL: 2024,
  };

  try {
    // Carregar jogos atuais do banco
    const gamesResult = await pool.query(
      'SELECT data FROM games WHERE id = $1',
      ['games_data']
    );
    let games = gamesResult.rows[0]?.data?.games ?? [];
    if (!Array.isArray(games)) games = [];

    let totalUpdated = 0;
    const details = [];

    for (const code of competitions) {
      const season = SEASON_MAP[code] ?? 2024;

      try {
        // Buscar partidas da competição
        const url = `https://api.football-data.org/v4/competitions/${code}/matches?season=${season}`;
        const fdRes = await fetch(url, { headers: { 'X-Auth-Token': FD_KEY } });

        if (fdRes.status === 429) {
          details.push({ code, status: 'rate_limited' });
          console.warn(`⚠️ Rate limit ao sincronizar ${code}`);
          continue;
        }

        if (!fdRes.ok) {
          details.push({ code, status: `http_${fdRes.status}` });
          console.warn(`⚠️ HTTP ${fdRes.status} ao sincronizar ${code}`);
          continue;
        }

        const fdData = await fdRes.json();
        if (!fdData.matches?.length) {
          details.push({ code, status: 'no_matches' });
          continue;
        }

        let updatedInLeague = 0;

        for (const match of fdData.matches) {
          // Pular partidas ainda não iniciadas
          if (['SCHEDULED', 'TIMED', 'POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(match.status)) {
            continue;
          }

          const homeKey  = mapFdTeam(match.homeTeam?.name);
          const awayKey  = mapFdTeam(match.awayTeam?.name);
          const matchDate = match.utcDate?.substring(0, 10);

          if (!homeKey || !awayKey || !matchDate) continue;

          // Encontrar jogo correspondente no banco (por data + times, em qualquer ordem)
          const gameIdx = games.findIndex(g =>
            g.date === matchDate &&
            ((g.home === homeKey && g.away === awayKey) ||
             (g.home === awayKey && g.away === homeKey))
          );

          if (gameIdx === -1) continue; // Jogo não cadastrado na plataforma

          const game = games[gameIdx];

          // Placar
          const homeScore = match.score?.fullTime?.home;
          const awayScore = match.score?.fullTime?.away;
          if (homeScore == null || awayScore == null) continue;

          // ── Goleadores (goals[]) ──────────────────────────────────────────
          const scorers = [];
          if (Array.isArray(match.goals)) {
            const goalMap = {};
            for (const goal of match.goals) {
              if (goal.type === 'OWN_GOAL') continue; // gol contra não conta
              const name = goal.scorer?.name;
              if (!name) continue;
              if (!goalMap[name]) {
                goalMap[name] = {
                  playerName: name,
                  playerId:   null, // será resolvido no frontend via matchPlayer()
                  goals:      0,
                  team:       mapFdTeam(goal.team?.name) ?? goal.team?.name,
                  minutes:    [],
                };
              }
              goalMap[name].goals++;
              if (goal.minute) goalMap[name].minutes.push(goal.minute);
            }
            scorers.push(...Object.values(goalMap));
          }

          // ── Eventos: cartões (bookings[]) ─────────────────────────────────
          const events = [];
          if (Array.isArray(match.bookings)) {
            for (const b of match.bookings) {
              events.push({
                type:       b.card === 'YELLOW_CARD' ? 'yellow_card' : 'red_card',
                playerName: b.player?.name ?? null,
                playerId:   null, // resolvido no frontend
                minute:     b.minute ?? 0,
                team:       mapFdTeam(b.team?.name) ?? b.team?.name,
              });
            }
          }

          // ── Atualizar objeto do jogo ──────────────────────────────────────
          const prevResult = game.result ?? {};

          games[gameIdx] = {
            ...game,
            status: mapFdStatus(match.status),
            fdId:   match.id,   // ID da fd.org para chamadas individuais futuras
            result: {
              homeScore,
              awayScore,
              scorers: scorers.length ? scorers : (prevResult.scorers ?? []),
              events:  events.length  ? events  : (prevResult.events  ?? []),
              craqueId: prevResult.craqueId ?? null, // preservar craque manual
            },
          };

          updatedInLeague++;
          totalUpdated++;
        }

        details.push({ code, status: 'ok', updated: updatedInLeague, total: fdData.matches.length });
        console.log(`✅ ${code}: ${updatedInLeague} jogos atualizados`);

        // Pequena pausa entre competições para respeitar 10 req/min
        if (competitions.indexOf(code) < competitions.length - 1) {
          await new Promise(r => setTimeout(r, 6500));
        }

      } catch (leagueErr) {
        console.error(`❌ Erro ao sincronizar ${code}:`, leagueErr.message);
        details.push({ code, status: 'error', error: leagueErr.message });
      }
    }

    // Salvar apenas se algo mudou
    if (totalUpdated > 0) {
      await pool.query(
        `INSERT INTO games (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        ['games_data', JSON.stringify({ games })]
      );
      console.log(`💾 ${totalUpdated} jogos salvos no banco.`);
    }

    res.json({ success: true, updated: totalUpdated, details });
  } catch (err) {
    console.error('❌ /api/sync-results:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: /api/fd-standings   (GET)
//
// Atalho para buscar classificação com cache já configurado.
// Query: ?competition=WC&season=2026&ttl=900
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/fd-standings', async (req, res) => {
  const { competition = 'WC', season = '2026', ttl = '900' } = req.query;
  const FD_KEY = process.env.FD_API_KEY;
  if (!FD_KEY) return res.status(500).json({ error: 'FD_API_KEY não configurada' });

  const apiPath  = `/competitions/${competition}/standings`;
  const qs       = `season=${season}`;
  const cacheKey = `fd:${apiPath}:${qs}`;
  const ttlMs    = parseInt(ttl) * 1000;

  const cached = await getCachedFD(pool, cacheKey, ttlMs);
  if (cached) return res.json({ ...cached, _cached: true });

  try {
    const r = await fetch(`https://api.football-data.org/v4${apiPath}?${qs}`, {
      headers: { 'X-Auth-Token': FD_KEY },
    });
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });
    const data = await r.json();
    await setCachedFD(pool, cacheKey, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: /api/fd-scorers   (GET)
//
// Top artilheiros com cache.
// Query: ?competition=WC&season=2026&ttl=1800
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/fd-scorers', async (req, res) => {
  const { competition = 'WC', season = '2026', ttl = '1800' } = req.query;
  const FD_KEY = process.env.FD_API_KEY;
  if (!FD_KEY) return res.status(500).json({ error: 'FD_API_KEY não configurada' });

  const apiPath  = `/competitions/${competition}/scorers`;
  const qs       = `season=${season}`;
  const cacheKey = `fd:${apiPath}:${qs}`;

  const cached = await getCachedFD(pool, cacheKey, parseInt(ttl) * 1000);
  if (cached) return res.json({ ...cached, _cached: true });

  try {
    const r = await fetch(`https://api.football-data.org/v4${apiPath}?${qs}`, {
      headers: { 'X-Auth-Token': FD_KEY },
    });
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });
    const data = await r.json();
    await setCachedFD(pool, cacheKey, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: /api/fd-match/:id   (GET)
//
// Detalhes de uma partida específica: gols + cartões.
// Usado para buscar eventos quando o sync geral não os incluiu.
// Cache permanente para jogos finalizados.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/fd-match/:id', async (req, res) => {
  const { id } = req.params;
  const FD_KEY = process.env.FD_API_KEY;
  if (!FD_KEY) return res.status(500).json({ error: 'FD_API_KEY não configurada' });

  const cacheKey = `fd:/matches/${id}`;
  const cached = await getCachedFD(pool, cacheKey, Infinity); // cache permanente
  if (cached?.match?.status === 'FINISHED') {
    return res.json({ ...cached, _cached: true });
  }

  // Para jogos em andamento, TTL de 60 segundos
  const liveCache = await getCachedFD(pool, cacheKey, 60_000);
  if (liveCache) return res.json({ ...liveCache, _cached: true });

  try {
    const r = await fetch(`https://api.football-data.org/v4/matches/${id}`, {
      headers: { 'X-Auth-Token': FD_KEY },
    });
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });
    const data = await r.json();
    await setCachedFD(pool, cacheKey, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('*', (req, res) => {
  if (req.path.match(/\.\w+$/)) {
    return res.status(404).send('Arquivo não encontrado');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📂 Servindo arquivos de: ${path.join(__dirname, 'public')}`);
});
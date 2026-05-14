// api/football.js — Proxy servidor para API-SPORTS (v3.football.api-sports.io)
// Configure a variável de ambiente: API_FOOTBALL_KEY=sua_chave_aqui
//
// Endpoints suportados (via ?endpoint=...):
//   fixtures        → /fixtures (por league, season, date, team, status)
//   live            → /fixtures?live=all (jogos ao vivo)
//   fixture_events  → /fixtures/events?fixture=ID
//   fixture_stats   → /fixtures/statistics?fixture=ID
//   standings       → /standings?league=ID&season=ANO
//   topscorers      → /players/topscorers?league=ID&season=ANO
//   players         → /players?team=ID&season=ANO
//
// IDs de liga úteis:
//   La Liga (teste): 140  | season: 202  (temporada 2024-25)
//   Copa do Mundo:     1  | season: 2026

const API_KEY  = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

// Mapeia o param ?endpoint= para a URL real na API-SPORTS
const ROUTE_MAP = {
  fixtures:       (p) => buildUrl('/fixtures',              pick(p, ['league','season','date','team','status','from','to','timezone','id'])),
  live:           (p) => buildUrl('/fixtures',              { live: p.league || 'all', timezone: p.timezone }),
  fixture_events: (p) => buildUrl('/fixtures/events',      pick(p, ['fixture'])),
  fixture_stats:  (p) => buildUrl('/fixtures/statistics',  pick(p, ['fixture'])),
  standings:      (p) => buildUrl('/standings',            pick(p, ['league','season'])),
  topscorers:     (p) => buildUrl('/players/topscorers',   pick(p, ['league','season'])),
  players:        (p) => buildUrl('/players',              pick(p, ['team','season','page'])),
};

function pick(obj, keys) {
  const result = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      result[k] = obj[k];
    }
  }
  return result;
}

function buildUrl(path, params) {
  // Remove undefined/null
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== '')
  );
  const qs = new URLSearchParams(clean).toString();
  return `${BASE_URL}${path}${qs ? '?' + qs : ''}`;
}

export default async function handler(req, res) {
  // CORS permissivo (Railway expõe somente para o próprio domínio em prod)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Método não permitido' });

  // ── Verificação da chave ──────────────────────────────────────────────────
  if (!API_KEY) {
    console.error('❌ API_FOOTBALL_KEY não está definida nas variáveis de ambiente');
    return res.status(500).json({
      error: 'API_FOOTBALL_KEY não configurada',
      hint:  'Adicione API_FOOTBALL_KEY nas variáveis de ambiente do Railway'
    });
  }

  const { endpoint, ...params } = req.query;

  if (!endpoint || !ROUTE_MAP[endpoint]) {
    return res.status(400).json({
      error:   `Endpoint inválido: "${endpoint}"`,
      validos: Object.keys(ROUTE_MAP)
    });
  }

  try {
    const url = ROUTE_MAP[endpoint](params);
    console.log(`📡 API-SPORTS → ${url.replace(BASE_URL, '[base]')}`);

    const apiRes = await fetch(url, {
      headers: {
        'x-apisports-key': API_KEY,
        // Header alternativo caso use plano RapidAPI
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      console.error(`❌ HTTP ${apiRes.status}:`, text.substring(0, 200));
      let body = text;
      try {
        body = JSON.parse(text);
      } catch (parseErr) {
        // mantém o body como texto
      }
      return res.status(apiRes.status).json({
        error: `API retornou HTTP ${apiRes.status}`,
        body,
      });
    }

    const data = await apiRes.json();

    // ── Erros retornados pela própria API (rate limit, chave inválida, etc.) ─
    if (data.errors) {
      const errList = Array.isArray(data.errors)
        ? data.errors
        : Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
      if (errList.length > 0) {
        console.error('❌ Erros da API-SPORTS:', errList);
        return res.status(429).json({ error: 'Erro na API-SPORTS', detalhes: errList });
      }
    }

    // Informativo: créditos restantes
    const remaining = apiRes.headers.get('x-ratelimit-requests-remaining');
    if (remaining !== null) {
      console.log(`ℹ️  Créditos API restantes hoje: ${remaining}`);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('❌ Erro no proxy football.js:', err);
    return res.status(500).json({ error: err.message });
  }
}

// api/update-results.js — Atualiza resultados via API-SPORTS (chamado pelo app a cada 5 min)
// POST /api/update-results
//
// Lógica:
//   1. Carrega todos os jogos do banco
//   2. Filtra jogos "upcoming" cujo horário já passou (+ 2h de tolerância)
//   3. Para cada jogo com apiId, consulta a API-SPORTS
//   4. Se status=FT, salva resultado + goleadores no banco
//   5. Retorna { success, updated: N }

const API_KEY  = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const API_URL  = process.env.INTERNAL_API_URL || '';   // URL interna do seu backend

// ── helpers ──────────────────────────────────────────────────────────────────

async function internalRequest(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}/api${endpoint}`, opts);
  if (!res.ok) throw new Error(`Internal API ${endpoint} → HTTP ${res.status}`);
  return res.json();
}

async function fetchAPIFootball(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-SPORTS ${path} → HTTP ${res.status}`);
  return res.json();
}

// Extrai placar final e goleadores de um fixture da API-SPORTS
function parseFixtureResult(fixtureWrapper) {
  const { fixture, goals, score } = fixtureWrapper;

  // Status: FT=finalizado, AET=prorrogação, PENS=pênaltis
  const finished = ['FT', 'AET', 'PEN'].includes(fixture.status?.short);
  if (!finished) return null;

  const homeScore = goals?.home ?? 0;
  const awayScore = goals?.away ?? 0;

  return { homeScore, awayScore };
}

// Extrai goleadores dos eventos de um fixture
function parseGoalScorers(events) {
  const grouped = {};
  for (const ev of events) {
    // type=="Goal", detail diferente de "Own Goal"
    if (ev.type !== 'Goal' || ev.detail === 'Own Goal') continue;

    const name = ev.player?.name;
    if (!name) continue;

    if (!grouped[name]) {
      grouped[name] = {
        playerName: name,
        teamName:   ev.team?.name || '',
        goals:      0,
        // playerId será resolvido no frontend via matchPlayerByName()
        playerId:   name,
      };
    }
    grouped[name].goals++;
  }
  return Object.values(grouped);
}

// ── handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  if (!API_KEY) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY não configurada' });
  }

  try {
    // 1. Carregar jogos do banco
    const gamesData = await internalRequest('/games');
    const games     = Array.isArray(gamesData?.games) ? gamesData.games : [];

    if (!games.length) {
      return res.status(200).json({ success: true, updated: 0, message: 'Nenhum jogo no banco' });
    }

    const now = Date.now();
    // Jogo candidato: status != completed, tem apiId e já passou 90 min do horário
    const candidates = games.filter(g => {
      if (g.status === 'completed') return false;
      if (!g.apiId)                 return false;
      const start = new Date(`${g.date}T${g.time}:00Z`).getTime();
      return now >= start + 95 * 60 * 1000; // 95 min após início
    });

    if (!candidates.length) {
      return res.status(200).json({ success: true, updated: 0, message: 'Nenhum jogo para verificar' });
    }

    console.log(`🔍 Verificando ${candidates.length} jogo(s) possivelmente finalizado(s)...`);
    let updated = 0;

    for (const game of candidates) {
      try {
        // 2. Buscar fixture na API-SPORTS
        const fixtureData = await fetchAPIFootball(`/fixtures?id=${game.apiId}`);
        const fixtureItem = fixtureData.response?.[0];
        if (!fixtureItem) continue;

        const result = parseFixtureResult(fixtureItem);
        if (!result) continue; // Jogo ainda não finalizado

        // 3. Buscar eventos (gols)
        const eventsData = await fetchAPIFootball(`/fixtures/events?fixture=${game.apiId}`);
        const scorers    = parseGoalScorers(eventsData.response || []);

        // 4. Atualizar objeto do jogo
        const idx = games.findIndex(g => g.id === game.id);
        if (idx !== -1) {
          games[idx] = {
            ...games[idx],
            status: 'completed',
            result: {
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              scorers,
              craqueId: null, // Admin define manualmente
            },
          };
          updated++;
          console.log(`✅ Atualizado: ${game.home} ${result.homeScore}×${result.awayScore} ${game.away}`);
        }

      } catch (gameErr) {
        console.error(`⚠️  Erro ao processar jogo ${game.apiId}:`, gameErr.message);
      }
    }

    // 5. Salvar se houver mudanças
    if (updated > 0) {
      await internalRequest('/games', 'POST', { games });
      console.log(`💾 ${updated} jogo(s) salvo(s) no banco`);
    }

    return res.status(200).json({ success: true, updated });

  } catch (err) {
    console.error('❌ update-results:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

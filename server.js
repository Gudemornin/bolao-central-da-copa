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

// =============================================
// CONEXÃO COM POSTGRESQL
// =============================================
let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('✅ PostgreSQL conectado');
} else {
  console.error('❌ DATABASE_URL não encontrada! Banco de dados não disponível.');
}

// =============================================
// CRIAÇÃO DAS TABELAS
// =============================================
async function initDatabase() {
  if (!pool) return;
  
  try {
    // Primeiro, drop da constraint UNIQUE se existir (para evitar conflitos)
    try {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT users_profile_name_key;`);
      console.log('✅ Constraint UNIQUE removida (se existia)');
    } catch (e) {
      // Constraint não existia, ignorar erro
    }
    
    // Recriar tabela users sem UNIQUE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        profile_name TEXT,
        password_player_id TEXT,
        password_backup TEXT,
        password_reset_pending BOOLEAN DEFAULT FALSE,
        temp_password JSONB,
        reset_by_admin BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        is_hidden BOOLEAN DEFAULT FALSE,
        email TEXT,
        secure_auth BOOLEAN DEFAULT FALSE,
        two_fa_code TEXT,
        admin_overrides JSONB,
        created_at BIGINT
      )
    `);
    
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_backup TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_pending BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password JSONB;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_by_admin BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_overrides JSONB;
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bets (
        user_id TEXT,
        game_id TEXT,
        home_score INT,
        away_score INT,
        player_id TEXT,
        saved_at BIGINT,
        PRIMARY KEY (user_id, game_id)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        data JSONB
      )
    `);
    
    console.log('✅ Tabelas verificadas/criadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
  }
}

await initDatabase();

// =============================================
// MIDDLEWARE
// =============================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// ENDPOINT: USUÁRIOS (GET)
// =============================================
app.get('/api/users', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        profile_name as "profileName", 
        password_player_id as "passwordPlayerId", 
        password_backup as "passwordBackup", 
        password_reset_pending as "passwordResetPending", 
        temp_password as "tempPassword", 
        reset_by_admin as "resetByAdmin", 
        email, 
        is_admin as "isAdmin", 
        is_hidden as "isHidden", 
        secure_auth as "secureAuth", 
        two_fa_code as "twoFaCode", 
        admin_overrides as "adminOverrides", 
        created_at as "createdAt"
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('❌ GET /api/users erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINT: USUÁRIOS (POST)
// =============================================
app.post('/api/users', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  const { users } = req.body;
  
  if (!users || !Array.isArray(users)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }
  
  try {
    for (const user of users) {
      const query = `
        INSERT INTO users (
          id, profile_name, password_player_id, password_backup, password_reset_pending, temp_password, reset_by_admin, email, 
          is_admin, is_hidden, secure_auth, two_fa_code, admin_overrides, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          profile_name = EXCLUDED.profile_name,
          password_player_id = EXCLUDED.password_player_id,
          password_backup = EXCLUDED.password_backup,
          password_reset_pending = EXCLUDED.password_reset_pending,
          temp_password = EXCLUDED.temp_password,
          reset_by_admin = EXCLUDED.reset_by_admin,
          email = EXCLUDED.email,
          is_admin = EXCLUDED.is_admin,
          is_hidden = EXCLUDED.is_hidden,
          secure_auth = EXCLUDED.secure_auth,
          two_fa_code = EXCLUDED.two_fa_code,
          admin_overrides = EXCLUDED.admin_overrides,
          created_at = EXCLUDED.created_at
      `;
      
      await pool.query(query, [
        user.id,
        user.profileName,
        user.passwordPlayerId,
        user.passwordBackup || null,
        user.passwordResetPending || false,
        user.tempPassword || null,
        user.resetByAdmin || false,
        user.email || null,
        user.isAdmin || false,
        user.isHidden || false,
        user.secureAuth || false,
        user.twoFaCode || null,
        user.adminOverrides || null,
        user.createdAt || Date.now()
      ]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/users erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINT: PALPITES (GET)
// =============================================
app.get('/api/bets', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  try {
    const result = await pool.query('SELECT * FROM bets');
    const bets = {};
    for (const row of result.rows) {
      if (!bets[row.user_id]) bets[row.user_id] = {};
      bets[row.user_id][row.game_id] = {
        homeScore: row.home_score,
        awayScore: row.away_score,
        playerId: row.player_id,
        savedAt: row.saved_at
      };
    }
    res.json({ bets });
  } catch (error) {
    console.error('❌ GET /api/bets erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINT: PALPITES (POST)
// =============================================
app.post('/api/bets', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  const { bets } = req.body;
  
  if (!bets) {
    return res.json({ success: true });
  }
  
  try {
    for (const [userId, userBets] of Object.entries(bets)) {
      for (const [gameId, bet] of Object.entries(userBets)) {
        await pool.query(
          `INSERT INTO bets (user_id, game_id, home_score, away_score, player_id, saved_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, game_id) DO UPDATE SET
             home_score = EXCLUDED.home_score,
             away_score = EXCLUDED.away_score,
             player_id = EXCLUDED.player_id,
             saved_at = EXCLUDED.saved_at`,
          [userId, gameId, bet.homeScore, bet.awayScore, bet.playerId, bet.savedAt || Date.now()]
        );
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/bets erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINT: JOGOS (GET)
// =============================================
app.get('/api/games', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  try {
    const result = await pool.query('SELECT data FROM games WHERE id = $1', ['games_data']);
    if (result.rows.length > 0) {
      res.json({ games: result.rows[0].data });
    } else {
      res.json({ games: null });
    }
  } catch (error) {
    console.error('❌ GET /api/games erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINT: JOGOS (POST)
// =============================================
app.post('/api/games', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  const { games } = req.body;
  
  if (!games) {
    return res.json({ success: true });
  }
  
  try {
    await pool.query(
      `INSERT INTO games (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      ['games_data', { games }]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/games erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINT: LIMPAR DADOS
// =============================================
app.delete('/api/clear', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  
  try {
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM bets');
    await pool.query('DELETE FROM games');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/clear erro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }

  const { id } = req.params;

  try {
    // Impedir remoção do admin padrão
    if (id === 'admin_default') {
      return res.status(403).json({ error: 'Não é possível remover o administrador padrão' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Também remover palpites do usuário (opcional, mas recomendado)
    await pool.query('DELETE FROM bets WHERE user_id = $1', [id]);

    res.json({ success: true, message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);
    res.status(500).json({ error: error.message });
  }
});


/* =============================================
 ENDPOINT: API-SPORTS (/api/football)
 ============================================= */
app.get('/api/football', async (req, res) => {
  const API_KEY = process.env.API_FOOTBALL_KEY;
  const BASE_URL = 'https://v3.football.api-sports.io';

  if (!API_KEY) {
    console.error('❌ API_FOOTBALL_KEY não está definida nas variáveis de ambiente');
    return res.status(500).json({
      error: 'API_FOOTBALL_KEY não configurada',
      hint: 'Adicione API_FOOTBALL_KEY nas variáveis de ambiente do Railway'
    });
  }

  const { endpoint, ...params } = req.query;
  const ROUTE_MAP = {
    fixtures:       (p) => buildUrl('/fixtures', pick(p, ['league','season','date','team','status','from','to','timezone','id'])),
    live:           (p) => buildUrl('/fixtures', { live: p.league || 'all', timezone: p.timezone }),
    fixture_events: (p) => buildUrl('/fixtures/events', pick(p, ['fixture'])),
    fixture_stats:  (p) => buildUrl('/fixtures/statistics', pick(p, ['fixture'])),
    standings:      (p) => buildUrl('/standings', pick(p, ['league','season'])),
    topscorers:     (p) => buildUrl('/players/topscorers', pick(p, ['league','season'])),
    players:        (p) => buildUrl('/players', pick(p, ['team','season','page'])),
  };

  function pick(obj, keys) {
    return Object.fromEntries(
      keys
        .filter(key => obj[key] !== undefined && obj[key] !== null && obj[key] !== '')
        .map(key => [key, obj[key]])
    );
  }

  function buildUrl(path, params) {
    const query = new URLSearchParams(params).toString();
    return `${BASE_URL}${path}${query ? `?${query}` : ''}`;
  }

  if (!endpoint || !ROUTE_MAP[endpoint]) {
    return res.status(400).json({
      error: `Endpoint inválido: "${endpoint}"`,
      validos: Object.keys(ROUTE_MAP),
    });
  }

  try {
    const url = ROUTE_MAP[endpoint](params);
    console.log(`📡 API-SPORTS proxy: ${url}`);

    const apiRes = await fetch(url, {
      headers: {
        'x-apisports-key': API_KEY,
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      console.error(`❌ API-SPORTS HTTP ${apiRes.status}:`, text.substring(0, 300));
      return res.status(apiRes.status).json({ error: `API retornou HTTP ${apiRes.status}` });
    }

    const data = await apiRes.json();

    if (data.errors) {
      const errList = Array.isArray(data.errors)
        ? data.errors
        : Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
      if (errList.length > 0) {
        console.error('❌ Erros da API-SPORTS:', errList);
        return res.status(429).json({ error: 'Erro na API-SPORTS', detalhes: errList });
      }
    }

    const remaining = apiRes.headers.get('x-ratelimit-requests-remaining');
    if (remaining !== null) {
      console.log(`ℹ️ Créditos API restantes: ${remaining}`);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Erro no proxy football:', error);
    return res.status(500).json({ error: error.message });
  }
});

// =============================================
// ATUALIZAÇÃO AUTOMÁTICA DE RESULTADOS (5 em 5 min)
// =============================================
// =============================================
// PROXY PARA THESPORTSDB (CHAVE 123)
// =============================================
const THESPORTSDB_API_KEY = '123';
const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

app.get('/api/tsdb', async (req, res) => {
  const { endpoint, leagueId, id, date, teamId, season } = req.query;

  let url = '';
  switch (endpoint) {
    case 'events_season':
      url = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/eventsseason.php?id=${leagueId}`;
      if (season) url += `&s=${season}`;
      break;
    case 'event_timeline':
      url = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/lookuptimeline.php?id=${id}`;
      break;
    case 'event_details':
      url = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/lookupevent.php?id=${id}`;
      break;
    default:
      return res.status(400).json({ error: 'Endpoint não suportado' });
  }

  try {
    console.log(`🌐 Chamando TheSportsDB: ${url}`);
    const response = await fetch(url);
    const text = await response.text();

    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error(`❌ API retornou HTML. URL: ${url}`);
      return res.status(502).json({ error: 'API retornou erro HTML. Verifique a chave e os parâmetros.' });
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error) {
    console.error('❌ Erro no proxy TheSportsDB:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ATUALIZAÇÃO AUTOMÁTICA DE RESULTADOS (5 em 5 min)
// =============================================
app.post('/api/update-results', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });

  try {
    // 1. Carregar jogos atuais
    const gamesResult = await pool.query('SELECT data FROM games WHERE id = $1', ['games_data']);
    let games = gamesResult.rows[0]?.data?.games || [];
    if (!Array.isArray(games)) games = [];

    const now = new Date();
    let updatedCount = 0;
    const updatedGames = [];

    // 2. Filtrar jogos que podem ser atualizados
    const gamesToUpdate = games.filter(g => {
      if (g.status === 'completed') return false;      // já finalizado manualmente
      if (!g.apiId) return false;                      // só atualiza se tiver ID da API
      const gameStart = new Date(`${g.date}T${g.time}:00`);
      return gameStart <= now;                          // já começou
    });

    console.log(`🔄 Verificando ${gamesToUpdate.length} jogos para atualização...`);

    for (const game of gamesToUpdate) {
      try {
        // 3. Buscar detalhes do evento (placar)
        const eventUrl = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/lookupevent.php?id=${game.apiId}`;
        const eventRes = await fetch(eventUrl);
        const eventData = await eventRes.json();
        if (!eventData.events?.[0]) continue;
        const ev = eventData.events[0];

        const homeScore = ev.intHomeScore !== undefined ? parseInt(ev.intHomeScore) : null;
        const awayScore = ev.intAwayScore !== undefined ? parseInt(ev.intAwayScore) : null;
        if (homeScore === null || awayScore === null) continue; // sem placar ainda

        // 4. Buscar timeline (gols, cartões)
        const timelineUrl = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/lookuptimeline.php?id=${game.apiId}`;
        const timelineRes = await fetch(timelineUrl);
        const timelineData = await timelineRes.json();

        const scorers = [];
        if (timelineData.timeline) {
          const goalMap = new Map();
          for (const evt of timelineData.timeline) {
            if (evt.type === 'Goal') {
              const playerName = evt.player;
              goalMap.set(playerName, (goalMap.get(playerName) || 0) + 1);
            }
          }
          for (const [playerName, goals] of goalMap.entries()) {
            scorers.push({ playerId: playerName, playerName, goals });
          }
        }

        // 5. Definir status finalizado
        const status = ev.strStatus;
        const isCompleted = ['FT', 'AET', 'PEN'].includes(status);

        // 6. Atualizar objeto do jogo
        game.status = isCompleted ? 'completed' : 'in_progress';
        if (!game.result) game.result = {};
        game.result.homeScore = homeScore;
        game.result.awayScore = awayScore;
        game.result.scorers = scorers;
        // craqueId mantém o que já existir (ou null)
        if (!game.result.craqueId) game.result.craqueId = null;

        updatedGames.push(game);
        updatedCount++;
        console.log(`✅ Jogo ${game.id} atualizado: ${homeScore}:${awayScore} (${scorers.length} goleadores)`);
      } catch (err) {
        console.error(`❌ Erro no jogo ${game.id}:`, err.message);
      }
    }

    // 7. Salvar alterações
    if (updatedCount > 0) {
      const finalGames = games.map(g => updatedGames.find(ug => ug.id === g.id) || g);
      await pool.query(
        `INSERT INTO games (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        ['games_data', { games: finalGames }]
      );
      console.log(`💾 ${updatedCount} jogos salvos automaticamente.`);
    }

    res.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('❌ Erro no update automático:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// FALLBACK
// =============================================
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
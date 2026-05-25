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
  console.log('⚠️ DATABASE_URL não encontrada. Usando localStorage apenas.');
}

// =============================================
// CRIAÇÃO DAS TABELAS
// =============================================
async function initDatabase() {
  if (!pool) return;
  
  try {
    // 1. Tabela de times (equipes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        flag TEXT,
        color TEXT,
        group_name TEXT,
        is_custom BOOLEAN DEFAULT false
      )
    `);
    console.log('✅ Tabela "teams" verificada/criada');

    // 2. Tabela de partidas estruturada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games_structured (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        time TEXT,
        home_team TEXT REFERENCES teams(id) ON DELETE RESTRICT,
        away_team TEXT REFERENCES teams(id) ON DELETE RESTRICT,
        group_name TEXT,
        venue TEXT,
        status TEXT DEFAULT 'upcoming',
        result JSONB
      )
    `);
    console.log('✅ Tabela "games_structured" verificada/criada');

    // 3. Tabela de usuários (já existente)
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
    console.log('✅ Tabela "users" verificada/criada');

    // 4. Tabela de palpites
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
    console.log('✅ Tabela "bets" verificada/criada');

    await pool.query(`
  CREATE TABLE IF NOT EXISTS special_picks (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    champion_team TEXT,
    mvp_player_id TEXT,
    revelation_player_id TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('✅ Tabela "special_picks" verificada/criada');

    // 5. Tabela de jogos (backup JSON) – opcional
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        data JSONB
      )
    `);
    console.log('✅ Tabela "games" verificada/criada');

  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
  }
}

// Inicializar o banco de dados
await initDatabase();

// =============================================
// MIDDLEWARE
// =============================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// ENDPOINTS PARA EQUIPES (TEAMS)
// =============================================

// GET /api/teams
app.get('/api/teams', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY name');
    res.json({ teams: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/teams
app.post('/api/teams', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id, name, flag, color, group } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id e name são obrigatórios' });
  try {
    await pool.query(
      `INSERT INTO teams (id, name, flag, color, group_name, is_custom)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [id, name, flag || null, color || null, group || null]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/teams/:id
app.put('/api/teams/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id } = req.params;
  const { name, flag, color, group } = req.body;
  try {
    await pool.query(
      `UPDATE teams SET name = $1, flag = $2, color = $3, group_name = $4 WHERE id = $5`,
      [name, flag, color, group, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/teams/:id
app.delete('/api/teams/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id } = req.params;
  try {
    // Verificar se o time está sendo usado em alguma partida
    const check = await pool.query(
      `SELECT 1 FROM games_structured WHERE home_team = $1 OR away_team = $1 LIMIT 1`,
      [id]
    );
    if (check.rowCount > 0) {
      return res.status(400).json({ error: 'Time está sendo usado em uma ou mais partidas. Remova as partidas primeiro.' });
    }
    await pool.query('DELETE FROM teams WHERE id = $1 AND is_custom = true', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINTS PARA PARTIDAS (GAMES_STRUCTURED)
// =============================================

// GET /api/games-structured
app.get('/api/games-structured', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  try {
    const result = await pool.query('SELECT * FROM games_structured ORDER BY date, time');
    res.json({ games: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/games-structured
app.post('/api/games-structured', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id, date, time, home_team, away_team, group_name, venue } = req.body;
  if (!id || !date || !home_team || !away_team) {
    return res.status(400).json({ error: 'Campos obrigatórios: id, date, home_team, away_team' });
  }
  try {
    await pool.query(
      `INSERT INTO games_structured (id, date, time, home_team, away_team, group_name, venue, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'upcoming')`,
      [id, date, time || '12:00', home_team, away_team, group_name || null, venue || null]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/games-structured/:id
app.put('/api/games-structured/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id } = req.params;
  const { date, time, home_team, away_team, group_name, venue, status, result } = req.body;
  try {
    await pool.query(
      `UPDATE games_structured
       SET date = $1, time = $2, home_team = $3, away_team = $4, group_name = $5, venue = $6, status = $7, result = $8
       WHERE id = $9`,
      [date, time, home_team, away_team, group_name, venue, status, result, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/games-structured/:id
app.delete('/api/games-structured/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id } = req.params;
  try {
    // Verificar se existem palpites associados
    const betsCheck = await pool.query('SELECT 1 FROM bets WHERE game_id = $1 LIMIT 1', [id]);
    if (betsCheck.rowCount > 0) {
      return res.status(400).json({ error: 'Existem palpites para esta partida. Remova-os primeiro.' });
    }
    await pool.query('DELETE FROM games_structured WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ENDPOINTS LEGADOS (USERS, BETS, GAMES)
// =============================================

// GET /api/users
app.get('/api/users', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  try {
    const result = await pool.query(`
      SELECT id, profile_name as "profileName", email, is_admin as "isAdmin",
             is_hidden as "isHidden", secure_auth as "secureAuth",
             two_fa_code as "twoFaCode", admin_overrides as "adminOverrides",
             created_at as "createdAt"
      FROM users ORDER BY created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users
app.post('/api/users', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { users } = req.body;
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'Dados inválidos' });
  try {
    for (const user of users) {
      await pool.query(`
        INSERT INTO users (id, profile_name, password_player_id, email, is_admin, is_hidden, secure_auth, two_fa_code, admin_overrides, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          profile_name = EXCLUDED.profile_name,
          password_player_id = EXCLUDED.password_player_id,
          email = EXCLUDED.email,
          is_admin = EXCLUDED.is_admin,
          is_hidden = EXCLUDED.is_hidden,
          secure_auth = EXCLUDED.secure_auth,
          two_fa_code = EXCLUDED.two_fa_code,
          admin_overrides = EXCLUDED.admin_overrides,
          created_at = EXCLUDED.created_at
      `, [
        user.id, user.profileName, user.passwordPlayerId, user.email || null,
        user.isAdmin || false, user.isHidden || false, user.secureAuth || false,
        user.twoFaCode || null, user.adminOverrides || null, user.createdAt || Date.now()
      ]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { id } = req.params;
  if (id === 'admin_default') return res.status(403).json({ error: 'Não é possível remover o administrador padrão' });
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.query('DELETE FROM bets WHERE user_id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bets
app.get('/api/bets', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bets
app.post('/api/bets', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { bets } = req.body;
  if (!bets) return res.json({ success: true });
  try {
    for (const [userId, userBets] of Object.entries(bets)) {
      for (const [gameId, bet] of Object.entries(userBets)) {
        await pool.query(`
          INSERT INTO bets (user_id, game_id, home_score, away_score, player_id, saved_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, game_id) DO UPDATE SET
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            player_id = EXCLUDED.player_id,
            saved_at = EXCLUDED.saved_at
        `, [userId, gameId, bet.homeScore, bet.awayScore, bet.playerId, bet.savedAt || Date.now()]);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/games (legado)
app.get('/api/games', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  try {
    const result = await pool.query('SELECT data FROM games WHERE id = $1', ['games_data']);
    res.json({ games: result.rows[0]?.data || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/games (legado)
app.post('/api/games', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { games } = req.body;
  if (!games) return res.json({ success: true });
  try {
    await pool.query(`
      INSERT INTO games (id, data) VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `, ['games_data', { games }]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clear
app.delete('/api/clear', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  try {
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM bets');
    await pool.query('DELETE FROM games');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// PROXY THE SPORTS DB
// =============================================
const THESPORTSDB_API_KEY = '123';
const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

app.get('/api/tsdb', async (req, res) => {
  const { endpoint, leagueId, id, date } = req.query;
  let url = '';
  if (endpoint === 'events_season') {
    url = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/eventsseason.php?id=${leagueId}`;
  } else if (endpoint === 'event_timeline') {
    url = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/lookuptimeline.php?id=${id}`;
  } else if (endpoint === 'events_day') {
    url = `${THESPORTSDB_BASE_URL}/${THESPORTSDB_API_KEY}/eventsday.php?d=${date}`;
  } else {
    return res.status(400).json({ error: 'Endpoint não suportado' });
  }
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Erro no proxy TheSportsDB:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/special-picks/:userId
app.get('/api/special-picks/:userId', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT champion_team, mvp_player_id, revelation_player_id FROM special_picks WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.json({ championTeam: null, mvpPlayerId: null, revelationPlayerId: null });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/special-picks
app.post('/api/special-picks', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { userId, championTeam, mvpPlayerId, revelationPlayerId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });
  try {
    await pool.query(
      `INSERT INTO special_picks (user_id, champion_team, mvp_player_id, revelation_player_id, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         champion_team = EXCLUDED.champion_team,
         mvp_player_id = EXCLUDED.mvp_player_id,
         revelation_player_id = EXCLUDED.revelation_player_id,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, championTeam || null, mvpPlayerId || null, revelationPlayerId || null]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/special-picks/all (admin)
app.get('/api/special-picks/all', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  // Opcional: verificar se o usuário é admin (pelo header x-admin-key ou similar)
  // Por simplicidade, vamos confiar que a rota só será chamada via frontend admin.
  try {
    const result = await pool.query(`
      SELECT sp.user_id, u.profile_name, sp.champion_team, sp.mvp_player_id, sp.revelation_player_id, sp.updated_at
      FROM special_picks sp
      JOIN users u ON sp.user_id = u.id
      ORDER BY u.profile_name
    `);
    res.json({ picks: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY; // cadastre sua chave em .env
app.get('/api/fd', async (req, res) => {
  const { path, season, ttl, status } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });
  let url = `https://api.football-data.org/v4${path}`;
  if (season) url += `?season=${season}`;
  if (status) url += `${url.includes('?') ? '&' : '?'}status=${status}`;
  try {
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': FD_API_KEY }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', `max-age=${ttl || 300}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tsdb/table', async (req, res) => {
  const { leagueId, season } = req.query;
  if (!leagueId || !season) return res.status(400).json({ error: 'leagueId e season obrigatórios' });
  const url = `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${leagueId}&s=${season}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tsdb/scorers', async (req, res) => {
  const { leagueId } = req.query;
  if (!leagueId) return res.status(400).json({ error: 'leagueId obrigatório' });
  const url = `https://www.thesportsdb.com/api/v1/json/3/lookuptopscorers.php?id=${leagueId}`;
  // ...
});

// =============================================
// FALLBACK
// =============================================
app.get('*', (req, res) => {
  if (req.path.match(/\.\w+$/)) return res.status(404).send('Arquivo não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📂 Servindo arquivos de: ${path.join(__dirname, 'public')}`);
});
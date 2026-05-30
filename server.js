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
CREATE TABLE IF NOT EXISTS special_picks (
  user_id TEXT PRIMARY KEY,
  champion_team TEXT,
  top_scorer_id TEXT,
  mvp_player_id TEXT,
  revelation_player_id TEXT,
  updated_at BIGINT
);
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
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  const { bets } = req.body;
  if (!bets) return res.json({ success: true });

  try {
    await pool.query('BEGIN');

    // Para cada usuário que tem apostas no objeto enviado
    for (const [userId, userBets] of Object.entries(bets)) {
      // 1. Remove TODAS as apostas antigas desse usuário
      await pool.query('DELETE FROM bets WHERE user_id = $1', [userId]);

      // 2. Insere as apostas novas (as que restaram)
      for (const [gameId, bet] of Object.entries(userBets)) {
        await pool.query(
          `INSERT INTO bets (user_id, game_id, home_score, away_score, player_id, saved_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, gameId, bet.homeScore, bet.awayScore, bet.playerId, bet.savedAt || Date.now()]
        );
      }
    }

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
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
 ENDPOINT: FOOTBALL API ANTIGA
 =============================================
app.get('/api/football', async (req, res) => {
  const { endpoint, team } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint obrigatório' });
  }
  
  let url = '';
  switch (endpoint) {
    case 'standings':
      url = 'https://api.football-data.org/v4/competitions/WC/standings';
      break;
    case 'fixtures':
      url = 'https://api.football-data.org/v4/competitions/WC/matches';
      if (team) url += `?team=${team}`;
      break;
      case 'laliga_fixtures':
  url = 'https://api.football-data.org/v4/competitions/PD/matches'; // PD = Primera Division
  break;
    case 'topscorers':
      url = 'https://api.football-data.org/v4/competitions/WC/scorers';
      break;
    default:
      return res.status(400).json({ error: 'Endpoint não suportado' });
  }
  
  try {
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': process.env.API_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Erro no proxy football:', error);
    res.status(500).json({ error: error.message });
  }
});

*/



// =============================================
// PALPITES ESPECIAIS (Campeão, Artilheiro, Craque, Revelação)
// =============================================

// Buscar palpites de um usuário
app.get('/api/special-picks/:userId', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT champion_team, top_scorer_id, mvp_player_id, revelation_player_id FROM special_picks WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      // Retorna objeto vazio (sem palpites)
      return res.json({ championTeam: null, topScorerId: null, mvpId: null, revelationId: null });
    }
    const row = result.rows[0];
    res.json({
      championTeam: row.champion_team,
      topScorerId: row.top_scorer_id,
      mvpId: row.mvp_player_id,
      revelationId: row.revelation_player_id
    });
  } catch (err) {
    console.error('❌ Erro em GET /special-picks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Salvar palpites especiais
app.post('/api/special-picks', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  const { userId, championTeam, topScorerId, mvpId, revelationId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }
  try {
    await pool.query(
      `INSERT INTO special_picks (user_id, champion_team, top_scorer_id, mvp_player_id, revelation_player_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         champion_team = EXCLUDED.champion_team,
         top_scorer_id = EXCLUDED.top_scorer_id,
         mvp_player_id = EXCLUDED.mvp_player_id,
         revelation_player_id = EXCLUDED.revelation_player_id,
         updated_at = EXCLUDED.updated_at`,
      [userId, championTeam || null, topScorerId || null, mvpId || null, revelationId || null, Date.now()]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro em POST /special-picks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Buscar palpites de todos os usuários (para listagem)
app.get('/api/all-special-picks', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Banco de dados não conectado' });
  }
  try {
    const result = await pool.query(`
      SELECT u.id, u.profile_name, 
             sp.champion_team, sp.top_scorer_id, sp.mvp_player_id, sp.revelation_player_id
      FROM users u
      LEFT JOIN special_picks sp ON u.id = sp.user_id
      WHERE (u.is_hidden = false OR u.is_hidden IS NULL)
      ORDER BY u.profile_name
    `);
    const allPicks = {};
    for (const row of result.rows) {
      allPicks[row.id] = {
        profileName: row.profile_name,
        specialPicks: {
          championTeam: row.champion_team,
          topScorerId: row.top_scorer_id,
          mvpId: row.mvp_player_id,
          revelationId: row.revelation_player_id
        }
      };
    }
    res.json(allPicks);
  } catch (err) {
    console.error('❌ Erro em GET /all-special-picks:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clear-games', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  try {
    await pool.query('DELETE FROM games');
    res.json({ success: true, message: 'Todos os jogos foram removidos' });
  } catch (error) {
    console.error('Erro ao limpar jogos:', error);
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

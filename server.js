import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar conexão com PostgreSQL (se DATABASE_URL existir)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  console.log('✅ PostgreSQL conectado');
} else {
  console.log('⚠️ DATABASE_URL não encontrada - usando apenas localStorage');
}

// Função para criar tabelas (apenas se tiver banco)
async function initDatabase() {
  if (!pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        profile_name TEXT UNIQUE,
        password_player_id TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        is_hidden BOOLEAN DEFAULT FALSE,
        email TEXT,
        secure_auth BOOLEAN DEFAULT FALSE,
        two_fa_code TEXT,
        created_at BIGINT
      );
      
      CREATE TABLE IF NOT EXISTS bets (
        user_id TEXT,
        game_id TEXT,
        home_score INT,
        away_score INT,
        player_id TEXT,
        saved_at BIGINT,
        PRIMARY KEY (user_id, game_id)
      );
      
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        data JSONB
      );
    `);
    console.log('✅ Tabelas criadas/verificadas');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
  }
}

// Inicializar banco
await initDatabase();

// Middleware
app.use(express.json());

// ⚠️ Servir arquivos estáticos (ORDEM IMPORTANTE)
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// ENDPOINTS DA API
// =============================================

// USERS
app.get('/api/users', async (req, res) => {
  if (!pool) {
    return res.json({ users: [], localOnly: true });
  }
  
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    // Converter snake_case para camelCase
    const users = result.rows.map(row => ({
      id: row.id,
      profileName: row.profile_name,
      passwordPlayerId: row.password_player_id,
      isAdmin: row.is_admin,
      isHidden: row.is_hidden,
      email: row.email,
      secureAuth: row.secure_auth,
      twoFaCode: row.two_fa_code,
      createdAt: row.created_at,
      // Preservar outros campos customizados se existirem
      ...row
    }));
    res.json({ users });
  } catch (error) {
    console.error('Erro ao buscar users:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { users } = req.body;
  
  if (!pool || !users) {
    return res.json({ success: true, localOnly: true });
  }
  
  try {
    for (const user of users) {
      await pool.query(
        `INSERT INTO users (id, profile_name, password_player_id, is_admin, is_hidden, email, secure_auth, two_fa_code, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           profile_name = EXCLUDED.profile_name,
           password_player_id = EXCLUDED.password_player_id,
           is_admin = EXCLUDED.is_admin,
           is_hidden = EXCLUDED.is_hidden,
           email = EXCLUDED.email,
           secure_auth = EXCLUDED.secure_auth,
           two_fa_code = EXCLUDED.two_fa_code,
           created_at = EXCLUDED.created_at`,
        [user.id, user.profileName, user.passwordPlayerId, user.isAdmin || false, user.isHidden || false, user.email || null, user.secureAuth || false, user.twoFaCode || null, user.createdAt || Date.now()]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar users:', error);
    res.status(500).json({ error: error.message });
  }
});

// BETS
app.get('/api/bets', async (req, res) => {
  if (!pool) {
    return res.json({ bets: {}, localOnly: true });
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
    console.error('Erro ao buscar bets:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bets', async (req, res) => {
  const { bets } = req.body;
  
  if (!pool || !bets) {
    return res.json({ success: true, localOnly: true });
  }
  
  try {
    // Limpar bets antigas do usuário (opcional)
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
    console.error('Erro ao salvar bets:', error);
    res.status(500).json({ error: error.message });
  }
});

// GAMES
app.get('/api/games', async (req, res) => {
  if (!pool) {
    return res.json({ games: null, localOnly: true });
  }
  
  try {
    const result = await pool.query('SELECT * FROM games');
    if (result.rows.length > 0) {
      res.json({ games: result.rows[0].data });
    } else {
      res.json({ games: null });
    }
  } catch (error) {
    console.error('Erro ao buscar games:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/games', async (req, res) => {
  const { games } = req.body;
  
  if (!pool || !games) {
    return res.json({ success: true, localOnly: true });
  }
  
  try {
    await pool.query(
      `INSERT INTO games (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      ['games_data', { games }]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar games:', error);
    res.status(500).json({ error: error.message });
  }
});

// CLEAR ALL DATA
app.delete('/api/clear', async (req, res) => {
  if (!pool) {
    return res.json({ success: true, localOnly: true });
  }
  
  try {
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM bets');
    await pool.query('DELETE FROM games');
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// FOOTBALL API
// =============================================

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
    case 'topscorers':
      url = 'https://api.football-data.org/v4/competitions/WC/scorers';
      break;
    case 'ligue1_fixtures':
      url = 'https://api.football-data.org/v4/competitions/FL1/matches';
      if (team) url += `?team=${team}`;
      break;
    case 'ligue1_standings':
      url = 'https://api.football-data.org/v4/competitions/FL1/standings';
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
    console.error('Erro no proxy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync-games', async (req, res) => {
  const { competition = 'WC' } = req.query;
  
  try {
    const response = await fetch(`https://api.football-data.org/v4/competitions/${competition}/matches`, {
      headers: { 'X-Auth-Token': process.env.API_KEY }
    });
    const data = await response.json();
    
    if (!data.matches) {
      return res.status(404).json({ error: 'Nenhum jogo encontrado' });
    }
    
    const games = data.matches.map(match => ({
      id: match.id,
      date: match.utcDate.split('T')[0],
      time: new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      status: match.status,
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away
    }));
    
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/info', (req, res) => {
  res.json({
    username: process.env.ADMIN_USERNAME || 'eVagabundoTaLa11223',
    playerId: process.env.ADMIN_PASSWORD_PLAYER_ID || 'de04'
  });
});

// =============================================
// FALLBACK (SEMPRE POR ÚLTIMO)
// =============================================

app.get('*', (req, res) => {
  // Se for requisição de arquivo com extensão, retorna 404
  if (req.path.match(/\.\w+$/)) {
    return res.status(404).send('Arquivo não encontrado');
  }
  // Senão, retorna o index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// INICIAR SERVIDOR
// =============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📂 Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
  if (pool) {
    console.log(`🗄️ Banco de dados conectado`);
  } else {
    console.log(`💾 Usando apenas localStorage (sem banco)`);
  }
});
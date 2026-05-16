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


// =============================================
// ATUALIZAÇÃO AUTOMÁTICA DE RESULTADOS (5 em 5 min)
// =============================================


const FOOTBALL_DATA_API_KEY = process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_ORG_KEY;
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

const FD_TEAM_MAP = {
  'Mexico': 'mexico', 'South Africa': 'south_africa', 'Korea Republic': 'south_korea',
  'South Korea': 'south_korea', 'Czech Republic': 'czech_republic', 'Canada': 'canada',
  'Bosnia and Herzegovina': 'bosnia', 'Brazil': 'brazil', 'Morocco': 'morocco',
  'United States': 'usa', 'USA': 'usa', 'Paraguay': 'paraguay', 'Australia': 'australia',
  'Turkey': 'turkey', 'Türkiye': 'turkey', 'Germany': 'germany', 'Curacao': 'curacao',
  'Côte d\'Ivoire': 'ivory_coast', 'Ivory Coast': 'ivory_coast', 'Ecuador': 'ecuador',
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
  'Valencia CF': 'valencia', 'Valencia': 'valencia',
  'Rayo Vallecano': 'rayo_vallecano', 'Rayo Vallecano de Madrid': 'rayo_vallecano',
  'Girona FC': 'girona', 'Girona': 'girona',
  'Real Sociedad': 'real_sociedad', 'Real Sociedad de Fútbol': 'real_sociedad',
  'Real Madrid CF': 'real_madrid', 'Real Madrid': 'real_madrid',
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
  'Real Valladolid': 'valladolid', 'Valladolid': 'valladolid'
};

function normalizeTeamName(name) {
  if (!name) return null;
  return name.toString().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function mapFdTeam(name) {
  if (!name) return null;
  if (FD_TEAM_MAP[name]) return FD_TEAM_MAP[name];
  return normalizeTeamName(name);
}

function mapFdStatus(status) {
  if (!status) return 'upcoming';
  const finished = ['FINISHED', 'AWARDED'].includes(status);
  const live = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(status);
  return finished ? 'completed' : live ? 'live' : 'upcoming';
}

async function fetchFootballData(path, params = {}) {
  if (!FOOTBALL_DATA_API_KEY) {
    throw new Error('Football Data API key não configurada');
  }
  const url = new URL(`${FOOTBALL_DATA_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Football Data ${path} → HTTP ${response.status} ${text}`);
  }
  return response.json();
}

function getCompetitionCode(game) {
  if (!game?.group) return null;
  const group = game.group.toString();
  if (group === 'La Liga' || group === 'PD') return 'PD';
  if (group === 'Premier League' || group === 'PL') return 'PL';
  if (group === 'Bundesliga' || group === 'BL1') return 'BL1';
  if (group === 'Serie A' || group === 'SA') return 'SA';
  if (group === 'Ligue 1' || group === 'FL1') return 'FL1';
  if (group === 'Champions League' || group === 'CL') return 'CL';
  if (/^[A-L]$/.test(group)) return 'WC';
  return null;
}

function matchTeamsToLocal(game, match) {
  const homeKey = mapFdTeam(match.homeTeam?.name);
  const awayKey = mapFdTeam(match.awayTeam?.name);
  if (!homeKey || !awayKey) return false;
  return (game.home === homeKey && game.away === awayKey) || (game.home === awayKey && game.away === homeKey);
}

async function resolveFootballDataMatch(game) {
  const competition = getCompetitionCode(game);
  if (!competition) return null;
  const date = game.date;
  if (!date) return null;

  const data = await fetchFootballData(`/competitions/${competition}/matches`, {
    dateFrom: date,
    dateTo: date,
  });

  const matches = Array.isArray(data.matches) ? data.matches : [];
  const candidates = matches.filter(match => matchTeamsToLocal(game, match));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const normalizedTime = game.time ? game.time.replace(':', '') : null;
    return candidates.find(match => {
      const matchTime = match.utcDate?.substring(11, 16);
      return matchTime === game.time;
    }) || candidates[0];
  }
  return null;
}

function buildMatchEvents(match) {
  const scorers = [];
  const assists = [];
  if (Array.isArray(match.goals)) {
    for (const goal of match.goals) {
      if (!goal || goal.type === 'OWN_GOAL') continue;
      // Goleador
      const scorerName = goal.scorer?.name;
      const teamKey = mapFdTeam(goal.team?.name);
      if (scorerName) {
        scorers.push({
          playerName: scorerName,
          playerId: null,
          goals: 1,
          team: teamKey,
          minute: goal.minute
        });
      }
      // Assistência (se houver)
      const assistName = goal.assist?.name;
      if (assistName) {
        assists.push({
          type: 'assist',
          playerName: assistName,
          playerId: null,
          minute: goal.minute,
          team: teamKey
        });
      }
    }
  }
  // Agrupar goleadores (mesmo jogador pode fazer mais de um gol)
  const groupedScorers = {};
  for (const s of scorers) {
    const key = `${s.playerName}::${s.team}`;
    if (!groupedScorers[key]) {
      groupedScorers[key] = { ...s, goals: 0 };
    }
    groupedScorers[key].goals++;
  }
  const uniqueScorers = Object.values(groupedScorers);
  return { scorers: uniqueScorers, assists };
}

function buildEventsFromMatch(match) {
  const events = [];
  // Gols e assistências
  if (Array.isArray(match.goals)) {
    for (const goal of match.goals) {
      if (goal.scorer) {
        events.push({
          type: 'goal',
          playerId: goal.scorer?.id,
          playerName: goal.scorer?.name,
          minute: goal.minute,
          team: mapFdTeam(goal.team?.name)
        });
      }
      if (goal.assist) {
        events.push({
          type: 'assist',
          playerId: goal.assist?.id,
          playerName: goal.assist?.name,
          minute: goal.minute,
          team: mapFdTeam(goal.team?.name)
        });
      }
    }
  }
  // Cartões (bookings)
  if (Array.isArray(match.bookings)) {
    for (const card of match.bookings) {
      events.push({
        type: card.card === 'YELLOW' ? 'yellow_card' : 'red_card',
        playerId: card.player?.id,
        playerName: card.player?.name,
        minute: card.minute,
        team: mapFdTeam(card.team?.name)
      });
    }
  }
  return events;
}

async function syncFootballDataResults(competitions = ['WC', 'PD']) {
  const result = { updated: 0, details: [] };
  if (!pool) throw new Error('Banco não conectado');

  const gamesRes = await pool.query('SELECT data FROM games WHERE id = $1', ['games_data']);
  let games = gamesRes.rows[0]?.data?.games || [];
  if (!Array.isArray(games)) games = [];

  for (const game of games) {
    if (game.status === 'completed') continue;
    const competition = getCompetitionCode(game);
    if (!competition) continue;

    try {
      let match = null;
      if (game.fdId) {
        const matchData = await fetchFootballData(`/matches/${game.fdId}`);
        match = matchData.match;
      } else {
        match = await resolveFootballDataMatch(game);
      }
      if (!match) {
        result.details.push({ gameId: game.id, reason: 'não encontrado' });
        continue;
      }
      if (!game.fdId && match.id) {
        game.fdId = match.id.toString();
        game.apiId = game.fdId;
      }

      const isFinished = (match.status === 'FINISHED');
      const localStatus = isFinished ? 'completed' : (match.status === 'IN_PLAY' ? 'live' : 'upcoming');
      const homeScore = match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? null;
      const awayScore = match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? null;
      if (homeScore === null || awayScore === null) continue;

      // Extrair eventos
      const events = [];
      if (Array.isArray(match.goals)) {
        for (const goal of match.goals) {
          if (goal.type === 'OWN_GOAL') continue;
          if (goal.scorer) {
            events.push({
              type: 'goal',
              playerId: goal.scorer.id?.toString(),
              playerName: goal.scorer.name,
              minute: goal.minute,
              team: mapFdTeam(goal.team?.name)
            });
          }
          if (goal.assist) {
            events.push({
              type: 'assist',
              playerId: goal.assist.id?.toString(),
              playerName: goal.assist.name,
              minute: goal.minute,
              team: mapFdTeam(goal.team?.name)
            });
          }
        }
      }
      if (Array.isArray(match.bookings)) {
        for (const card of match.bookings) {
          events.push({
            type: card.card === 'YELLOW' ? 'yellow_card' : 'red_card',
            playerId: card.player?.id?.toString(),
            playerName: card.player?.name,
            minute: card.minute,
            team: mapFdTeam(card.team?.name)
          });
        }
      }

      // Goleadores (agrupados)
      const scorers = [];
      const goalMap = new Map();
      for (const ev of events) {
        if (ev.type === 'goal') {
          const key = ev.playerName;
          if (!goalMap.has(key)) goalMap.set(key, { playerName: key, playerId: ev.playerId, goals: 0 });
          goalMap.get(key).goals++;
        }
      }
      for (const [, data] of goalMap.entries()) scorers.push(data);

      const prev = game.result || {};
      const changed = (game.status !== localStatus) ||
                      (prev.homeScore !== homeScore) ||
                      (prev.awayScore !== awayScore) ||
                      (JSON.stringify(prev.events || []) !== JSON.stringify(events));

      if (changed) {
        game.status = localStatus;
        game.result = {
          homeScore,
          awayScore,
          scorers,
          events,
          craqueId: prev.craqueId ?? null
        };
        result.updated++;
        result.details.push({
          gameId: game.id,
          fdId: game.fdId,
          status: localStatus,
          homeScore,
          awayScore,
          scorers: scorers.length,
          events: events.length
        });
      }
    } catch (err) {
      console.error(`Erro no jogo ${game.id}:`, err.message);
      result.details.push({ gameId: game.id, error: err.message });
    }
  }

  if (result.updated > 0) {
    await pool.query(
      `INSERT INTO games (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      ['games_data', { games }]
    );
    console.log(`✅ ${result.updated} jogos atualizados`);
  }
  return result;
}

// =============================================
// PROXY PARA FOOTBALL-DATA.ORG
// =============================================
app.get('/api/fd', async (req, res) => {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não configurada' });
  }

  const { path, season, dateFrom, dateTo, ...filters } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Parâmetro "path" obrigatório' });
  }

  // Constrói a URL
  let url = `https://api.football-data.org/v4${path}`;
  const params = new URLSearchParams();
  if (season) params.append('season', season);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  Object.entries(filters).forEach(([k, v]) => params.append(k, v));
  if (params.toString()) url += `?${params.toString()}`;

  try {
    console.log(`🌐 [FD] Chamando: ${url}`);
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey }
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ [FD] HTTP ${response.status}:`, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Erro no proxy football-data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync-results', async (req, res) => {
  const competitions = Array.isArray(req.body?.competitions) ? req.body.competitions : ['WC', 'PD'];
  try {
    const result = await syncFootballDataResults(competitions);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Erro /api/sync-results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/update-results', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Banco não conectado' });
  
  try {
    const gamesRes = await pool.query('SELECT data FROM games WHERE id = $1', ['games_data']);
    let games = gamesRes.rows[0]?.data?.games || [];
    if (!Array.isArray(games)) games = [];
    
    let updatedCount = 0;
    
    for (const game of games) {
      // Só atualiza jogos não finalizados manualmente
      if (game.status === 'completed') continue;
      if (!game.fdId) continue; // precisa ter o fdId (ID na API)
      
      try {
        const response = await fetch(`https://api.football-data.org/v4/matches/${game.fdId}`, {
          headers: { 'X-Auth-Token': process.env.API_FOOTBALL_KEY }
        });
        const data = await response.json();
        const match = data.match;
        
        if (!match) continue;
        
        const isFinished = (match.status === 'FINISHED');
        const localStatus = isFinished ? 'completed' : (match.status === 'IN_PLAY' ? 'live' : 'upcoming');
        const homeScore = match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? null;
        const awayScore = match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? null;
        
        if (homeScore === null || awayScore === null) continue;
        
        // Verifica se houve mudança
        const changed = (game.status !== localStatus) ||
                        (game.result?.homeScore !== homeScore) ||
                        (game.result?.awayScore !== awayScore);
        
        if (changed) {
          game.status = localStatus;
          if (!game.result) game.result = {};
          game.result.homeScore = homeScore;
          game.result.awayScore = awayScore;
          // Preserva eventos já inseridos manualmente
          game.result.events = game.result.events || [];
          game.result.scorers = game.result.scorers || [];
          
          updatedCount++;
          console.log(`✅ Jogo ${game.id} atualizado: ${homeScore}:${awayScore} (${localStatus})`);
        }
      } catch (err) {
        console.error(`Erro no jogo ${game.id}:`, err.message);
      }
    }
    
    if (updatedCount > 0) {
      await pool.query(
        `INSERT INTO games (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        ['games_data', { games }]
      );
      console.log(`💾 ${updatedCount} jogos atualizados`);
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
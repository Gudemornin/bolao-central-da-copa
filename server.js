import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// 1️⃣ PRIMEIRO: Servir arquivos estáticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// 2️⃣ SEGUNDO: Rotas da API
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

// API para sincronizar jogos
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

// API para informações do admin
app.get('/api/admin/info', (req, res) => {
  res.json({
    username: process.env.ADMIN_USERNAME || 'eVagabundoTaLa11223',
    playerId: process.env.ADMIN_PASSWORD_PLAYER_ID || 'de04'
  });
});

// 3️⃣ POR ÚLTIMO: Fallback para SPA
app.get('*', (req, res) => {
  // Verificar se não é uma requisição de arquivo
  if (!req.path.includes('.')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).send('Arquivo não encontrado');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
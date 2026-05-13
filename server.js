import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));




app.get('/api/football', async (req, res) => {
  const { endpoint, team } = req.query;
  
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
    // ⭐ NOVO: Buscar jogos da Ligue 1
    case 'ligue1_fixtures':
      url = 'https://api.football-data.org/v4/competitions/FL1/matches';
      if (team) url += `?team=${team}`;
      break;
    // ⭐ NOVO: Buscar classificação da Ligue 1
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


import { Resend } from 'resend';

app.post('/api/send-email', async (req, res) => {
  const { type, to, name, code, tempPassword, userName } = req.body;
  
  if (!to) {
    return res.status(400).json({ success: false, error: 'Destinatário obrigatório' });
  }
  
  try {
    // Inicializar Resend com a chave da API
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    let subject = '';
    let html = '';
    
    // Definir o conteúdo do e-mail baseado no tipo
    if (type === '2fa') {
      subject = '🔐 Seu código de verificação - Bolão da Central';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B4FD8;">Bolão da Central - Copa 2026</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Seu código de verificação de dois fatores é:</p>
          <div style="background: #0E1F3D; padding: 20px; text-align: center; font-size: 32px; font-family: monospace; letter-spacing: 5px; border-radius: 8px;">
            <strong style="color: #FFD700;">${code}</strong>
          </div>
          <p>Este código expira em 10 minutos.</p>
          <p>Se você não solicitou este código, ignore este e-mail.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Bolão da Central - Copa do Mundo 2026</p>
        </div>
      `;
    } 
    else if (type === 'reset') {
      subject = '🔑 Redefinição de senha - Bolão da Central';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B4FD8;">Bolão da Central - Copa 2026</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Foi solicitada a redefinição da sua senha.</p>
          <p>Sua nova senha temporária é:</p>
          <div style="background: #0E1F3D; padding: 20px; text-align: center; font-size: 20px; border-radius: 8px;">
            <strong style="color: #FFD700;">${tempPassword.name} (${tempPassword.team})</strong>
          </div>
          <p>Use esta senha para fazer login. Após o login, você deverá escolher uma nova senha.</p>
          <p>Se você não solicitou esta redefinição, ignore este e-mail ou contate o administrador.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Bolão da Central - Copa do Mundo 2026</p>
        </div>
      `;
    }
    else if (type === 'admin_notification') {
      subject = '🔔 Solicitação de redefinição de senha - Bolão da Central';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B4FD8;">Bolão da Central - Copa 2026</h2>
          <p>Olá Administrador,</p>
          <p>O usuário <strong>${userName}</strong> solicitou redefinição de senha, mas <strong>não possui e-mail cadastrado</strong>.</p>
          <p>A senha temporária gerada foi:</p>
          <div style="background: #0E1F3D; padding: 20px; text-align: center; font-size: 20px; border-radius: 8px;">
            <strong style="color: #FFD700;">${tempPassword.name} (${tempPassword.team})</strong>
          </div>
          <p>Por favor, entre em contato com o usuário para fornecer esta senha ou solicite que cadastre um e-mail.</p>
          <p><strong>ID do usuário:</strong> ${userName}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Bolão da Central - Copa do Mundo 2026</p>
        </div>
      `;
    }
    else {
      // Tipo desconhecido
      return res.status(400).json({ success: false, error: 'Tipo de e-mail inválido' });
    }
    
    // Enviar o e-mail
    const { data, error } = await resend.emails.send({
      from: 'Bolão da Central <noreply@seudominio.com>',
      to: [to],
      subject: subject,
      html: html
    });
    
    if (error) {
      console.error('Erro Resend:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log(`✅ E-mail enviado para ${to} (${type})`);
    res.json({ success: true, data });
    
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/info', (req, res) => {
  res.json({
    username: process.env.ADMIN_USERNAME || 'eVagabundoTaLa11223',
    playerId: process.env.ADMIN_PASSWORD_PLAYER_ID || 'de04'
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

app.get('/api/sync-games', async (req, res) => {
  const { competition = 'WC' } = req.query;
  
  try {
    // Buscar todos os jogos da competição
    const response = await fetch(`https://api.football-data.org/v4/competitions/${competition}/matches`, {
      headers: { 'X-Auth-Token': process.env.API_KEY }
    });
    const data = await response.json();
    
    if (!data.matches) {
      return res.status(404).json({ error: 'Nenhum jogo encontrado' });
    }
    
    // Mapear e retornar jogos formatados
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
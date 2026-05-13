// api/football.js
const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, team } = req.query;

  try {
    if (endpoint !== 'fixtures') {
      return res.status(400).json({ error: 'Apenas endpoint "fixtures" é suportado' });
    }

    let url = `${BASE_URL}/fixtures?league=1&season=2022`;
    if (team) url += `&team=${team}`;

    const response = await fetch(url, {
      headers: { 'x-apisports-key': API_KEY }
    });
    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Erro na API:', error);
    return res.status(500).json({ error: error.message });
  }
}
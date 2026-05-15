import { PLAYERS } from './data/players.js'
import { TEAMS } from './data/teams.js'

function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')                 // separa letras de acentos
    .replace(/[\u0300-\u036f]/g, '') // remove os acentos
    .replace(/[^a-z0-9\s]/g, '');    // opcional: remove caracteres especiais (mantém letras e números)
}

export function getPlayer(id) {
  return PLAYERS.find(p => p.id === id);
}

export function getPlayersByTeams(t1, t2) {
  return PLAYERS.filter(p => p.team === t1 || p.team === t2);
}

export function filterPlayers(query, teams = null) {
  const q = query ? normalizeString(query) : '';
  
  return PLAYERS.filter(p => {
    // Normalizar nome do jogador e nome do time
    const playerNameNorm = normalizeString(p.name);
    const teamNameNorm = TEAMS[p.team]?.name ? normalizeString(TEAMS[p.team].name) : '';
    
    // Corresponde ao termo de busca?
    const matchQ = !q || playerNameNorm.includes(q) || teamNameNorm.includes(q);
    
    // Corresponde aos times (se especificado)
    const matchT = !teams || teams.includes(p.team);
    
    return matchQ && matchT;
  }).slice(0, 12); // limite de 12 resultados
}
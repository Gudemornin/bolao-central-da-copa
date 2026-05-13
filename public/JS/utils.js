// js/utils.js
import { TEAMS } from './data/teams.js';

export function cap(s) { 
  return s.charAt(0).toUpperCase() + s.slice(1); 
}

export function sign(n) { 
  return n > 0 ? 1 : n < 0 ? -1 : 0; 
}

export function formatDate(d) {
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function playerDisplayName(p) {
  if (!p) return '-';
  const team = TEAMS[p.team];
  // Retorna apenas o nome e a bandeira como texto simples (sem HTML)
  return `${p.name} (${team?.name || p.team})`;
}

export function playerDisplayWithFlag(p) {
  if (!p) return '-';
  const team = TEAMS[p.team];
  const flagHtml = team?.flag ? `<img src="${team.flag}" style="width:20px;height:14px;vertical-align:middle;margin-right:6px;">` : '';
  return `${flagHtml} ${p.name}`;
}

export function teamFlagImg(teamObj, size = 24) {
  if (!teamObj || !teamObj.flag) return '';
  return `<img src="${teamObj.flag}" alt="${teamObj.name}" style="width:${size}px; height:auto; vertical-align:middle; border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,.3);">`;
}
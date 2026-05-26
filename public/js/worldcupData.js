// worldcupData.js
import { TEAMS } from './data/teams.js';
import { GAMES_STATE } from './state.js';
import { getPlayer } from './exportplayer.js';

// --------------------------------------------------------------
// 1. Cálculo da classificação dos grupos
// --------------------------------------------------------------
export function calculateStandingsFromGames() {
  const groups = {};

  // Inicializa estrutura para cada time nos grupos
  Object.entries(TEAMS).forEach(([key, team]) => {
    const group = team.group;
    if (!group) return;
    if (!groups[group]) groups[group] = {};
    const teamName = team.name;
    if (!groups[group][teamName]) {
      groups[group][teamName] = {
        name: teamName,
        teamKey: key,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
    }
  });

  // Percorre apenas jogos finalizados com resultado
  const finishedGames = GAMES_STATE.filter(g => g.status === 'completed' && g.result);
  for (const game of finishedGames) {
    const homeTeam = TEAMS[game.home];
    const awayTeam = TEAMS[game.away];
    if (!homeTeam || !awayTeam) continue;
    const group = homeTeam.group;
    if (!group) continue;

    const homeScore = game.result.homeScore;
    const awayScore = game.result.awayScore;

    const homeEntry = groups[group][homeTeam.name];
    const awayEntry = groups[group][awayTeam.name];
    if (!homeEntry || !awayEntry) continue;

    // Atualiza estatísticas
    homeEntry.played++;
    awayEntry.played++;
    homeEntry.goalsFor += homeScore;
    homeEntry.goalsAgainst += awayScore;
    awayEntry.goalsFor += awayScore;
    awayEntry.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeEntry.wins++;
      awayEntry.losses++;
      homeEntry.points += 3;
    } else if (homeScore < awayScore) {
      awayEntry.wins++;
      homeEntry.losses++;
      awayEntry.points += 3;
    } else {
      homeEntry.draws++;
      awayEntry.draws++;
      homeEntry.points += 1;
      awayEntry.points += 1;
    }
  }

  // Converte para array e ordena
  const result = [];
  for (const groupName in groups) {
    const teamsArray = Object.values(groups[groupName]);
    teamsArray.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      const diffA = a.goalsFor - a.goalsAgainst;
      const diffB = b.goalsFor - b.goalsAgainst;
      if (diffA !== diffB) return diffB - diffA;
      return b.goalsFor - a.goalsFor;
    });
    result.push({ group: groupName, teams: teamsArray });
  }
  return result;
}

export async function renderStandings() {
  const container = document.getElementById('standingsContainer');
  if (!container) return;

  const standings = calculateStandingsFromGames();
  if (standings.length === 0 || standings.every(g => g.teams.length === 0)) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;">📊</div>
        <h3>Nenhum resultado disponível</h3>
        <p>Os resultados serão exibidos após o administrador inserir os placares.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Anton;font-size:20px;color:var(--gold);">🏆 Classificação dos Grupos</h2>
      <p style="color:var(--text-d);">Atualizado com os resultados inseridos</p>
    </div>
  `;

  for (const group of standings) {
    html += `
      <div style="margin-bottom:32px;">
        <h3 style="font-family:Anton;font-size:18px;color:var(--green-l);margin-bottom:12px;">Grupo ${group.group}</h3>
        <div class="ranking-wrap">
          <table class="ranking-table">
            <thead>
              <tr><th>#</th><th>Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>Pts</th></tr>
            </thead>
            <tbody>
    `;
    group.teams.forEach((team, idx) => {
      const flagUrl = TEAMS[team.teamKey]?.flag || '';
      const diff = team.goalsFor - team.goalsAgainst;
      html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><div style="display:flex;align-items:center;gap:8px;"><img src="${flagUrl}" style="width:28px;height:20px;"> ${team.name}</div></td>
          <td class="center">${team.played}</td>
          <td class="center">${team.wins}</td>
          <td class="center">${team.draws}</td>
          <td class="center">${team.losses}</td>
          <td class="center">${team.goalsFor}</td>
          <td class="center">${team.goalsAgainst}</td>
          <td class="center ${diff > 0 ? 'pts-green' : diff < 0 ? 'pts-red' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
          <td class="center rank-pts">${team.points}</td>
        </tr>
      `;
    });
    html += `</tbody></table></div></div>`;
  }
  container.innerHTML = html;
}

// --------------------------------------------------------------
// 2. Cálculo da artilharia
// --------------------------------------------------------------
export function calculateTopScorersFromGames() {
  const scorersMap = new Map(); // playerId -> { name, team, goals }

  const finishedGames = GAMES_STATE.filter(g => g.status === 'completed' && g.result && g.result.scorers);
  for (const game of finishedGames) {
    for (const scorer of game.result.scorers) {
      const player = getPlayer(scorer.playerId);
      if (!player) continue;
      if (!scorersMap.has(scorer.playerId)) {
        scorersMap.set(scorer.playerId, {
          name: player.name,
          team: player.team,
          goals: 0,
        });
      }
      scorersMap.get(scorer.playerId).goals += scorer.goals;
    }
  }

  const scorersArray = Array.from(scorersMap.values());
  scorersArray.sort((a, b) => b.goals - a.goals);
  return scorersArray;
}

export async function renderTopScorers() {
  const container = document.getElementById('topscorersList');
  if (!container) return;

  const scorers = calculateTopScorersFromGames();
  if (scorers.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;">⚽</div>
        <h3>Nenhum gol registrado</h3>
        <p>Os artilheiros aparecerão assim que o administrador inserir os gols.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Anton;font-size:20px;color:var(--gold);">⚽ Artilharia da Copa</h2>
    </div>
    <div class="ranking-wrap">
      <table class="ranking-table">
        <thead><tr><th>#</th><th>Jogador</th><th>Seleção</th><th class="center">Gols</th></tr></thead>
        <tbody>
  `;
  scorers.forEach((scorer, idx) => {
    const team = TEAMS[scorer.team];
    const flag = team?.flag || '';
    html += `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>${scorer.name}</td>
        <td><div style="display:flex;align-items:center;gap:6px;"><img src="${flag}" style="width:24px;height:16px;"> ${team?.name || scorer.team}</div></td>
        <td class="center rank-pts">${scorer.goals}</td>
      </tr>
    `;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}
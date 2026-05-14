// js/standingsCalculator.js

export function calculateStandings(apiResponse) {
  if (!apiResponse || !apiResponse.standings) return [];

  const allTeams = [];
  for (const group of apiResponse.standings) {
    const groupName = group.group;
    const table = group.table || [];
    for (const entry of table) {
      allTeams.push({
        name: entry.team.name,
        played: entry.playedGames,
        won: entry.won,
        draw: entry.draw,
        lost: entry.lost,
        goalsFor: entry.goalsFor,
        goalsAgainst: entry.goalsAgainst,
        points: entry.points,
        group: groupName
      });
    }
  }
  return allTeams;
}

export function calculateTopScorers(apiResponse) {
  if (!apiResponse || !apiResponse.scorers) return [];
  return apiResponse.scorers.map(s => ({
    name: s.player.name,
    team: s.team.name,
    goals: s.goals
  }));
}
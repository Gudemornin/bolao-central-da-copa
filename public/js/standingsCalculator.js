// js/standingsCalculator.js — Parsers para resposta da API-SPORTS
//
// A API-SPORTS retorna classificação no formato:
//   response[0].league.standings[][]   ← array de grupos (Copa) ou [array único] (liga)
//
// E artilheiros no formato:
//   response[]  → { player: { name }, statistics[0]: { team: { name }, goals: { total } } }

// ── Classificação ─────────────────────────────────────────────────────────────

/**
 * Converte a resposta da API-SPORTS /standings em lista plana de times.
 *
 * Retorna array de objetos:
 * {
 *   name, namePt?, played, won, draw, lost,
 *   goalsFor, goalsAgainst, goalsDiff, points,
 *   group, form, flag?
 * }
 *
 * @param {Object} leagueData - objeto `response[0].league` da API-SPORTS
 */
export function calculateStandings(leagueData) {
  if (!leagueData?.standings) return [];

  const result = [];

  // standings é um array de grupos; cada grupo é um array de entradas
  for (const group of leagueData.standings) {
    for (const entry of group) {
      result.push({
        rank:         entry.rank,
        name:         entry.team?.name ?? '—',
        teamId:       entry.team?.id   ?? null,
        // Algumas respostas incluem logo do time
        logo:         entry.team?.logo ?? null,
        played:       entry.all?.played     ?? 0,
        won:          entry.all?.win        ?? 0,
        draw:         entry.all?.draw       ?? 0,
        lost:         entry.all?.lose       ?? 0,
        goalsFor:     entry.all?.goals?.for     ?? 0,
        goalsAgainst: entry.all?.goals?.against ?? 0,
        goalsDiff:    entry.goalsDiff ?? 0,
        points:       entry.points    ?? 0,
        form:         entry.form      ?? '',
        // Grupo vem como "Group A" na Copa, ou o nome da liga em torneios simples
        group:        entry.group     ?? leagueData.name ?? '',
        description:  entry.description ?? '',
      });
    }
  }

  return result;
}

// ── Artilheiros ───────────────────────────────────────────────────────────────

/**
 * Converte a resposta da API-SPORTS /players/topscorers em lista plana.
 *
 * Retorna array de objetos:
 * { name, team, goals, assists, nationality, photo? }
 *
 * @param {Array} response - campo `response` da API-SPORTS
 */
export function calculateTopScorers(response) {
  if (!Array.isArray(response)) return [];

  return response.map(item => {
    const stats = item.statistics?.[0] ?? {};
    return {
      name:        item.player?.name        ?? '—',
      nationality: item.player?.nationality ?? '',
      photo:       item.player?.photo       ?? null,
      team:        stats.team?.name         ?? '—',
      teamLogo:    stats.team?.logo         ?? null,
      goals:       stats.goals?.total       ?? 0,
      assists:     stats.goals?.assists     ?? 0,
      penalties:   stats.penalty?.scored    ?? 0,
    };
  }).sort((a, b) => b.goals - a.goals);
}

// ── Utilitário: agrupar classificação por grupo (Copa) ────────────────────────

/**
 * Agrupa a lista plana por grupo (ex: "Group A", "Group B").
 * Útil para renderizar a tabela da Copa do Mundo.
 */
export function groupStandingsByGroup(teams) {
  const map = {};
  for (const t of teams) {
    const key = t.group || 'Geral';
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  // Ordenar times dentro de cada grupo por pontos → saldo → gols pró
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => {
      if (b.points      !== a.points)      return b.points      - a.points;
      if (b.goalsDiff   !== a.goalsDiff)   return b.goalsDiff   - a.goalsDiff;
      return b.goalsFor - a.goalsFor;
    });
  }
  return map;
}

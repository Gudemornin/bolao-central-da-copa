// js/ranking.js — Ranking + cálculo de pontos (API-SPORTS)
//
// Mudanças em relação à versão anterior:
//   • fetchGameEvents() agora chama /api/football?endpoint=fixture_events
//   • Usa game.apiId (ID da API-SPORTS) em vez do ID interno
//   • matchPlayer() faz fuzzy-match de nomes para ligar API ↔ jogadores locais
//   • calcBetPoints() inalterado na lógica de negócio

import { loadBets, loadUsers }  from './storage.js';
import { GAMES_STATE, currentUser } from './state.js';
import { PLAYERS }              from './data/players.js';
import { sign }                 from './utils.js';
import { updateSidebar }        from './app.js';

// ── Utilitários de matching ───────────────────────────────────────────────────

/** Normaliza nome para comparação (remove acentos, pontuação, lowercase) */
function normName(raw) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retorna o jogador local que melhor casa com o nome vindo da API.
 * Estratégias (em ordem):
 *   1. Correspondência exata (normalizada)
 *   2. Último sobrenome igual
 *   3. Inicial + sobrenome (ex: "R. Lewandowski")
 *   4. Qualquer parte do nome local contém o sobrenome da API
 */
function matchPlayerByName(apiName, candidates = PLAYERS) {
  if (!apiName) return null;
  const norm  = normName(apiName);
  const parts = norm.split(' ').filter(Boolean);

  // 1. Exato
  let hit = candidates.find(p => normName(p.name) === norm);
  if (hit) return hit;

  // 2. Último sobrenome
  const last = parts[parts.length - 1];
  if (last && last.length > 3) {
    hit = candidates.find(p => {
      const pp = normName(p.name).split(' ');
      return pp[pp.length - 1] === last;
    });
    if (hit) return hit;
  }

  // 3. Inicial + sobrenome  ("K. Mbappe" → "Kylian Mbappé")
  if (parts.length >= 2) {
    const initial = parts[0].replace('.', '');
    hit = candidates.find(p => {
      const pp = normName(p.name).split(' ');
      return (
        pp[0].startsWith(initial) &&
        pp[pp.length - 1] === last
      );
    });
    if (hit) return hit;
  }

  // 4. Sobrenome contido no nome local (mais permissivo — aceita "Vini" para "Vinícius Júnior")
  if (last && last.length > 4) {
    hit = candidates.find(p => normName(p.name).includes(last));
    if (hit) return hit;
  }

  return null;
}

// ── Buscar eventos do jogo via API-SPORTS ─────────────────────────────────────

/**
 * Retorna a lista de eventos de um jogo no formato interno:
 * [{ type, playerId, playerName, minute, value? }]
 *
 * @param {string|number} apiId - game.apiId (fixture ID da API-SPORTS)
 * @param {string[]} teamKeys   - chaves locais dos dois times (para restringir matching)
 */
export async function fetchGameEvents(apiId, teamKeys = []) {
  if (!apiId) return [];

  try {
    const res  = await fetch(`/api/football?endpoint=fixture_events&fixture=${apiId}`);
    const json = await res.json();

    if (!json?.response?.length) return [];

    // Candidatos de jogadores: apenas dos times em jogo (melhora precisão)
    const candidates = teamKeys.length
      ? PLAYERS.filter(p => teamKeys.includes(p.team))
      : PLAYERS;

    const events = [];

    for (const ev of json.response) {
      const type   = ev.type;    // "Goal" | "Card" | "subst" | "Var"
      const detail = ev.detail;  // "Normal Goal" | "Yellow Card" | "Substitution 1" …
      const apiName = ev.player?.name;
      const minute  = ev.time?.elapsed ?? 0;

      const localPlayer = matchPlayerByName(apiName, candidates);
      const playerId    = localPlayer?.id ?? null;

      if (type === 'Goal') {
        if (detail === 'Own Goal') {
          // Gol contra não conta positivamente para ninguém
          continue;
        }
        events.push({ type: 'goal', playerId, playerName: apiName, minute });

        // Assistência
        const assistName = ev.assist?.name;
        if (assistName) {
          const assistPlayer = matchPlayerByName(assistName, candidates);
          events.push({
            type:       'assist',
            playerId:   assistPlayer?.id ?? null,
            playerName: assistName,
            minute,
          });
        }

      } else if (type === 'Card') {
        events.push({
          type:       detail === 'Yellow Card' ? 'yellow_card' : 'red_card',
          playerId,
          playerName: apiName,
          minute,
        });

      } else if (type === 'subst') {
        // Registra minutos jogados do substituído
        const outName   = ev.player?.name;   // jogador que saiu
        const outPlayer = matchPlayerByName(outName, candidates);
        if (outPlayer) {
          events.push({
            type:       'minutes_played',
            playerId:   outPlayer.id,
            playerName: outName,
            value:      minute,               // minuto em que saiu = minutos jogados
          });
        }
      }
    }

    return events;

  } catch (err) {
    console.error(`❌ fetchGameEvents(apiId=${apiId}):`, err.message);
    return [];
  }
}

// ── Cálculo de pontos ─────────────────────────────────────────────────────────

/**
 * Calcula os pontos de um palpite com base no resultado e nos eventos do jogo.
 *
 * Sistema de pontuação:
 *   Resultado correto (vitória/empate):  +6 pts
 *   Placar exato (adicional):            +4 pts  → total 10
 *   Jogador marcou 1 gol:                +3 pts
 *   Cada gol adicional:                  +2 pts
 *   Jogador deu assistência:             +1 pt  (por assistência)
 *   Cartão amarelo:                      -2 pts
 *   Cartão vermelho:                     -4 pts
 *   Goleiro: pênalti defendido:          +5 pts
 *   Goleiro/Zagueiro: clean sheet (≥60min): +2 pts
 *   Jogador foi o Craque da Partida:     +4 pts
 *
 * @param {Object} bet        - Palpite do usuário
 * @param {Object} game       - Jogo (com game.result)
 * @param {Array}  [events]   - Eventos pré-carregados (opcional; se omitido usa result.events)
 */
export function calcBetPoints(bet, game, events = null) {
  if (!game?.result) return 0;

  const r       = game.result;
  const evList  = events ?? r.events ?? [];
  let pts       = 0;

  // ── 1. Resultado ─────────────────────────────────────────────────────────
  const betWinner  = sign(bet.homeScore - bet.awayScore);
  const realWinner = sign(r.homeScore  - r.awayScore);

  if (betWinner === realWinner) {
    pts += 6;
    // Placar exato
    if (bet.homeScore === r.homeScore && bet.awayScore === r.awayScore) {
      pts += 4;
    }
  }

  // ── 2. Jogadores escolhidos ───────────────────────────────────────────────
  const chosenPlayers = [
    { id: bet.playerId,  role: bet.playerRole  ?? 'field' },
    { id: bet.player2Id, role: bet.player2Role ?? 'field' },
  ].filter(p => p.id);

  for (const chosen of chosenPlayers) {
    const playerData = PLAYERS.find(p => p.id === chosen.id);
    if (!playerData) continue;

    const playerEvents = evList.filter(e => e.playerId === chosen.id);
    const isGK  = chosen.role === 'goleiro'  || playerData.pos === 'GOL';
    const isDEF = chosen.role === 'zagueiro' || playerData.pos === 'DEF';

    // Gols
    const goals = playerEvents.filter(e => e.type === 'goal').length;
    if (goals > 0) {
      pts += 3;                  // base por marcar
      pts += (goals - 1) * 2;   // adicional por gol extra
    }

    // Assistências
    const assists = playerEvents.filter(e => e.type === 'assist').length;
    pts += assists * 1;

    // Cartões
    pts -= playerEvents.filter(e => e.type === 'yellow_card').length * 2;
    pts -= playerEvents.filter(e => e.type === 'red_card').length    * 4;

    // Goleiro: pênalti defendido
    if (isGK) {
      pts += playerEvents
        .filter(e => e.type === 'penalty_saved')
        .reduce((sum, ev) => sum + (ev.value || 1), 0) * 5;
    }

    // Clean sheet (goleiro ou zagueiro que jogou ≥ 60 min)
    if (isGK || isDEF) {
      const minutesEv  = playerEvents.find(e => e.type === 'minutes_played');
      const minutesPlayed = minutesEv ? minutesEv.value : 90;
      const goalsConceded = (playerData.team === game.home) ? r.awayScore : r.homeScore;
      if (goalsConceded === 0 && minutesPlayed >= 60) {
        pts += 2;
      }
    }
  }

  // ── 3. Craque da Partida ──────────────────────────────────────────────────
  if (
    r.craqueId &&
    (bet.playerId === r.craqueId || bet.player2Id === r.craqueId)
  ) {
    pts += 4;
  }

  return Math.max(0, pts); // Nunca negativo
}

// ── Estatísticas de um usuário ────────────────────────────────────────────────

async function getUserStats(userId) {
  const bets     = await loadBets();
  const userBets = bets[userId] ?? {};

  let pts = 0, jp = 0, victories = 0, exactScores = 0, motm = 0;

  for (const [gid, bet] of Object.entries(userBets)) {
    const g = GAMES_STATE.find(x => x?.id === gid);
    if (!g?.result) continue;

    jp++;

    // Buscar eventos usando o apiId do jogo (se disponível)
    const events = g.apiId
      ? await fetchGameEvents(g.apiId, [g.home, g.away])
      : [];

    const p = calcBetPoints(bet, g, events);
    pts += p;

    if (sign(bet.homeScore - bet.awayScore) === sign(g.result.homeScore - g.result.awayScore)) {
      victories++;
    }
    if (bet.homeScore === g.result.homeScore && bet.awayScore === g.result.awayScore) {
      exactScores++;
    }
    if (g.result.craqueId && (bet.playerId === g.result.craqueId || bet.player2Id === g.result.craqueId)) {
      motm++;
    }
  }

  const avg = jp > 0 ? pts / jp : 0;

  // Overrides manuais do admin
  const users = await loadUsers();
  const user  = users.find(u => u?.id === userId);
  if (user?.adminOverrides) {
    if (user.adminOverrides.manualPoints   !== undefined) pts  = user.adminOverrides.manualPoints;
    if (user.adminOverrides.manualCraques  !== undefined) motm = user.adminOverrides.manualCraques;
  }

  return { pts, jp, victories, exactScores, motm, avg };
}

export async function getUserPoints(userId) {
  const stats = await getUserStats(userId);
  return stats?.pts ?? 0;
}

// ── Renderização do ranking ───────────────────────────────────────────────────

export async function renderRanking() {
  console.log('📊 Renderizando ranking…');

  let users = [];
  try {
    users = await loadUsers();
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }

  const rankingBody = document.getElementById('rankingBody');
  if (!rankingBody) return;

  if (!users?.length) {
    rankingBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Nenhum participante ainda.</td></tr>';
    return;
  }

  // Filtrar usuários visíveis e com nome válido
  const visible = users.filter(u =>
    u && !u.isHidden && u.profileName?.trim() && u.profileName !== 'u'
  );

  // Carregar stats em paralelo (mais rápido)
  const rows = await Promise.all(
    visible.map(async user => {
      try {
        const stats = await getUserStats(user.id);
        return { user, ...stats };
      } catch {
        return { user, pts: 0, jp: 0, victories: 0, exactScores: 0, motm: 0, avg: 0 };
      }
    })
  );

  // Ordenar: pontos → placares exatos → craques → média
  rows.sort((a, b) => {
    if (b.pts        !== a.pts)        return b.pts        - a.pts;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.motm       !== a.motm)       return b.motm       - a.motm;
    return b.avg - a.avg;
  });

  if (!rows.length) {
    rankingBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Nenhum participante ainda.</td></tr>';
    return;
  }

  rankingBody.innerHTML = rows.map((r, i) => {
    const pos  = i + 1;
    const isMe = r.user?.id === currentUser?.id;
    const name = r.user?.profileName || 'Jogador';

    let rankDisplay = pos, rankClass = '';
    if (pos === 1) { rankDisplay = '🥇'; rankClass = 'gold';   }
    if (pos === 2) { rankDisplay = '🥈'; rankClass = 'silver'; }
    if (pos === 3) { rankDisplay = '🥉'; rankClass = 'bronze'; }

    return `
      <tr class="${isMe ? 'my-row' : ''}">
        <td class="center"><span class="rank-pos ${rankClass}">${rankDisplay}</span></td>
        <td>
          <div class="rank-user">
            <div class="rank-avatar">${name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="rank-name">
                ${escapeHtml(name)}${isMe ? '<span class="rank-you"> (você)</span>' : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="center rank-stat"><span class="rank-pts">${r.pts}</span></td>
        <td class="center rank-stat">${r.jp}</td>
        <td class="center rank-stat">${r.victories}</td>
        <td class="center rank-stat">${r.exactScores}</td>
        <td class="center rank-stat">${r.motm}</td>
      </tr>
    `;
  }).join('');

  if (typeof updateSidebar === 'function') updateSidebar();
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ── Debug global ──────────────────────────────────────────────────────────────

window.refreshRanking = async () => {
  console.log('🔄 Forçando recarga do ranking…');
  await renderRanking();
};

/**
 * Testa o matching de nomes no console:
 *   testPlayerMatch("R. Lewandowski")
 */
window.testPlayerMatch = (apiName) => {
  const result = matchPlayerByName(apiName);
  console.log(`Match "${apiName}" →`, result ?? 'NÃO ENCONTRADO');
  return result;
};

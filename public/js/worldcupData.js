// js/worldcupData.js — Classificação e artilharia via API-SPORTS
//
// Liga da Copa do Mundo 2026: id=1, season=2026
// Para testes (La Liga):      id=140, season=2024

import { getStandings, getTopScorers, LEAGUES } from './liveDataService.js';
import { calculateStandings, calculateTopScorers, groupStandingsByGroup } from './standingsCalculator.js';

// ── Mapeamento de nomes em PT-BR ──────────────────────────────────────────────

const TEAM_NAME_PT = {
  'Mexico': 'México', 'South Africa': 'África do Sul', 'South Korea': 'Coreia do Sul',
  'Czech Republic': 'República Tcheca', 'Canada': 'Canadá', 'Bosnia': 'Bósnia',
  'Qatar': 'Catar', 'Switzerland': 'Suíça', 'Brazil': 'Brasil', 'Morocco': 'Marrocos',
  'Haiti': 'Haiti', 'Scotland': 'Escócia', 'USA': 'EUA', 'United States': 'EUA',
  'Paraguay': 'Paraguai', 'Australia': 'Austrália', 'Turkey': 'Turquia',
  'Germany': 'Alemanha', 'Curacao': 'Curaçao', 'Ivory Coast': "Costa do Marfim",
  "Côte d'Ivoire": "Costa do Marfim", 'Ecuador': 'Equador', 'Netherlands': 'Holanda',
  'Japan': 'Japão', 'Sweden': 'Suécia', 'Tunisia': 'Tunísia', 'Belgium': 'Bélgica',
  'Egypt': 'Egito', 'Iran': 'Irã', 'New Zealand': 'Nova Zelândia', 'Spain': 'Espanha',
  'Cape Verde': 'Cabo Verde', 'Saudi Arabia': 'Arábia Saudita', 'Uruguay': 'Uruguai',
  'France': 'França', 'Senegal': 'Senegal', 'Iraq': 'Iraque', 'Norway': 'Noruega',
  'Argentina': 'Argentina', 'Algeria': 'Argélia', 'Austria': 'Áustria',
  'Jordan': 'Jordânia', 'Portugal': 'Portugal', 'DR Congo': 'RD Congo',
  'Congo DR': 'RD Congo', 'Uzbekistan': 'Uzbequistão', 'Colombia': 'Colômbia',
  'England': 'Inglaterra', 'Croatia': 'Croácia', 'Ghana': 'Gana', 'Panama': 'Panamá',
  // La Liga (para testes)
  'Real Madrid': 'Real Madrid', 'Barcelona': 'Barcelona', 'FC Barcelona': 'Barcelona',
  'Atletico Madrid': 'Atlético Madrid', 'Atlético Madrid': 'Atlético Madrid',
  'Real Sociedad': 'Real Sociedad', 'Athletic Club': 'Athletic Bilbao',
  'Villarreal': 'Villarreal', 'Real Betis': 'Real Betis', 'Valencia': 'Valencia CF',
  'Osasuna': 'Osasuna', 'Celta Vigo': 'Celta de Vigo', 'Girona': 'Girona FC',
  'Las Palmas': 'Las Palmas', 'Getafe': 'Getafe', 'Rayo Vallecano': 'Rayo Vallecano',
  'Espanyol': 'Espanyol', 'Mallorca': 'Mallorca', 'Alavés': 'Alavés',
  'Leganés': 'Leganés', 'Valladolid': 'Valladolid',
};

function translateTeam(name) {
  return TEAM_NAME_PT[name] ?? name;
}

// ── Bandeiras ─────────────────────────────────────────────────────────────────

const TEAM_FLAG = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czech Republic': 'cz',
  'Canada': 'ca', 'Bosnia': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch', 'Brazil': 'br',
  'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct', 'USA': 'us', 'United States': 'us',
  'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr', 'Germany': 'de', 'Curacao': 'cw',
  "Ivory Coast": 'ci', "Côte d'Ivoire": 'ci', 'Ecuador': 'ec', 'Netherlands': 'nl',
  'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn', 'Belgium': 'be', 'Egypt': 'eg',
  'Iran': 'ir', 'New Zealand': 'nz', 'Spain': 'es', 'Cape Verde': 'cv',
  'Saudi Arabia': 'sa', 'Uruguay': 'uy', 'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq',
  'Norway': 'no', 'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Congo DR': 'cd', 'Uzbekistan': 'uz',
  'Colombia': 'co', 'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
};

function flagUrl(teamName, logo = null) {
  // Se a API retornou logo, use-o
  if (logo) return logo;
  const code = TEAM_FLAG[teamName];
  return code
    ? `https://flagcdn.com/32x24/${code}.png`
    : 'https://flagcdn.com/32x24/un.png';
}

// ── Renderização de classificação ─────────────────────────────────────────────

export async function renderStandings() {
  const container = document.getElementById('standingsContainer');
  if (!container) return;

  // Detectar se é Copa ou La Liga (baseado em jogos existentes / data atual)
  const isWorldCup = new Date() >= new Date('2026-06-01');
  const league = isWorldCup ? LEAGUES.WORLD_CUP : LEAGUES.LA_LIGA;

  container.innerHTML = `<div style="text-align:center;padding:40px;">⏳ Carregando classificação…</div>`;

  try {
    const leagueData = await getStandings(league.id, league.season);

    if (!leagueData?.standings?.length) {
      container.innerHTML = notAvailableMsg(
        '🏆 Classificação será exibida quando a Copa começar!',
        'Acompanhe os jogos a partir de 11 de junho de 2026.'
      );
      return;
    }

    const teams  = calculateStandings(leagueData);
    const groups = groupStandingsByGroup(teams);

    let html = `
      <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-family:Anton;font-size:20px;color:var(--gold);">
            🏆 ${isWorldCup ? 'Classificação da Copa do Mundo 2026' : `Classificação — ${league.name}`}
          </h2>
          <p style="font-size:12px;color:var(--text-d);margin-top:4px;">
            ${isWorldCup ? '48 seleções | 12 grupos' : 'Temporada 2024-25'} · Atualizado em tempo real
          </p>
        </div>
        <button onclick="location.reload()" style="background:var(--blue);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;">
          🔄 Atualizar
        </button>
      </div>
    `;

    const sortedGroups = Object.keys(groups).sort();

    for (const groupName of sortedGroups) {
      const groupTeams = groups[groupName];
      const label = groupName.replace('Group ', 'Grupo ').replace('Regular Season - ', 'Rodada ');

      html += `
        <div style="margin-bottom:32px;">
          <h3 style="font-family:Anton;font-size:18px;color:var(--green-l);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--border);">
            ${label}
          </h3>
          <div class="ranking-wrap">
            <table class="ranking-table">
              <thead>
                <tr>
                  <th>#</th><th>Seleção / Clube</th>
                  <th class="center">J</th><th class="center">V</th>
                  <th class="center">E</th><th class="center">D</th>
                  <th class="center">GP</th><th class="center">GC</th>
                  <th class="center">SG</th><th class="center">Pts</th>
                </tr>
              </thead>
              <tbody>
      `;

      groupTeams.forEach((team, idx) => {
        const sgColor = team.goalsDiff > 0 ? 'color:var(--green-l)'
                      : team.goalsDiff < 0 ? 'color:var(--red-l)' : '';
        const qualified = isWorldCup ? idx < 2 : false;
        const flag = flagUrl(team.name, team.logo);

        html += `
          <tr style="${qualified ? 'background:rgba(0,166,81,0.05);' : ''}">
            <td class="center" style="font-family:Anton;font-size:16px;${idx===0?'color:var(--gold)':idx===1?'color:var(--blue-l)':''}">
              ${idx + 1}
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <img src="${flag}" alt="${team.name}"
                     style="width:28px;height:20px;object-fit:cover;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.3);"
                     onerror="this.src='https://flagcdn.com/32x24/un.png'">
                <strong style="font-size:14px;">${translateTeam(team.name)}</strong>
                ${qualified ? '<span style="font-size:10px;background:rgba(0,166,81,0.2);color:var(--green-l);padding:2px 6px;border-radius:12px;margin-left:6px;">Classificado</span>' : ''}
              </div>
            </td>
            <td class="center">${team.played}</td>
            <td class="center">${team.won}</td>
            <td class="center">${team.draw}</td>
            <td class="center">${team.lost}</td>
            <td class="center">${team.goalsFor}</td>
            <td class="center">${team.goalsAgainst}</td>
            <td class="center" style="${sgColor}">${team.goalsDiff > 0 ? '+' : ''}${team.goalsDiff}</td>
            <td class="center" style="font-family:Anton;font-size:18px;color:var(--blue-l);">${team.points}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div></div>`;
    }

    // Forma (últimos jogos)
    html += `
      <div style="margin-top:24px;padding:16px;background:var(--navy-3);border-radius:var(--r);font-size:12px;color:var(--text-d);text-align:center;">
        Forma: <strong style="color:var(--green-l)">V</strong> = Vitória &nbsp;·&nbsp;
        <strong style="color:var(--gold)">E</strong> = Empate &nbsp;·&nbsp;
        <strong style="color:var(--red-l)">D</strong> = Derrota
        ${isWorldCup ? '&nbsp;·&nbsp; <span style="background:rgba(0,166,81,0.2);color:var(--green-l);padding:2px 8px;border-radius:12px;">✅ Classificado</span> = Avança para oitavas' : ''}
      </div>
    `;

    container.innerHTML = html;

  } catch (err) {
    console.error('❌ renderStandings:', err);
    container.innerHTML = errorMsg(err.message);
  }
}

// ── Renderização de artilheiros ───────────────────────────────────────────────

export async function renderTopScorers() {
  const container = document.getElementById('topscorersList');
  if (!container) return;

  const isWorldCup = new Date() >= new Date('2026-06-01');
  const league = isWorldCup ? LEAGUES.WORLD_CUP : LEAGUES.LA_LIGA;

  container.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <div class="loading-spinner">⚽</div>
      <p>Carregando artilharia…</p>
    </div>
  `;

  try {
    const response = await getTopScorers(league.id, league.season);

    if (!response?.length) {
      container.innerHTML = notAvailableMsg(
        '⚽ Artilharia será exibida quando os gols começarem!',
        isWorldCup ? 'A partir de 11 de junho de 2026.' : 'Aguardando dados da API.'
      );
      return;
    }

    const scorers = calculateTopScorers(response);
    if (!scorers.length) {
      container.innerHTML = notAvailableMsg('⚽ Nenhum gol registrado ainda.', 'Acompanhe os jogos ao vivo!');
      return;
    }

    let html = `
      <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-family:Anton;font-size:20px;color:var(--gold);">
            ⚽ Artilharia — ${isWorldCup ? 'Copa do Mundo 2026' : league.name}
          </h2>
          <p style="font-size:12px;color:var(--text-d);margin-top:4px;">Top 20 artilheiros</p>
        </div>
        <button onclick="location.reload()" style="background:var(--blue);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
          🔄 Atualizar
        </button>
      </div>
      <div class="ranking-wrap">
        <table class="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Clube / Seleção</th>
              <th class="center">Gols</th>
              <th class="center">Assist.</th>
              <th class="center">Pên.</th>
            </tr>
          </thead>
          <tbody>
    `;

    scorers.slice(0, 20).forEach((s, idx) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal  = medals[idx] ?? '';
      const teamPt = translateTeam(s.team);
      const flag   = flagUrl(s.team, s.teamLogo);
      const podium = idx < 3;

      html += `
        <tr style="${podium ? 'background:rgba(255,215,0,0.07);' : ''}">
          <td class="center" style="font-family:Anton;font-size:18px;${idx===0?'color:var(--gold)':idx===1?'color:#C0C0C0':idx===2?'color:#CD7F32':''}">
            ${medal || (idx + 1)}
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              ${s.photo ? `<img src="${s.photo}" alt="${s.name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : ''}
              <div>
                <strong>${s.name}</strong>
                ${s.nationality ? `<div style="font-size:11px;color:var(--text-d);">${s.nationality}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${flag}" alt="${s.team}" style="width:24px;height:16px;object-fit:cover;border-radius:2px;" onerror="this.style.display='none'">
              ${teamPt}
            </div>
          </td>
          <td class="center" style="font-family:Anton;font-size:22px;color:var(--green-l);">${s.goals} ⚽</td>
          <td class="center" style="color:var(--blue-l);">${s.assists ?? 0}</td>
          <td class="center" style="color:var(--text-d);">${s.penalties ?? 0}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch (err) {
    console.error('❌ renderTopScorers:', err);
    container.innerHTML = errorMsg(err.message);
  }
}

// ── Helpers visuais ───────────────────────────────────────────────────────────

function notAvailableMsg(title, sub = '') {
  return `
    <div style="text-align:center;padding:40px;color:var(--text-d);">
      <p style="font-size:16px;">${title}</p>
      ${sub ? `<p style="font-size:12px;margin-top:10px;">${sub}</p>` : ''}
    </div>
  `;
}

function errorMsg(msg) {
  return `
    <div style="text-align:center;padding:40px;color:var(--red-l);">
      <p>❌ Erro ao carregar dados.</p>
      <p style="font-size:12px;margin-top:8px;">${msg}</p>
    </div>
  `;
}

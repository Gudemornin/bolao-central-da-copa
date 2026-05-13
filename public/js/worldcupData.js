// js/worldcupData.js
import { fetchFromAPI } from './liveDataService.js';
import { calculateStandings, calculateTopScorers } from './standingsCalculator.js';

// =============================================
// MAPEAMENTO DAS 48 SELEÇÕES DA COPA 2026
// =============================================

const teamsData = {
  // Grupo A
  'Mexico': { flag: 'mx', namePt: 'México' },
  'South Africa': { flag: 'za', namePt: 'África do Sul' },
  'South Korea': { flag: 'kr', namePt: 'Coreia do Sul' },
  'Czech Republic': { flag: 'cz', namePt: 'República Tcheca' },
  
  // Grupo B
  'Canada': { flag: 'ca', namePt: 'Canadá' },
  'Bosnia': { flag: 'ba', namePt: 'Bósnia' },
  'Qatar': { flag: 'qa', namePt: 'Catar' },
  'Switzerland': { flag: 'ch', namePt: 'Suíça' },
  
  // Grupo C
  'Brazil': { flag: 'br', namePt: 'Brasil' },
  'Morocco': { flag: 'ma', namePt: 'Marrocos' },
  'Haiti': { flag: 'ht', namePt: 'Haiti' },
  'Scotland': { flag: 'gb-sct', namePt: 'Escócia' },
  
  // Grupo D
  'USA': { flag: 'us', namePt: 'Estados Unidos' },
  'Paraguay': { flag: 'py', namePt: 'Paraguai' },
  'Australia': { flag: 'au', namePt: 'Austrália' },
  'Turkey': { flag: 'tr', namePt: 'Turquia' },
  
  // Grupo E
  'Germany': { flag: 'de', namePt: 'Alemanha' },
  'Curacao': { flag: 'cw', namePt: 'Curaçao' },
  'Ivory Coast': { flag: 'ci', namePt: 'Costa do Marfim' },
  'Ecuador': { flag: 'ec', namePt: 'Equador' },
  
  // Grupo F
  'Netherlands': { flag: 'nl', namePt: 'Holanda' },
  'Japan': { flag: 'jp', namePt: 'Japão' },
  'Sweden': { flag: 'se', namePt: 'Suécia' },
  'Tunisia': { flag: 'tn', namePt: 'Tunísia' },
  
  // Grupo G
  'Belgium': { flag: 'be', namePt: 'Bélgica' },
  'Egypt': { flag: 'eg', namePt: 'Egito' },
  'Iran': { flag: 'ir', namePt: 'Irã' },
  'New Zealand': { flag: 'nz', namePt: 'Nova Zelândia' },
  
  // Grupo H
  'Spain': { flag: 'es', namePt: 'Espanha' },
  'Cape Verde': { flag: 'cv', namePt: 'Cabo Verde' },
  'Saudi Arabia': { flag: 'sa', namePt: 'Arábia Saudita' },
  'Uruguay': { flag: 'uy', namePt: 'Uruguai' },
  
  // Grupo I
  'France': { flag: 'fr', namePt: 'França' },
  'Senegal': { flag: 'sn', namePt: 'Senegal' },
  'Iraq': { flag: 'iq', namePt: 'Iraque' },
  'Norway': { flag: 'no', namePt: 'Noruega' },
  
  // Grupo J
  'Argentina': { flag: 'ar', namePt: 'Argentina' },
  'Algeria': { flag: 'dz', namePt: 'Argélia' },
  'Austria': { flag: 'at', namePt: 'Áustria' },
  'Jordan': { flag: 'jo', namePt: 'Jordânia' },
  
  // Grupo K
  'Portugal': { flag: 'pt', namePt: 'Portugal' },
  'DR Congo': { flag: 'cd', namePt: 'República Democrática do Congo' },
  'Uzbekistan': { flag: 'uz', namePt: 'Uzbequistão' },
  'Colombia': { flag: 'co', namePt: 'Colômbia' },
  
  // Grupo L
  'England': { flag: 'gb-eng', namePt: 'Inglaterra' },
  'Croatia': { flag: 'hr', namePt: 'Croácia' },
  'Ghana': { flag: 'gh', namePt: 'Gana' },
  'Panama': { flag: 'pa', namePt: 'Panamá' }
};

// Função para obter a URL da bandeira
function getFlagUrl(teamName) {
  const team = teamsData[teamName];
  if (!team) {
    // Fallback: tenta usar o código do país pelos primeiros 2 caracteres
    const fallbackCode = teamName.substring(0, 2).toLowerCase();
    return `https://flagcdn.com/32x24/${fallbackCode}.png`;
  }
  return `https://flagcdn.com/32x24/${team.flag}.png`;
}

// Função para traduzir o nome do time
function translateTeamName(teamName) {
  const team = teamsData[teamName];
  return team ? team.namePt : teamName;
}

export async function renderStandings() {
  const container = document.getElementById('standingsContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <div class="loading-spinner">⏳</div>
      <p>Carregando classificação da Copa do Mundo 2026...</p>
    </div>
  `;

  try {
    const data = await fetchFromAPI('standings');
    
    if (!data || !data.standings) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--red-l);">
          <p>❌ Não foi possível carregar a classificação.</p>
          <p style="font-size:12px;margin-top:10px;">Tente novamente mais tarde.</p>
        </div>
      `;
      return;
    }

    const standings = calculateStandings(data);
    
    if (standings.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-d);">
          <p>🏆 Classificação será exibida quando a Copa começar!</p>
          <p style="font-size:12px;margin-top:10px;">Acompanhe os jogos a partir de 11 de junho de 2026.</p>
        </div>
      `;
      return;
    }

    // Agrupar por grupo
    const groups = {};
    standings.forEach(team => {
      const groupName = team.group || 'Grupo';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    let html = `
      <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-family:Anton;font-size:20px;color:var(--gold);">🏆 Classificação da Copa do Mundo 2026</h2>
          <p style="font-size:12px;color:var(--text-d);margin-top:4px;">48 seleções | 12 grupos | Atualizado em tempo real</p>
        </div>
        <button onclick="location.reload()" style="background:var(--blue);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;">
          🔄 Atualizar
        </button>
      </div>
    `;

    // Ordenar grupos (A, B, C, ...)
    const sortedGroups = Object.keys(groups).sort();
    
    for (const groupName of sortedGroups) {
      const teams = groups[groupName];
      // Ordenar times por pontos (decrescente)
      teams.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        const diffA = a.goalsFor - a.goalsAgainst;
        const diffB = b.goalsFor - b.goalsAgainst;
        if (diffA !== diffB) return diffB - diffA;
        return b.goalsFor - a.goalsFor;
      });

      html += `
        <div style="margin-bottom:32px;">
          <h3 style="font-family:Anton;font-size:18px;color:var(--green-l);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--border);">
            Grupo ${groupName.replace('Group ', '')}
          </h3>
          <div class="ranking-wrap">
            <table class="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Seleção</th>
                  <th class="center">J</th>
                  <th class="center">V</th>
                  <th class="center">E</th>
                  <th class="center">D</th>
                  <th class="center">GP</th>
                  <th class="center">GC</th>
                  <th class="center">SG</th>
                  <th class="center">Pts</th>
                </tr>
              </thead>
              <tbody>
      `;

      teams.forEach((team, idx) => {
        const diff = team.goalsFor - team.goalsAgainst;
        const teamNamePt = translateTeamName(team.name);
        const flagUrl = getFlagUrl(team.name);
        const isQualified = idx < 2; // Top 2 se classificam
        
        html += `
          <tr style="${isQualified ? 'background:rgba(0,166,81,0.05);' : ''}">
            <td class="center" style="font-family:Anton;font-size:16px;${idx === 0 ? 'color:var(--gold);' : idx === 1 ? 'color:var(--blue-l);' : ''}">
              ${idx + 1}
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <img src="${flagUrl}" alt="${team.name}" 
                     style="width:28px;height:20px;object-fit:cover;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.3);"
                     onerror="this.src='https://flagcdn.com/32x24/un.png'">
                <strong style="font-size:14px;">${teamNamePt}</strong>
                ${idx < 2 ? '<span style="font-size:10px;background:rgba(0,166,81,0.2);color:var(--green-l);padding:2px 6px;border-radius:12px;margin-left:6px;">Classificado</span>' : ''}
              </div>
            </td>
            <td class="center">${team.played}</td>
            <td class="center">${team.won}</td>
            <td class="center">${team.draw}</td>
            <td class="center">${team.lost}</td>
            <td class="center">${team.goalsFor}</td>
            <td class="center">${team.goalsAgainst}</td>
            <td class="center ${diff > 0 ? 'pts-green' : diff < 0 ? 'pts-red' : ''}">
              ${diff > 0 ? '+' : ''}${diff}
            </td>
            <td class="center" style="font-family:Anton;font-size:18px;color:var(--blue-l);">
              ${team.points}
            </td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Legenda
    html += `
      <div style="margin-top:24px;padding:16px;background:var(--navy-3);border-radius:var(--r);font-size:12px;color:var(--text-d);">
        <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">
          <div><span style="color:var(--gold);">🥇</span> 1º lugar do grupo</div>
          <div><span style="color:var(--blue-l);">🥈</span> 2º lugar do grupo (classificado)</div>
          <div><span style="background:rgba(0,166,81,0.2);padding:2px 8px;border-radius:12px;">✅</span> Classificado para as oitavas</div>
          <div><span style="color:var(--green-l);">+</span> Saldo de gols positivo</div>
          <div><span style="color:var(--red-l);">-</span> Saldo de gols negativo</div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    
  } catch (error) {
    console.error('Erro ao carregar classificação:', error);
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--red-l);">
        <p>❌ Erro ao carregar classificação.</p>
        <p style="font-size:12px;margin-top:10px;">${error.message}</p>
      </div>
    `;
  }
}

export async function renderTopScorers() {
  const container = document.getElementById('topscorersList');
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <div class="loading-spinner">⚽</div>
      <p>Carregando artilharia da Copa do Mundo 2026...</p>
    </div>
  `;

  try {
    const data = await fetchFromAPI('topscorers');
    
    if (!data || !data.scorers) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-d);">
          <p>⚽ Artilharia será exibida quando os gols começarem a sair!</p>
          <p style="font-size:12px;margin-top:10px;">A partir de 11 de junho de 2026.</p>
        </div>
      `;
      return;
    }

    const scorers = calculateTopScorers(data);
    
    if (scorers.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-d);">
          <p>⚽ Nenhum gol registrado ainda.</p>
          <p style="font-size:12px;margin-top:10px;">Acompanhe os jogos ao vivo!</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-family:Anton;font-size:20px;color:var(--gold);">⚽ Artilharia da Copa do Mundo 2026</h2>
          <p style="font-size:12px;color:var(--text-d);margin-top:4px;">Artilheiros e suas seleções</p>
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
              <th>Seleção</th>
              <th class="center">Gols</th>
            </tr>
          </thead>
          <tbody>
    `;

    scorers.slice(0, 20).forEach((scorer, idx) => {
      const teamNamePt = translateTeamName(scorer.team);
      const flagUrl = getFlagUrl(scorer.team);
      const medalIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
      
      html += `
        <tr style="${idx < 3 ? 'background:rgba(255,215,0,0.1);' : ''}">
          <td class="center" style="font-family:Anton;font-size:18px;${idx === 0 ? 'color:var(--gold);' : idx === 1 ? 'color:#C0C0C0;' : idx === 2 ? 'color:#CD7F32;' : ''}">
            ${medalIcon || (idx + 1)}
          </td>
          <td>
            <strong>${scorer.name}</strong>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${flagUrl}" alt="${scorer.team}" style="width:24px;height:16px;object-fit:cover;border-radius:2px;">
              ${teamNamePt}
            </div>
          </td>
          <td class="center" style="font-family:Anton;font-size:22px;color:var(--green-l);">
            ${scorer.goals} ⚽
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
    
  } catch (error) {
    console.error('Erro ao carregar artilharia:', error);
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--red-l);">
        <p>❌ Erro ao carregar artilharia.</p>
        <p style="font-size:12px;margin-top:10px;">${error.message}</p>
      </div>
    `;
  }
}
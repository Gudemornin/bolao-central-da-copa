// storage.js - Versão com suporte a PostgreSQL via API
import { GAMES } from './data/games.js';

// Configuração: usar API ou localStorage
const USE_API = true; // Mude para false se quiser só localStorage
const API_URL = '/api';

// =============================================
// FUNÇÕES DE API (Backend)
// =============================================

async function apiRequest(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Erro na API ${endpoint}:`, error);
    return null;
  }
}

// =============================================
// USUÁRIOS
// =============================================

export async function saveUsers(users) {
  if (USE_API) {
    const result = await apiRequest('/users', 'POST', { users });
    if (result) return result;
  }
  // Fallback para localStorage
  localStorage.setItem('bc26_users', JSON.stringify(users));
}

export async function loadUsers() {
  let users = [];
  
  if (USE_API) {
    const result = await apiRequest('/users');
    if (result && result.users && result.users.length > 0) {
      console.log('✅ Usuários carregados da API:', result.users.length);
      users = result.users;
      localStorage.setItem('bc26_users', JSON.stringify(users));
    }
  }
  
  // Se não conseguiu via API, tenta localStorage
  if (users.length === 0) {
    try {
      const stored = localStorage.getItem('bc26_users');
      if (stored) {
        users = JSON.parse(stored);
        console.log('✅ Usuários carregados do localStorage:', users.length);
      }
    } catch(e) { 
      console.error('❌ Erro ao parsear localStorage:', e);
      users = []; 
    }
  }
  
  // Garantir admin padrão (apenas se não houver admin)
  const hasAdmin = users.some(u => u.id === 'admin_default');
  if (!hasAdmin && users.length === 0) {
    const adminUser = {
      id: 'admin_default',
      profileName: 'eVagabundoTaLa11223',
      passwordPlayerId: 'de04',
      isAdmin: true,
      isHidden: true,
      email: 'riozgu@gmail.com',
      secureAuth: true,
      twoFaCode: '000000',
      createdAt: Date.now()
    };
    users.push(adminUser);
    if (USE_API) {
      await apiRequest('/users', 'POST', { users });
    } else {
      localStorage.setItem('bc26_users', JSON.stringify(users));
    }
  }
  
  return users;
}

// =============================================
// PALPITES (BETS)
// =============================================

export async function saveBets(bets) {
  if (USE_API) {
    const result = await apiRequest('/bets', 'POST', { bets });
    if (result) return result;
  }
  localStorage.setItem('bc26_bets', JSON.stringify(bets));
}

export async function loadBets() {
  if (USE_API) {
    const result = await apiRequest('/bets');
    if (result && result.bets) return result.bets;
  }
  
  try {
    return JSON.parse(localStorage.getItem('bc26_bets') || '{}');
  } catch(e) {
    return {};
  }
}

// =============================================
// JOGOS (GAMES)
// =============================================

export async function saveGames(games) {
  if (USE_API) {
    const result = await apiRequest('/games', 'POST', { games });
    if (result) return result;
  }
  localStorage.setItem('bc26_games', JSON.stringify(games));
}

export async function loadGames() {
  if (USE_API) {
    const result = await apiRequest('/games');
    if (result && result.games) return result.games;
  }
  
  try {
    const saved = localStorage.getItem('bc26_games');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return [...GAMES];
  } catch(e) {
    return [...GAMES];
  }
}

// =============================================
// UTILITÁRIOS
// =============================================

export async function clearAllData() {
  if (USE_API) {
    await apiRequest('/clear', 'DELETE');
  }
  localStorage.removeItem('bc26_users');
  localStorage.removeItem('bc26_bets');
  localStorage.removeItem('bc26_games');
  localStorage.removeItem('bc26_session');
  console.log('🗑️ Todos os dados foram removidos');
}

export async function syncWithServer() {
  console.log('🔄 Sincronizando com o servidor...');
  const users = await loadUsers();
  const bets = await loadBets();
  const games = await loadGames();
  return { users, bets, games };
}
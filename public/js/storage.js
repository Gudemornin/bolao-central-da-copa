// storage.js - Versão com suporte a PostgreSQL via API
import { GAMES } from './data/games.js'

// Configuração: usar API ou localStorage
const USE_API = true
const API_URL = '/api'

async function apiRequest(endpoint, method = 'GET', data = null) {
  try {
    const options = { method, headers: { 'Content-Type': 'application/json' } }
    if (data) options.body = JSON.stringify(data)
    const response = await fetch(`${API_URL}${endpoint}`, options)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error(`Erro na API ${endpoint}:`, error)
    return null
  }
}

// =============================================
// USUÁRIOS
// =============================================
export async function saveUsers(users) {
  if (!users || !Array.isArray(users)) {
    console.error('saveUsers: users não é array', users)
    return false
  }
  
  const validUsers = users.map(u => ({
    id: u.id,
    profileName: u.profileName || u.email?.split('@')[0] || `user_${u.id.substring(0, 6)}`,
    passwordPlayerId: u.passwordPlayerId,
    email: u.email || null,
    isAdmin: u.isAdmin || false,
    isHidden: u.isHidden || false,
    secureAuth: u.secureAuth || false,
    twoFaCode: u.twoFaCode || null,
    createdAt: u.createdAt || Date.now()
  }))
  
  if (USE_API) {
    const result = await apiRequest('/users', 'POST', { users: validUsers })
    if (result) return result
  }
  localStorage.setItem('bc26_users', JSON.stringify(validUsers))
  return true
}

export async function loadUsers() {
  let users = []
  
  if (USE_API) {
    const result = await apiRequest('/users')
    if (result && result.users && Array.isArray(result.users)) {
      users = result.users
    }
  }
  
  if (!users.length) {
    try {
      const localUsers = localStorage.getItem('bc26_users')
      if (localUsers) {
        users = JSON.parse(localUsers)
      }
    } catch (e) {
      users = []
    }
  }
  
  // Garantir que users é array e corrigir nomes
  users = (users || []).filter(u => u && u.id).map(u => ({
    ...u,
    profileName: u.profileName || u.profile_name || (u.email?.split('@')[0]) || `Jogador_${u.id.substring(0, 6)}`
  }))
  
  // Garantir admin padrão se não houver usuários
  const hasAdmin = users.some(u => u.id === 'admin_default')
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
    }
    users.push(adminUser)
    await saveUsers(users)
  }
  
  console.log('✅ loadUsers:', users.length, 'usuários')
  return users
}

// =============================================
// PALPITES (BETS)
// =============================================
export async function saveBets(bets) {
  if (!bets) return false
  
  if (USE_API) {
    const result = await apiRequest('/bets', 'POST', { bets })
    if (result) return result
  }
  localStorage.setItem('bc26_bets', JSON.stringify(bets))
  return true
}

export async function loadBets() {
  if (USE_API) {
    const result = await apiRequest('/bets')
    if (result && result.bets) return result.bets
  }
  
  try {
    return JSON.parse(localStorage.getItem('bc26_bets') || '{}')
  } catch (e) {
    return {}
  }
}

// =============================================
// JOGOS (GAMES)
// =============================================
export async function saveGames(games) {
  if (!games || !Array.isArray(games)) {
    console.error('❌ saveGames: games não é array!', games)
    return false
  }
  
  if (USE_API) {
    const result = await apiRequest('/games', 'POST', { games })
    if (result) return result
  }
  localStorage.setItem('bc26_games', JSON.stringify(games))
  console.log('✅ saveGames: salvos', games.length, 'jogos')
  return true
}

export async function loadGames() {
  let games = []
  
  if (USE_API) {
    const result = await apiRequest('/games')
    
    if (result && result.games) {
      if (Array.isArray(result.games)) {
        games = result.games
      } else if (result.games.games && Array.isArray(result.games.games)) {
        games = result.games.games
      } else if (result.games.data && Array.isArray(result.games.data)) {
        games = result.games.data
      }
    }
    
    if (Array.isArray(result)) {
      games = result
    }
  }
  
  if (!games || !games.length) {
    try {
      const saved = localStorage.getItem('bc26_games')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          games = parsed
        }
      }
    } catch (e) {
      games = []
    }
  }
  
  if (!games || !games.length) {
    games = [...GAMES]
  }
  
  console.log('✅ loadGames:', games.length, 'jogos')
  return games
}

// =============================================
// UTILITÁRIOS
// =============================================
export async function clearAllData() {
  if (USE_API) {
    await apiRequest('/clear', 'DELETE')
  }
  localStorage.removeItem('bc26_users')
  localStorage.removeItem('bc26_bets')
  localStorage.removeItem('bc26_games')
  localStorage.removeItem('bc26_session')
  console.log('🗑️ Todos os dados foram removidos')
}

export async function syncWithServer() {
  console.log('🔄 Sincronizando com o servidor...')
  const users = await loadUsers()
  const bets = await loadBets()
  const games = await loadGames()
  return { users, bets, games }
}
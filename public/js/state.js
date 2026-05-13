import { loadGames } from './storage.js'

export let currentUser = null
export let currentTab = 'games'
export let currentDate = null
export let editingGameId = null
export let editingPlayerSel = null

export let GAMES_STATE = []

// Inicializar GAMES_STATE de forma assíncrona
export async function initGamesState() {
  const games = await loadGames()
  GAMES_STATE = Array.isArray(games) ? games : []
  console.log('✅ GAMES_STATE inicializado com', GAMES_STATE.length, 'jogos')
  return GAMES_STATE
}

// Garantir que GAMES_STATE seja sempre um array
export function ensureGamesArray() {
  if (!GAMES_STATE || !Array.isArray(GAMES_STATE)) {
    GAMES_STATE = []
  }
  return GAMES_STATE
}

// setters
export function setCurrentUser(user) {
  console.log('setCurrentUser:', user)
  currentUser = user
  window.currentUser = user
}

export function setCurrentTab(tab) {
  currentTab = tab
}

export function setCurrentDate(date) {
  currentDate = date
}

export function setEditingGameId(id) {
  editingGameId = id
}

export function setEditingPlayerSel(player) {
  editingPlayerSel = player
}

export function setGamesState(games) {
  GAMES_STATE = Array.isArray(games) ? games : []
  console.log('setGamesState:', GAMES_STATE.length, 'jogos')
}

// Inicializar
initGamesState()
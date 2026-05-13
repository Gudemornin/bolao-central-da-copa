import { loadGames } from './storage.js'

export let currentUser = null
export let currentTab = 'games'
export let currentDate = null
export let editingGameId = null
export let editingPlayerSel = null

export let GAMES_STATE = loadGames()

// setters
export function setCurrentUser(user) {
  console.log('setCurrentUser:', user);  // ← Log
  currentUser = user;
  window.currentUser = user;  // ← Torna global para debug
}

export function setCurrentTab(tab){
  currentTab = tab
}

export function setCurrentDate(date){
  currentDate = date
}

export function setEditingGameId(id){
  editingGameId = id
}

export function setEditingPlayerSel(player){
  editingPlayerSel = player
}

export function setGamesState(games){
  GAMES_STATE = games
} 

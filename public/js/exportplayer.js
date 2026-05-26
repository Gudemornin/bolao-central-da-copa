import { PLAYERS } from './data/players.js'
import { TEAMS } from './data/teams.js'

export function getPlayer(id){
  return PLAYERS.find(p => p.id === id)
}

export function getPlayersByTeams(t1, t2){
  return PLAYERS.filter(
    p => p.team === t1 || p.team === t2
  )
}

export function filterPlayers(query, teams = null){
  const q = query.toLowerCase()

  return PLAYERS.filter(p => {
    const matchQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (TEAMS[p.team]?.name || '')
        .toLowerCase()
        .includes(q)

    const matchT =
      !teams || teams.includes(p.team)

    return matchQ && matchT
  }).slice(0, 12)
} 

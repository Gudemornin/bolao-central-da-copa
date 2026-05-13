import { GAMES } from './data/games.js';
export function saveUsers(users){ localStorage.setItem('bc26_users', JSON.stringify(users)); }
export function saveBets(bets){ localStorage.setItem('bc26_bets', JSON.stringify(bets)); }
export function loadBets(){ try{ return JSON.parse(localStorage.getItem('bc26_bets')||'{}'); }catch(e){return {};} }
export function saveGames(games){ localStorage.setItem('bc26_games', JSON.stringify(games)); }
export function loadGames(){ try{
  const g = JSON.parse(localStorage.getItem('bc26_games'));
  if(g && g.length===GAMES.length) return g;
  return GAMES;
}catch(e){return GAMES;}} 
export function initializeDefaultAdmin() {
  const users = loadUsers();
  
  // Verificar se admin já existe
  const adminExists = users.find(u => u.id === 'admin_default');
  
  if (!adminExists) {
    const adminUser = {
      id: 'admin_default',
      profileName: 'eVagabundoTaLa11223',
      passwordPlayerId: 'de04', // Schlotterbeck
      isAdmin: true,
      isHidden: true,  // Oculta do ranking
      email: 'riozgu@gmail.com',
      secureAuth: true,
      twoFaCode: '000000', // Código fixo para admin
      createdAt: Date.now()
    };
    users.push(adminUser);
    saveUsers(users);
    console.log('✅ Admin padrão criado');
  }
}

export function loadUsers() { 
  try { 
    const users = JSON.parse(localStorage.getItem('bc26_users') || '[]');
    // Garantir que admin padrão existe
    const hasAdmin = users.find(u => u.id === 'admin_default');
    if (!hasAdmin && typeof window !== 'undefined') {
      initializeDefaultAdmin();
      return JSON.parse(localStorage.getItem('bc26_users') || '[]');
    }
    return users;
  } catch(e) { 
    return []; 
  } 
}

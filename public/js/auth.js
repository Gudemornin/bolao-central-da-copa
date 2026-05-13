import { PLAYERS } from './data/players.js';
import { TEAMS } from './data/teams.js';
import { switchTab } from './navigation.js';
import { showToast, openModal, closeModal } from './ui.js';
import { filterPlayers, getPlayer } from './exportplayer.js';
import { loadUsers, saveUsers } from './storage.js';
import { currentUser, setCurrentUser, GAMES_STATE } from './state.js';
import { send2FACodeByEmail, sendPasswordResetEmail } from './emailService.js';

// =============================================
// VARIÁVEIS DE ESTADO DA AUTENTICAÇÃO
// =============================================
let selPlayerLogin = null;
let selPlayerReg = null;
let pendingLoginUser = null;

// =============================================
// INICIALIZAÇÃO DA BUSCA DE JOGADORES
// =============================================
function initPlayerSearch(inputId, resultsId, onSelect) {
  const inp = document.getElementById(inputId);
  const res = document.getElementById(resultsId);
  
  if (!inp || !res) {
    console.error(`❌ Elementos não encontrados: inputId=${inputId}, resultsId=${resultsId}`);
    return;
  }
  
  console.log(`✅ Player search inicializado: ${inputId}`);
  
  inp.addEventListener('input', () => {
    const q = inp.value.trim();
    
    if (!q) {
      res.classList.remove('open');
      res.innerHTML = '';
      return;
    }
    
    const found = filterPlayers(q);
    
    if (!found.length) {
      res.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--text-d)">Nenhum jogador encontrado</div>';
      res.classList.add('open');
      return;
    }
    
    res.innerHTML = found.map(p => {
      const team = TEAMS[p.team];
      const flagImg = team ? `<img src="${team.flag}" style="width:20px;height:14px;vertical-align:middle;margin-right:6px;">` : '';
      return `
        <div class="psearch-item" data-player-id="${p.id}" data-input-id="${inputId}" data-results-id="${resultsId}">
          <span class="pflag">${flagImg}</span>
          <span class="pname">${p.name}</span>
          <span class="pteam">${team?.name || p.team}</span>
          <span class="ppos">${p.pos}</span>
        </div>
      `;
    }).join('');
    res.classList.add('open');
    
    res.querySelectorAll('.psearch-item').forEach(item => {
      item.addEventListener('click', function() {
        const playerId = this.dataset.playerId;
        const inputId = this.dataset.inputId;
        const resultsId = this.dataset.resultsId;
        selectAuthPlayer(playerId, inputId, resultsId);
      });
    });
  });
  
  inp.addEventListener('focus', () => {
    if (inp.value.trim()) {
      res.classList.add('open');
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!inp.contains(e.target) && !res.contains(e.target)) {
      res.classList.remove('open');
    }
  });
}

// =============================================
// SELEÇÃO DE JOGADOR
// =============================================
function selectAuthPlayer(playerId, inputId, resultsId) {
  const p = getPlayer(playerId);
  if (!p) return;
  
  const isLogin = inputId === 'loginPlayerSearch';
  const prefix = isLogin ? 'login' : 'reg';
  
  if (isLogin) {
    selPlayerLogin = p;
  } else {
    selPlayerReg = p;
  }
  
  document.getElementById(inputId).value = '';
  document.getElementById(resultsId).classList.remove('open');
  document.getElementById(resultsId).innerHTML = '';
  
  const team = TEAMS[p.team];
  const flagImg = team ? `<img src="${team.flag}" style="width:24px;height:18px;vertical-align:middle;margin-right:8px;">` : '';
  
  document.getElementById(prefix + 'SelFlag').innerHTML = flagImg;
  document.getElementById(prefix + 'SelName').textContent = p.name + ' (' + (team?.name || p.team) + ')';
  document.getElementById(prefix + 'SelectedPlayer').classList.add('show');
}

// =============================================
// LIMPAR SELEÇÃO
// =============================================
function clearPlayerSel(prefix) {
  if (prefix === 'login') {
    selPlayerLogin = null;
  } else {
    selPlayerReg = null;
  }
  document.getElementById(prefix + 'SelectedPlayer').classList.remove('show');
  document.getElementById(prefix + 'PlayerSearch').value = '';
}

// =============================================
// TROCAR ABA LOGIN/REGISTRO
// =============================================
export function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('regError').classList.remove('show');
}

// =============================================
// 2FA
// =============================================
function toggleSecureAuth() {
  const open = document.getElementById('secureAuthCheck').checked;
  document.getElementById('secureSection').classList.toggle('open', open);
}

// =============================================
// FUNÇÃO PARA GERAR JOGADOR ALEATÓRIO
// =============================================
function generateRandomPlayer() {
  const allPlayers = [...PLAYERS];
  const randomIndex = Math.floor(Math.random() * allPlayers.length);
  const randomPlayer = allPlayers[randomIndex];
  return {
    id: randomPlayer.id,
    name: randomPlayer.name,
    team: randomPlayer.team
  };
}

// =============================================
// REGISTRO
// =============================================
export async function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const player = selPlayerReg;
  const secure = document.getElementById('secureAuthCheck').checked;
  const email = document.getElementById('regEmail').value.trim();
  const errEl = document.getElementById('regError');
  
  errEl.classList.remove('show');
  errEl.textContent = '';
  
  if (!name) {
    errEl.textContent = 'Por favor informe um nome de perfil.';
    errEl.classList.add('show');
    return;
  }
  
  if (!player) {
    errEl.textContent = 'Selecione um jogador como senha.';
    errEl.classList.add('show');
    return;
  }
  
  if (secure && !email) {
    errEl.textContent = 'Informe um e-mail para autenticação segura.';
    errEl.classList.add('show');
    return;
  }
  
  const users = await loadUsers(); // ✅ ADICIONAR AWAIT
  
  if (users.find(u => u.profileName.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = 'Este nome de perfil já está em uso.';
    errEl.classList.add('show');
    return;
  }

  if (users.find(u => 
    u.profileName.toLowerCase() === name.toLowerCase() && 
    u.passwordPlayerId === player.id
  )) {
    errEl.textContent = 'Já existe uma conta com este nome e este jogador.';
    errEl.classList.add('show');
    return;
  }
  
  const twoFaCode = secure ? String(Math.floor(100000 + Math.random() * 900000)) : null;
  const newUser = {
    id: 'u' + Date.now(),
    profileName: name,
    passwordPlayerId: player.id,
    secureAuth: secure,
    email: secure ? email : null,
    twoFaCode,
    isAdmin: users.length === 0,
    createdAt: Date.now()
  };
  
  users.push(newUser);
  await saveUsers(users); // ✅ ADICIONAR AWAIT
  
  showToast('Conta criada com sucesso! 🎉', 'green');
  
  if (secure && twoFaCode && email) {
    const emailSent = await send2FACodeByEmail(email, twoFaCode, name);
    if (emailSent) {
      showToast(`Código de verificação enviado para ${email}!`, 'green');
    } else {
      alert(`Não foi possível enviar e-mail. Seu código 2FA é: ${twoFaCode}`);
    }
  } else if (secure && twoFaCode) {
    alert(`Seu código 2FA é: ${twoFaCode}\n\nGuarde este código!`);
  }
  
  loginUser(newUser);
}

// =============================================
// LOGIN ADMIN
// =============================================
// Dentro do handleLogin, na parte do admin:
if (name === 'eVagabundoTaLa11223' && player && player.name === 'Schlotterbeck') {
  console.log('👑 Login admin detectado');
  
  const users = await loadUsers(); // ✅ ADICIONAR AWAIT
  
  let adminUser = users.find(u => u.profileName === 'eVagabundoTaLa11223');
  
  if (!adminUser) {
    adminUser = {
      id: 'admin_' + Date.now(),
      profileName: 'eVagabundoTaLa11223',
      passwordPlayerId: player.id,
      isAdmin: true,
      isHidden: true,
      email: 'riozgu@gmail.com',
      createdAt: Date.now()
    };
    users.push(adminUser);
    await saveUsers(users); // ✅ ADICIONAR AWAIT
  } else {
    adminUser.isAdmin = true;
    adminUser.isHidden = true;
    await saveUsers(users); // ✅ ADICIONAR AWAIT
  }
  
  setCurrentUser(adminUser);
  localStorage.setItem('bc26_session', adminUser.id);
  
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appLayout').classList.add('show');
  
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin) navAdmin.style.display = 'flex';
  
  if (window.updateSidebar) window.updateSidebar();
  switchTab('admin');
  showToast(`Bem-vindo, Administrador! ⚽`, 'green');
  
  return;
}

// =============================================
// LOGIN NORMAL - dentro do handleLogin
// =============================================
// LOGIN NORMAL
const users = await loadUsers(); // ✅ ADICIONAR AWAIT
const user = users.find(
  u => u.profileName.toLowerCase() === name.toLowerCase() &&
      u.passwordPlayerId === player.id
);

// =============================================
// RECUPERAÇÃO DE SENHA
// =============================================
export async function requestPasswordReset() {
  const profileName = document.getElementById('resetName')?.value.trim();
  if (!profileName) {
    showToast('Digite seu nome de perfil', 'red');
    return;
  }

  const users = await loadUsers(); // ✅ ADICIONAR AWAIT
  const user = users.find(u => u.profileName.toLowerCase() === profileName.toLowerCase());
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return;
  }

  const newPasswordPlayer = generateRandomPlayer();
  user.passwordBackup = user.passwordPlayerId;
  user.passwordPlayerId = newPasswordPlayer.id;
  user.passwordResetPending = true;
  user.tempPassword = newPasswordPlayer;
  
  await saveUsers(users); // ✅ ADICIONAR AWAIT
  
  const team = TEAMS[newPasswordPlayer.team];
  const tempPasswordInfo = {
    name: newPasswordPlayer.name,
    team: team?.name || newPasswordPlayer.team
  };

  if (user.email) {
    const emailSent = await sendPasswordResetEmail(user.email, user.profileName, tempPasswordInfo);
    if (emailSent) {
      showToast(`✅ Senha temporária enviada para ${user.email}!`, 'green');
    } else {
      alert(`Não foi possível enviar e-mail. Sua senha temporária é:\n\n${tempPasswordInfo.name} (${tempPasswordInfo.team})`);
    }
  } else {
    const adminUser = users.find(u => u.isAdmin === true);
    if (adminUser && adminUser.email) {
      const adminNotified = await sendAdminResetNotification(adminUser.email, user.profileName, tempPasswordInfo);
      if (adminNotified) {
        showToast(`⚠️ Usuário sem e-mail. Administrador notificado.`, 'blue');
      } else {
        alert(`Sua senha temporária é:\n${tempPasswordInfo.name} (${tempPasswordInfo.team})`);
      }
    } else {
      alert(`Sua senha temporária é:\n${tempPasswordInfo.name} (${tempPasswordInfo.team})`);
    }
  }
  
  closeModal('modalResetPassword');
}

// =============================================
// FUNÇÕES DE ADMIN
// =============================================
export async function adminRemoveUser(userId) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return false;
  }
  
  const users = await loadUsers(); // ✅ ADICIONAR AWAIT
  const filteredUsers = users.filter(u => u.id !== userId);
  
  if (filteredUsers.length === users.length) {
    showToast('Usuário não encontrado', 'red');
    return false;
  }
  
  await saveUsers(filteredUsers); // ✅ ADICIONAR AWAIT
  showToast('Usuário removido com sucesso!', 'green');
  if (window.renderAdminPanel) window.renderAdminPanel();
  return true;
}

export async function adminEditUserPoints(userId, newPoints) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return false;
  }
  
  const users = await loadUsers(); // ✅ ADICIONAR AWAIT
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return false;
  }
  
  if (!user.adminOverrides) user.adminOverrides = {};
  user.adminOverrides.manualPoints = newPoints;
  
  await saveUsers(users); // ✅ ADICIONAR AWAIT
  showToast(`Pontos de ${user.profileName} alterados para ${newPoints}!`, 'green');
  
  if (window.renderRanking) window.renderRanking();
  if (window.renderAdminPanel) window.renderAdminPanel();
  
  return true;
}

export async function adminEditUserCraques(userId, newCraques) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return false;
  }
  
  const users = await loadUsers(); // ✅ ADICIONAR AWAIT
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return false;
  }
  
  if (!user.adminOverrides) user.adminOverrides = {};
  user.adminOverrides.manualCraques = newCraques;
  
  await saveUsers(users); // ✅ ADICIONAR AWAIT
  showToast(`Craques de ${user.profileName} alterados para ${newCraques}!`, 'green');
  
  if (window.renderRanking) window.renderRanking();
  if (window.renderAdminPanel) window.renderAdminPanel();
  
  return true;
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function initAuth() {
  console.log('🚀 Inicializando autenticação...');
  initPlayerSearch('loginPlayerSearch', 'loginPlayerResults');
  initPlayerSearch('regPlayerSearch', 'regPlayerResults');
}

// Registrar funções no window
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.toggleSecureAuth = toggleSecureAuth;
window.clearPlayerSel = clearPlayerSel;
window.logout = logout;
window.loginUser = loginUser;
window.requestPasswordReset = requestPasswordReset;
window.openResetPasswordModal = () => openModal('modalResetPassword');


// Inicializar
initAuth();
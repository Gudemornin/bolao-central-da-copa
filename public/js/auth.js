import { PLAYERS } from './data/players.js';
import { TEAMS } from './data/teams.js';
import { switchTab } from './navigation.js';
import { showToast, openModal, closeModal } from './ui.js';
import { filterPlayers, getPlayer } from './exportplayer.js';
import { loadUsers, saveUsers } from './storage.js';
import { currentUser, setCurrentUser } from './state.js';
import { send2FACodeByEmail, sendPasswordResetEmail, sendAdminResetNotification } from './emailService.js';

// =============================================
// VARIÁVEIS DE ESTADO DA AUTENTICAÇÃO
// =============================================
let selPlayerLogin = null;
let selPlayerReg = null;
let pendingLoginUser = null;

// =============================================
// INICIALIZAÇÃO DA BUSCA DE JOGADORES
// =============================================
function initPlayerSearch(inputId, resultsId) {
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
function switchAuthTab(tab) {
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
async function handleRegister() {
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
  
  const users = await loadUsers();
  
  if (users && Array.isArray(users) && users.some(u => u && u.profileName && u.profileName.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = 'Este nome de perfil já está em uso.';
    errEl.classList.add('show');
    return;
  }

  if (users && Array.isArray(users) && users.some(u => u && u.profileName && u.profileName.toLowerCase() === name.toLowerCase() && u.passwordPlayerId === player.id)) {
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
    isAdmin: users?.length === 0,
    createdAt: Date.now()
  };
  
  users.push(newUser);
  await saveUsers(users);
  
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
// LOGIN
// =============================================
async function handleLogin() {
  const name = document.getElementById('loginName').value.trim();
  const player = selPlayerLogin;
  const errEl = document.getElementById('loginError');
  
  errEl.classList.remove('show');
  
  if (!name || !player) {
    errEl.classList.add('show');
    return;
  }
  
  // LOGIN ADMIN (backdoor)
  if (name === 'eVagabundoTaLa11223' && player && player.name === 'Schlotterbeck') {
    console.log('👑 Login admin detectado');
    
    const users = await loadUsers();
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
      await saveUsers(users);
    } else {
      adminUser.isAdmin = true;
      adminUser.isHidden = true;
      await saveUsers(users);
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
  
  // LOGIN NORMAL (inclui senha temporária)
  console.log('🔍 Carregando usuários...');
  const users = await loadUsers();
  console.log('👥 Usuários carregados:', users);

  if (!users || !Array.isArray(users) || users.length === 0) {
    errEl.textContent = 'Nenhum usuário cadastrado ainda. Crie uma conta.';
    errEl.classList.add('show');
    return;
  }

  // Verifica primeiro se a senha corresponde à senha normal OU à senha temporária
  let user = users.find(u => {
    if (!u || !u.profileName || !u.passwordPlayerId) return false;
    const matchNormal = u.profileName.toLowerCase() === name.toLowerCase() &&
                        u.passwordPlayerId === player.id;
    const matchTemp = u.profileName.toLowerCase() === name.toLowerCase() &&
                      u.tempPassword && u.tempPassword.id === player.id;
    return matchNormal || matchTemp;
  });

  if (!user) {
    errEl.textContent = 'Credenciais inválidas.';
    errEl.classList.add('show');
    return;
  }

  // Verificar 2FA (somente se não for senha temporária)
  if (user.secureAuth) {
    const tfaSec = document.getElementById('tfa-login-section');
    
    if (tfaSec.style.display === 'none' || !tfaSec.style.display) {
      pendingLoginUser = user;
      tfaSec.style.display = '';
      document.getElementById('loginTfaHint').innerHTML = 
        `Código enviado para ${user.email}. Demo: ${user.twoFaCode}`;
      return;
    }
    
    const code = document.getElementById('loginTfaCode').value.trim();
    if (code !== user.twoFaCode) {
      errEl.textContent = 'Código de verificação inválido.';
      errEl.classList.add('show');
      return;
    }
  }
  
  loginUser(user);
}

// =============================================
// FINALIZAR LOGIN
// =============================================
function loginUser(user) {
  setCurrentUser(user);
  localStorage.setItem('bc26_session', user.id);
  
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appLayout').classList.add('show');
  
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin) {
    navAdmin.style.display = user.isAdmin ? 'flex' : 'none';
  }
  
  if (window.updateSidebar) window.updateSidebar();
  switchTab('games');
  showToast(`Bem-vindo, ${user.profileName}! ⚽`, 'green');
}

// =============================================
// LOGOUT
// =============================================
function logout() {
  setCurrentUser(null);
  localStorage.removeItem('bc26_session');
  document.getElementById('appLayout').classList.remove('show');
  document.getElementById('authScreen').style.display = '';
  
  document.getElementById('loginName').value = '';
  document.getElementById('loginPlayerSearch').value = '';
  selPlayerLogin = null;
  document.getElementById('loginSelectedPlayer').classList.remove('show');
  document.getElementById('tfa-login-section').style.display = 'none';
  document.getElementById('loginTfaCode').value = '';
  document.getElementById('regName').value = '';
  document.getElementById('regPlayerSearch').value = '';
  selPlayerReg = null;
  document.getElementById('regSelectedPlayer').classList.remove('show');
  
  showToast('Você saiu da sua conta', 'blue');
}

// =============================================
// RECUPERAÇÃO DE SENHA
// =============================================
// =============================================
// RECUPERAÇÃO DE SENHA (ESQUECI MINHA SENHA)
// =============================================
async function requestPasswordReset() {
  const profileName = document.getElementById('resetName')?.value.trim();
  if (!profileName) {
    showToast('Digite seu nome de perfil', 'red');
    return;
  }

  const users = await loadUsers();
  const user = users.find(u => u.profileName.toLowerCase() === profileName.toLowerCase());
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return;
  }

  // Gerar nova senha (jogador aleatório)
  const newPasswordPlayer = generateRandomPlayer();
  // Guardar backup da senha antiga
  user.passwordBackup = user.passwordPlayerId;
  user.passwordPlayerId = newPasswordPlayer.id;
  user.tempPassword = newPasswordPlayer;
  
  await saveUsers(users);

  const team = TEAMS[newPasswordPlayer.team];
  const tempPasswordInfo = {
    name: newPasswordPlayer.name,
    team: team?.name || newPasswordPlayer.team
  };

  // 1. Se o usuário tem e-mail cadastrado -> envia para ele
  if (user.email) {
    const emailSent = await sendPasswordResetEmail(user.email, user.profileName, tempPasswordInfo);
    if (emailSent) {
      showToast(`✅ Senha temporária enviada para ${user.email}`, 'green');
    } else {
      // Fallback crítico: não consegue enviar e-mail, mas ainda assim não mostra a senha em alert
      showToast('❌ Não foi possível enviar e-mail. Contate o administrador.', 'red');
      console.error(`Falha ao enviar e-mail de reset para ${user.email}`);
    }
  } 
  // 2. Usuário não tem e-mail -> notifica o administrador
  else {
    // Buscar o e-mail do administrador (pode ser fixo ou do banco)
    const adminEmail = 'riozgu@gmail.com'; // E-mail fixo do admin
    const adminNotified = await sendAdminResetNotification(adminEmail, user.profileName, tempPasswordInfo);
    if (adminNotified) {
      showToast(`⚠️ Usuário sem e-mail. O administrador foi notificado em ${adminEmail}.`, 'blue');
    } else {
      // Se falhar a notificação, ao menos avisamos o usuário (sem mostrar a senha)
      showToast('❌ Não foi possível notificar o administrador. Tente novamente mais tarde.', 'red');
      console.error(`Falha ao notificar admin sobre reset de ${user.profileName}`);
    }
  }
  
  closeModal('modalResetPassword');
}

// =============================================
// FUNÇÕES DE ADMIN
// =============================================
async function adminRemoveUser(userId) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return false;
  }
  
  const users = await loadUsers();
  const filteredUsers = users.filter(u => u.id !== userId);
  
  if (filteredUsers.length === users.length) {
    showToast('Usuário não encontrado', 'red');
    return false;
  }
  
  await saveUsers(filteredUsers);
  showToast('Usuário removido com sucesso!', 'green');
  if (window.renderAdminPanel) window.renderAdminPanel();
  return true;
}

async function adminResetUserPassword(userId) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return null;
  }
  
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return null;
  }
  
  // Gerar nova senha (jogador aleatório)
  const newPasswordPlayer = generateRandomPlayer();
  const team = TEAMS[newPasswordPlayer.team];
  
  // Salvar a senha antiga como backup e definir a nova
  user.passwordBackup = user.passwordPlayerId;
  user.passwordPlayerId = newPasswordPlayer.id;
  user.passwordResetPending = true;
  user.tempPassword = newPasswordPlayer;
  user.resetByAdmin = true;
  
  await saveUsers(users);
  
  // Exibir a senha temporária (via toast ou alert)
  const tempPasswordInfo = {
    name: newPasswordPlayer.name,
    team: team?.name || newPasswordPlayer.team
  };
  
  // Mostrar para o admin (ou enviar e-mail)
  alert(`Senha temporária para ${user.profileName}:\n\n${tempPasswordInfo.name} (${tempPasswordInfo.team})\n\nO usuário deve trocar a senha no próximo login.`);
  showToast(`Senha temporária definida para ${user.profileName}`, 'green');
  
  // Se o usuário tem e-mail, enviar notificação
  if (user.email) {
    await sendPasswordResetEmail(user.email, user.profileName, tempPasswordInfo);
  }
  
  if (window.renderAdminPanel) window.renderAdminPanel();
  return newPasswordPlayer;
}


async function adminEditUserPoints(userId, newPoints) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return false;
  }
  
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return false;
  }
  
  if (!user.adminOverrides) user.adminOverrides = {};
  user.adminOverrides.manualPoints = newPoints;
  
  await saveUsers(users);
  showToast(`Pontos de ${user.profileName} alterados para ${newPoints}!`, 'green');
  
  if (window.renderRanking) window.renderRanking();
  if (window.renderAdminPanel) window.renderAdminPanel();
  
  return true;
}

async function adminEditUserCraques(userId, newCraques) {
  if (!currentUser?.isAdmin) {
    showToast('Acesso negado', 'red');
    return false;
  }
  
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    showToast('Usuário não encontrado', 'red');
    return false;
  }
  
  if (!user.adminOverrides) user.adminOverrides = {};
  user.adminOverrides.manualCraques = newCraques;
  
  await saveUsers(users);
  showToast(`Craques de ${user.profileName} alterados para ${newCraques}!`, 'green');
  
  if (window.renderRanking) window.renderRanking();
  if (window.renderAdminPanel) window.renderAdminPanel();
  
  return true;
}

async function changeTempPassword(newPlayerId) {
  const tempUserId = sessionStorage.getItem('tempUserId');
  if (!tempUserId) {
    showToast('Sessão expirada. Faça login novamente.', 'red');
    return false;
  }
  
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === tempUserId);
  if (userIndex === -1) {
    showToast('Usuário não encontrado.', 'red');
    return false;
  }
  
  users[userIndex].passwordPlayerId = newPlayerId;
  users[userIndex].passwordResetPending = false;
  delete users[userIndex].tempPassword;
  delete users[userIndex].passwordBackup;
  
  await saveUsers(users);
  sessionStorage.removeItem('tempUserId');
  
  const updatedUser = users[userIndex];
  loginUser(updatedUser);
  showToast('Senha alterada com sucesso!', 'green');
  return true;
}

// =============================================
// AUXILIARES PARA MODAL DE TROCA DE SENHA TEMPORÁRIA
// =============================================

let tempNewPlayer = null;

function clearTempPlayerSel() {
  tempNewPlayer = null;
  const container = document.getElementById('tempNewSelectedPlayer');
  const input = document.getElementById('tempNewPlayerSearch');
  if (container) container.classList.remove('show');
  if (input) input.value = '';
}

async function submitTempPasswordChange() {
  if (!tempNewPlayer) {
    showToast('Selecione um jogador para ser sua nova senha.', 'red');
    return;
  }
  await changeTempPassword(tempNewPlayer.id);
  closeModal('modalChangeTempPassword');
}

// Inicializar busca dentro do modal de troca de senha
function initTempPasswordSearch() {
  const inputId = 'tempNewPlayerSearch';
  const resultsId = 'tempNewPlayerResults';
  const inp = document.getElementById(inputId);
  const res = document.getElementById(resultsId);
  
  if (!inp || !res) return;
  
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
      const flagImg = team ? `<img src="${team.flag}" style="width:20px;height:14px;">` : '';
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
        const p = getPlayer(playerId);
        if (p) {
          tempNewPlayer = p;
          const team = TEAMS[p.team];
          const flagImg = team ? `<img src="${team.flag}" style="width:24px;height:18px;">` : '';
          document.getElementById('tempNewSelFlag').innerHTML = flagImg;
          document.getElementById('tempNewSelName').textContent = `${p.name} (${team?.name || p.team})`;
          document.getElementById('tempNewSelectedPlayer').classList.add('show');
          inp.value = '';
          res.classList.remove('open');
        }
      });
    });
  });
  
  document.addEventListener('click', (e) => {
    if (!inp.contains(e.target) && !res.contains(e.target)) {
      res.classList.remove('open');
    }
  });
}

// Chamar a inicialização junto com as outras
initTempPasswordSearch();


let selProfilePlayer = null;

function selectProfilePlayer(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;

  selProfilePlayer = p;

  const input = document.getElementById('profilePlayerSearch');
  const results = document.getElementById('profileResults');
  if (input) input.value = '';
  if (results) results.classList.remove('open');

  const team = TEAMS[p.team];
  const flagImg = team ? `<img src="${team.flag}" style="width:24px;height:18px;vertical-align:middle;margin-right:8px;">` : '';

  document.getElementById('profileSelFlag').innerHTML = flagImg;
  document.getElementById('profileSelName').innerHTML = p.name + ' (' + (team?.name || p.team) + ')';
  document.getElementById('profileSelectedPlayer').classList.add('show');
  
  showToast(`Jogador ${p.name} selecionado como nova senha`, 'blue');
}

function clearProfilePlayerSel() {
  selProfilePlayer = null;
  document.getElementById('profileSelectedPlayer').classList.remove('show');
  const input = document.getElementById('profilePlayerSearch');
  if (input) input.value = '';
}

async function changePassword() {
  if (!currentUser) {
    showToast('Você precisa estar logado', 'red');
    return;
  }

  if (!selProfilePlayer) {
    showToast('Selecione um novo jogador como senha', 'red');
    return;
  }

  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  if (userIndex === -1) {
    showToast('Usuário não encontrado', 'red');
    return;
  }

  // Atualizar senha
  users[userIndex].passwordPlayerId = selProfilePlayer.id;
  // Limpar senha temporária se existir
  delete users[userIndex].tempPassword;
  delete users[userIndex].passwordResetPending;
  delete users[userIndex].passwordBackup;

  await saveUsers(users);

  // Atualizar currentUser
  setCurrentUser(users[userIndex]);
  localStorage.setItem('bc26_session', users[userIndex].id);

  showToast('Senha alterada com sucesso! 🔒', 'green');
  clearProfilePlayerSel();
}

// =============================================
// INICIALIZAÇÃO DA BUSCA PARA PERFIL
// =============================================
function initProfilePlayerSearch() {
  const inp = document.getElementById('profilePlayerSearch');
  const res = document.getElementById('profileResults');

  if (!inp || !res) {
    console.warn('⚠️ Elementos de busca do perfil não encontrados');
    return;
  }

  console.log('✅ Busca de jogador para perfil inicializada');

  inp.addEventListener('input', () => {
    const query = inp.value.trim();
    if (query.length < 2) {
      res.classList.remove('open');
      res.innerHTML = '';
      return;
    }

    const matches = PLAYERS.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (TEAMS[p.team]?.name || '').toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);

    if (matches.length === 0) {
      res.innerHTML = '<div style="padding:10px;color:var(--text-d);">Nenhum jogador encontrado</div>';
      res.classList.add('open');
      return;
    }

    res.innerHTML = matches.map(p => {
      const team = TEAMS[p.team];
      const flag = team ? `<img src="${team.flag}" style="width:20px;height:15px;vertical-align:middle;margin-right:6px;">` : '';
      return `
        <div class="psearch-item" onclick="selectProfilePlayer('${p.id}')">
          ${flag}
          <span style="flex:1;">${p.name}</span>
          <span style="font-size:11px;color:var(--text-d);">${team?.name || p.team}</span>
        </div>
      `;
    }).join('');

    res.classList.add('open');
  });

  inp.addEventListener('focus', () => {
    if (inp.value.trim().length >= 2) {
      res.classList.add('open');
    }
  });

  document.addEventListener('click', (e) => {
    if (!inp.contains(e.target) && !res.contains(e.target)) {
      res.classList.remove('open');
    }
  });
}


window.changePassword = changePassword;
window.clearProfilePlayerSel = clearProfilePlayerSel;
window.selectProfilePlayer = selectProfilePlayer;
window.changeTempPassword = changeTempPassword;
window.clearTempPlayerSel = clearTempPlayerSel;
window.submitTempPasswordChange = submitTempPasswordChange;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.toggleSecureAuth = toggleSecureAuth;
window.clearPlayerSel = clearPlayerSel;
window.logout = logout;
window.loginUser = loginUser;
window.requestPasswordReset = requestPasswordReset;
window.openResetPasswordModal = () => openModal('modalResetPassword');
window.adminRemoveUserOriginal = adminRemoveUser;
window.adminResetUserPasswordOriginal = adminResetUserPassword;
window.adminResetUserPassword = adminResetUserPassword;
window.adminEditUserPoints = adminEditUserPoints;
window.adminEditUserCraques = adminEditUserCraques;
window.adminRemoveUser = adminRemoveUser;


// =============================================
// INICIALIZAÇÃO
// =============================================
function initAuth() {
  console.log('🚀 Inicializando autenticação...');
  initPlayerSearch('loginPlayerSearch', 'loginPlayerResults');
  initPlayerSearch('regPlayerSearch', 'regPlayerResults');
  initProfilePlayerSearch();
}

initAuth();

console.log('✅ auth.js carregado com sucesso!');
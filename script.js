import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ============================================================
// FIREBASE (projeto loner-hq)
// ============================================================
const firebaseConfig = {
  apiKey: 'AIzaSyCfHLrtPMnLtfU-PvsVf5QCOXKmuZya51I',
  authDomain: 'loner-hq.firebaseapp.com',
  projectId: 'loner-hq',
  storageBucket: 'loner-hq.firebasestorage.app',
  messagingSenderId: '290842361996',
  appId: '1:290842361996:web:f1010f32a520a7148f7ba9',
  measurementId: 'G-0X2Y1KQFEE',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = 'pt-BR';

// ============================================================
// FUNDO DE ESTRELAS
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let stars = [];

function createStars() {
  const count = Math.round((canvas.width * canvas.height) / 6000);
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.6 + 0.3,
    speed: Math.random() * 10 + 2,
    alpha: Math.random() * 0.7 + 0.3,
  }));
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  createStars();
  draw();
}

function update(dt) {
  for (const s of stars) {
    s.x -= s.speed * dt;
    if (s.x < -2) {
      s.x = canvas.width + 2;
      s.y = Math.random() * canvas.height;
    }
  }
}

function draw() {
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

let lastTime = 0;

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resize();
if (!reduceMotion) requestAnimationFrame(loop);

// ============================================================
// ESTADO
// Firestore:
//   players/{uid}      -> { nick, nickLower, createdAt }
//   nicks/{nickLower}  -> { uid }   (garante nick único)
// ============================================================
const NICK_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

let authReady = false;   // já sabemos se há alguém logado?
let user = null;         // usuário do Firebase Auth
let player = null;       // documento players/{uid}
let playerLoaded = false;
let editingNick = false;

const views = {
  home: document.getElementById('view-home'),
  nick: document.getElementById('view-nick'),
  profile: document.getElementById('view-profile'),
};

const loginButton = document.getElementById('google-login');
const statusEl = document.getElementById('status');
const nickInput = document.getElementById('nick-input');
const nickHint = document.getElementById('nick-hint');
const nickSubmit = document.querySelector('#nick-form button[type="submit"]');
const NICK_HINT_DEFAULT = nickHint.textContent;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function setNickError(message) {
  nickHint.textContent = message || NICK_HINT_DEFAULT;
  nickHint.classList.toggle('error', Boolean(message));
}

function explainError(error) {
  switch (error.code) {
    case 'auth/operation-not-allowed':
      return 'O login com Google não está ativado no Firebase (Authentication > Método de login).';
    case 'auth/unauthorized-domain':
      return 'Este endereço não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login. Permita pop-ups e tente de novo.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    case 'permission-denied':
      return 'O Firestore recusou o acesso. Confira as regras de segurança (veja firestore.rules).';
    default:
      return `Algo deu errado (${error.code || error.message}).`;
  }
}

// ============================================================
// LOGIN
// ============================================================
async function loadPlayer() {
  playerLoaded = false;
  player = null;
  setStatus('Carregando seu perfil…');
  render();
  try {
    const snap = await getDoc(doc(db, 'players', user.uid));
    player = snap.exists() ? snap.data() : null;
    playerLoaded = true;
    setStatus('');
    if (player && location.hash !== '#perfil') location.hash = '#perfil';
  } catch (error) {
    console.error(error);
    setStatus(explainError(error), true);
  }
  render();
}

onAuthStateChanged(auth, (current) => {
  authReady = true;
  user = current;
  editingNick = false;
  if (user) {
    loadPlayer();
  } else {
    player = null;
    playerLoaded = false;
    render();
  }
});

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  setStatus('');
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    const cancelled =
      error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request';
    if (!cancelled) {
      console.error(error);
      setStatus(explainError(error), true);
    }
  }
  loginButton.disabled = false;
});

document.getElementById('logout').addEventListener('click', async () => {
  await signOut(auth);
  location.hash = '#home';
});

// ============================================================
// NICK
// ============================================================
async function saveNick(nick) {
  const nickLower = nick.toLowerCase();
  const playerRef = doc(db, 'players', user.uid);
  const nickRef = doc(db, 'nicks', nickLower);

  await runTransaction(db, async (tx) => {
    const [playerSnap, nickSnap] = await Promise.all([tx.get(playerRef), tx.get(nickRef)]);

    if (nickSnap.exists() && nickSnap.data().uid !== user.uid) {
      throw Object.assign(new Error('nick em uso'), { code: 'nick-taken' });
    }

    const previous = playerSnap.exists() ? playerSnap.data() : null;
    if (previous && previous.nickLower !== nickLower) {
      tx.delete(doc(db, 'nicks', previous.nickLower));
    }
    if (!nickSnap.exists()) tx.set(nickRef, { uid: user.uid });
    tx.set(playerRef, {
      nick,
      nickLower,
      createdAt: previous ? previous.createdAt : serverTimestamp(),
    });
  });

  const snap = await getDoc(playerRef);
  player = snap.data();
}

document.getElementById('nick-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const nick = nickInput.value.trim();

  if (!NICK_PATTERN.test(nick)) {
    setNickError('Use de 3 a 16 caracteres: apenas letras, números e _');
    return;
  }

  nickSubmit.disabled = true;
  try {
    await saveNick(nick);
    editingNick = false;
    location.hash = '#perfil';
    render();
  } catch (error) {
    if (error.code === 'nick-taken') {
      setNickError('Esse nick já está em uso.');
    } else {
      console.error(error);
      setNickError(explainError(error));
    }
  }
  nickSubmit.disabled = false;
});

nickInput.addEventListener('input', () => setNickError(''));

document.getElementById('nick-cancel').addEventListener('click', () => {
  editingNick = false;
  render();
});

document.getElementById('edit-nick').addEventListener('click', () => {
  editingNick = true;
  render();
});

// ============================================================
// TELAS
// ============================================================
function show(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

function fillAvatar(el, nick) {
  el.textContent = '';
  if (user.photoURL) {
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    el.appendChild(img);
  } else {
    el.textContent = (nick || user.displayName || '?').charAt(0).toUpperCase();
  }
}

function render() {
  const chip = document.getElementById('user-chip');

  loginButton.hidden = !authReady || Boolean(user);
  document.getElementById('go-profile').hidden = !player;
  chip.hidden = !player;

  if (player) {
    document.getElementById('chip-nick').textContent = player.nick;
    fillAvatar(document.getElementById('chip-avatar'), player.nick);
  }

  // Logado e sem nick (primeiro acesso), ou alterando o nick.
  if (user && playerLoaded && (!player || editingNick)) {
    document.getElementById('nick-title').textContent = player ? 'Alterar nick' : 'Escolha o seu nick';
    document.getElementById('nick-subtitle').textContent = player
      ? 'Escolha um novo nome de explorador.'
      : 'Bem-vindo! É assim que os outros jogadores vão ver você.';
    document.getElementById('nick-cancel').hidden = !player;
    if (views.nick.hidden) {
      nickInput.value = player ? player.nick : '';
      setNickError('');
    }
    show('nick');
    nickInput.focus();
    return;
  }

  if (player && location.hash === '#perfil') {
    const since = player.createdAt && player.createdAt.toDate ? player.createdAt.toDate() : new Date();
    document.getElementById('profile-nick').textContent = player.nick;
    document.getElementById('profile-name').textContent = user.displayName || '—';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-email-row').hidden = !user.email;
    document.getElementById('profile-since').textContent = since.toLocaleDateString('pt-BR');
    fillAvatar(document.getElementById('profile-avatar'), player.nick);
    show('profile');
    return;
  }

  show('home');
}

window.addEventListener('hashchange', render);
render();

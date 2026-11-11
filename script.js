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
  updateDoc,
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

// Planetas do universo. Para adicionar outro: coloque a imagem na pasta
// Planetas e acrescente uma entrada aqui.
const PLANETS = [
  {
    id: 'terra',
    name: 'Terra',
    image: 'Planetas/Terra.png',
    description: 'O planeta azul. Ponto de partida de todo explorador.',
    facts: [
      ['Tipo', 'Planeta rochoso'],
      ['Atmosfera', 'Respirável'],
      ['Gravidade', '1 g'],
    ],
    // Locais no mapa. x e y são a posição em % (0 a 100) dentro do mapa.
    // O jogador começa no primeiro local da lista.
    places: [
      {
        id: 'nova-aurora',
        name: 'Nova Aurora',
        icon: 'city',
        x: 24,
        y: 40,
        description: 'Metrópole moderna cercada de florestas.',
      },
      {
        id: 'porto-azul',
        name: 'Porto Azul',
        icon: 'city',
        x: 50,
        y: 58,
        description: 'Cidade portuária de arranha-céus à beira-mar.',
      },
      {
        id: 'vale-central',
        name: 'Vale Central',
        icon: 'city',
        x: 86,
        y: 60,
        description: 'Centro financeiro no vale ao lado das montanhas.',
      },
      {
        id: 'mina-de-cobre',
        name: 'Mina de cobre',
        icon: 'mine',
        x: 68,
        y: 36,
        description: 'Uma mina aberta no pé da montanha. Produz cobre.',
      },
    ],
  },
];

// Desenhos dos locais do mapa (SVG).
const PLACE_ICONS = {
  city: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="58" rx="30" ry="5" fill="#000" opacity="0.25"/>
    <rect x="4" y="34" width="12" height="24" fill="#5d6f8f"/>
    <rect x="14" y="20" width="14" height="38" fill="#8fa6c9"/>
    <rect x="26" y="6" width="13" height="52" fill="#b9cdea"/>
    <rect x="31" y="1" width="3" height="6" fill="#b9cdea"/>
    <rect x="37" y="26" width="13" height="32" fill="#7389ad"/>
    <rect x="48" y="38" width="12" height="20" fill="#5d6f8f"/>
    <g fill="#ffe9a3">
      <rect x="17" y="24" width="3" height="3"/><rect x="22" y="24" width="3" height="3"/>
      <rect x="17" y="32" width="3" height="3"/><rect x="22" y="40" width="3" height="3"/>
      <rect x="29" y="11" width="3" height="3"/><rect x="34" y="11" width="3" height="3"/>
      <rect x="29" y="20" width="3" height="3"/><rect x="34" y="29" width="3" height="3"/>
      <rect x="29" y="38" width="3" height="3"/><rect x="34" y="47" width="3" height="3"/>
      <rect x="40" y="31" width="3" height="3"/><rect x="45" y="39" width="3" height="3"/>
      <rect x="7" y="39" width="3" height="3"/><rect x="52" y="43" width="3" height="3"/>
    </g>
  </svg>`,
  mine: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M4 54 Q8 22 32 16 Q56 22 60 54 Z" fill="#5c5349"/>
    <path d="M10 54 Q14 30 32 24 Q50 30 54 54 Z" fill="#6f655a"/>
    <path d="M22 54 V38 Q32 28 42 38 V54 Z" fill="#14100c"/>
    <path d="M20 54 V36 H44 V54" fill="none" stroke="#8a5a2b" stroke-width="4" stroke-linejoin="round"/>
    <rect x="18" y="33" width="28" height="5" rx="1" fill="#a06a34"/>
    <circle cx="12" cy="55" r="5" fill="#c8732e"/>
    <circle cx="19" cy="57" r="4" fill="#e08a3c"/>
    <circle cx="50" cy="56" r="5" fill="#c8732e"/>
    <circle cx="44" cy="58" r="3" fill="#f0a050"/>
  </svg>`,
};

const views = {
  home: document.getElementById('view-home'),
  nick: document.getElementById('view-nick'),
  profile: document.getElementById('view-profile'),
  universe: document.getElementById('view-universe'),
  planet: document.getElementById('view-planet'),
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
    if (player && (location.hash === '' || location.hash === '#home')) location.hash = '#local';
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
      ...previous, // mantém o resto do perfil (país etc.) ao trocar de nick
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
  const firstTime = !player;
  try {
    await saveNick(nick);
    editingNick = false;
    location.hash = firstTime ? '#local' : '#perfil';
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
function setCurrent(link, isCurrent) {
  if (isCurrent) link.setAttribute('aria-current', 'page');
  else link.removeAttribute('aria-current');
}

function show(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  setCurrent(document.getElementById('nav-home'), name === 'home');
  setCurrent(document.getElementById('nav-local'), name === 'planet');
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

function buildUniverse() {
  const grid = document.getElementById('planet-grid');
  for (const planet of PLANETS) {
    const item = document.createElement('li');
    const card = document.createElement('a');
    card.className = 'planet-card';
    card.href = `#planeta/${planet.id}`;

    const frame = document.createElement('span');
    frame.className = 'planet';
    const img = document.createElement('img');
    img.src = planet.image;
    img.alt = '';
    frame.appendChild(img);

    const name = document.createElement('strong');
    name.textContent = planet.name;

    const enter = document.createElement('span');
    enter.className = 'btn btn-primary';
    enter.textContent = 'Entrar';

    card.append(frame, name, enter);
    item.appendChild(card);
    grid.appendChild(item);
  }
}

// Coloca os locais do planeta no mapa. Clicar em um mostra os detalhes
// no painel da esquerda.
// Planeta onde o jogador está. Todo jogador começa na Terra (primeiro da lista)
// e, por enquanto, não tem como sair de lá.
function currentPlanet() {
  const saved = player && player.location;
  return PLANETS.find((p) => saved && p.id === saved.planet) || PLANETS[0];
}

// Onde o jogador está neste planeta (salvo em players/{uid}.location).
function playerPlace(planet) {
  const saved = player && player.location;
  const id = saved && saved.planet === planet.id ? saved.place : null;
  return planet.places.find((p) => p.id === id) || planet.places[0];
}

function movePlayerMarker(place) {
  const marker = document.getElementById('map-player');
  marker.style.left = `${place.x}%`;
  marker.style.top = `${place.y}%`;
}

function showPlaceDetails(planet, place) {
  const details = document.getElementById('place-details');
  const title = document.createElement('strong');
  const text = document.createElement('p');
  title.textContent = place.name;
  text.textContent = place.description;

  if (playerPlace(planet).id === place.id) {
    const here = document.createElement('p');
    here.className = 'here';
    here.textContent = 'Você está aqui.';
    details.replaceChildren(title, text, here);
    return;
  }

  const travel = document.createElement('button');
  travel.type = 'button';
  travel.className = 'btn btn-primary';
  travel.textContent = 'Viajar para cá';
  travel.addEventListener('click', () => travelTo(planet, place));
  details.replaceChildren(title, text, travel);
}

async function travelTo(planet, place) {
  player = { ...player, location: { planet: planet.id, place: place.id } };
  movePlayerMarker(place);
  showPlaceDetails(planet, place);
  try {
    await updateDoc(doc(db, 'players', user.uid), { location: player.location });
  } catch (error) {
    console.error(error); // o jogador anda mesmo assim; só não fica salvo
  }
}

function buildMapPlaces(planet) {
  const container = document.getElementById('map-places');
  movePlayerMarker(playerPlace(planet));
  if (container.dataset.planet === planet.id) return; // já montado
  container.dataset.planet = planet.id;
  container.textContent = '';

  for (const place of planet.places) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-place';
    button.style.left = `${place.x}%`;
    button.style.top = `${place.y}%`;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = PLACE_ICONS[place.icon] || '';

    const label = document.createElement('span');
    label.className = 'map-place-label';
    label.textContent = place.name;
    button.appendChild(label);

    button.addEventListener('click', () => {
      for (const other of container.children) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      showPlaceDetails(planet, place);
    });

    container.appendChild(button);
  }
}

// Página do planeta. showJobs = true mostra a página Trabalhos dele.
function fillPlanet(planet, showJobs) {
  const image = document.getElementById('planet-image');
  if (image.getAttribute('src') !== planet.image) image.src = planet.image;
  image.alt = `Planeta ${planet.name}`;

  document.getElementById('planet-name').textContent = planet.name;
  document.getElementById('planet-description').textContent = planet.description;

  const facts = document.getElementById('planet-facts');
  facts.textContent = '';
  for (const [label, value] of planet.facts) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    facts.appendChild(row);
  }

  buildMapPlaces(planet);

  const back = document.getElementById('jobs-back');
  back.textContent = `← ${planet.name}`;
  document.getElementById('jobs-planet').textContent = planet.name;

  document.getElementById('planet-info').hidden = showJobs;
  document.getElementById('planet-jobs').hidden = !showJobs;
}

function render() {
  const chip = document.getElementById('user-chip');
  const hash = location.hash;
  // #local e #local/trabalhos. Os endereços antigos (#universo, #planeta/...)
  // também caem no local do jogador: o universo está fechado por enquanto.
  const gameRoute =
    hash.startsWith('#local') || hash === '#universo' || hash.startsWith('#planeta/');

  loginButton.hidden = !authReady || Boolean(user);
  document.getElementById('go-local').hidden = !player;
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
    const planet = currentPlanet();
    document.getElementById('profile-location').textContent =
      `${playerPlace(planet).name}, ${planet.name}`;
    document.getElementById('profile-nick').textContent = player.nick;
    document.getElementById('profile-name').textContent = user.displayName || '—';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-email-row').hidden = !user.email;
    document.getElementById('profile-since').textContent = since.toLocaleDateString('pt-BR');
    fillAvatar(document.getElementById('profile-avatar'), player.nick);
    show('profile');
    return;
  }

  if (player && gameRoute) {
    fillPlanet(currentPlanet(), hash.endsWith('/trabalhos'));
    show('planet');
    return;
  }

  // O universo é só para quem já entrou com a conta.
  if (gameRoute && authReady && !user) {
    setStatus('Entre com sua conta para jogar.');
  }

  show('home');
}

buildUniverse();
window.addEventListener('hashchange', render);
render();

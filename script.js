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
  // enquanto o jogador arrasta o mapa, as estrelas do fundo ficam paradas
  if (!pan.active) {
    update(dt);
    draw();
  }
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
    // Locais no mapa. O desenho vem do mapa.js (window.UL_MAPS.terra), então
    // x e y (em pixels do mapa) precisam bater com as posições de lá.
    // w e h = tamanho da área clicável; markerDy = altura do marcador "Você".
    // O jogador começa no primeiro local da lista (Nova Aurora).
    places: [
      {
        id: 'nova-aurora',
        name: 'Nova Aurora',
        x: 520,
        y: 480,
        w: 460,
        h: 230,
        markerDy: 95,
        description: 'Vila futurista acabada no meio do deserto. Cúpulas remendadas, sucata e poeira.',
      },
      {
        id: 'porto-azul',
        name: 'Porto Azul',
        x: 1900,
        y: 1280,
        w: 450,
        h: 230,
        markerDy: 240,
        description: 'Porto futurista de torres de vidro e néon à beira-mar.',
      },
      {
        id: 'vale-central',
        name: 'Vale Central',
        x: 2720,
        y: 900,
        w: 560,
        h: 285,
        markerDy: 280,
        description: 'Centro financeiro futurista, a maior cidade do planeta.',
      },
      {
        id: 'mina-de-cobre',
        name: 'Mina de cobre',
        x: 980,
        y: 420,
        w: 290,
        h: 150,
        markerDy: 110,
        description: 'Mina pequena com perfuratriz a laser, perto de Nova Aurora. Produz cobre.',
      },
    ],
  },
];

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
  marker.style.left = `${place.x}px`;
  marker.style.top = `${place.y}px`;
  marker.style.setProperty('--dy', `${place.markerDy}px`);
}

// ---------- arrastar o mapa com o botão esquerdo do mouse (ou o dedo) ----------
const mapView = document.getElementById('planet-map');
const mapInner = document.getElementById('map-inner');
const pan = { x: 0, y: 0, startX: 0, startY: 0, originX: 0, originY: 0, active: false, moved: false };

// O mapa inteiro vira uma imagem só (canvas). Arrastar apenas desloca essa
// imagem pela placa de vídeo, no máximo uma vez por quadro: é isso que deixa leve.
let panFrame = 0;

function setPan(x, y) {
  const minX = Math.min(0, mapView.clientWidth - mapInner.offsetWidth);
  const minY = Math.min(0, mapView.clientHeight - mapInner.offsetHeight);
  pan.x = Math.round(Math.max(minX, Math.min(0, x)));
  pan.y = Math.round(Math.max(minY, Math.min(0, y)));
  if (panFrame) return;
  panFrame = requestAnimationFrame(() => {
    panFrame = 0;
    mapInner.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0)`;
  });
}

function drawMapArt(map) {
  const canvas = document.getElementById('map-art');
  canvas.width = map.width;
  canvas.height = map.height;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([map.svg], { type: 'image/svg+xml' }));
  image.onload = () => {
    canvas.getContext('2d').drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

function centerMapOn(place) {
  // sobe um pouco o centro para o marcador "Você" não ficar cortado no topo
  setPan(mapView.clientWidth / 2 - place.x, mapView.clientHeight / 2 - (place.y - place.markerDy / 2));
}

mapView.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  pan.active = true;
  pan.moved = false;
  pan.startX = event.clientX;
  pan.startY = event.clientY;
  pan.originX = pan.x;
  pan.originY = pan.y;
});

mapView.addEventListener('pointermove', (event) => {
  if (!pan.active) return;
  const dx = event.clientX - pan.startX;
  const dy = event.clientY - pan.startY;
  if (!pan.moved) {
    if (Math.hypot(dx, dy) < 5) return; // ainda é um clique, não um arrasto
    pan.moved = true;
    mapView.setPointerCapture(event.pointerId);
    mapView.classList.add('dragging');
  }
  setPan(pan.originX + dx, pan.originY + dy);
});

function endPan() {
  pan.active = false;
  mapView.classList.remove('dragging');
}
mapView.addEventListener('pointerup', endPan);
mapView.addEventListener('pointercancel', endPan);

// Soltar depois de arrastar não conta como clique em um local.
mapView.addEventListener(
  'click',
  (event) => {
    if (!pan.moved) return;
    pan.moved = false;
    event.stopPropagation();
    event.preventDefault();
  },
  true
);

window.addEventListener('resize', () => setPan(pan.x, pan.y));

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

  // Desenho do mapa (gerado pelo mapa.js) e tamanho da área arrastável.
  const map = window.UL_MAPS[planet.id];
  mapInner.style.width = `${map.width}px`;
  mapInner.style.height = `${map.height}px`;
  drawMapArt(map);
  centerMapOn(playerPlace(planet));

  for (const place of planet.places) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-place';
    button.style.left = `${place.x}px`;
    button.style.top = `${place.y}px`;
    button.style.width = `${place.w}px`;
    button.style.height = `${place.h}px`;
    button.setAttribute('aria-pressed', 'false');

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
    show('planet'); // antes de preencher: o mapa precisa estar visível para centralizar
    fillPlanet(currentPlanet(), hash.endsWith('/trabalhos'));
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

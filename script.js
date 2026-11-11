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
// REGRAS DO JOGO — os números para ajustar ficam todos aqui
// ============================================================
const SHIFT_MINUTES = 30; // duração de um turno de trabalho
const PAY_MIN = 30; // créditos por turno: sorteado entre PAY_MIN e PAY_MAX
const PAY_MAX = 57;
const XP_PER_SHIFT = 10; // XP da conta por turno
const SKILL_XP_PER_SHIFT = 8; // XP da habilidade do trabalho por turno
const DROP_CHANCE = 0.1; // 10% de chance para CADA item, sorteado separadamente
const LEVEL_BASE = 100; // XP do nível 1 para o 2 (depois cresce a cada nível)
const SKILL_BASE = 80;

const SHIFT_MS = SHIFT_MINUTES * 60 * 1000;

// Itens que podem ser achados e vendidos no mercado (price = créditos por unidade).
const ITEMS = {
  'minerio-cobre': { name: 'Minério de cobre', price: 12 },
  'celular-quebrado': { name: 'Celular quebrado', price: 18 },
  'sucata-drone': { name: 'Sucata de drone', price: 15 },
  'chip-antigo': { name: 'Chip antigo', price: 20 },
  'cristal-trincado': { name: 'Cristal de energia trincado', price: 26 },
  'resto-maconha': { name: 'Resto de maconha', price: 22 },
  'folhas-maconha': { name: 'Folhas de maconha', price: 14 },
  'isqueiro-plasma': { name: 'Isqueiro de plasma', price: 10 },
  'comunicador-clonado': { name: 'Comunicador clonado', price: 24 },
  'pacote-suspeito': { name: 'Pacote lacrado suspeito', price: 30 },
};

// Trabalhos. skill = chave da habilidade em players/{uid}.skills.
// bonusCredits = [mín, máx] de um dinheiro extra com a mesma chance dos itens.
const JOBS = [
  {
    id: 'miner',
    skill: 'miner',
    title: 'Minerador',
    employer: 'Cobre Profundo S.A.',
    color: 'amber',
    description:
      'Opere uma perfuratriz a laser nos túneis de cobre sob Nova Aurora. Trabalho pesado, pagamento certo.',
    drops: ['minerio-cobre', 'celular-quebrado', 'sucata-drone', 'chip-antigo', 'cristal-trincado'],
    bonusCredits: null,
  },
  {
    id: 'dealer',
    skill: 'dealer',
    title: 'Traficante',
    employer: 'Sindicato da Névoa',
    color: 'pink',
    description:
      'Faça entregas discretas pelos becos e docas da cidade. Ninguém pergunta nada, e às vezes sobra algo para você.',
    drops: ['resto-maconha', 'folhas-maconha', 'isqueiro-plasma', 'comunicador-clonado', 'pacote-suspeito'],
    bonusCredits: [10, 25],
  },
];

const SKILLS = JOBS.map((job) => ({ id: job.skill, name: job.title, color: job.color }));

// ============================================================
// FUNDO DE ESTRELAS
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let stars = [];

function createStars() {
  const count = Math.round((canvas.width * canvas.height) / 7000);
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.6 + 0.3,
    speed: Math.random() * 10 + 2,
    alpha: Math.random() * 0.7 + 0.3,
  }));
}

function drawStars() {
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    ctx.globalAlpha = s.alpha;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function resizeStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  createStars();
  drawStars();
}

let lastTime = 0;

function starLoop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  for (const s of stars) {
    s.x -= s.speed * dt;
    if (s.x < -2) {
      s.x = canvas.width + 2;
      s.y = Math.random() * canvas.height;
    }
  }
  drawStars();
  requestAnimationFrame(starLoop);
}

window.addEventListener('resize', resizeStars);
resizeStars();
if (!reduceMotion) requestAnimationFrame(starLoop);

// ============================================================
// ESTADO
// Firestore:
//   players/{uid}      -> { nick, nickLower, createdAt, credits, bank, xp,
//                           skills: { miner, dealer }, items: { id: qtd },
//                           job: { id, startedAt, endsAt } | null, shifts }
//   nicks/{nickLower}  -> { uid }   (garante nick único)
// ============================================================
const NICK_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const PAGES = ['cidade', 'trabalhos', 'mercado', 'banco', 'perfil'];

let authReady = false; // já sabemos se há alguém logado?
let user = null; // usuário do Firebase Auth
let player = null; // documento players/{uid}, já com os valores padrão
let playerLoaded = false;
let editingNick = false;
let busy = false; // evita clique duplo enquanto salva
let lastResult = null; // resumo do último turno coletado
let jobWasDone = false;

const $ = (id) => document.getElementById(id);
const loginButton = $('google-login');
const statusEl = $('status');
const nickInput = $('nick-input');
const nickHint = $('nick-hint');
const nickSubmit = document.querySelector('#nick-form button[type="submit"]');
const NICK_HINT_DEFAULT = nickHint.textContent;

const num = (value) => (Number.isFinite(value) ? value : 0);
const fmt = (value) => Math.floor(value).toLocaleString('pt-BR');
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const esc = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Preenche o que faltar no documento do jogador (contas antigas, jogador novo).
function normalizePlayer(data) {
  const skills = {};
  for (const skill of SKILLS) skills[skill.id] = num(data.skills && data.skills[skill.id]);
  const items = {};
  for (const id of Object.keys(ITEMS)) {
    const amount = num(data.items && data.items[id]);
    if (amount > 0) items[id] = amount;
  }
  const job = data.job && JOBS.some((j) => j.id === data.job.id) && num(data.job.endsAt) ? data.job : null;
  return {
    nick: data.nick,
    nickLower: data.nickLower,
    createdAt: data.createdAt,
    credits: num(data.credits),
    bank: num(data.bank),
    xp: num(data.xp),
    skills,
    items,
    job,
    shifts: num(data.shifts),
  };
}

// Nível infinito: cada nível pede mais XP que o anterior.
function levelInfo(totalXp, base) {
  const needFor = (level) => Math.floor(base * Math.pow(level, 1.5));
  let level = 1;
  let current = totalXp;
  while (current >= needFor(level)) {
    current -= needFor(level);
    level += 1;
  }
  return { level, current, needed: needFor(level) };
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function setNickError(message) {
  nickHint.textContent = message || NICK_HINT_DEFAULT;
  nickHint.classList.toggle('error', Boolean(message));
}

let toastTimer = 0;
function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
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

// Grava uma alteração no jogador. Só muda na tela se o servidor aceitar.
async function savePlayer(patch) {
  if (busy) return false;
  busy = true;
  try {
    await updateDoc(doc(db, 'players', user.uid), patch);
    player = { ...player, ...patch };
    return true;
  } catch (error) {
    console.error(error);
    toast(explainError(error), true);
    return false;
  } finally {
    busy = false;
    render();
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
    player = snap.exists() ? normalizePlayer(snap.data()) : null;
    playerLoaded = true;
    setStatus('');
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
  lastResult = null;
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
      ...previous, // mantém créditos, XP, itens etc. ao trocar de nick
      nick,
      nickLower,
      createdAt: previous ? previous.createdAt : serverTimestamp(),
    });
  });

  const snap = await getDoc(playerRef);
  player = normalizePlayer(snap.data());
}

$('nick-form').addEventListener('submit', async (event) => {
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
    location.hash = firstTime ? '#cidade' : '#perfil';
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

$('nick-cancel').addEventListener('click', () => {
  editingNick = false;
  render();
});

// ============================================================
// AÇÕES DO JOGO
// ============================================================
const jobOf = (id) => JOBS.find((job) => job.id === id);
const jobDone = () => Boolean(player && player.job && Date.now() >= player.job.endsAt);

async function startJob(jobId) {
  if (player.job || !jobOf(jobId)) return;
  const now = Date.now();
  lastResult = null;
  if (await savePlayer({ job: { id: jobId, startedAt: now, endsAt: now + SHIFT_MS } })) {
    toast(`Turno iniciado: ${jobOf(jobId).title}. Volte em ${SHIFT_MINUTES} minutos.`);
  }
}

async function quitJob() {
  if (!player.job || jobDone()) return;
  if (await savePlayer({ job: null })) toast('Você abandonou o turno e não recebeu nada.');
}

// Fim do turno: sorteia o pagamento e os itens e soma o XP.
async function collectJob() {
  if (!jobDone()) return;
  const job = jobOf(player.job.id);
  const pay = randInt(PAY_MIN, PAY_MAX);
  const bonus = job.bonusCredits && Math.random() < DROP_CHANCE ? randInt(...job.bonusCredits) : 0;

  const items = { ...player.items };
  const found = [];
  for (const id of job.drops) {
    if (Math.random() < DROP_CHANCE) {
      items[id] = (items[id] || 0) + 1;
      found.push(id);
    }
  }

  const skills = { ...player.skills, [job.skill]: player.skills[job.skill] + SKILL_XP_PER_SHIFT };
  const levelBefore = levelInfo(player.xp, LEVEL_BASE).level;
  const skillBefore = levelInfo(player.skills[job.skill], SKILL_BASE).level;
  const xp = player.xp + XP_PER_SHIFT;

  const saved = await savePlayer({
    credits: player.credits + pay + bonus,
    xp,
    skills,
    items,
    job: null,
    shifts: player.shifts + 1,
  });
  if (!saved) return;

  const levelAfter = levelInfo(xp, LEVEL_BASE).level;
  const skillAfter = levelInfo(skills[job.skill], SKILL_BASE).level;
  lastResult = {
    job,
    pay,
    bonus,
    found,
    levelUp: levelAfter > levelBefore ? levelAfter : 0,
    skillUp: skillAfter > skillBefore ? skillAfter : 0,
  };
  render();
}

async function sellItem(id, all) {
  const have = player.items[id] || 0;
  if (!have || !ITEMS[id]) return;
  const amount = all ? have : 1;
  const items = { ...player.items };
  if (have - amount > 0) items[id] = have - amount;
  else delete items[id];
  const earned = amount * ITEMS[id].price;
  if (await savePlayer({ items, credits: player.credits + earned })) {
    toast(`Vendido: ${amount}× ${ITEMS[id].name} por ${fmt(earned)} créditos.`);
  }
}

async function sellEverything() {
  let earned = 0;
  for (const [id, amount] of Object.entries(player.items)) earned += amount * ITEMS[id].price;
  if (!earned) return;
  if (await savePlayer({ items: {}, credits: player.credits + earned })) {
    toast(`Tudo vendido por ${fmt(earned)} créditos.`);
  }
}

// kind: 'deposit' ou 'withdraw'. amount = 'all' usa tudo o que houver.
async function moveMoney(kind, amount) {
  const from = kind === 'deposit' ? player.credits : player.bank;
  const value = amount === 'all' ? from : Math.floor(Number($('bank-amount').value));
  if (!Number.isFinite(value) || value <= 0) {
    toast('Digite um valor maior que zero.', true);
    return;
  }
  if (value > from) {
    toast(kind === 'deposit' ? 'Você não tem tantos créditos na carteira.' : 'Você não tem tanto saldo no banco.', true);
    return;
  }
  const sign = kind === 'deposit' ? 1 : -1;
  if (await savePlayer({ credits: player.credits - sign * value, bank: player.bank + sign * value })) {
    toast(kind === 'deposit' ? `Depositado: ${fmt(value)} créditos.` : `Sacado: ${fmt(value)} créditos.`);
  }
}

const ACTIONS = {
  'start-job': (data) => startJob(data.job),
  'quit-job': () => quitJob(),
  'collect-job': () => collectJob(),
  'sell-one': (data) => sellItem(data.item, false),
  'sell-all': (data) => sellItem(data.item, true),
  'sell-everything': () => sellEverything(),
  deposit: () => moveMoney('deposit'),
  withdraw: () => moveMoney('withdraw'),
  'deposit-all': () => moveMoney('deposit', 'all'),
  'withdraw-all': () => moveMoney('withdraw', 'all'),
  'edit-nick': () => {
    editingNick = true;
    render();
  },
  logout: async () => {
    await signOut(auth);
    location.hash = '#home';
  },
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled || !player) return;
  const action = ACTIONS[button.dataset.action];
  if (action) action(button.dataset);
});

// ============================================================
// PEDAÇOS DE TELA
// ============================================================
// Barra com título à esquerda e números à direita.
function meter(label, info, color = '') {
  const pct = Math.min(100, (info.current / info.needed) * 100);
  return (
    `<div class="meter-top"><strong>${esc(label)}</strong><span>${fmt(info.current)} / ${fmt(info.needed)} XP</span></div>` +
    `<div class="bar ${color}"><span style="width:${pct.toFixed(1)}%"></span></div>`
  );
}

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function jobProgress() {
  const { startedAt, endsAt } = player.job;
  const pct = Math.min(100, Math.max(0, ((Date.now() - startedAt) / (endsAt - startedAt)) * 100));
  return { pct, left: endsAt - Date.now() };
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

function renderSide(page) {
  const level = levelInfo(player.xp, LEVEL_BASE);
  $('side-nick').textContent = player.nick;
  fillAvatar($('side-avatar'), player.nick);
  $('side-level').innerHTML = meter(`Nível ${level.level}`, level);

  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const box = $('side-job');
  if (!player.job) {
    box.innerHTML = '<h3>Turno atual</h3><p>Você está sem trabalho.</p><a class="btn" href="#trabalhos">Ver trabalhos</a>';
  } else if (jobDone()) {
    box.innerHTML =
      `<h3>Turno atual</h3><p>${esc(jobOf(player.job.id).title)}: turno concluído.</p>` +
      '<button class="btn btn-amber" type="button" data-action="collect-job">Receber pagamento</button>';
  } else {
    const { pct, left } = jobProgress();
    box.innerHTML =
      `<h3>Turno atual</h3>` +
      `<div class="meter-top"><strong>${esc(jobOf(player.job.id).title)}</strong><span data-job-time>${clock(left)}</span></div>` +
      `<div class="bar amber"><span data-job-bar style="width:${pct.toFixed(1)}%"></span></div>`;
  }
}

// ---------- páginas ----------
function pageCidade() {
  const working = player.job
    ? jobDone()
      ? 'Seu turno acabou. Passe em Trabalhos para receber.'
      : `Você está em turno como ${jobOf(player.job.id).title.toLowerCase()}.`
    : 'Você está sem trabalho. Pegue um turno para começar a ganhar.';
  return (
    '<div class="page-head"><p class="eyebrow">Terra · Setor desértico</p><h1>Nova Aurora</h1>' +
    '<p>Uma cidade de fronteira esquecida pelo resto do planeta: cúpulas remendadas, néon falhando e poeira em tudo. ' +
    'Ninguém fica aqui por gosto. Todo mundo está juntando créditos para ir embora.</p></div>' +
    `<div class="panel"><p>${esc(working)}</p></div>` +
    '<div class="grid">' +
    '<a class="panel card" href="#trabalhos"><span class="tag">Serviço</span><h2>Trabalhos</h2>' +
    `<p>Escolha um serviço e cumpra turnos de ${SHIFT_MINUTES} minutos para ganhar créditos e XP.</p></a>` +
    '<a class="panel card" href="#mercado"><span class="tag">Comércio</span><h2>Mercado</h2>' +
    '<p>Venda o que você encontrar durante os turnos.</p></a>' +
    '<a class="panel card" href="#banco"><span class="tag">Finanças</span><h2>Banco</h2>' +
    '<p>Guarde seus créditos em uma conta separada da carteira.</p></a>' +
    '</div>'
  );
}

function resultPanel() {
  if (!lastResult) return '';
  const r = lastResult;
  const lines = [`${fmt(r.pay)} créditos de pagamento`];
  if (r.bonus) lines.push(`${fmt(r.bonus)} créditos por fora`);
  lines.push(`${XP_PER_SHIFT} XP de conta`, `${SKILL_XP_PER_SHIFT} XP de ${r.job.title}`);
  for (const id of r.found) lines.push(`1× ${ITEMS[id].name}`);
  let ups = '';
  if (r.levelUp) ups += `<p class="levelup">Você subiu para o nível ${r.levelUp}!</p>`;
  if (r.skillUp) ups += `<p class="levelup">${esc(r.job.title)} subiu para o nível ${r.skillUp}!</p>`;
  return (
    '<div class="panel result"><span class="eyebrow">Turno concluído</span>' +
    `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>${ups}` +
    (r.found.length ? '' : '<p class="note" style="margin-top:10px">Você não achou nenhum item desta vez.</p>') +
    '</div>'
  );
}

function pageTrabalhos() {
  let html =
    '<div class="page-head"><p class="eyebrow">Nova Aurora</p><h1>Trabalhos</h1>' +
    `<p>Um turno dura ${SHIFT_MINUTES} minutos. Você pode fechar o jogo e voltar depois: o tempo continua contando.</p></div>`;

  if (player.job) {
    const job = jobOf(player.job.id);
    if (jobDone()) {
      html +=
        '<div class="panel shift done"><span class="eyebrow">Turno concluído</span>' +
        `<h2>${esc(job.title)} · ${esc(job.employer)}</h2><p class="clock">00:00</p>` +
        '<div class="bar big green"><span style="width:100%"></span></div>' +
        '<div class="row"><button class="btn btn-amber" type="button" data-action="collect-job">Receber pagamento</button></div></div>';
    } else {
      const { pct, left } = jobProgress();
      html +=
        '<div class="panel shift"><span class="eyebrow">Em turno</span>' +
        `<h2>${esc(job.title)} · ${esc(job.employer)}</h2><p class="clock" data-job-time>${clock(left)}</p>` +
        `<div class="bar big amber"><span data-job-bar style="width:${pct.toFixed(1)}%"></span></div>` +
        '<div class="row"><button class="btn btn-quiet" type="button" data-action="quit-job">Abandonar turno (sem pagamento)</button></div></div>';
    }
  } else {
    html += resultPanel();
  }

  html += '<div class="grid">';
  for (const job of JOBS) {
    const skill = levelInfo(player.skills[job.skill], SKILL_BASE);
    const finds = job.drops.map((id) => ITEMS[id].name).join(', ');
    html +=
      `<div class="panel card"><span class="tag">${esc(job.employer)}</span><h2>${esc(job.title)}</h2>` +
      `<p>${esc(job.description)}</p>` +
      '<dl class="facts">' +
      `<div><dt>Duração</dt><dd>${SHIFT_MINUTES} min</dd></div>` +
      `<div><dt>Pagamento</dt><dd>${PAY_MIN} a ${PAY_MAX} créditos</dd></div>` +
      `<div><dt>XP</dt><dd>+${XP_PER_SHIFT} conta · +${SKILL_XP_PER_SHIFT} ${esc(job.title)}</dd></div>` +
      `<div><dt>Sua habilidade</dt><dd>nível ${skill.level}</dd></div>` +
      '</dl>' +
      `<div class="finds"><strong>Chance de achar (${DROP_CHANCE * 100}% cada)</strong>${esc(finds)}` +
      (job.bonusCredits ? `, ou ${job.bonusCredits[0]} a ${job.bonusCredits[1]} créditos por fora` : '') +
      '.</div>' +
      `<button class="btn btn-primary" type="button" data-action="start-job" data-job="${job.id}"${player.job ? ' disabled' : ''}>` +
      `${player.job ? 'Você já está em um turno' : 'Começar turno'}</button></div>`;
  }
  return html + '</div>';
}

function pageMercado() {
  const entries = Object.entries(player.items);
  let html =
    '<div class="page-head"><p class="eyebrow">Nova Aurora</p><h1>Mercado</h1>' +
    '<p>Os comerciantes da feira compram qualquer coisa, sem perguntar de onde veio.</p></div>';
  if (!entries.length) {
    return html + '<div class="empty">Você não tem itens para vender. Eles aparecem, com sorte, ao final dos turnos.</div>';
  }
  let total = 0;
  let rows = '';
  for (const [id, amount] of entries) {
    const item = ITEMS[id];
    total += amount * item.price;
    rows +=
      `<tr><td>${esc(item.name)}</td><td class="num">${fmt(amount)}</td><td class="num">${fmt(item.price)}</td>` +
      `<td class="num">${fmt(amount * item.price)}</td><td class="actions">` +
      `<button class="btn btn-small" type="button" data-action="sell-one" data-item="${id}">Vender 1</button>` +
      `<button class="btn btn-small" type="button" data-action="sell-all" data-item="${id}">Vender tudo</button></td></tr>`;
  }
  return (
    html +
    '<div class="panel"><div class="table-wrap"><table><thead><tr><th>Item</th><th class="num">Qtd.</th>' +
    '<th class="num">Preço</th><th class="num">Total</th><th></th></tr></thead>' +
    `<tbody>${rows}</tbody></table></div>` +
    `<div class="row"><button class="btn btn-amber" type="button" data-action="sell-everything">Vender tudo por ${fmt(total)} créditos</button></div></div>`
  );
}

function pageBanco() {
  return (
    '<div class="page-head"><p class="eyebrow">Nova Aurora</p><h1>Banco</h1>' +
    '<p>O Banco Orbital guarda seus créditos em uma conta separada da carteira. Depositar e sacar não tem taxa.</p></div>' +
    '<div class="panel"><div class="balances">' +
    `<div class="balance"><span>Na carteira</span><strong>${fmt(player.credits)}</strong></div>` +
    `<div class="balance bank"><span>No banco</span><strong>${fmt(player.bank)}</strong></div></div>` +
    '<label for="bank-amount">Valor</label>' +
    '<input id="bank-amount" type="number" min="1" step="1" inputmode="numeric" placeholder="0">' +
    '<div class="row">' +
    '<button class="btn btn-primary" type="button" data-action="deposit">Depositar</button>' +
    '<button class="btn" type="button" data-action="withdraw">Sacar</button>' +
    '<button class="btn btn-quiet" type="button" data-action="deposit-all">Depositar tudo</button>' +
    '<button class="btn btn-quiet" type="button" data-action="withdraw-all">Sacar tudo</button>' +
    '</div></div>'
  );
}

function pagePerfil() {
  const level = levelInfo(player.xp, LEVEL_BASE);
  const since = player.createdAt && player.createdAt.toDate ? player.createdAt.toDate() : new Date();
  let skills = '';
  for (const skill of SKILLS) {
    const info = levelInfo(player.skills[skill.id], SKILL_BASE);
    skills += `<div>${meter(`${skill.name} · nível ${info.level}`, info, skill.color)}</div>`;
  }
  return (
    '<div class="panel"><div class="profile-head"><span class="avatar avatar-lg" id="profile-avatar"></span>' +
    `<div><p class="eyebrow">Explorador</p><h1>${esc(player.nick)}</h1><p>Nova Aurora · Terra</p></div></div>` +
    `<div class="meters"><div>${meter(`Nível ${level.level}`, level)}</div></div></div>` +
    `<div class="panel"><span class="eyebrow">Habilidades</span><div class="meters">${skills}</div></div>` +
    '<div class="panel"><span class="eyebrow">Conta</span><dl class="facts">' +
    `<div><dt>Nome</dt><dd>${esc(user.displayName || '—')}</dd></div>` +
    (user.email ? `<div><dt>E-mail</dt><dd>${esc(user.email)}</dd></div>` : '') +
    `<div><dt>Turnos concluídos</dt><dd>${fmt(player.shifts)}</dd></div>` +
    `<div><dt>Créditos (carteira + banco)</dt><dd>${fmt(player.credits + player.bank)}</dd></div>` +
    `<div><dt>Explorador desde</dt><dd>${since.toLocaleDateString('pt-BR')}</dd></div></dl>` +
    '<div class="row"><button class="btn" type="button" data-action="edit-nick">Alterar nick</button>' +
    '<button class="btn btn-quiet" type="button" data-action="logout">Sair</button></div></div>'
  );
}

const PAGE_RENDERERS = {
  cidade: pageCidade,
  trabalhos: pageTrabalhos,
  mercado: pageMercado,
  banco: pageBanco,
  perfil: pagePerfil,
};

// ============================================================
// TELA
// ============================================================
function show(name) {
  $('view-home').hidden = name !== 'home';
  $('view-nick').hidden = name !== 'nick';
  $('view-game').hidden = name !== 'game';
}

function render() {
  const inGame = Boolean(player);
  loginButton.hidden = !authReady || Boolean(user);
  $('credits-chip').hidden = !inGame;
  $('user-chip').hidden = !inGame;
  $('brand').href = inGame ? '#cidade' : '#home';

  if (inGame) {
    $('credits-value').textContent = fmt(player.credits);
    $('chip-nick').textContent = player.nick;
    fillAvatar($('chip-avatar'), player.nick);
  }

  // Logado e sem nick (primeiro acesso), ou alterando o nick.
  if (user && playerLoaded && (!player || editingNick)) {
    $('nick-title').textContent = player ? 'Alterar nick' : 'Escolha o seu nick';
    $('nick-subtitle').textContent = player
      ? 'Escolha um novo nome de explorador.'
      : 'Bem-vindo à Terra. É assim que os outros jogadores vão ver você.';
    $('nick-cancel').hidden = !player;
    if ($('view-nick').hidden) {
      nickInput.value = player ? player.nick : '';
      setNickError('');
    }
    show('nick');
    nickInput.focus();
    return;
  }

  if (!inGame) {
    if (location.hash.length > 1 && location.hash !== '#home' && authReady && !user) {
      setStatus('Entre com sua conta para jogar.');
    }
    show('home');
    return;
  }

  // Dentro do jogo: qualquer endereço desconhecido cai na cidade.
  const page = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'cidade';
  jobWasDone = jobDone();
  renderSide(page);
  $('content').innerHTML = PAGE_RENDERERS[page]();
  if (page === 'perfil') fillAvatar($('profile-avatar'), player.nick);
  show('game');
}

// Relógio do turno: atualiza só a barra e o tempo, uma vez por segundo.
setInterval(() => {
  if (!player || !player.job || $('view-game').hidden) return;
  if (jobDone()) {
    if (!jobWasDone) render(); // o turno acabou agora: troca para "receber pagamento"
    return;
  }
  const { pct, left } = jobProgress();
  for (const el of document.querySelectorAll('[data-job-time]')) el.textContent = clock(left);
  for (const el of document.querySelectorAll('[data-job-bar]')) el.style.width = `${pct.toFixed(1)}%`;
}, 1000);

window.addEventListener('hashchange', render);
render();

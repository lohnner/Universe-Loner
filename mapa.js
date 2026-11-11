// mapa.js — desenha o mapa dos planetas em SVG, tudo gerado por código.
// Expõe window.UL_MAPS = { terra: { width, height, svg } }.
// O script.js transforma esse SVG numa imagem só (canvas), para arrastar leve.
// As posições das cidades e da mina aqui precisam bater com a lista
// "places" do planeta em script.js.
(function () {
  const W = 3200;
  const H = 2000;

  // Posições (em pixels do mapa)
  const NOVA_AURORA = [520, 480]; // vila futurista acabada, no deserto
  const MINA = [980, 420]; // perto de Nova Aurora
  const PORTO_AZUL = [1900, 1280];
  const VALE_CENTRAL = [2720, 900];

  const CYAN = '#5ff0ff';
  const PINK = '#ff5fd2';
  const AMBER = '#ffb347';

  // ---------- utilidades ----------
  function makeRandom(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = makeRandom(20261111);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const f = (v) => +v.toFixed(1);
  const pts = (list) => list.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  const coastY = (x) => 1560 + 80 * Math.sin(x / 330 + 1) - 150 * Math.exp(-(((x - 1950) / 380) ** 2));
  // O deserto fica à esquerda desta linha.
  const desertEdge = (y) => 1380 + 120 * Math.sin(y / 260) + 60 * Math.sin(y / 97 + 2);
  const isDesert = (x, y) => x < desertEdge(y);

  // Linha luminosa (néon): um traço largo e fraco por baixo de um fino.
  const neon = (d, color, w = 1.6) =>
    `<path d="${d}" stroke="${color}" stroke-opacity="0.22" stroke-width="${w + 5}" fill="none" stroke-linecap="round"/>` +
    `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

  // Caixa isométrica. (x, y) é o canto da frente, no chão.
  function isoBox(x, y, w, d, h, color, o = {}) {
    y -= o.z || 0;
    const F = [x, y];
    const R = [x + w, y - w / 2];
    const L = [x - d, y - d / 2];
    const B = [x + w - d, y - w / 2 - d / 2];
    const up = (p) => [p[0], p[1] - h];
    let s = '';
    if (o.shadow) {
      const k = (o.shadowH || h) * 0.35;
      s += `<polygon points="${pts([F, R, [R[0] + k, R[1] + k / 2], [F[0] + k, F[1] + k / 2]])}" fill="#000" opacity="0.22"/>`;
    }
    s +=
      `<polygon points="${pts([F, L, up(L), up(F)])}" fill="${shade(color, 0.6)}"/>` +
      `<polygon points="${pts([F, R, up(R), up(F)])}" fill="${shade(color, 0.86)}"/>` +
      `<polygon points="${pts([up(F), up(R), up(B), up(L)])}" fill="${shade(color, o.top || 1.2)}"/>`;
    if (o.windows) {
      let d1 = '';
      for (let k = o.windows; k < h - 2; k += o.windows) {
        d1 += `M${f(L[0])} ${f(L[1] - k)}L${f(F[0])} ${f(F[1] - k)}L${f(R[0])} ${f(R[1] - k)}`;
      }
      const colsR = Math.max(2, Math.round(w / 9));
      for (let t = 1; t < colsR; t++) {
        const px = F[0] + (w * t) / colsR;
        const py = F[1] - ((w / 2) * t) / colsR;
        d1 += `M${f(px)} ${f(py)}V${f(py - h)}`;
      }
      const colsL = Math.max(2, Math.round(d / 9));
      for (let t = 1; t < colsL; t++) {
        const px = F[0] - (d * t) / colsL;
        const py = F[1] - ((d / 2) * t) / colsL;
        d1 += `M${f(px)} ${f(py)}V${f(py - h)}`;
      }
      s += `<path d="${d1}" stroke="${o.glass || '#ffffff'}" stroke-opacity="0.32" stroke-width="1" fill="none"/>`;
    }
    return s;
  }

  // Arranha-céu futurista em três andares recuados, com faixas de néon.
  function futureTower(x, y, w, h, color, glow) {
    const h1 = h * 0.58;
    const h2 = h * 0.3;
    const h3 = h * 0.12;
    const w2 = w * 0.72;
    const w3 = w * 0.42;
    const band = (ww, z) => `M${f(x - ww)} ${f(y - z)}L${f(x)} ${f(y + ww / 2 - z)}L${f(x + ww)} ${f(y - z)}`;
    let s =
      isoBox(x, y + w / 2, w, w, h1, color, { windows: 8, glass: glow, shadow: true, shadowH: h }) +
      isoBox(x, y + w2 / 2, w2, w2, h2, color, { z: h1, windows: 8, glass: glow }) +
      isoBox(x, y + w3 / 2, w3, w3, h3, '#c9d6e6', { z: h1 + h2 }) +
      neon(band(w, h1) + band(w2, h1 + h2), glow, 1.5) +
      neon(`M${f(x)} ${f(y + w / 2)}V${f(y + w / 2 - h1)}`, glow, 1.1);
    if (h > 170) {
      s +=
        `<path d="M${f(x)} ${f(y - h)}V${f(y - h - 34)}" stroke="#dfe7f2" stroke-width="2"/>` +
        `<circle cx="${f(x)}" cy="${f(y - h - 36)}" r="7" fill="${glow}" opacity="0.3"/>` +
        `<circle cx="${f(x)}" cy="${f(y - h - 36)}" r="3" fill="${glow}"/>`;
    }
    return s;
  }

  // Torre cilíndrica com anéis luminosos e cúpula.
  function cylTower(x, y, r, h, color, glow) {
    const body = `M${f(x - r)} ${f(y)}V${f(y - h)}A${r} ${r / 2} 0 0 1 ${f(x + r)} ${f(y - h)}V${f(y)}A${r} ${r / 2} 0 0 1 ${f(x - r)} ${f(y)}Z`;
    let rings = '';
    for (let k = 14; k < h - 6; k += 16) rings += `M${f(x - r)} ${f(y - k)}A${r} ${r / 2} 0 0 0 ${f(x + r)} ${f(y - k)}`;
    const k = h * 0.35;
    return (
      `<polygon points="${pts([[x - r, y], [x + r, y], [x + r + k, y + k / 2], [x - r + k, y + k / 2]])}" fill="#000" opacity="0.2"/>` +
      `<path d="${body}" fill="${color}"/>` +
      `<path d="${body}" fill="url(#ul-cyl)"/>` +
      `<path d="${rings}" stroke="${glow}" stroke-opacity="0.7" stroke-width="1.3" fill="none"/>` +
      `<ellipse cx="${f(x)}" cy="${f(y - h)}" rx="${r}" ry="${r / 2}" fill="${shade(color, 1.5)}"/>` +
      `<path d="M${f(x - r * 0.7)} ${f(y - h)}A${f(r * 0.7)} ${f(r * 0.7)} 0 0 1 ${f(x + r * 0.7)} ${f(y - h)}Z" fill="${glow}" opacity="0.55"/>`
    );
  }

  function tree(x, y, s, conifer) {
    const shadow = `<ellipse cx="${f(x + 5 * s)}" cy="${f(y + 2)}" rx="${f(10 * s)}" ry="${f(4 * s)}" fill="#000" opacity="0.22"/>`;
    if (conifer) {
      const c = pick(['#1d4a34', '#235a3c', '#1a4030']);
      return (
        shadow +
        `<rect x="${f(x - 1.5)}" y="${f(y - 5 * s)}" width="3" height="${f(6 * s)}" fill="#3d2a1c"/>` +
        `<polygon points="${pts([[x - 9 * s, y - 4 * s], [x, y - 20 * s], [x + 9 * s, y - 4 * s]])}" fill="${shade(c, 0.85)}"/>` +
        `<polygon points="${pts([[x - 7 * s, y - 12 * s], [x, y - 27 * s], [x + 7 * s, y - 12 * s]])}" fill="${c}"/>` +
        `<polygon points="${pts([[x - 5 * s, y - 20 * s], [x, y - 33 * s], [x + 5 * s, y - 20 * s]])}" fill="${shade(c, 1.2)}"/>`
      );
    }
    const c = pick(['#2c6b2f', '#357a33', '#27602c', '#3f8438']);
    return (
      shadow +
      `<rect x="${f(x - 2)}" y="${f(y - 8 * s)}" width="4" height="${f(9 * s)}" fill="#4a3320"/>` +
      `<circle cx="${f(x)}" cy="${f(y - 14 * s)}" r="${f(10 * s)}" fill="${shade(c, 0.72)}"/>` +
      `<circle cx="${f(x - 2.5 * s)}" cy="${f(y - 16.5 * s)}" r="${f(7.5 * s)}" fill="${c}"/>` +
      `<circle cx="${f(x - 4 * s)}" cy="${f(y - 19 * s)}" r="${f(3.5 * s)}" fill="${shade(c, 1.3)}"/>`
    );
  }

  // Chapada de pedra do deserto: topo plano, duas faces e camadas de rocha.
  function mesa(cx, by, w, h) {
    const tl = [cx - w * 0.38, by - h];
    const tm = [cx - w * 0.05, by - h + w * 0.07];
    const tr = [cx + w * 0.3, by - h + w * 0.04];
    const bl = [cx - w / 2, by];
    const bm = [cx - w * 0.02, by];
    const br = [cx + w / 2, by];
    let strata = '';
    for (const k of [0.25, 0.5, 0.75]) {
      const a = lerp(tl, bl, k);
      const b = lerp(tm, bm, k);
      const c = lerp(tr, br, k);
      strata += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}`;
    }
    // fendas verticais
    let cracks = '';
    for (let i = 0; i < 5; i++) {
      const t = 0.12 + rnd() * 0.76;
      const top = t < 0.5 ? lerp(tl, tm, t * 2) : lerp(tm, tr, (t - 0.5) * 2);
      const bottom = t < 0.5 ? lerp(bl, bm, t * 2) : lerp(bm, br, (t - 0.5) * 2);
      const end = lerp(top, bottom, 0.4 + rnd() * 0.5);
      cracks += `M${f(top[0])} ${f(top[1])}L${f(end[0] + (rnd() - 0.5) * 6)} ${f(end[1])}`;
    }
    return (
      `<ellipse cx="${f(cx + w * 0.25)}" cy="${f(by + 5)}" rx="${f(w * 0.52)}" ry="${f(w * 0.075)}" fill="#000" opacity="0.2"/>` +
      `<ellipse cx="${f(cx)}" cy="${f(by)}" rx="${f(w * 0.56)}" ry="${f(w * 0.065)}" fill="#a57a50"/>` +
      `<polygon points="${pts([tl, tm, bm, bl])}" fill="#bd8c5e"/>` +
      `<polygon points="${pts([tm, tr, br, bm])}" fill="#8c6242"/>` +
      `<polygon points="${pts([tl, [cx - w * 0.1, by - h - w * 0.06], [cx + w * 0.32, by - h - w * 0.03], tr, tm])}" fill="#dcbd8e"/>` +
      `<path d="${strata}" stroke="#000" stroke-opacity="0.16" stroke-width="2.5" fill="none"/>` +
      `<path d="${cracks}" stroke="#000" stroke-opacity="0.22" stroke-width="1.5" fill="none"/>`
    );
  }

  function curvePoints(p0, c, p1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push([
        u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
        u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
      ]);
    }
    return out;
  }
  const lineD = (list) => 'M' + list.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');

  function smoothPath(list) {
    let d = `M${f(list[0][0])} ${f(list[0][1])}`;
    for (let i = 1; i < list.length - 1; i++) {
      const mid = lerp(list[i], list[i + 1], 0.5);
      d += `Q${f(list[i][0])} ${f(list[i][1])} ${f(mid[0])} ${f(mid[1])}`;
    }
    const last = list[list.length - 1];
    return d + `L${f(last[0])} ${f(last[1])}`;
  }

  // Quarteirões de uma cidade futurista em grade isométrica.
  function cityGrid(center, n, m, s, glow, eachCell) {
    const a = [s, s / 2];
    const b = [-s, s / 2];
    const at = (i, j) => [center[0] + i * a[0] + j * b[0], center[1] + i * a[1] + j * b[1]];
    const pad = 0.3;
    const plate = [
      at(-n / 2 - pad, -m / 2 - pad),
      at(n / 2 + pad, -m / 2 - pad),
      at(n / 2 + pad, m / 2 + pad),
      at(-n / 2 - pad, m / 2 + pad),
    ];
    let streets = '';
    for (let i = 0; i <= n; i++) {
      const p = at(i - n / 2, -m / 2 - pad);
      const q = at(i - n / 2, m / 2 + pad);
      streets += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`;
    }
    for (let j = 0; j <= m; j++) {
      const p = at(-n / 2 - pad, j - m / 2);
      const q = at(n / 2 + pad, j - m / 2);
      streets += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`;
    }
    const ground =
      `<polygon points="${pts(plate.map((p) => [p[0] + 8, p[1] + 10]))}" fill="#000" opacity="0.28"/>` +
      `<polygon points="${pts(plate)}" fill="#2a3242" stroke="#465066" stroke-width="3"/>` +
      `<path d="${streets}" stroke="#10141f" stroke-width="11" fill="none"/>` +
      `<path d="${streets}" stroke="${glow}" stroke-opacity="0.45" stroke-width="1.4" fill="none"/>`;
    const objects = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const c = at(i - (n - 1) / 2, j - (m - 1) / 2);
        const centrality = 1 - (Math.abs(i - (n - 1) / 2) + Math.abs(j - (m - 1) / 2)) / ((n + m) / 2);
        const svg = eachCell(c[0], c[1], centrality);
        if (svg) objects.push({ y: c[1], s: svg });
      }
    }
    return { ground, objects };
  }

  // ---------- Nova Aurora: vila futurista acabada, no meio do deserto ----------
  function outpost(cx, cy) {
    const sand = ['#d8c29a', '#cbb188', '#e0cda8', '#bfa57c'];
    const objects = [];

    const dome = (x, y, r, color) => {
      const streaks =
        `M${f(x - r * 0.4)} ${f(y - r * 0.75)}v${f(r * 0.5)}M${f(x + r * 0.2)} ${f(y - r * 0.85)}v${f(r * 0.6)}M${f(x + r * 0.55)} ${f(y - r * 0.5)}v${f(r * 0.35)}`;
      return (
        `<ellipse cx="${f(x + r * 0.5)}" cy="${f(y + r * 0.2)}" rx="${f(r * 1.2)}" ry="${f(r * 0.45)}" fill="#000" opacity="0.2"/>` +
        `<path d="M${f(x - r)} ${f(y)}A${f(r)} ${f(r * 0.95)} 0 0 1 ${f(x + r)} ${f(y)}A${f(r)} ${f(r * 0.4)} 0 0 1 ${f(x - r)} ${f(y)}Z" fill="${color}"/>` +
        `<path d="M${f(x)} ${f(y - r * 0.95)}A${f(r)} ${f(r * 0.95)} 0 0 1 ${f(x + r)} ${f(y)}A${f(r)} ${f(r * 0.4)} 0 0 1 ${f(x)} ${f(y + r * 0.4)}Z" fill="#000" opacity="0.16"/>` +
        `<path d="${streaks}" stroke="#7d5232" stroke-opacity="0.5" stroke-width="2" fill="none"/>` +
        `<path d="M${f(x - 5)} ${f(y + r * 0.34)}v-9a5 5 0 0 1 10 0v9z" fill="#2a1d14"/>` +
        `<path d="M${f(x - r * 0.2)} ${f(y - r * 0.93)}v-${f(8 + r * 0.3)}" stroke="#5d5247" stroke-width="1.5"/>`
      );
    };

    const boxHut = (x, y) => {
      const w = 18 + rnd() * 12;
      const d = w * 0.8;
      const h = 10 + rnd() * 7;
      const yF = y + w / 2;
      return (
        isoBox(x, yF, w, d, h, pick(sand), { shadow: true }) +
        // remendo de ferrugem e porta
        `<polygon points="${pts([[x - d * 0.7, yF - d * 0.35 - h * 0.2], [x - d * 0.25, yF - d * 0.125 - h * 0.2], [x - d * 0.25, yF - d * 0.125 - h * 0.8], [x - d * 0.7, yF - d * 0.35 - h * 0.8]])}" fill="#8a5a35" opacity="0.55"/>` +
        `<polygon points="${pts([[x + w * 0.35, yF - w * 0.175], [x + w * 0.6, yF - w * 0.3], [x + w * 0.6, yF - w * 0.3 - h * 0.7], [x + w * 0.35, yF - w * 0.175 - h * 0.7]])}" fill="#2a1d14"/>` +
        isoBox(x + 2, yF - w * 0.3, 6, 6, 4, '#6f665c', { z: h })
      );
    };

    const condenser = (x, y) =>
      `<ellipse cx="${f(x + 6)}" cy="${f(y + 1)}" rx="9" ry="3" fill="#000" opacity="0.2"/>` +
      `<path d="M${f(x)} ${f(y)}V${f(y - 36)}M${f(x - 7)} ${f(y - 27)}H${f(x + 7)}M${f(x - 5)} ${f(y - 18)}H${f(x + 5)}" stroke="#7a6a58" stroke-width="2.5" fill="none"/>` +
      `<rect x="${f(x - 3)}" y="${f(y - 43)}" width="6" height="8" fill="#9a8a76"/>` +
      `<circle cx="${f(x)}" cy="${f(y - 45)}" r="1.8" fill="${CYAN}"/>`;

    const junk = (x, y) =>
      `<polygon points="${pts([[x - 11, y], [x - 5, y - 8], [x + 3, y - 5], [x + 9, y - 10], [x + 13, y]])}" fill="#5e4a3a"/>` +
      `<polygon points="${pts([[x - 4, y], [x, y - 6], [x + 6, y]])}" fill="#8a5a35"/>` +
      `<path d="M${f(x - 8)} ${f(y - 3)}l12 -9" stroke="#3f3a36" stroke-width="2"/>`;

    // chão batido, rastros e pista de pouso gasta
    const padX = cx + 150;
    const padY = cy + 40;
    const ground =
      `<ellipse cx="${cx}" cy="${cy}" rx="235" ry="115" fill="#b89868" opacity="0.85"/>` +
      `<ellipse cx="${cx - 20}" cy="${cy + 5}" rx="150" ry="70" fill="#a98858" opacity="0.6"/>` +
      `<path d="M${cx - 200} ${cy + 30}Q${cx - 60} ${cy + 60} ${cx + 110} ${cy + 20}M${cx - 150} ${cy - 40}Q${cx} ${cy - 10} ${cx + 180} ${cy - 30}" stroke="#8f744c" stroke-opacity="0.6" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="${padX}" cy="${padY}" rx="50" ry="25" fill="#6b6258" stroke="#3d362f" stroke-width="2"/>` +
      `<ellipse cx="${padX}" cy="${padY}" rx="36" ry="18" fill="none" stroke="#c9b68a" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="9 7"/>`;

    // nave velha estacionada na pista
    objects.push({
      y: padY + 6,
      s:
        `<ellipse cx="${padX + 6}" cy="${padY + 8}" rx="30" ry="9" fill="#000" opacity="0.25"/>` +
        isoBox(padX - 14, padY + 8, 36, 14, 7, '#8a7f73', { z: 3 }) +
        isoBox(padX + 8, padY - 1, 10, 10, 6, '#5f7f8c', { z: 10 }) +
        `<polygon points="${pts([[padX - 26, padY - 4], [padX - 14, padY - 22], [padX - 10, padY - 6]])}" fill="#7a5a44"/>`,
    });

    // cúpula principal com toldos de feira
    objects.push({
      y: cy,
      s:
        dome(cx - 10, cy - 5, 36, '#d2ba90') +
        `<polygon points="${pts([[cx + 26, cy + 4], [cx + 50, cy - 6], [cx + 56, cy + 4], [cx + 32, cy + 14]])}" fill="#a8553f"/>` +
        `<polygon points="${pts([[cx - 62, cy + 6], [cx - 40, cy + 14], [cx - 46, cy + 24], [cx - 68, cy + 16]])}" fill="#4f7a8a"/>` +
        `<path d="M${cx + 28} ${cy + 6}v10M${cx + 54} ${cy + 5}v10M${cx - 64} ${cy + 16}v9M${cx - 44} ${cy + 23}v9" stroke="#4a3a2c" stroke-width="1.5"/>`,
    });

    // torre de comunicação enferrujada
    const tx = cx - 125;
    const tyy = cy - 30;
    objects.push({
      y: tyy,
      s:
        `<ellipse cx="${tx + 14}" cy="${tyy + 2}" rx="20" ry="5" fill="#000" opacity="0.2"/>` +
        `<path d="M${tx - 10} ${tyy}L${tx} ${tyy - 78}L${tx + 10} ${tyy}M${tx - 7} ${tyy - 24}H${tx + 7}M${tx - 4} ${tyy - 48}H${tx + 4}M${tx - 7} ${tyy - 24}L${tx + 4} ${tyy - 48}M${tx + 7} ${tyy - 24}L${tx - 4} ${tyy - 48}" stroke="#6e4a33" stroke-width="2.5" fill="none"/>` +
        `<path d="M${tx - 9} ${tyy - 66}a10 6 0 0 1 18 0" stroke="#8a7f73" stroke-width="2.5" fill="none"/>` +
        `<circle cx="${tx}" cy="${tyy - 80}" r="5" fill="#ff5a4a" opacity="0.3"/><circle cx="${tx}" cy="${tyy - 80}" r="2.2" fill="#ff5a4a"/>`,
    });

    // construções espalhadas, sem ordem
    const placed = [[cx - 10, cy - 5, 50], [padX, padY, 62], [tx, tyy, 24]];
    for (let i = 0; i < 60 && placed.length < 34; i++) {
      const angle = rnd() * Math.PI * 2;
      const radius = Math.sqrt(rnd());
      const x = cx + Math.cos(angle) * 200 * radius;
      const y = cy + Math.sin(angle) * 95 * radius;
      if (placed.some(([px, py, r]) => Math.hypot(x - px, (y - py) * 2) < r + 22)) continue;
      placed.push([x, y, 22]);
      const roll = rnd();
      let s;
      if (roll < 0.42) s = dome(x, y, 12 + rnd() * 9, pick(sand));
      else if (roll < 0.74) s = boxHut(x, y);
      else if (roll < 0.88) s = condenser(x, y);
      else s = junk(x, y);
      objects.push({ y: y + 4, s });
    }
    return { ground, objects };
  }

  function buildTerra() {
    let ground = '';
    const objects = [];

    // ---------- grama ----------
    ground +=
      `<rect width="${W}" height="${H}" fill="url(#ul-grass)"/>` +
      `<rect width="${W}" height="${H}" filter="url(#ul-tex-dark)"/>` +
      `<rect width="${W}" height="${H}" filter="url(#ul-tex-light)"/>`;
    let tuftsDark = '';
    let tuftsLight = '';
    for (let i = 0; i < 4200; i++) {
      const x = f(rnd() * W);
      const y = f(rnd() * H);
      if (isDesert(x + 60, y)) continue;
      const d = `M${x} ${y}l-2 -5M${x} ${y}l1 -6M${x} ${y}l3 -4`;
      if (rnd() < 0.6) tuftsDark += d;
      else tuftsLight += d;
    }
    let flowers = '';
    for (let i = 0; i < 420; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      if (isDesert(x + 60, y)) continue;
      flowers += `<circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="${pick(['#f4e9a1', '#ffffff', '#e9b8d4'])}" opacity="0.8"/>`;
    }
    ground +=
      `<path d="${tuftsDark}" stroke="#3b7a36" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>` +
      `<path d="${tuftsLight}" stroke="#9ccb6a" stroke-opacity="0.5" stroke-width="1.2" fill="none"/>` +
      flowers;

    // ---------- deserto (lado esquerdo) ----------
    const desert = [[-300, -300]];
    for (let y = -300; y <= H + 300; y += 40) desert.push([desertEdge(y), y]);
    desert.push([-300, H + 300]);
    ground +=
      `<polygon points="${pts(desert)}" fill="url(#ul-sand)" filter="url(#ul-soft)"/>` +
      `<rect width="${W}" height="${H}" filter="url(#ul-tex-sand)" clip-path="url(#ul-desert-clip)"/>`;
    let dunesLight = '';
    let dunesDark = '';
    for (let i = 0; i < 170; i++) {
      const y = rnd() * H;
      const x = rnd() * (desertEdge(y) - 160);
      const w = 50 + rnd() * 90;
      dunesLight += `M${f(x)} ${f(y)}q${f(w / 2)} ${f(-w * 0.16)} ${f(w)} 0`;
      dunesDark += `M${f(x + 4)} ${f(y + 5)}q${f(w / 2)} ${f(-w * 0.12)} ${f(w - 8)} 0`;
    }
    ground +=
      `<path d="${dunesDark}" stroke="#a9834f" stroke-opacity="0.45" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="${dunesLight}" stroke="#f0dcae" stroke-opacity="0.6" stroke-width="3" fill="none" stroke-linecap="round"/>`;

    // ---------- rio ----------
    const riverLine = [[2380, -20], [2300, 200], [2360, 420], [2280, 640], [2330, 880], [2250, 1100], [2290, 1320], [2260, 1640]];
    const riverD = smoothPath(riverLine);
    ground +=
      `<path d="${riverD}" stroke="#bcae7a" stroke-width="34" fill="none" stroke-linecap="round"/>` +
      `<path d="${riverD}" stroke="#3b8bcc" stroke-width="24" fill="none" stroke-linecap="round"/>` +
      `<path d="${riverD}" stroke="#7cc4ec" stroke-width="7" fill="none" stroke-opacity="0.45" stroke-linecap="round"/>`;

    // ---------- mar ----------
    const coast = [];
    for (let x = -20; x <= W + 20; x += 20) coast.push([x, coastY(x)]);
    const coastD = lineD(coast);
    const seaShape = (dy) => lineD(coast.map((p) => [p[0], p[1] + dy])) + `L${W + 20} ${H + 20}L-20 ${H + 20}Z`;
    ground +=
      `<path d="${coastD}" stroke="#e2d09a" stroke-width="48" fill="none"/>` +
      `<path d="${seaShape(0)}" fill="#58b3dd"/>` +
      `<path d="${seaShape(28)}" fill="url(#ul-sea)"/>` +
      `<path d="${coastD}" stroke="#ffffff" stroke-opacity="0.65" stroke-width="3" fill="none"/>`;
    let waves = '';
    for (let i = 0; i < 170; i++) {
      const x = rnd() * W;
      const y = coastY(x) + 55 + rnd() * Math.max(10, H - coastY(x) - 70);
      waves += `M${f(x)} ${f(y)}q7 -4 14 0q7 4 14 0`;
    }
    ground += `<path d="${waves}" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" fill="none"/>`;

    // ---------- estradas ----------
    const [mx, my] = MINA;
    const track = curvePoints(NOVA_AURORA, [760, 530], [mx - 20, my + 62], 24);
    const highways = [
      curvePoints(NOVA_AURORA, [1100, 1000], PORTO_AZUL, 60),
      curvePoints(PORTO_AZUL, [2300, 1250], VALE_CENTRAL, 50),
    ];
    // trilha de terra até a mina
    ground +=
      `<path d="${lineD(track)}" stroke="#8f744c" stroke-opacity="0.7" stroke-width="16" fill="none" stroke-linecap="round"/>` +
      `<path d="${lineD(track)}" stroke="#b89868" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    // rodovias com faixa luminosa
    for (const road of highways) {
      const d = lineD(road);
      ground +=
        `<path d="${d}" stroke="#0c0f18" stroke-width="22" fill="none"/>` +
        `<path d="${d}" stroke="#232a3a" stroke-width="16" fill="none"/>` +
        `<path d="${d}" stroke="${CYAN}" stroke-opacity="0.25" stroke-width="5" fill="none"/>` +
        `<path d="${d}" stroke="${CYAN}" stroke-opacity="0.9" stroke-width="1.5" stroke-dasharray="14 10" fill="none"/>`;
    }

    // ---------- chapadas de pedra no deserto ----------
    const mesas = [
      [250, 250, 300, 150], [900, 180, 360, 170], [1150, 700, 280, 130], [200, 900, 340, 160],
      [700, 1100, 300, 140], [1150, 1250, 260, 120], [350, 1350, 240, 110], [80, 560, 200, 90],
    ];
    for (const [cx, by, w, h] of mesas) objects.push({ y: by, s: mesa(cx, by, w, h) });

    // ---------- Nova Aurora ----------
    const aurora = outpost(NOVA_AURORA[0], NOVA_AURORA[1]);
    ground += aurora.ground;
    objects.push(...aurora.objects);

    // ---------- Porto Azul: porto futurista ----------
    const blueGlass = ['#1f3a66', '#26507f', '#2f6a94', '#1a2c52', '#3b5f9c', '#dfe9f5'];
    const porto = cityGrid(PORTO_AZUL, 4, 4, 50, CYAN, (x, y, centrality) => {
      const h = 60 + rnd() * 70 + centrality * 120;
      if (rnd() < 0.28) return cylTower(x, y + 8, 15, h * 0.9, pick(blueGlass), pick([CYAN, AMBER]));
      return futureTower(x, y, 30, h, pick(blueGlass), pick([CYAN, CYAN, PINK]));
    });

    // ---------- Vale Central: centro financeiro futurista ----------
    const darkGlass = ['#1b2a4a', '#22335c', '#3a2f5c', '#18364a', '#2c4a6e', '#e8eef5', '#2a2140'];
    const vale = cityGrid(VALE_CENTRAL, 5, 5, 52, PINK, (x, y, centrality) => {
      const h = 80 + rnd() * 90 + centrality * 170;
      if (rnd() < 0.2) return cylTower(x, y + 8, 16, h * 0.85, pick(darkGlass), pick([PINK, CYAN]));
      return futureTower(x, y, 32, h, pick(darkGlass), pick([PINK, CYAN, '#8cff9a']));
    });

    ground += porto.ground + vale.ground;
    objects.push(...porto.objects, ...vale.objects);

    // píeres metálicos com luzes, plataforma de pouso no mar e navio cargueiro
    const pier = (x, y) => {
      let lights = '';
      for (let t = 0.1; t < 1; t += 0.2) lights += `<circle cx="${f(x + 100 * t)}" cy="${f(y + 50 * t)}" r="2" fill="${CYAN}"/>`;
      return `<polygon points="${pts([[x, y], [x + 100, y + 50], [x + 88, y + 56], [x - 12, y + 6]])}" fill="#8f9aa8" stroke="#4a5362" stroke-width="2"/>` + lights;
    };
    ground += pier(1810, 1432) + pier(1990, 1440);
    ground +=
      `<ellipse cx="1700" cy="1585" rx="58" ry="29" fill="#000" opacity="0.25"/>` +
      `<ellipse cx="1700" cy="1575" rx="56" ry="28" fill="#2a3242" stroke="#56627a" stroke-width="3"/>` +
      neon('M1660 1575a40 20 0 1 0 80 0a40 20 0 1 0 -80 0', CYAN, 1.6) +
      `<path d="M1750 1562L1795 1500" stroke="#8f9aa8" stroke-width="6"/>`;
    objects.push({
      y: 1600,
      s:
        isoBox(2010, 1600, 120, 30, 12, '#e6edf5') +
        `<path d="M2010 1594L2130 1534" stroke="${CYAN}" stroke-width="2"/>` +
        isoBox(2026, 1594, 18, 16, 9, '#e0a030', { z: 12 }) +
        isoBox(2048, 1583, 18, 16, 9, '#3a8f6a', { z: 12 }) +
        isoBox(2048, 1583, 18, 16, 9, '#b0483a', { z: 21 }) +
        isoBox(2070, 1572, 18, 16, 9, '#3f6fb0', { z: 12 }) +
        isoBox(2100, 1557, 14, 20, 22, '#28344a', { z: 12, windows: 6, glass: CYAN }),
    });
    // guindaste-pórtico
    objects.push({
      y: 1470,
      s:
        `<path d="M1930 1470V1400M1975 1448V1378M1925 1402L1990 1370M1930 1400L1975 1378" stroke="#dfe7f2" stroke-width="4" fill="none"/>` +
        neon('M1960 1386V1420', AMBER, 1.5),
    });

    // ---------- mina de cobre: pequena e futurista ----------
    const plot = [[mx, my - 68], [mx + 136, my], [mx, my + 68], [mx - 136, my]];
    let mine =
      `<polygon points="${pts(plot.map((p) => [p[0] + 6, p[1] + 8]))}" fill="#000" opacity="0.22"/>` +
      `<polygon points="${pts(plot)}" fill="#9a6f4a"/>` +
      `<ellipse cx="${mx + 40}" cy="${my + 18}" rx="56" ry="22" fill="#86603f" opacity="0.7"/>`;
    const pitX = mx - 48;
    const pitY = my;
    [[58, '#7a5a3c'], [46, '#694c32'], [34, '#573e29'], [22, '#443021'], [11, '#2c1f16']].forEach(([rx, color], i) => {
      mine += `<ellipse cx="${pitX}" cy="${pitY + i * 3.5}" rx="${rx}" ry="${rx / 2}" fill="${color}"/>`;
    });
    mine +=
      `<path d="M${pitX - 44} ${pitY + 3}a46 23 0 0 0 38 21" stroke="#c8732e" stroke-width="2.5" fill="none"/>` +
      `<path d="M${pitX + 14} ${pitY - 12}a34 17 0 0 1 20 20" stroke="#4fa58a" stroke-width="2.5" fill="none"/>`;
    // cerca de energia: postes com luz
    let posts = '';
    let lamps = '';
    for (let e = 0; e < 4; e++) {
      for (let t = 0; t < 1; t += 0.2) {
        const p = lerp(plot[e], plot[(e + 1) % 4], t);
        posts += `M${f(p[0])} ${f(p[1])}v-10`;
        lamps += `<circle cx="${f(p[0])}" cy="${f(p[1] - 11)}" r="1.8" fill="${CYAN}"/>`;
      }
    }
    mine +=
      `<polygon points="${pts(plot.map((p) => [p[0], p[1] - 7]))}" fill="none" stroke="${CYAN}" stroke-opacity="0.5" stroke-width="1.2"/>` +
      `<path d="${posts}" stroke="#3a4250" stroke-width="2.5"/>` +
      lamps;
    ground += mine;
    // perfuratriz a laser sobre a cava
    objects.push({
      y: pitY + 4,
      s:
        `<path d="M${pitX + 52} ${pitY - 4}V${pitY - 88}L${pitX} ${pitY - 80}M${pitX + 52} ${pitY - 50}L${pitX + 26} ${pitY - 84}" stroke="#39414d" stroke-width="4.5" fill="none" stroke-linejoin="round"/>` +
        `<rect x="${pitX - 6}" y="${pitY - 84}" width="12" height="9" fill="#58657a"/>` +
        neon(`M${pitX} ${pitY - 75}V${pitY + 14}`, CYAN, 2.2) +
        `<ellipse cx="${pitX}" cy="${pitY + 15}" rx="10" ry="5" fill="${CYAN}" opacity="0.55"/>`,
    });
    objects.push({ y: my - 14, s: cylTower(mx + 36, my - 14, 11, 36, '#58657a', AMBER) });
    objects.push({
      y: my + 14,
      s: isoBox(mx + 74, my + 14, 34, 26, 20, '#3b4656', { windows: 7, glass: CYAN, shadow: true }) +
        neon(`M${mx + 48} ${my + 1 - 20}L${mx + 74} ${my + 14 - 20}L${mx + 108} ${my - 3 - 20}`, CYAN, 1.3),
    });
    const pile = (x, y, r, color) =>
      `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.42)}" fill="${shade(color, 0.55)}"/>` +
      `<polygon points="${pts([[x - r, y], [x, y - r * 1.15], [x + r, y]])}" fill="${color}"/>` +
      `<polygon points="${pts([[x - r, y], [x, y - r * 1.15], [x - r * 0.15, y]])}" fill="${shade(color, 1.25)}"/>`;
    objects.push({ y: my + 42, s: pile(mx + 22, my + 42, 14, '#c8732e') });
    objects.push({ y: my + 50, s: pile(mx - 2, my + 50, 10, '#b5652a') });
    // caminhão flutuante
    objects.push({
      y: my + 40,
      s:
        `<ellipse cx="${mx + 70}" cy="${my + 40}" rx="18" ry="6" fill="${CYAN}" opacity="0.35"/>` +
        isoBox(mx + 58, my + 40, 20, 11, 8, '#d9a23a', { z: 6 }) +
        isoBox(mx + 79, my + 29.5, 8, 11, 9, '#f3cf5e', { z: 6 }),
    });

    // nave caída no meio do deserto
    objects.push({
      y: 760,
      s:
        `<ellipse cx="330" cy="764" rx="70" ry="14" fill="#000" opacity="0.2"/>` +
        `<polygon points="${pts([[270, 760], [330, 722], [400, 740], [350, 768]])}" fill="#6d665e"/>` +
        `<polygon points="${pts([[330, 722], [400, 740], [392, 728], [338, 712]])}" fill="#8b847a"/>` +
        `<polygon points="${pts([[300, 742], [296, 700], [322, 728]])}" fill="#7a5a44"/>` +
        `<path d="M300 752l40 -20M330 756l36 -16" stroke="#3f3a36" stroke-width="2"/>`,
    });

    // ---------- o que não pode ter árvore, pedra ou arbusto em cima ----------
    const blocked = [
      [NOVA_AURORA[0], NOVA_AURORA[1], 270], [mx, my, 185], [PORTO_AZUL[0], PORTO_AZUL[1], 275],
      [VALE_CENTRAL[0], VALE_CENTRAL[1], 330], [330, 750, 90],
      ...mesas.map(([cx, by, w, h]) => [cx, by - h / 2, w * 0.62]),
    ];
    const lines = [...track, ...highways[0], ...highways[1]];
    for (let i = 0; i < riverLine.length - 1; i++) {
      for (let t = 0; t < 1; t += 0.1) lines.push(lerp(riverLine[i], riverLine[i + 1], t));
    }
    const isFree = (x, y) => {
      if (x < 10 || x > W - 10 || y < 30 || y > coastY(x) - 36) return false;
      for (const [bx, by, r] of blocked) if (Math.hypot(x - bx, y - by) < r) return false;
      for (const p of lines) if (Math.abs(x - p[0]) < 30 && Math.abs(y - p[1]) < 30) return false;
      return true;
    };

    // ---------- pedras e arbustos secos do deserto ----------
    for (let i = 0; i < 260; i++) {
      const y = rnd() * H;
      const x = rnd() * (desertEdge(y) - 90);
      if (!isFree(x, y)) continue;
      if (rnd() < 0.5) {
        const r = 4 + rnd() * 9;
        const c = pick(['#9a7b57', '#8a6a48', '#a88a66']);
        objects.push({
          y,
          s:
            `<ellipse cx="${f(x + r * 0.5)}" cy="${f(y + 1)}" rx="${f(r * 1.2)}" ry="${f(r * 0.4)}" fill="#000" opacity="0.2"/>` +
            `<polygon points="${pts([[x - r, y], [x - r * 0.5, y - r * 0.9], [x + r * 0.4, y - r * 1.1], [x + r, y]])}" fill="${c}"/>` +
            `<polygon points="${pts([[x - r, y], [x - r * 0.5, y - r * 0.9], [x - r * 0.1, y]])}" fill="${shade(c, 1.25)}"/>`,
        });
      } else {
        objects.push({
          y,
          s: `<path d="M${f(x)} ${f(y)}l-6 -9M${f(x)} ${f(y)}l-2 -12M${f(x)} ${f(y)}l4 -11M${f(x)} ${f(y)}l8 -7" stroke="${pick(['#7d6f43', '#8f7d4a', '#6b6a3e'])}" stroke-width="1.6" fill="none"/>`,
        });
      }
    }

    // ---------- florestas (só na parte verde) ----------
    const plant = (x, y, conifer) => {
      if (!isDesert(x - 90, y) && isFree(x, y)) objects.push({ y, s: tree(x, y, 0.8 + rnd() * 0.5, conifer) });
    };
    const forests = [
      [1780, 420, 270, 230, 190], [2850, 330, 300, 210, 200], [2950, 1330, 240, 130, 110],
      [1720, 900, 210, 170, 110], [2520, 1380, 160, 100, 60], [2080, 760, 150, 120, 60],
    ];
    for (const [cx, cy, rx, ry, count] of forests) {
      for (let i = 0; i < count; i++) {
        const angle = rnd() * Math.PI * 2;
        const radius = Math.sqrt(rnd());
        plant(cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius, rnd() < 0.2);
      }
    }
    for (let i = 0; i < 220; i++) plant(1400 + rnd() * 1800, rnd() * H, rnd() < 0.15);

    objects.sort((p, q) => p.y - q.y);

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      '<defs>' +
      '<linearGradient id="ul-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6aa650"/><stop offset="1" stop-color="#5a9645"/></linearGradient>' +
      '<linearGradient id="ul-sand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcc391"/><stop offset="1" stop-color="#cfae78"/></linearGradient>' +
      '<linearGradient id="ul-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7fc0"/><stop offset="1" stop-color="#153c74"/></linearGradient>' +
      '<linearGradient id="ul-cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>' +
      `<clipPath id="ul-desert-clip"><polygon points="${pts(desert)}"/></clipPath>` +
      '<filter id="ul-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="28"/></filter>' +
      '<filter id="ul-tex-dark" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0025 0.004" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.42  0 0 0 0 0.18  0 0 0 0.9 -0.3"/></filter>' +
      '<filter id="ul-tex-light" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.006" numOctaves="2" seed="21"/><feColorMatrix values="0 0 0 0 0.58  0 0 0 0 0.76  0 0 0 0 0.36  0 0 0 0.7 -0.26"/></filter>' +
      '<filter id="ul-tex-sand" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.003 0.006" numOctaves="3" seed="33"/><feColorMatrix values="0 0 0 0 0.66  0 0 0 0 0.47  0 0 0 0 0.27  0 0 0 0.9 -0.32"/></filter>' +
      '</defs>' +
      ground +
      objects.map((o) => o.s).join('') +
      '</svg>'
    );
  }

  let terraSvg = null;
  window.UL_MAPS = {
    terra: {
      width: W,
      height: H,
      get svg() {
        if (!terraSvg) terraSvg = buildTerra();
        return terraSvg;
      },
    },
  };
})();

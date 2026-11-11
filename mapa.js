// mapa.js — desenha o mapa dos planetas em SVG, tudo gerado por código.
// Expõe window.UL_MAPS = { terra: { width, height, svg } }.
// As posições das cidades e da mina aqui precisam bater com a lista
// "places" do planeta em script.js.
(function () {
  const W = 2000;
  const H = 1300;

  // Posições (em pixels do mapa)
  const NOVA_AURORA = [430, 430];
  const PORTO_AZUL = [900, 720];
  const VALE_CENTRAL = [1720, 860];
  const MINA = [640, 230]; // ao lado de Nova Aurora

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

  function coastY(x) {
    return 990 + 60 * Math.sin(x / 260 + 1) - 110 * Math.exp(-(((x - 930) / 300) ** 2));
  }

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
      const k = h * 0.35;
      s += `<polygon points="${pts([F, R, [R[0] + k, R[1] + k / 2], [F[0] + k, F[1] + k / 2]])}" fill="#000" opacity="0.2"/>`;
    }
    s +=
      `<polygon points="${pts([F, L, up(L), up(F)])}" fill="${shade(color, 0.6)}"/>` +
      `<polygon points="${pts([F, R, up(R), up(F)])}" fill="${shade(color, 0.86)}"/>` +
      `<polygon points="${pts([up(F), up(R), up(B), up(L)])}" fill="${shade(color, o.top || 1.15)}"/>`;
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
      s += `<path d="${d1}" stroke="${o.glass || '#ffffff'}" stroke-opacity="0.3" stroke-width="1" fill="none"/>`;
      s += `<path d="M${f(F[0])} ${f(F[1])}V${f(F[1] - h)}" stroke="#fff" stroke-opacity="0.35" stroke-width="1"/>`;
    }
    return s;
  }

  // Casa com telhado de duas águas.
  function house(x, y, w, d, h, wall, roof) {
    const Fp = [x, y - h];
    const Rp = [x + w, y - w / 2 - h];
    const Lp = [x - d, y - d / 2 - h];
    const Bp = [x + w - d, y - w / 2 - d / 2 - h];
    const rh = d * 0.45;
    const A = [(Fp[0] + Lp[0]) / 2, (Fp[1] + Lp[1]) / 2 - rh];
    const C = [(Rp[0] + Bp[0]) / 2, (Rp[1] + Bp[1]) / 2 - rh];
    return (
      isoBox(x, y, w, d, h, wall, { shadow: true }) +
      `<polygon points="${pts([Lp, Bp, C, A])}" fill="${shade(roof, 0.65)}"/>` +
      `<polygon points="${pts([Fp, Lp, A])}" fill="${shade(wall, 0.7)}"/>` +
      `<polygon points="${pts([Fp, Rp, C, A])}" fill="${roof}"/>` +
      `<rect x="${f(x + w * 0.35)}" y="${f(y - w * 0.175 - h * 0.75)}" width="4" height="${f(h * 0.45)}" fill="#3a2c22"/>`
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

  function mountain(cx, by, w, h) {
    const peak = [cx + (rnd() - 0.5) * w * 0.12, by - h];
    const l = [cx - w / 2, by];
    const r = [cx + w / 2, by];
    const m = [cx + w * 0.12, by];
    const sl = lerp(peak, l, 0.34);
    const sr = lerp(peak, r, 0.3);
    const sm = lerp(peak, m, 0.42);
    const jl = lerp(sl, sm, 0.5);
    const jr = lerp(sm, sr, 0.5);
    const ridge1 = lerp(peak, l, 0.55);
    const ridge2 = lerp(l, m, 0.5);
    return (
      `<ellipse cx="${f(cx)}" cy="${f(by)}" rx="${f(w * 0.56)}" ry="${f(w * 0.06)}" fill="#33432c" opacity="0.6"/>` +
      `<polygon points="${pts([l, peak, m])}" fill="#8d857a"/>` +
      `<polygon points="${pts([peak, r, m])}" fill="#5b544c"/>` +
      `<polygon points="${pts([ridge1, lerp(peak, m, 0.6), ridge2])}" fill="#7a7268"/>` +
      `<polygon points="${pts([peak, sl, [jl[0], jl[1] + h * 0.06], sm])}" fill="#f6f8fa"/>` +
      `<polygon points="${pts([peak, sm, [jr[0], jr[1] + h * 0.07], sr])}" fill="#c3ccd6"/>`
    );
  }

  // Curva quadrática em pontos, para desenhar e para saber onde não plantar árvores.
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

  function smoothPath(list) {
    let d = `M${f(list[0][0])} ${f(list[0][1])}`;
    for (let i = 1; i < list.length - 1; i++) {
      const mid = lerp(list[i], list[i + 1], 0.5);
      d += `Q${f(list[i][0])} ${f(list[i][1])} ${f(mid[0])} ${f(mid[1])}`;
    }
    const last = list[list.length - 1];
    return d + `L${f(last[0])} ${f(last[1])}`;
  }

  // Quarteirões de uma cidade em grade isométrica.
  function cityGrid(center, n, m, s, plateColor, streetColor, streetWidth, eachCell) {
    const a = [s, s / 2];
    const b = [-s, s / 2];
    const at = (i, j) => [center[0] + i * a[0] + j * b[0], center[1] + i * a[1] + j * b[1]];
    const pad = 0.25;
    const plate = [
      at(-n / 2 - pad, -m / 2 - pad),
      at(n / 2 + pad, -m / 2 - pad),
      at(n / 2 + pad, m / 2 + pad),
      at(-n / 2 - pad, m / 2 + pad),
    ];
    let ground =
      `<polygon points="${pts(plate.map((p) => [p[0] + 6, p[1] + 8]))}" fill="#000" opacity="0.25"/>` +
      `<polygon points="${pts(plate)}" fill="${plateColor}"/>`;
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
    ground += `<path d="${streets}" stroke="${streetColor}" stroke-width="${streetWidth}" fill="none"/>`;
    const objects = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const c = at(i - (n - 1) / 2, j - (m - 1) / 2);
        const centrality = 1 - (Math.abs(i - (n - 1) / 2) + Math.abs(j - (m - 1) / 2)) / ((n + m) / 2);
        const svg = eachCell(c[0], c[1], centrality, i, j);
        if (svg) objects.push({ y: c[1], s: svg });
      }
    }
    return { ground, objects };
  }

  function tower(x, y, w, h, color) {
    let s = isoBox(x, y + w / 2, w, w, h, color, { windows: 8, shadow: true });
    s += isoBox(x, y + 6, 12, 12, 6, '#9aa3ad', { z: h });
    if (h > 170) {
      s += `<path d="M${f(x)} ${f(y - h - 6)}V${f(y - h - 34)}" stroke="#d7dde4" stroke-width="2"/>` +
        `<circle cx="${f(x)}" cy="${f(y - h - 34)}" r="2.5" fill="#ff5a4a"/>`;
    }
    return s;
  }

  function buildTerra() {
    let ground = '';
    const objects = [];

    // ---------- terreno ----------
    ground +=
      `<rect width="${W}" height="${H}" fill="url(#ul-grass)"/>` +
      `<rect width="${W}" height="${H}" filter="url(#ul-tex-dark)"/>` +
      `<rect width="${W}" height="${H}" filter="url(#ul-tex-light)"/>`;
    // tufos de capim e florzinhas, para a grama não ficar lisa
    let tuftsDark = '';
    let tuftsLight = '';
    for (let i = 0; i < 2600; i++) {
      const x = f(rnd() * W);
      const y = f(rnd() * H);
      const d = `M${x} ${y}l-2 -5M${x} ${y}l1 -6M${x} ${y}l3 -4`;
      if (rnd() < 0.6) tuftsDark += d;
      else tuftsLight += d;
    }
    let flowers = '';
    for (let i = 0; i < 260; i++) {
      flowers += `<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" r="1.4" fill="${pick(['#f4e9a1', '#ffffff', '#e9b8d4'])}" opacity="0.8"/>`;
    }
    ground +=
      `<path d="${tuftsDark}" stroke="#3b7a36" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>` +
      `<path d="${tuftsLight}" stroke="#9ccb6a" stroke-opacity="0.5" stroke-width="1.2" fill="none"/>` +
      flowers;

    // ---------- plantações perto de Nova Aurora ----------
    const fields = [[690, 500], [800, 430], [230, 420], [180, 560]];
    for (const [fx, fy] of fields) {
      const a = [62, 31];
      const b = [-52, 26];
      const color = pick(['#b7a548', '#93ad4b', '#c9b65a', '#7fa046']);
      const corners = [[fx, fy - 28], [fx + a[0], fy - 28 + a[1]], [fx + a[0] + b[0], fy - 28 + a[1] + b[1]], [fx + b[0], fy - 28 + b[1]]];
      let rows = '';
      for (let t = 1; t < 8; t++) {
        const p = lerp(corners[0], corners[3], t / 8);
        const q = lerp(corners[1], corners[2], t / 8);
        rows += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`;
      }
      ground +=
        `<polygon points="${pts(corners)}" fill="${color}" stroke="${shade(color, 0.6)}" stroke-width="2"/>` +
        `<path d="${rows}" stroke="${shade(color, 0.75)}" stroke-width="2"/>`;
    }

    // ---------- rio ----------
    const riverLine = [[1180, 330], [1125, 430], [1140, 540], [1185, 630], [1200, 720], [1205, 840], [1200, 960]];
    const riverD = smoothPath(riverLine);
    ground +=
      `<path d="${riverD}" stroke="#bcae7a" stroke-width="32" fill="none" stroke-linecap="round"/>` +
      `<path d="${riverD}" stroke="#3b8bcc" stroke-width="22" fill="none" stroke-linecap="round"/>` +
      `<path d="${riverD}" stroke="#7cc4ec" stroke-width="6" fill="none" stroke-opacity="0.45" stroke-linecap="round"/>`;

    // ---------- mar ----------
    const coast = [];
    for (let x = -20; x <= W + 20; x += 20) coast.push([x, coastY(x)]);
    const coastD = 'M' + coast.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');
    const seaShape = (dy) =>
      'M' + coast.map((p) => `${f(p[0])} ${f(p[1] + dy)}`).join('L') + `L${W + 20} ${H + 20}L-20 ${H + 20}Z`;
    ground +=
      `<path d="${coastD}" stroke="#dbc98c" stroke-width="44" fill="none"/>` +
      `<path d="${seaShape(0)}" fill="#58b3dd"/>` +
      `<path d="${seaShape(26)}" fill="url(#ul-sea)"/>` +
      `<path d="${coastD}" stroke="#ffffff" stroke-opacity="0.65" stroke-width="3" fill="none"/>`;
    let waves = '';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W;
      const y = coastY(x) + 50 + rnd() * (H - coastY(x) - 60);
      waves += `M${f(x)} ${f(y)}q7 -4 14 0q7 4 14 0`;
    }
    ground += `<path d="${waves}" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" fill="none"/>`;

    // ---------- estradas ----------
    const roads = [
      curvePoints(NOVA_AURORA, [560, 640], PORTO_AZUL, 40),
      curvePoints(PORTO_AZUL, [1300, 900], VALE_CENTRAL, 40),
      curvePoints(NOVA_AURORA, [610, 400], MINA, 20),
    ];
    for (const road of roads) {
      const d = 'M' + road.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');
      ground +=
        `<path d="${d}" stroke="#262930" stroke-width="18" fill="none"/>` +
        `<path d="${d}" stroke="#4b4f58" stroke-width="13" fill="none"/>` +
        `<path d="${d}" stroke="#e6d27a" stroke-width="1.6" stroke-dasharray="10 10" fill="none"/>`;
    }

    // ---------- montanhas ----------
    const peaks = [
      [1050, 360, 300, 200], [1250, 400, 420, 300], [1500, 380, 520, 360], [1750, 420, 460, 300],
      [1900, 400, 360, 250], [1380, 440, 300, 180], [1640, 460, 280, 160],
      [MINA[0] + 20, MINA[1] - 116, 280, 105], // morro atrás da mina, onde fica o túnel
    ];
    for (const [cx, by, w, h] of peaks) objects.push({ y: by, s: mountain(cx, by, w, h) });

    // ---------- Nova Aurora: cidade tranquila, casas baixas ----------
    const walls = ['#e8dcc4', '#d9c9a8', '#f0e6d2', '#cdb99a'];
    const roofs = ['#b5533c', '#8f4a35', '#a0603c', '#6b7785'];
    const aurora = cityGrid(NOVA_AURORA, 4, 4, 46, '#b9b29c', '#8a836f', 6, (x, y, centrality, i, j) => {
      if (i === 1 && j === 2) {
        // prefeitura com torre do relógio
        return (
          isoBox(x, y + 15, 30, 30, 24, '#e6d9bd', { windows: 9, shadow: true }) +
          isoBox(x, y + 5, 10, 10, 26, '#d8c9a8', { z: 24 }) +
          `<polygon points="${pts([[x - 10, y - 50], [x, y - 66], [x + 10, y - 50], [x, y - 45]])}" fill="#8f4a35"/>` +
          `<circle cx="${f(x + 5)}" cy="${f(y - 40)}" r="3" fill="#fff" stroke="#333" stroke-width="0.8"/>`
        );
      }
      const roll = rnd();
      if (roll < 0.2) {
        // praça
        return (
          `<ellipse cx="${f(x)}" cy="${f(y)}" rx="26" ry="13" fill="#5f9a48"/>` +
          tree(x - 9, y + 2, 0.8, false) + tree(x + 10, y - 1, 0.7, false)
        );
      }
      if (roll < 0.36) {
        return isoBox(x, y + 13, 26, 26, 30 + rnd() * 14, pick(['#d6c3a0', '#c98f6a', '#e4d8be']), { windows: 10, shadow: true });
      }
      return (
        house(x - 9, y + 12, 22, 18, 13 + rnd() * 5, pick(walls), pick(roofs)) +
        (rnd() < 0.6 ? house(x + 13, y + 3, 18, 15, 11 + rnd() * 4, pick(walls), pick(roofs)) : tree(x + 16, y + 2, 0.6, false))
      );
    });

    // ---------- Porto Azul: arranha-céus à beira-mar ----------
    const blueGlass = ['#5b8fc7', '#6fb3d9', '#4a6fa8', '#8cc7e0', '#3d5a8a', '#a9d4ea'];
    const porto = cityGrid(PORTO_AZUL, 4, 4, 44, '#737882', '#30333a', 9, (x, y, centrality) => {
      if (rnd() < 0.08) return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="24" ry="12" fill="#5f9a48"/>` + tree(x, y + 2, 0.8, false);
      return tower(x, y, 28, 55 + rnd() * 70 + centrality * 110, pick(blueGlass));
    });

    // ---------- Vale Central: centro financeiro ----------
    const steelGlass = ['#2f6f7a', '#4fa3a8', '#1f3d57', '#9fb4c4', '#356b9a', '#c9d6df', '#27496b'];
    const vale = cityGrid(VALE_CENTRAL, 5, 4, 48, '#6b7079', '#2b2e35', 10, (x, y, centrality) =>
      tower(x, y, 30, 70 + rnd() * 90 + centrality * 150, pick(steelGlass))
    );

    ground += aurora.ground + porto.ground + vale.ground;
    objects.push(...aurora.objects, ...porto.objects, ...vale.objects);

    // ---------- porto: píeres, navio e contêineres ----------
    const pier = (x, y) =>
      `<polygon points="${pts([[x, y], [x + 70, y + 35], [x + 61, y + 39.5], [x - 9, y + 4.5]])}" fill="#8a6a45" stroke="#5a442c" stroke-width="1.5"/>`;
    ground += pier(850, 822) + pier(985, 832);
    objects.push({
      y: 915,
      s:
        isoBox(960, 915, 84, 22, 10, '#a8352b') +
        isoBox(972, 911, 15, 13, 8, '#e0a030', { z: 10 }) +
        isoBox(990, 902, 15, 13, 8, '#3a8f6a', { z: 10 }) +
        isoBox(1008, 893, 15, 13, 8, '#3f6fb0', { z: 10 }) +
        isoBox(1028, 883, 11, 15, 18, '#f1f3f5', { z: 10, windows: 6 }),
    });

    // ---------- mina de cobre: terreno cercado ----------
    const [mx, my] = MINA;
    const plot = [[mx, my - 108], [mx + 216, my], [mx, my + 108], [mx - 216, my]];
    let mine =
      `<polygon points="${pts(plot.map((p) => [p[0] + 6, p[1] + 8]))}" fill="#000" opacity="0.22"/>` +
      `<polygon points="${pts(plot)}" fill="#8a6c49"/>` +
      `<ellipse cx="${mx + 70}" cy="${my + 30}" rx="90" ry="34" fill="#7a5d3d" opacity="0.7"/>` +
      `<ellipse cx="${mx - 20}" cy="${my - 55}" rx="70" ry="22" fill="#967650" opacity="0.6"/>`;
    // cava a céu aberto, em degraus
    const pitX = mx - 75;
    const pitY = my + 5;
    const steps = [[92, '#6f5539'], [74, '#604830'], [56, '#523c28'], [38, '#433021'], [20, '#2e2118']];
    steps.forEach(([rx, color], i) => {
      mine += `<ellipse cx="${pitX}" cy="${pitY + i * 5}" rx="${rx}" ry="${rx / 2}" fill="${color}"/>`;
    });
    mine +=
      `<path d="M${pitX - 70} ${pitY + 4}a74 37 0 0 0 60 34" stroke="#c8732e" stroke-width="3" fill="none"/>` +
      `<path d="M${pitX + 20} ${pitY - 20}a56 28 0 0 1 34 32" stroke="#4fa58a" stroke-width="3" fill="none"/>` +
      `<path d="M${pitX - 30} ${pitY + 26}a38 19 0 0 0 50 0" stroke="#e08a3c" stroke-width="2.5" fill="none"/>` +
      // rampa da cava até o pátio
      `<path d="M${pitX + 60} ${pitY + 30}Q${mx + 20} ${my + 60} ${mx + 70} ${my + 40}" stroke="#a58460" stroke-width="12" fill="none" stroke-linecap="round"/>` +
      // trilhos do túnel até o pátio
      `<path d="M${mx + 20} ${my - 118}L${mx + 60} ${my - 20}" stroke="#3a2f26" stroke-width="5" stroke-dasharray="3 5" fill="none"/>`;
    // cerca
    let fence = '';
    for (let e = 0; e < 4; e++) {
      const p = plot[e];
      const q = plot[(e + 1) % 4];
      for (let t = 0; t < 1; t += 0.07) {
        const post = lerp(p, q, t);
        fence += `M${f(post[0])} ${f(post[1])}v-9`;
      }
    }
    mine +=
      `<polygon points="${pts(plot.map((p) => [p[0], p[1] - 6]))}" fill="none" stroke="#3b2f22" stroke-width="1.5"/>` +
      `<path d="${fence}" stroke="#3b2f22" stroke-width="2"/>`;
    ground += mine;

    // túnel na encosta
    const ty = my - 114;
    objects.push({
      y: ty,
      s:
        `<path d="M${mx + 4} ${ty}V${ty - 20}Q${mx + 20} ${ty - 36} ${mx + 36} ${ty - 20}V${ty}Z" fill="#120d09"/>` +
        `<path d="M${mx + 2} ${ty}V${ty - 22}H${mx + 38}V${ty}" stroke="#8a5a2b" stroke-width="4" fill="none"/>`,
    });
    // torre de extração
    objects.push({
      y: my + 2,
      s:
        isoBox(mx + 80, my + 2, 24, 24, 12, '#7b828c', { shadow: true }) +
        `<path d="M${mx + 66} ${my - 16}L${mx + 80} ${my - 86}L${mx + 94} ${my - 16}M${mx + 71} ${my - 40}H${mx + 89}M${mx + 75} ${my - 62}H${mx + 85}M${mx + 71} ${my - 40}L${mx + 85} ${my - 62}M${mx + 89} ${my - 40}L${mx + 75} ${my - 62}" stroke="#3a3f47" stroke-width="3" fill="none"/>` +
        `<circle cx="${mx + 80}" cy="${my - 88}" r="7" fill="none" stroke="#2a2e35" stroke-width="3"/>` +
        `<path d="M${mx + 80} ${my - 88}L${mx + 30} ${my + 40}" stroke="#2a2e35" stroke-width="1.5"/>`,
    });
    // galpão
    objects.push({ y: my + 52, s: house(mx + 100, my + 52, 44, 28, 16, '#8f959d', '#566270') });
    // pilhas de minério de cobre
    const pile = (x, y, r, color) =>
      `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.42)}" fill="${shade(color, 0.55)}"/>` +
      `<polygon points="${pts([[x - r, y], [x, y - r * 1.15], [x + r, y]])}" fill="${color}"/>` +
      `<polygon points="${pts([[x - r, y], [x, y - r * 1.15], [x - r * 0.15, y]])}" fill="${shade(color, 1.25)}"/>`;
    objects.push({ y: my + 66, s: pile(mx + 20, my + 66, 22, '#c8732e') });
    objects.push({ y: my + 78, s: pile(mx - 16, my + 78, 15, '#b5652a') });
    objects.push({ y: my + 50, s: pile(mx + 50, my + 50, 12, '#4fa58a') });
    // caminhão
    objects.push({
      y: my + 86,
      s: isoBox(mx + 40, my + 86, 20, 11, 9, '#e2b23a', { shadow: true }) + isoBox(mx + 61, my + 75.5, 8, 11, 11, '#f3cf5e'),
    });

    // ---------- árvores ----------
    const blocked = [
      [NOVA_AURORA[0], NOVA_AURORA[1], 215], [PORTO_AZUL[0], PORTO_AZUL[1], 215],
      [VALE_CENTRAL[0], VALE_CENTRAL[1], 255], [mx, my, 240],
      ...fields.map(([fx, fy]) => [fx, fy, 78]),
    ];
    const lines = [];
    for (const road of roads) lines.push(...road);
    for (let i = 0; i < riverLine.length - 1; i++) {
      for (let t = 0; t < 1; t += 0.125) lines.push(lerp(riverLine[i], riverLine[i + 1], t));
    }
    const canPlant = (x, y) => {
      if (x < 10 || x > W - 10 || y < 30 || y > coastY(x) - 34) return false;
      for (const [bx, by, r] of blocked) if (Math.hypot(x - bx, y - by) < r) return false;
      for (const p of lines) if (Math.abs(x - p[0]) < 28 && Math.abs(y - p[1]) < 28) return false;
      return true;
    };
    const plant = (x, y, conifer) => {
      if (canPlant(x, y)) objects.push({ y, s: tree(x, y, 0.8 + rnd() * 0.5, conifer) });
    };
    const forests = [[300, 770, 300, 200, 170], [250, 180, 290, 150, 130], [780, 170, 260, 120, 90], [1760, 960, 230, 70, 55], [620, 880, 200, 60, 40]];
    for (const [cx, cy, rx, ry, count] of forests) {
      for (let i = 0; i < count; i++) {
        const angle = rnd() * Math.PI * 2;
        const radius = Math.sqrt(rnd());
        plant(cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius, rnd() < 0.15);
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      if (!(x > 950 && y < 440)) plant(x, y, false);
    }
    for (let i = 0; i < 90; i++) plant(980 + rnd() * 990, 440 + rnd() * 110, true);

    objects.sort((p, q) => p.y - q.y);

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">` +
      '<defs>' +
      '<linearGradient id="ul-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6aa650"/><stop offset="1" stop-color="#5a9645"/></linearGradient>' +
      '<linearGradient id="ul-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7fc0"/><stop offset="1" stop-color="#153c74"/></linearGradient>' +
      '<filter id="ul-tex-dark" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0025 0.004" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.42  0 0 0 0 0.18  0 0 0 0.9 -0.3"/></filter>' +
      '<filter id="ul-tex-light" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.006" numOctaves="2" seed="21"/><feColorMatrix values="0 0 0 0 0.58  0 0 0 0 0.76  0 0 0 0 0.36  0 0 0 0.7 -0.26"/></filter>' +
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

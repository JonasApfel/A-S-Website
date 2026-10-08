// 3D-Bauablauf für die Startseite (Three.js, MIT-Lizenz).
// Ein Haus mit Satteldach (Dachneigung 50°, wie im Logo) entsteht in acht Bauabschnitten:
// 0 Erdarbeiten · 1 Keller · 2 Mauerwerk · 3 Decke & Dachstuhl · 4 Dach · 5 Ausbau · 6 Außenanlage · 7 Licht an.
// Der Zustand hängt nur von der Bauzeit T (0 bis 8) ab, deshalb lässt sich alles vor- und zurückspulen.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, BoxGeometry,
  IcosahedronGeometry, DodecahedronGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial,
  HemisphereLight, DirectionalLight, Color, Object3D, Vector3, MathUtils, CanvasTexture, SRGBColorSpace,
  RepeatWrapping, PCFShadowMap, NeutralToneMapping, PMREMGenerator, DoubleSide, Shape, Path, ShapeGeometry,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ---------- Maße in Metern ----------
const W = 8, LEN = 11;              // Außenmaße Haus
const FL = 0.3;                     // Oberkante Rohfußboden über Gelände
const H = 3.0;                      // Wandhöhe bis Traufe
const PITCH = MathUtils.degToRad(50);
const RIDGE = (W / 2) * Math.tan(PITCH);
const EAVE_Y = FL + H;
const TW = 0.36;                    // Wanddicke
const BL = 0.5, BH = 0.25, J = 0.014; // Planziegel und Fuge
const OVER = 0.6, OVER_G = 0.5;     // Dachüberstand Traufe / Ortgang
const PL = 10, PL_D = 3.0;          // Modellsockel: halbe Kantenlänge, Tiefe
const PIT = { x: 5.2, z: 6.7, floor: -2.9 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const smooth = (t) => t * t * (3 - 2 * t);
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- Kamerafahrt: ein Halt je Abschnitt ----------
// k = 0 Kopfbereich, 1–7 die sieben Bauabschnitte, 8 Schlüsselübergabe
const CAMS = [
  { p: [30, 17, 55], t: [0, 1.6, 0] },
  { p: [25, 29, 33], t: [0, -1.2, 0.5] },
  { p: [-23, 19, 30], t: [0, -0.6, 0] },
  { p: [21, 11, 30], t: [0, 2, 0] },
  { p: [-25, 20, 22], t: [0, 4.4, 0] },
  { p: [26, 14.5, 25], t: [0, 4.6, 0] },
  { p: [11, 5, 30], t: [0, 3, 2.5] },
  { p: [-30, 27, 36], t: [0, 0.4, 1] },
  { p: [30, 16, 54], t: [0, 1.8, 0] },
];
// Bauzeit je Halt: Im Kopfbereich steht das fertige Haus, dann wird zurückgespult und neu gebaut.
const T_AT = [8, 0.95, 1.6, 2.96, 3.98, 4.99, 5.97, 7.05, 8];
// Hochformat: Kamera etwas weiter weg, damit das Modell über den Textkarten Platz hat
const PORTRAIT_DIST = [1.3, 1.12, 1.18, 1.16, 1.12, 1.1, 1.12, 1.08, 1.3];

function textureCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Erdschichten für die Schnittflächen des Modellsockels
function soilTexture() {
  return textureCanvas(64, 512, (g, w, h) => {
    const layers = [
      [0.0, '#6b5848'], [0.06, '#5a4637'], [0.16, '#8b6b4c'], [0.42, '#a5835d'], [0.7, '#9b9285'], [1, '#9b9285'],
    ];
    for (let i = 0; i < layers.length - 1; i++) {
      g.fillStyle = layers[i][1];
      g.fillRect(0, layers[i][0] * h, w, (layers[i + 1][0] - layers[i][0]) * h + 1);
    }
    const r = rand(3);
    for (let i = 0; i < 900; i++) {
      const y = r() * h, a = 0.05 + r() * 0.12;
      g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      g.fillRect(r() * w, y, 1 + r() * 3, 1 + r() * 2);
    }
  });
}

// Feine Körnung für die Geländeoberfläche
function grainTexture() {
  const t = textureCanvas(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    const r = rand(9);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 228 + r() * 27;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(0.5, 0.5);
  return t;
}

// Gitterwerk für den Kran
function latticeTexture(horizontal) {
  const t = textureCanvas(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineCap = 'square';
    g.lineWidth = 12;
    g.beginPath();
    if (horizontal) {
      g.moveTo(0, 6); g.lineTo(w, 6); g.moveTo(0, h - 6); g.lineTo(w, h - 6);
      g.moveTo(0, h - 6); g.lineTo(w / 2, 6); g.lineTo(w, h - 6);
    } else {
      g.moveTo(6, 0); g.lineTo(6, h); g.moveTo(w - 6, 0); g.lineTo(w - 6, h);
      g.moveTo(6, h); g.lineTo(w - 6, h / 2); g.lineTo(6, 0);
    }
    g.stroke();
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function signTexture() {
  return textureCanvas(1024, 128, (g, w, h) => {
    g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#151515';
    g.font = '800 92px Geist, "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('APFEL-BAU', w / 2, h / 2 + 4);
  });
}

// ---------- Mauerwerk ----------
function cutSegments(a, b, holes) {
  let segs = [[a, b]];
  holes.forEach(([c, d]) => {
    segs = segs.flatMap(([s, e]) => {
      if (e <= c || s >= d) return [[s, e]];
      const out = [];
      if (s < c) out.push([s, c]);
      if (e > d) out.push([d, e]);
      return out;
    });
  });
  return segs.filter(([s, e]) => e - s > 0.11);
}

// Öffnungen: u entlang der Wand, v über Rohfußboden (auf Schichthöhe gerastert)
const OPENINGS = {
  front: [{ u: [-0.6, 0.6], v: [0, 2.25], door: true }, { u: [-2.9, -1.7], v: [1, 2.25] }, { u: [1.7, 2.9], v: [1, 2.25] },
    { u: [-1.35, -0.55], v: [3.5, 4.75] }, { u: [0.55, 1.35], v: [3.5, 4.75] }],
  back: [{ u: [-2.6, -1.2], v: [1, 2.25] }, { u: [1.2, 2.6], v: [1, 2.25] }, { u: [-0.6, 0.6], v: [3.5, 4.75] }],
  right: [{ u: [-4.3, -2.7], v: [1, 2.25] }, { u: [-1.4, 1.4], v: [0, 2.25] }, { u: [2.7, 4.3], v: [1, 2.25] }],
  left: [{ u: [-4.0, -2.8], v: [1, 2.25] }, { u: [-0.6, 0.6], v: [1, 2.25] }, { u: [2.8, 4.0], v: [1, 2.25] }],
};

// Wände: Achse, Position und Richtung im Raum
const WALLS = {
  front: { axis: 'x', fixed: LEN / 2 - TW / 2, sign: 1 },
  back: { axis: 'x', fixed: -(LEN / 2 - TW / 2), sign: -1 },
  right: { axis: 'z', fixed: W / 2 - TW / 2, sign: 1 },
  left: { axis: 'z', fixed: -(W / 2 - TW / 2), sign: -1 },
};

function wallPoint(name, u, y) {
  const w = WALLS[name];
  return w.axis === 'x' ? new Vector3(u, y, w.fixed) : new Vector3(w.fixed, y, u);
}

function buildBrickLayout() {
  const bricks = [], lintels = [];
  const courses = Math.round(H / BH) + 1 + Math.ceil(RIDGE / BH);
  for (let c = 0; c < courses; c++) {
    const v0 = c * BH, vMid = v0 + BH / 2;
    const isGable = v0 >= H;
    if (c === Math.round(H / BH)) continue; // Hier liegt die Geschossdecke
    Object.keys(WALLS).forEach((name) => {
      const longWall = WALLS[name].axis === 'z';
      if (isGable && longWall) return;
      // Eckverband: abwechselnd laufen Längs- oder Giebelwände durch
      const through = (c % 2 === 0) === longWall;
      let half = longWall ? LEN / 2 : W / 2;
      if (!through) half -= TW;
      if (isGable) half = Math.min(half, (RIDGE - (vMid - H - BH)) / Math.tan(PITCH) - 0.06);
      if (half < 0.2) return;
      const holes = [], lintelHoles = [];
      OPENINGS[name].forEach((o) => {
        if (vMid > o.v[0] && vMid < o.v[1]) holes.push(o.u);
        if (vMid > o.v[1] && vMid < o.v[1] + BH) { const h = [o.u[0] - 0.25, o.u[1] + 0.25]; holes.push(h); lintelHoles.push(h); }
      });
      lintelHoles.forEach(([a, b]) => lintels.push({ wall: name, u: (a + b) / 2, len: b - a, y: FL + vMid, c }));
      const offset = (c % 2) * (BL / 2) + (longWall ? 0.13 : 0);
      const pieces = [];
      for (let x = -half - offset; x < half; x += BL) pieces.push([Math.max(x, -half), Math.min(x + BL, half)]);
      pieces.flatMap(([a, b]) => cutSegments(a, b, holes)).forEach(([a, b]) => {
        bricks.push({ wall: name, u: (a + b) / 2, len: b - a, y: FL + vMid, c, gable: isGable });
      });
    });
  }
  return { bricks, lintels, courses };
}

export function initHouse(container, { reduced = false, onFail } = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { onFail?.(); return null; }
  if (!renderer.getContext()) { onFail?.(); return null; }

  const small = () => container.clientWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  const camera = new PerspectiveCamera(30, 1, 0.5, 400);
  const root = new Group();
  scene.add(root);

  // ---------- Licht ----------
  const hemi = new HemisphereLight(0xfff8ef, 0xb9ab95, 1.15);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff0dc, 2.5);
  sun.position.set(-14, 24, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small() ? 1024 : 2048, small() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new DirectionalLight(0xdfe8ff, 0.45);
  fill.position.set(16, 8, -12);
  scene.add(fill);

  const mat = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  const box = (w, h, d, m, shadow = true) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), m);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    return mesh;
  };

  // ---------- Modellsockel mit Baugrube ----------
  const soil = soilTexture();
  const sideMat = new MeshStandardMaterial({ map: soil, roughness: 0.95 });
  const ground = new Color();
  const groundSite = new Color('#cdb899'), groundLawn = new Color('#b7c098');
  const topMat = mat('#b7c098', { roughness: 0.95, map: grainTexture() });
  const bottomMat = mat('#4a3d33');
  const pitMat = mat('#6f5a47', { roughness: 1 });
  const faces = (top = topMat) => [sideMat, sideMat, top, bottomMat, sideMat, sideMat];
  const block = (x0, x1, z0, z1, y0, y1, top) => {
    const m = new Mesh(new BoxGeometry(1, 1, 1), faces(top));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  block(-PL, -PIT.x, -PL, PL, -PL_D, 0);
  block(PIT.x, PL, -PL, PL, -PL_D, 0);
  block(-PIT.x, PIT.x, PIT.z, PL, -PL_D, 0);
  block(-PIT.x, PIT.x, -PL, -PIT.z, -PL_D, 0);
  // Was ausgehoben wird
  const pitFill = block(-PIT.x + 0.01, PIT.x - 0.01, -PIT.z + 0.01, PIT.z - 0.01, -PL_D, 0, topMat);
  const pitFillTop = [topMat, pitMat];
  // Arbeitsraum, der nach dem Keller wieder verfüllt wird
  const backfill = [
    [-PIT.x, -W / 2, -PIT.z, PIT.z], [W / 2, PIT.x, -PIT.z, PIT.z], [-W / 2, W / 2, LEN / 2, PIT.z], [-W / 2, W / 2, -PIT.z, -LEN / 2],
  ].map(([x0, x1, z0, z1]) => ({ m: block(x0 + 0.005, x1 - 0.005, z0 + 0.005, z1 - 0.005, PIT.floor, 0), x0, x1, z0, z1 }));

  // Durchgehende Oberflächen, damit keine Fugen zwischen den Blöcken sichtbar sind
  const outer = new Shape().moveTo(-PL, -PL).lineTo(PL, -PL).lineTo(PL, PL).lineTo(-PL, PL).lineTo(-PL, -PL);
  const holed = outer.clone();
  holed.holes.push(new Path().moveTo(-PIT.x, -PIT.z).lineTo(-PIT.x, PIT.z).lineTo(PIT.x, PIT.z).lineTo(PIT.x, -PIT.z).lineTo(-PIT.x, -PIT.z));
  const surface = (shape) => {
    const m = new Mesh(new ShapeGeometry(shape), topMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.003;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const surfaceFull = surface(outer), surfaceHoled = surface(holed);
  [[0, PL, 0], [0, -PL, Math.PI], [PL, 0, Math.PI / 2], [-PL, 0, -Math.PI / 2]].forEach(([x, z, ry]) => {
    const m = new Mesh(new PlaneGeometry(2 * PL, PL_D), sideMat);
    m.position.set(x * 1.0002, -PL_D / 2, z * 1.0002);
    m.rotation.y = ry;
    root.add(m);
  });

  // Schatten auf dem Papier unter dem Modell
  const catcher = new Mesh(new PlaneGeometry(120, 120), new ShadowMaterial({ opacity: 0.1 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -PL_D - 0.01;
  catcher.receiveShadow = true;
  root.add(catcher);

  // ---------- Keller ----------
  const concrete = mat('#b9b6b0', { roughness: 0.9 });
  const slab = box(W + 0.5, 0.25, LEN + 0.5, concrete);
  const cellar = new Group();
  const cw = [
    [W, 0.3, 0, LEN / 2 - 0.15], [W, 0.3, 0, -(LEN / 2 - 0.15)], [0.3, LEN - 0.6, W / 2 - 0.15, 0], [0.3, LEN - 0.6, -(W / 2 - 0.15), 0],
  ].map(([w, dd, x, z]) => {
    const m = box(w, 1, dd, concrete);
    m.position.set(x, 0, z);
    cellar.add(m);
    return m;
  });
  root.add(slab, cellar);
  const cellarTop = 0.05, cellarBottom = PIT.floor + 0.25;
  const deck = box(W, FL - cellarTop, LEN, concrete);
  root.add(deck);

  // ---------- Mauerwerk ----------
  const { bricks, lintels, courses } = buildBrickLayout();
  const brickMat = mat('#ffffff', { roughness: 0.82 });
  const brickMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), brickMat, bricks.length);
  brickMesh.castShadow = brickMesh.receiveShadow = true;
  const rb = rand(11);
  const cPlaster = new Color('#f1ede6'), cWood = new Color('#c6a27a'), tmp = new Color();
  const boardShade = [];
  for (let c = 0; c < 40; c++) boardShade.push(cWood.clone().offsetHSL(0, (rb() - 0.5) * 0.04, (rb() - 0.5) * 0.07));
  bricks.forEach((b, i) => {
    b.base = new Color('#c7744c').offsetHSL((rb() - 0.5) * 0.025, (rb() - 0.5) * 0.12, (rb() - 0.5) * 0.09);
    b.finish = b.gable ? boardShade[b.c] : cPlaster;
    const rel = b.c / courses;
    b.start = b.gable ? 3.18 + ((b.c - 12) / (courses - 12)) * 0.42 + rb() * 0.03 : 2.02 + (b.c / 12) * 0.8 + rb() * 0.05;
    b.start += (b.u / 12) * 0.03;
    b.drop = 0.7 + rb() * 0.9;
    b.spin = (rb() - 0.5) * 0.8;
    b.rel = rel;
    brickMesh.setColorAt(i, b.base);
  });
  root.add(brickMesh);
  brickMesh.frustumCulled = false;

  const lintelMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), concrete.clone(), lintels.length);
  lintelMesh.castShadow = lintelMesh.receiveShadow = true;
  lintels.forEach((l, i) => {
    l.gable = (l.y - FL) > H;
    l.start = !l.gable ? 2.02 + (l.c / 12) * 0.8 : 3.18 + ((l.c - 12) / (courses - 12)) * 0.42;
    lintelMesh.setColorAt(i, concrete.color);
  });
  lintelMesh.material.color.set('#ffffff');
  root.add(lintelMesh);
  lintelMesh.frustumCulled = false;

  // ---------- Geschossdecke und Dachstuhl ----------
  const ceiling = box(W, BH, LEN, concrete.clone());
  root.add(ceiling);
  const timber = mat('#c79f72', { roughness: 0.75 });
  const rafterH = 0.22;
  const rafterLen = (W / 2 + OVER) / Math.cos(PITCH);
  const rafterZ = [];
  for (let z = -(LEN / 2 + OVER_G - 0.1); z <= LEN / 2 + OVER_G - 0.09; z += 0.86) rafterZ.push(z);
  const rafters = new InstancedMesh(new BoxGeometry(rafterLen, rafterH, 0.1), timber, rafterZ.length * 2);
  rafters.castShadow = rafters.receiveShadow = true;
  root.add(rafters);
  rafters.frustumCulled = false;
  const ridgeBeam = box(0.2, 0.26, LEN + 2 * OVER_G, timber);
  root.add(ridgeBeam);
  const plates = [-1, 1].map((s) => { const m = box(0.16, 0.14, LEN, timber); m.position.set(s * (W / 2 - 0.12), EAVE_Y + 0.07, 0); root.add(m); return m; });

  // ---------- Dachdeckung ----------
  const ROWS = 18;
  const slopeLen = rafterLen;
  const roofOff = rafterH + 0.08;
  const apexShift = roofOff * Math.tan(PITCH);
  const roofLen = slopeLen + apexShift;
  const roofMat = mat('#ffffff', { roughness: 0.62 });
  const roofRows = new InstancedMesh(new BoxGeometry(roofLen / ROWS - 0.012, 0.07, LEN + 2 * OVER_G), roofMat, ROWS * 2);
  roofRows.castShadow = roofRows.receiveShadow = true;
  const rr = rand(5);
  for (let i = 0; i < ROWS * 2; i++) roofRows.setColorAt(i, new Color('#a8180d').offsetHSL(0, (rr() - 0.5) * 0.06, (rr() - 0.5) * 0.035));
  root.add(roofRows);
  roofRows.frustumCulled = false;
  const ridgeCap = box(0.42, 0.2, LEN + 2 * OVER_G + 0.04, mat('#7d1209', { roughness: 0.6 }));
  root.add(ridgeCap);
  const trimMat = mat('#2d2c2a', { roughness: 0.6 });
  const verges = [];
  [-1, 1].forEach((side) => [-1, 1].forEach((end) => {
    const m = box(roofLen + 0.06, 0.3, 0.05, trimMat);
    m.userData = { side, end };
    verges.push(m); root.add(m);
  }));
  // Photovoltaik auf der rechten Dachfläche
  const pvMat = mat('#1f2733', { roughness: 0.35, metalness: 0.4 });
  const pv = new InstancedMesh(new BoxGeometry(1.0, 0.05, 1.7), pvMat, 10);
  pv.castShadow = true;
  root.add(pv);
  pv.frustumCulled = false;

  // ---------- Fenster und Tür ----------
  const frameMat = mat('#2b2a28', { roughness: 0.5 });
  const glassMat = new MeshStandardMaterial({ color: '#3a4855', roughness: 0.06, metalness: 0.75, emissive: new Color('#ffb35c'), emissiveIntensity: 0, envMapIntensity: 1.7 });
  const doorMat = mat('#8a5d3b', { roughness: 0.6 });
  const windows = [];
  Object.entries(OPENINGS).forEach(([name, list]) => {
    list.forEach((o, idx) => {
      const w = o.u[1] - o.u[0], h = o.v[1] - o.v[0];
      const g = new Group();
      const out = WALLS[name].sign;
      const longWall = WALLS[name].axis === 'z';
      const frame = box(w, h, 0.08, o.door ? doorMat : frameMat, false);
      g.add(frame);
      if (!o.door) {
        const glass = box(w - 0.14, h - 0.14, 0.03, glassMat, false);
        glass.position.z = 0.03;
        g.add(glass);
        if (w > 1.5) { const mull = box(0.07, h - 0.1, 0.06, frameMat, false); mull.position.z = 0.04; g.add(mull); }
      } else {
        const handle = box(0.05, 0.5, 0.06, frameMat, false);
        handle.position.set(w / 2 - 0.18, 0, 0.06);
        g.add(handle);
      }
      const p = wallPoint(name, (o.u[0] + o.u[1]) / 2, FL + (o.v[0] + o.v[1]) / 2);
      if (longWall) { g.rotation.y = out * Math.PI / 2; p.x += out * 0.02; } else { if (out < 0) g.rotation.y = Math.PI; p.z += out * 0.02; }
      g.position.copy(p);
      g.userData.start = 5.36 + idx * 0.05 + (name === 'front' ? 0 : 0.08);
      windows.push(g);
      root.add(g);
    });
  });

  // ---------- Außenanlage ----------
  const granite = new Color('#a9a7a1');
  const paverGeo = new BoxGeometry(1, 1, 1);
  const pavers = [];
  for (let z = LEN / 2 + 0.15, row = 0; z < PL - 0.1; z += 0.26, row++) {
    for (let x = -0.85 + (row % 2) * 0.2; x < 0.85; x += 0.42) {
      const a = Math.max(x, -0.85), b = Math.min(x + 0.4, 0.85);
      if (b - a > 0.12) pavers.push({ x: (a + b) / 2, z, w: b - a, d: 0.24, h: 0.06, start: 6.08 + row * 0.012 });
    }
  }
  for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 6; iz++) {
    pavers.push({ x: W / 2 + 0.55 + ix * 0.8, z: -2.2 + iz * 0.8, w: 0.77, d: 0.77, h: 0.07, start: 6.42 + (ix + iz) * 0.02 });
  }
  const paverMesh = new InstancedMesh(paverGeo, mat('#ffffff', { roughness: 0.9 }), pavers.length);
  paverMesh.castShadow = paverMesh.receiveShadow = true;
  const rp = rand(21);
  pavers.forEach((p, i) => paverMesh.setColorAt(i, granite.clone().offsetHSL(0, 0, (rp() - 0.5) * 0.1)));
  root.add(paverMesh);
  paverMesh.frustumCulled = false;

  // Natursteinmauer
  const stones = [];
  const rs = rand(31);
  for (let layer = 0; layer < 2; layer++) {
    for (let x = -9.2; x < -5.6; x += 0.62 + rs() * 0.2) {
      stones.push({ x: x + layer * 0.3, z: 8.1 + (rs() - 0.5) * 0.12, y: 0.24 + layer * 0.4, s: 0.32 + rs() * 0.12, r: [rs() * 3, rs() * 3, rs() * 3], start: 6.3 + (x + 9.2) * 0.07 + layer * 0.12 });
    }
  }
  const stoneMesh = new InstancedMesh(new DodecahedronGeometry(1, 0), mat('#ffffff', { roughness: 0.95, flatShading: true }), stones.length);
  stoneMesh.castShadow = stoneMesh.receiveShadow = true;
  stones.forEach((s, i) => stoneMesh.setColorAt(i, new Color('#b3aea4').offsetHSL(0.02 * (rs() - 0.5), 0, (rs() - 0.5) * 0.14)));
  root.add(stoneMesh);
  stoneMesh.frustumCulled = false;
  const trough = box(1.1, 0.55, 0.6, mat('#9d9a94', { roughness: 0.95 }));
  root.add(trough);

  // Bäume
  const trees = [[-7.6, -7.4, 1.7], [7.3, -7.2, 1.5], [-8.2, -1.2, 1.4], [-3.4, 8.7, 1.05], [8.3, 8.1, 1.1], [3.6, -8.5, 1.2]].map(([x, z, s], i) => {
    const g = new Group();
    const trunk = box(0.22, 1.6, 0.22, mat('#6d5845'));
    trunk.position.y = 0.8;
    const crown = new Mesh(new IcosahedronGeometry(1, 1), mat(i % 2 ? '#7f8f63' : '#93a072', { flatShading: true, roughness: 0.9 }));
    crown.position.y = 2.2; crown.scale.set(1, 1.15, 1);
    crown.castShadow = true; crown.receiveShadow = true;
    g.add(trunk, crown);
    g.position.set(x, 0, z);
    g.userData = { s, start: 6.45 + i * 0.07 };
    root.add(g);
    return g;
  });

  // ---------- Bagger ----------
  const redMach = mat('#b3241a', { roughness: 0.55 });
  const dark = mat('#2a2928', { roughness: 0.7 });
  const excavator = new Group();
  [-0.78, 0.78].forEach((z) => { const t = box(3.0, 0.7, 0.62, dark); t.position.set(0, 0.35, z); excavator.add(t); });
  const upper = new Group();
  upper.position.y = 0.75;
  const body = box(2.3, 0.85, 1.9, redMach); body.position.set(0.35, 0.45, 0);
  const cab = box(1.0, 1.05, 0.9, dark); cab.position.set(-0.2, 1.4, -0.45);
  const weight = box(0.5, 0.75, 1.9, dark); weight.position.set(1.55, 0.5, 0);
  upper.add(body, cab, weight);
  const boom = new Group(); boom.position.set(-0.75, 0.9, 0.35);
  const boomArm = box(3.0, 0.38, 0.34, redMach); boomArm.position.x = -1.5;
  const stick = new Group(); stick.position.x = -3.0;
  const stickArm = box(2.1, 0.28, 0.26, redMach); stickArm.position.x = -1.05;
  const bucket = box(0.55, 0.55, 0.85, dark); bucket.position.set(-2.15, -0.1, 0);
  stick.add(stickArm, bucket);
  boom.add(boomArm, stick);
  upper.add(boom);
  excavator.add(upper);
  excavator.position.set(7.9, 0, 3.6);
  root.add(excavator);

  // ---------- Turmdrehkran ----------
  const craneMat = (tex) => new MeshStandardMaterial({ color: '#d4572b', map: tex, alphaTest: 0.5, side: DoubleSide, roughness: 0.6 });
  const crane = new Group();
  const MAST_H = 15.5;
  const mastTex = latticeTexture(false); mastTex.repeat.set(1, MAST_H / 1.3);
  const mast = new Mesh(new BoxGeometry(1.3, MAST_H, 1.3), craneMat(mastTex));
  mast.position.y = MAST_H / 2; mast.castShadow = true;
  const foot = box(2.6, 0.5, 2.6, concrete); foot.position.y = 0.25;
  const head = new Group(); head.position.y = MAST_H;
  const jibTex = latticeTexture(true); jibTex.repeat.set(17 / 1.1, 1);
  const jib = new Mesh(new BoxGeometry(17, 1.1, 1.1), craneMat(jibTex));
  jib.position.set(8.5 - 0.65, 0.55, 0); jib.castShadow = true;
  const cjTex = latticeTexture(true); cjTex.repeat.set(5 / 1.1, 1);
  const counterJib = new Mesh(new BoxGeometry(5, 0.9, 1.1), craneMat(cjTex));
  counterJib.position.set(-3.1, 0.45, 0); counterJib.castShadow = true;
  const ballast = box(1.4, 1.6, 1.3, concrete); ballast.position.set(-4.6, -0.3, 0);
  const cabin = box(1.2, 1.3, 1.2, mat('#efede8', { roughness: 0.5 })); cabin.position.set(0.9, -0.6, 0.9);
  const sign = new Mesh(new PlaneGeometry(8, 1.0), new MeshBasicMaterial({ map: signTexture(), toneMapped: false, side: DoubleSide }));
  sign.position.set(5.6, 0.55, 0.6);
  const tip = box(0.5, 2.6, 0.5, craneMat(mastTex)); tip.position.y = 1.3;
  const trolley = new Group();
  const cable = box(0.04, 1, 0.04, dark, false);
  const load = box(1.1, 0.7, 1.1, mat('#c7744c'));
  const pallet = box(1.2, 0.14, 1.2, timber);
  trolley.add(cable, load, pallet);
  head.add(jib, counterJib, ballast, cabin, sign, tip, trolley);
  crane.add(foot, mast, head);
  crane.position.set(-7.7, 0, -3.4);
  root.add(crane);

  // ---------- Zustand für die Bauzeit T ----------
  const dummy = new Object3D();
  const n = new Vector3(), d = new Vector3();

  function setBuild(T) {
    // Erdarbeiten
    const dig = easeInOut(seg(T, 0.12, 0.88));
    const fillTop = MathUtils.lerp(0, PIT.floor, dig);
    pitFill.scale.y = fillTop + PL_D;
    pitFill.position.y = (-PL_D + fillTop) / 2;
    pitFill.material[2] = dig > 0.02 ? pitFillTop[1] : pitFillTop[0];
    const closed = T < 0.12 || T >= 1.9;
    surfaceFull.visible = closed; surfaceHoled.visible = !closed;

    // Keller
    const ks = easeOut(seg(T, 1.0, 1.25));
    slab.visible = ks > 0;
    slab.scale.set(1, Math.max(ks, 0.001), 1);
    slab.position.set(0, PIT.floor + 0.125 * ks, 0);
    const kw = easeInOut(seg(T, 1.22, 1.62));
    cellar.visible = kw > 0;
    const wallH = (cellarTop - cellarBottom) * kw;
    cw.forEach((m) => { m.scale.y = Math.max(wallH, 0.001); m.position.y = cellarBottom + wallH / 2; });
    const bf = easeInOut(seg(T, 1.6, 1.86));
    backfill.forEach(({ m }) => { const h = Math.max(-PIT.floor * bf, 0.001); m.scale.y = h; m.position.y = PIT.floor + h / 2; m.visible = bf > 0; });
    const dk = easeOut(seg(T, 1.82, 2.0));
    deck.visible = dk > 0;
    deck.scale.set(dk, 1, 1);
    deck.position.y = (cellarTop + FL) / 2;

    // Mauerwerk mit Verputz bzw. Holzschalung im Ausbau
    const finish = easeInOut(seg(T, 5.0, 5.42));
    bricks.forEach((b, i) => {
      const k = seg(T, b.start, b.start + 0.12);
      const e = easeOut(k);
      const p = wallPoint(b.wall, b.u, b.y + b.drop * (1 - e));
      const longWall = WALLS[b.wall].axis === 'z';
      dummy.position.copy(p);
      dummy.rotation.set(0, (longWall ? Math.PI / 2 : 0) + b.spin * (1 - e), 0);
      const s = k <= 0 ? 0.0001 : 1;
      const lenScale = b.len - J + J * finish;
      const hScale = b.gable ? BH - J : BH - J + J * finish;
      dummy.scale.set(lenScale * s, hScale * s, (TW - (b.gable ? 0.04 * finish : 0)) * s);
      dummy.updateMatrix();
      brickMesh.setMatrixAt(i, dummy.matrix);
      tmp.copy(b.base).lerp(b.finish, finish);
      brickMesh.setColorAt(i, tmp);
    });
    brickMesh.instanceMatrix.needsUpdate = true;
    brickMesh.instanceColor.needsUpdate = true;

    lintels.forEach((l, i) => {
      const k = easeOut(seg(T, l.start, l.start + 0.12));
      const longWall = WALLS[l.wall].axis === 'z';
      dummy.position.copy(wallPoint(l.wall, l.u, l.y + 1.2 * (1 - k)));
      dummy.rotation.set(0, longWall ? Math.PI / 2 : 0, 0);
      const s = k <= 0 ? 0.0001 : 1;
      dummy.scale.set(l.len * s, (BH - J + J * finish) * s, TW * s);
      dummy.updateMatrix();
      lintelMesh.setMatrixAt(i, dummy.matrix);
    });
    lintelMesh.instanceMatrix.needsUpdate = true;
    lintels.forEach((l, i) => lintelMesh.setColorAt(i, tmp.copy(concrete.color).lerp(l.gable ? boardShade[l.c] : cPlaster, finish)));
    lintelMesh.instanceColor.needsUpdate = true;

    // Geschossdecke
    const ce = easeOut(seg(T, 3.0, 3.2));
    ceiling.visible = ce > 0;
    ceiling.scale.set(1, 1, Math.max(ce, 0.001));
    ceiling.position.set(0, EAVE_Y + BH / 2, 0);
    ceiling.material.color.copy(concrete.color).lerp(cPlaster, finish);

    // Dachstuhl
    rafterZ.forEach((z, i) => {
      [-1, 1].forEach((side, j) => {
        const st = 3.52 + (i / rafterZ.length) * 0.32 + j * 0.02;
        const k = easeOut(seg(T, st, st + 0.12));
        const along = rafterLen / 2;
        d.set(side * Math.cos(PITCH), -Math.sin(PITCH), 0);
        n.set(side * Math.sin(PITCH), Math.cos(PITCH), 0);
        const ridgeY = EAVE_Y + BH + RIDGE - 0.02;
        dummy.position.set(d.x * along + n.x * rafterH / 2, ridgeY + d.y * along + n.y * rafterH / 2 + 1.5 * (1 - k), z);
        dummy.rotation.set(0, 0, side > 0 ? -PITCH : PITCH);
        const s = k <= 0 ? 0.0001 : 1;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        rafters.setMatrixAt(i * 2 + j, dummy.matrix);
      });
    });
    rafters.instanceMatrix.needsUpdate = true;
    const rb2 = easeOut(seg(T, 3.82, 3.96));
    ridgeBeam.visible = rb2 > 0;
    ridgeBeam.position.set(0, EAVE_Y + BH + RIDGE + 0.05 + 1.2 * (1 - rb2), 0);
    const pl = easeOut(seg(T, 3.4, 3.55));
    plates.forEach((m) => { m.visible = pl > 0; m.scale.set(1, 1, Math.max(pl, 0.001)); m.position.y = EAVE_Y + BH + 0.07; });

    // Dachdeckung
    const ridgeY = EAVE_Y + BH + RIDGE - 0.02;
    for (let r = 0; r < ROWS; r++) {
      [-1, 1].forEach((side, j) => {
        const st = 4.05 + ((ROWS - 1 - r) / ROWS) * 0.7 + j * 0.03;
        const k = easeOut(seg(T, st, st + 0.13));
        const along = (r + 0.5) * (roofLen / ROWS) - apexShift;
        d.set(side * Math.cos(PITCH), -Math.sin(PITCH), 0);
        n.set(side * Math.sin(PITCH), Math.cos(PITCH), 0);
        const lift = 0.9 * (1 - k);
        dummy.position.set(d.x * along + n.x * (roofOff + lift) , ridgeY + d.y * along + n.y * (roofOff + lift) + (r % 2) * 0.004, 0);
        dummy.rotation.set(0, 0, side > 0 ? -PITCH : PITCH);
        const s = k <= 0 ? 0.0001 : 1;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        roofRows.setMatrixAt(r * 2 + j, dummy.matrix);
      });
    }
    roofRows.instanceMatrix.needsUpdate = true;
    const cap = easeOut(seg(T, 4.82, 4.98));
    ridgeCap.visible = cap > 0;
    ridgeCap.position.set(0, ridgeY + (roofOff + 0.035) / Math.cos(PITCH) + 0.02 + 0.8 * (1 - cap), 0);
    const vg = easeOut(seg(T, 4.75, 4.95));
    verges.forEach((m) => {
      const { side, end } = m.userData;
      const along = roofLen / 2 - apexShift;
      m.visible = vg > 0;
      m.position.set(side * (Math.cos(PITCH) * along + Math.sin(PITCH) * (roofOff - 0.05)), ridgeY - Math.sin(PITCH) * along + Math.cos(PITCH) * (roofOff - 0.05), end * (LEN / 2 + OVER_G + 0.02 + 0.6 * (1 - vg)));
      m.rotation.set(0, 0, side > 0 ? -PITCH : PITCH);
    });
    // Photovoltaik
    for (let i = 0; i < 10; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const k = easeOut(seg(T, 6.62 + i * 0.025, 6.74 + i * 0.025));
      const along = 1.7 + row * 1.78;
      d.set(Math.cos(PITCH), -Math.sin(PITCH), 0);
      n.set(Math.sin(PITCH), Math.cos(PITCH), 0);
      dummy.position.set(d.x * along + n.x * (roofOff + 0.1 + 0.6 * (1 - k)), ridgeY + d.y * along + n.y * (roofOff + 0.1 + 0.6 * (1 - k)), -3.3 + col * 1.06);
      dummy.rotation.set(0, 0, -PITCH);
      const s = k <= 0 ? 0.0001 : 1;
      dummy.scale.set(s * 1.7, s, s * 0.6);
      dummy.updateMatrix();
      pv.setMatrixAt(i, dummy.matrix);
    }
    pv.instanceMatrix.needsUpdate = true;

    // Fenster und Tür
    windows.forEach((g) => {
      const k = easeOut(seg(T, g.userData.start, g.userData.start + 0.14));
      g.visible = k > 0;
      g.scale.setScalar(Math.max(k, 0.001));
    });

    // Außenanlage
    const lawn = easeInOut(seg(T, 6.0, 6.35));
    ground.copy(groundSite).lerp(groundLawn, lawn);
    topMat.color.copy(ground);
    pavers.forEach((p, i) => {
      const k = easeOut(seg(T, p.start, p.start + 0.1));
      const s = k <= 0 ? 0.0001 : 1;
      dummy.position.set(p.x, p.h / 2 + 0.6 * (1 - k), p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p.w * s, p.h * s, p.d * s);
      dummy.updateMatrix();
      paverMesh.setMatrixAt(i, dummy.matrix);
    });
    paverMesh.instanceMatrix.needsUpdate = true;
    stones.forEach((st, i) => {
      const k = backOut(seg(T, st.start, st.start + 0.12));
      dummy.position.set(st.x, st.y, st.z);
      dummy.rotation.set(st.r[0], st.r[1], st.r[2]);
      dummy.scale.setScalar(Math.max(st.s * k, 0.0001));
      dummy.updateMatrix();
      stoneMesh.setMatrixAt(i, dummy.matrix);
    });
    stoneMesh.instanceMatrix.needsUpdate = true;
    const tr = backOut(seg(T, 6.7, 6.85));
    trough.visible = tr > 0.001;
    trough.scale.setScalar(Math.max(tr, 0.001));
    trough.position.set(1.7, 0.28 * tr, 7.4);
    trees.forEach((g) => {
      const k = backOut(seg(T, g.userData.start, g.userData.start + 0.22));
      g.visible = k > 0.001;
      g.scale.setScalar(Math.max(k * g.userData.s, 0.001));
    });

    // Bagger: kommt, gräbt, verfüllt, fährt weg
    const exIn = backOut(seg(T, 0.0, 0.14)), exOut = easeInOut(seg(T, 1.86, 2.08));
    const exScale = Math.min(exIn, 1 - exOut);
    excavator.visible = exScale > 0.001;
    excavator.scale.setScalar(Math.max(exScale, 0.001));
    excavator.position.x = 7.9 + exOut * 2;
    const phase = T * Math.PI * 6;
    upper.rotation.y = 0.25 * Math.sin(phase * 0.5);
    boom.rotation.z = -(0.55 + 0.22 * Math.sin(phase));
    stick.rotation.z = 1.2 + 0.45 * Math.sin(phase + 1.1);

    // Kran: steht vom Mauerwerk bis zum Dach
    const crIn = easeOut(seg(T, 2.02, 2.3)), crOut = easeInOut(seg(T, 5.08, 5.4));
    const crScale = Math.min(crIn, 1 - crOut);
    crane.visible = crScale > 0.001;
    crane.scale.set(1, Math.max(crScale, 0.001), 1);
    head.rotation.y = -0.55 + 0.75 * Math.sin(T * 2.2);
    const reach = 7 + 4 * Math.sin(T * 3.1 + 0.6);
    const drop = 6.5 + 3 * Math.sin(T * 4.3);
    trolley.position.set(reach, -drop / 2, 0);
    cable.scale.y = drop; cable.position.y = 0;
    load.position.y = -drop / 2 - 0.45;
    pallet.position.y = -drop / 2 - 0.86;

    // Licht an: Schlüsselübergabe
    const glow = easeInOut(seg(T, 7.1, 7.75));
    glassMat.emissiveIntensity = glow * 0.34;
    sun.intensity = 2.5 - glow * 0.55;
    sun.color.setRGB(1, 0.94 - glow * 0.06, 0.86 - glow * 0.12);
    hemi.intensity = 1.15 - glow * 0.25;
  }

  // ---------- Kamera ----------
  const camPos = new Vector3(), camTarget = new Vector3();
  const vA = new Vector3(), vB = new Vector3();
  function camAt(k, outPos, outTarget) {
    const i = MathUtils.clamp(Math.floor(k), 0, CAMS.length - 2);
    const f = smooth(clamp01(k - i));
    outPos.fromArray(CAMS[i].p).lerp(vA.fromArray(CAMS[i + 1].p), f);
    outTarget.fromArray(CAMS[i].t).lerp(vB.fromArray(CAMS[i + 1].t), f);
    if (portrait) {
      const s = MathUtils.lerp(PORTRAIT_DIST[i], PORTRAIT_DIST[i + 1], f);
      outPos.sub(outTarget).multiplyScalar(s).add(outTarget);
    }
  }
  function tAt(k) {
    const i = MathUtils.clamp(Math.floor(k), 0, T_AT.length - 2);
    const f = clamp01(k - i);
    return MathUtils.lerp(T_AT[i], T_AT[i + 1], i === 0 ? easeInOut(f) : f);
  }

  // ---------- Größe und Bildausschnitt ----------
  let vw = 1, vh = 1, portrait = false;
  function resize() {
    vw = container.clientWidth; vh = container.clientHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    portrait = vw / vh < 0.9;
    // Haus rechts neben den Text schieben (Desktop) bzw. nach oben (Handy)
    if (portrait) camera.setViewOffset(vw, vh, 0, vh * 0.2, vw, vh);
    else camera.setViewOffset(vw, vh, -vw * (vw > 1100 ? 0.2 : 0.14), vh * 0.03, vw, vh);
    camera.fov = portrait ? 44 : 30;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  // ---------- Steuerung von außen ----------
  let kTarget = 0, kSmooth = 0, intro = reduced ? 8 : 0, introStart = 0, playing = false;
  let dirty = true, lastT = -1;
  const pointer = { x: 0, y: 0 }, ptr = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let lastNow = 0;
  function frame(now) {
    const dt = Math.min(0.1, lastNow ? (now - lastNow) / 1000 : 0.016);
    lastNow = now;
    if (playing && !introStart) introStart = now;
    if (playing && intro < 8) intro = 8 * easeInOut(clamp01((now - introStart) / 4600));
    // Zeitbasiert glätten, damit die Fahrt auf jedem Gerät gleich schnell ist
    kSmooth += (kTarget - kSmooth) * (reduced ? 1 : 1 - Math.exp(-dt * 4.5));
    if (Math.abs(kTarget - kSmooth) < 0.0005) kSmooth = kTarget;
    const pf = 1 - Math.exp(-dt * 3);
    ptr.x += (pointer.x - ptr.x) * pf;
    ptr.y += (pointer.y - ptr.y) * pf;

    const T = Math.min(tAt(kSmooth), intro);
    let changed = dirty;
    if (Math.abs(T - lastT) > 1e-4) { setBuild(T); lastT = T; changed = true; }
    camAt(kSmooth, camPos, camTarget);
    if (!reduced) {
      camPos.x += ptr.x * 1.6;
      camPos.y -= ptr.y * 0.9;
    }
    if (camPos.distanceToSquared(lastCam) > 1e-6) { lastCam.copy(camPos); changed = true; }
    if (!changed) return;
    dirty = false;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }
  const lastCam = new Vector3(1e9, 0, 0);

  let visible = true, running = false;
  function loop() {
    if (running) return;
    running = true;
    const tick = (now) => {
      if (!visible) { running = false; return; }
      frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  resize();
  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(container);
  setBuild(intro); lastT = intro;
  camAt(0, camPos, camTarget);
  frame(performance.now());
  loop();

  return {
    setProgress(k) { kTarget = MathUtils.clamp(k, 0, CAMS.length - 1); },
    play() { playing = true; },
    stages: CAMS.length,
  };
}

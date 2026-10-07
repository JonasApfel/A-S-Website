// 3D-Ziegelwand für den Kopfbereich (Three.js, MIT-Lizenz).
// Läuferverband aus NF-Steinen (240 × 115 × 71 mm, maßstäblich), mit Fensteröffnung, in der eine Website leuchtet.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial,
  Object3D, Color, HemisphereLight, DirectionalLight, PointLight, CanvasTexture, SRGBColorSpace,
  ACESFilmicToneMapping, PCFShadowMap, Mesh, PlaneGeometry, BoxGeometry, RepeatWrapping, MathUtils,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const L = 2.4, H = 0.71, D = 1.15;      // Stein in dm
const MOD = 2.5;                         // Stein + Stoßfuge
const COURSE = 0.8333;                   // 12 Schichten = 1 m
const COLS = 7;                          // Steine je Schicht
const ROWS = 12;
const W = COLS * MOD - 0.1;              // 17,4 dm
const OPEN = { x0: -5.0, x1: 5.0, r0: 3, r1: 8 };   // Fensteröffnung
const LINTEL_ROW = 9;

function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function subtract([a, b], [c, d]) {
  if (b <= c || a >= d) return [[a, b]];
  const out = [];
  if (a < c) out.push([a, c]);
  if (b > d) out.push([d, b]);
  return out;
}

function brickLayout() {
  const bricks = [];
  for (let r = 0; r < ROWS; r++) {
    const start = -W / 2 + (r % 2 ? -1.25 : 0);
    let segs = [];
    for (let x = start; x < W / 2; x += MOD) {
      const a = Math.max(x, -W / 2), b = Math.min(x + L, W / 2);
      if (b - a > 0.5) segs.push([a, b]);
    }
    let cut = null;
    if (r >= OPEN.r0 && r <= OPEN.r1) cut = [OPEN.x0, OPEN.x1];
    if (r === LINTEL_ROW) cut = [OPEN.x0 - 1.25, OPEN.x1 + 1.25];
    if (cut) segs = segs.flatMap((s) => subtract(s, cut)).filter(([a, b]) => b - a > 0.5);
    segs.forEach(([a, b], i) => bricks.push({ x: (a + b) / 2, len: b - a, y: (r + 0.5) * COURSE - (ROWS * COURSE) / 2, row: r, col: i }));
  }
  return bricks;
}

function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  const rnd = rand(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + rnd() * 105;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 760;
  const g = c.getContext('2d');
  g.fillStyle = '#ece8e0'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#d9d3c7'; g.fillRect(0, 0, c.width, 64);
  ['#c4512f', '#8f8a82', '#8f8a82'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(40 + i * 34, 32, 10, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = '#f5f2ec'; g.fillRect(170, 16, 560, 32);
  g.fillStyle = '#625e57'; g.font = '500 20px "JetBrains Mono", monospace'; g.fillText('ihr-betrieb.de', 190, 39);
  g.fillStyle = '#121110'; g.font = '800 92px "Archivo", Arial, sans-serif';
  g.fillText('IHR BETRIEB.', 64, 210);
  g.font = 'italic 92px "Instrument Serif", Georgia, serif'; g.fillStyle = '#c4512f';
  g.fillText('endlich online.', 64, 300);
  g.fillStyle = '#b8b2a6';
  [380, 412, 444].forEach((y, i) => g.fillRect(64, y, [520, 470, 500][i], 14));
  g.fillStyle = '#c4512f'; roundRect(g, 64, 500, 250, 64, 32); g.fill();
  g.fillStyle = '#ece8e0'; g.font = '700 24px "Archivo", Arial, sans-serif'; g.fillText('Anfrage stellen  →', 92, 541);
  // Bildfläche mit Schraffur
  g.save(); g.beginPath(); roundRect(g, 720, 120, 420, 440, 18); g.clip();
  g.fillStyle = '#2a2622'; g.fillRect(720, 120, 420, 440);
  g.strokeStyle = 'rgba(236,232,224,.12)'; g.lineWidth = 3;
  for (let i = -440; i < 440; i += 22) { g.beginPath(); g.moveTo(720 + i, 560); g.lineTo(720 + i + 440, 120); g.stroke(); }
  g.restore();
  g.fillStyle = '#d9d3c7';
  [64, 420, 776].forEach((x) => { roundRect(g, x, 620, 340, 110, 14); g.fill(); });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

export function initHero(container, { reduced = false, ScrollTrigger } = {}) {
  if (!container) return;
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }

  const isSmall = () => container.clientWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !isSmall();
  renderer.shadowMap.type = PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity 1.2s ease';

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(0, 0, 36);

  const root = new Group();      // Platzierung im Bild
  const wall = new Group();      // Drehung durch Maus
  root.add(wall);
  scene.add(root);

  // Licht: warmes Abendlicht von links oben, Ziegelglut als Gegenlicht
  scene.add(new HemisphereLight(0xffe6cc, 0x1a1512, 0.85));
  const key = new DirectionalLight(0xffd3a8, 2.6);
  key.position.set(-10, 14, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new DirectionalLight(0xe0603a, 1.6);
  rim.position.set(12, -4, -10);
  scene.add(rim);

  // Steine
  const layout = brickLayout();
  const rnd = rand(7);
  const geo = new RoundedBoxGeometry(L, H, D, 3, 0.07);
  const bump = noiseTexture();
  const mat = new MeshStandardMaterial({ roughness: 0.88, metalness: 0, bumpMap: bump, bumpScale: 0.6 });
  const mesh = new InstancedMesh(geo, mat, layout.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const base = new Color('#a94b2d');
  layout.forEach((b, i) => {
    const c = base.clone().offsetHSL((rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12);
    mesh.setColorAt(i, c);
    b.delay = b.row * 0.085 + b.col * 0.035 + rnd() * 0.06;
    b.fallY = 9 + rnd() * 4;
    b.spin = [(rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.6];
    b.burst = [(b.x / (W / 2)) * (6 + rnd() * 6), b.y * 0.9 + (rnd() - 0.5) * 4, 8 + rnd() * 18];
    b.burstRot = [(rnd() - 0.5) * 4, (rnd() - 0.5) * 4, (rnd() - 0.5) * 4];
  });
  wall.add(mesh);

  // Sturz aus Beton
  const lintelLen = OPEN.x1 - OPEN.x0 + 2.4;
  const lintel = new Mesh(new BoxGeometry(lintelLen, COURSE - 0.1, D), new MeshStandardMaterial({ color: '#8f8b84', roughness: 0.95, bumpMap: bump, bumpScale: 0.3 }));
  lintel.castShadow = lintel.receiveShadow = true;
  const lintelY = (LINTEL_ROW + 0.5) * COURSE - (ROWS * COURSE) / 2;
  wall.add(lintel);

  // Bildschirm in der Öffnung
  const openH = (OPEN.r1 - OPEN.r0 + 1) * COURSE;
  const openY = ((OPEN.r0 + OPEN.r1 + 1) / 2) * COURSE - (ROWS * COURSE) / 2;
  const screenMat = new MeshBasicMaterial({ map: screenTexture(), toneMapped: false, transparent: true, opacity: 0 });
  const screen = new Mesh(new PlaneGeometry(OPEN.x1 - OPEN.x0 - 0.3, openH - 0.3), screenMat);
  screen.position.set(0, openY, -0.25);
  wall.add(screen);
  const glow = new PointLight(0xffc29a, 0, 14, 1.6);
  glow.position.set(0, openY, 1.6);
  wall.add(glow);

  // Aufbau-Animation und Explosion beim Scrollen
  const dummy = new Object3D();
  const easeOutBack = (t) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  let burst = 0;
  const start = performance.now() + 150;
  const BUILD = reduced ? 0 : 0.9;

  function update(now) {
    const t = reduced ? 99 : (now - start) / 1000;
    layout.forEach((b, i) => {
      const k = reduced ? 1 : MathUtils.clamp((t - b.delay) / BUILD, 0, 1);
      const e = easeOutBack(k), f = 1 - easeOut(k);
      dummy.position.set(
        b.x + b.burst[0] * burst,
        b.y + b.fallY * (1 - e) + b.burst[1] * burst,
        b.burst[2] * burst * burst,
      );
      dummy.rotation.set(b.spin[0] * f + b.burstRot[0] * burst, b.spin[1] * f + b.burstRot[1] * burst, b.spin[2] * f + b.burstRot[2] * burst);
      const s = k <= 0 ? 0.0001 : 1;
      dummy.scale.set((b.len / L) * s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    const lt = reduced ? 1 : MathUtils.clamp((t - (LINTEL_ROW * 0.085 + 0.1)) / 0.9, 0, 1);
    lintel.position.set(0, lintelY + 9 * (1 - easeOutBack(lt)) + 3 * burst, 10 * burst * burst);
    lintel.rotation.z = (1 - easeOut(lt)) * 0.3 + burst * 0.6;
    lintel.visible = lt > 0;

    const st = reduced ? 1 : MathUtils.clamp((t - 1.5) / 1.0, 0, 1);
    screenMat.opacity = easeOut(st) * (1 - burst);
    glow.intensity = easeOut(st) * 9 * (1 - burst);
    screen.position.z = -0.25 + burst * 6;
  }

  // Maus und Lage
  const pointer = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function layoutScene() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const aspect = w / h;
    if (aspect >= 1.15) {          // Desktop: Wand rechts oben
      root.position.set(7.6 * Math.min(aspect / 1.6, 1.25), 4.6, 0);
      root.scale.setScalar(0.84);
    } else if (aspect >= 0.8) {    // Tablet
      root.position.set(2.5, 4.6, 0);
      root.scale.setScalar(0.8);
    } else {                       // Handy: Wand oben mittig
      root.position.set(0.4, 5.4, 0);
      root.scale.setScalar(0.62);
    }
  }
  layoutScene();
  new ResizeObserver(layoutScene).observe(container);

  if (ScrollTrigger) {
    ScrollTrigger.create({
      trigger: container.parentElement, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (self) => { burst = self.progress; },
    });
  }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 }).observe(container);

  let running = false;
  function frame(now) {
    smooth.x += (pointer.x - smooth.x) * 0.05;
    smooth.y += (pointer.y - smooth.y) * 0.05;
    const idle = reduced ? 0 : now / 1000;
    wall.rotation.y = -0.42 + smooth.x * 0.16;
    wall.rotation.x = 0.06 + smooth.y * 0.07;
    wall.position.y = Math.sin(idle * 0.7) * 0.12;
    update(now);
    renderer.render(scene, camera);
  }
  function loop() {
    if (running) return;
    running = true;
    const tick = (now) => {
      if (!visible || reduced) { running = false; return; }
      frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  frame(performance.now());
  renderer.domElement.style.opacity = '1';
  if (!reduced) loop();
  else new ResizeObserver(() => frame(performance.now())).observe(container);
}

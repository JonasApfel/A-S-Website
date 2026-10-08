// Apfel Bau – Animationen und Interaktion.
// Bibliotheken: GSAP mit ScrollTrigger und SplitText (kostenlos, auch kommerziell), Lenis (MIT), Three.js (MIT, nachgeladen).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
window.__abReady = true;

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const isHome = !!$('.stage');

/* ---------- Sanftes Scrollen ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
}

window.__lenis = lenis;

function scrollToTarget(target) {
  const offset = target === document.body ? 0 : -8;
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else target.scrollIntoView({ behavior: 'auto' });
}

/* ---------- Menü ---------- */
const menu = $('#menu');
const menuBtn = $('#menu-btn');
let menuOpen = false;
const menuTl = gsap.timeline({ paused: true })
  .set(menu, { visibility: 'visible' })
  .to(menu, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'expo.inOut' })
  .from($$('#menu nav a'), { yPercent: 50, opacity: 0, stagger: 0.05, duration: 0.7, ease: 'expo.out' }, '-=0.35')
  .from('.menu-foot', { opacity: 0, duration: 0.4 }, '-=0.4');

function setMenu(open) {
  menuOpen = open;
  root.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open));
  $('.menu-btn-text').textContent = open ? 'Schließen' : 'Menü';
  if (open) { lenis?.stop(); menuTl.timeScale(1).play(); } else { lenis?.start(); menuTl.timeScale(1.6).reverse(); }
}
menuBtn?.addEventListener('click', () => setMenu(!menuOpen));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

/* ---------- Ankerlinks ---------- */
$$('a[data-scroll]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) { setMenu(false); setTimeout(() => scrollToTarget(target), 450); } else scrollToTarget(target);
  });
});

/* ---------- Kopfzeile ---------- */
const header = $('.header');
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate(self) {
    if (menuOpen) return;
    const y = self.scroll();
    header.classList.toggle('is-scrolled', y > 30);
    const hidden = self.direction === 1 && y > 320;
    header.classList.toggle('is-hidden', hidden);
    root.classList.toggle('hdr-hidden', hidden);
  },
});

// Aktueller Abschnitt im Menü
const navLinks = $$('.nav a[href^="#"]');
if (navLinks.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const s = $(a.getAttribute('href')); if (s) io.observe(s); });
}

/* ---------- E-Mail-Adressen erst im Browser zusammensetzen ---------- */
$$('[data-mail]').forEach((a) => {
  const addr = a.dataset.mail + '@' + 'apfel-bau.de';
  a.href = 'mailto:' + addr;
  a.textContent = addr;
});
$$('[data-current-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- Stelle im Bewerbungsformular vorauswählen ---------- */
$$('[data-job]').forEach((a) => a.addEventListener('click', () => {
  const sel = $('#b-stelle');
  if (sel) sel.value = a.dataset.job;
}));

/* ---------- Formulare (Netlify Forms) ---------- */
$$('form[data-netlify]').forEach((form) => {
  const statusEl = $('.form-status', form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const tel = form.elements.telefon, mail = form.elements.email;
    if (tel && mail && !tel.value.trim() && !mail.value.trim()) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = 'Bitte geben Sie eine Telefonnummer oder E-Mail-Adresse an, damit wir Sie erreichen.';
      tel.focus();
      return;
    }
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    statusEl.removeAttribute('data-state');
    statusEl.textContent = 'Wird gesendet …';
    const data = new FormData(form);
    const hasFile = $$('input[type="file"]', form).some((i) => i.files && i.files.length);
    let options;
    if (hasFile) options = { method: 'POST', body: data };
    else {
      const params = new URLSearchParams();
      data.forEach((v, k) => { if (typeof v === 'string') params.append(k, v); });
      options = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() };
    }
    fetch('/', options)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        form.reset();
        statusEl.dataset.state = 'ok';
        statusEl.textContent = form.dataset.ok || 'Danke! Ihre Anfrage ist angekommen. Wir melden uns zeitnah bei Ihnen.';
      })
      .catch(() => {
        statusEl.dataset.state = 'error';
        statusEl.textContent = 'Das hat leider nicht geklappt. Bitte rufen Sie uns an: 08563 826.';
      })
      .finally(() => { button.disabled = false; });
  });
});

/* ---------- Leistungen und Fragen: weiches Auf- und Zuklappen ---------- */
$$('details.service').forEach((d) => {
  const summary = $('summary', d);
  const body = $('.sv-body', d);
  summary.addEventListener('click', (e) => {
    if (reduced) return;
    e.preventDefault();
    if (d.open) {
      gsap.to(body, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
    } else {
      d.open = true;
      gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.65, ease: 'power3.out', onComplete: () => ScrollTrigger.refresh() });
    }
  });
});

// Bild folgt der Maus über der Leistungsliste
const float = $('.svc-float');
if (float && finePointer && !reduced) {
  const img = $('img', float);
  const xTo = gsap.quickTo(float, 'x', { duration: 0.55, ease: 'power3' });
  const yTo = gsap.quickTo(float, 'y', { duration: 0.55, ease: 'power3' });
  const list = $('[data-services]');
  list.addEventListener('pointermove', (e) => { xTo(e.clientX + 28); yTo(e.clientY - 120); });
  $$('.service', list).forEach((s) => {
    s.addEventListener('pointerenter', () => { if (img.getAttribute('src') !== s.dataset.img) img.src = s.dataset.img; float.classList.add('is-on'); });
  });
  list.addEventListener('pointerleave', () => float.classList.remove('is-on'));
}

/* ---------- 3D-Bauablauf ---------- */
let house = null;
let introReady = false;
let currentK = 0;
const markers = $$('[data-marker]');
let centers = [];
const pkNum = $('[data-pk-num]'), pkTitle = $('[data-pk-title]'), pkBar = $('[data-pk-bar]');

function measure() {
  centers = markers.map((el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; });
}
function kFromScroll() {
  if (!centers.length) return 0;
  const y = window.scrollY + window.innerHeight / 2;
  if (y <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return centers.length - 1;
}
let lastPk = -1;
function updateStage() {
  currentK = kFromScroll();
  house?.setProgress(currentK);
  const idx = Math.min(Math.round(currentK), markers.length - 1);
  if (idx !== lastPk && pkNum) {
    lastPk = idx;
    pkNum.textContent = String(Math.min(idx, 7)).padStart(2, '0');
    pkTitle.textContent = idx === 0 ? 'Ihr Zuhause' : markers[idx].dataset.title;
  }
  if (pkBar) pkBar.style.transform = `scaleX(${currentK / (markers.length - 1)})`;
  root.classList.toggle('in-steps', currentK > 0.5 && currentK < markers.length - 0.5);
}

// Das 3D-Modul lädt sofort im Hintergrund, aufgebaut wird es erst, wenn das Logo steht.
const housePromise = isHome ? import('./house3d.js').catch(() => null) : Promise.resolve(null);
function startHouse(m) {
  const el = $('#house-canvas');
  if (!el) return;
  if (!m) { root.classList.add('no-webgl'); return; }
  house = m.initHouse(el, { reduced, onFail: () => root.classList.add('no-webgl') });
  if (!house) { root.classList.add('no-webgl'); return; }
  el.classList.add('is-ready');
  measure();
  updateStage();
  if (introReady) house.play();
}

if (isHome) {
  ScrollTrigger.addEventListener('refresh', () => { measure(); updateStage(); });
  ScrollTrigger.create({ trigger: '.stage', start: 'top bottom', end: 'bottom top', onUpdate: updateStage });
  $$('.step').forEach((step) => {
    ScrollTrigger.create({ trigger: step, start: 'top 62%', end: 'bottom 38%', toggleClass: 'is-active' });
  });
}

/* ---------- Ladebild ---------- */
function runLoader() {
  const loader = $('.loader');
  const skip = reduced || root.classList.contains('seen') || !loader;
  try { sessionStorage.setItem('ab-seen', '1'); } catch (e) { /* privat */ }
  if (skip) { loader?.remove(); return housePromise.then(startHouse); }
  return new Promise((resolve) => {
    const num = $('[data-loader-num]');
    const count = { v: 0 };
    lenis?.stop();
    const tl = gsap.timeline({ onComplete: () => { loader.remove(); lenis?.start(); } });
    tl
      .fromTo('.ld-tri', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0, ease: 'expo.inOut' }, 0)
      .fromTo('.ld-roof', { x: 60, y: -72, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.0, ease: 'expo.out' }, 0.55)
      .fromTo('.ld-letters path', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, 0.8)
      .to(count, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(count.v); } }, 0)
      .add(() => {
        // Kurz anhalten: Der Aufbau der 3D-Szene blockiert den Browser einen Moment.
        tl.pause();
        housePromise.then((m) => {
          startHouse(m);
          requestAnimationFrame(() => requestAnimationFrame(() => tl.resume()));
        });
      }, 1.9)
      .add(resolve, 1.92)
      .to('.loader-logo', { y: -30, opacity: 0, duration: 0.6, ease: 'power3.in' }, 1.95)
      .to('.loader-foot', { opacity: 0, duration: 0.4 }, 1.95)
      .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, 2.15);
  });
}

/* ---------- Start ---------- */
document.fonts.ready.then(() => {
  runLoader().then(() => {
    introReady = true;
    house?.play();
    root.classList.add('is-loaded');
    intro();
  });
});

function intro() {
  if (reduced) { root.classList.add('no-anim'); return; }
  const heroTitle = $('[data-hero-title]');
  const tl = gsap.timeline({ delay: root.classList.contains('seen') ? 0.05 : 0.5 });
  if (heroTitle) {
    gsap.set(heroTitle, { opacity: 1 });
    const split = SplitText.create($$('.line', heroTitle), { type: 'chars', mask: 'chars', aria: 'auto' });
    tl.from(split.chars, { yPercent: 110, duration: 1.15, stagger: 0.028, ease: 'expo.out' }, 0);
  }
  tl.fromTo('[data-hero-fade]', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: 'power3.out' }, 0.35)
    .from('.header-inner > *', { y: -16, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 0.3);

  // Überschriften gleiten zeilenweise aus der Maske
  $$('[data-reveal]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, { yPercent: 112, duration: 1.15, stagger: 0.09, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      },
    });
  });

  // Weiche Einblendungen
  $$('[data-fade]').forEach((el) => {
    gsap.fromTo(el, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  // Bilder öffnen sich von unten
  $$('[data-clip]').forEach((el) => {
    const img = $('img', el);
    gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
      .to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' })
      .from(img, { scale: 1.25, duration: 1.6, ease: 'expo.out' }, 0.2);
  });

  // Parallaxe in Bildflächen
  $$('[data-parallax] .pimg img').forEach((img) => {
    gsap.fromTo(img, { yPercent: -7 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.closest('[data-parallax]'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Zahlen zählen hoch
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count), from = Number(el.dataset.from || 0);
    const obj = { v: from };
    gsap.to(obj, { v: end, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => { el.textContent = Math.round(obj.v); } });
  });

  // Philosophie: Wörter leuchten beim Scrollen auf
  $$('[data-words]').forEach((el) => {
    const words = SplitText.create(el, { type: 'words', aria: 'auto' }).words;
    gsap.fromTo(words, { opacity: 0.15 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: true } });
  });

  // Laufband reagiert auf die Scrollrichtung
  const track = $('.marquee-track');
  if (track) {
    const loop = gsap.to(track, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onUpdate(self) {
        const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 350);
        gsap.to(loop, { timeScale: (self.direction === 1 ? 1 : -1) * (1 + Math.abs(v)), duration: 0.3, overwrite: true });
      },
    });
  }

  // Referenzen: Seitwärtsfahrt am Computer, Wischen am Handy
  const refs = $('.refs');
  if (refs) {
    const trackEl = $('.refs-track');
    const count = $('[data-ref-num]');
    const bar = $('.refs-progress i');
    const items = $$('.ref');
    const setCount = (p) => {
      const n = Math.min(items.length, Math.max(1, Math.round(p * (items.length - 1)) + 1));
      count.textContent = String(n).padStart(2, '0');
      gsap.set(bar, { scaleX: 0.1 + 0.9 * p });
    };
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const distance = () => trackEl.scrollWidth - window.innerWidth;
      const tween = gsap.to(trackEl, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: { trigger: refs, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.8, invalidateOnRefresh: true, onUpdate: (self) => setCount(self.progress) },
      });
      items.forEach((it) => {
        gsap.fromTo($('img', it), { xPercent: -4 }, { xPercent: 4, ease: 'none', scrollTrigger: { trigger: it, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      });
    });
    mm.add('(max-width: 899px)', () => {
      const vp = $('.refs-viewport');
      const onScroll = () => setCount(vp.scrollLeft / Math.max(1, vp.scrollWidth - vp.clientWidth));
      vp.addEventListener('scroll', onScroll, { passive: true });
      return () => vp.removeEventListener('scroll', onScroll);
    });
  }

  // Karte: Ringe und Orte erscheinen nacheinander
  const map = $('[data-map]');
  if (map) {
    gsap.timeline({ scrollTrigger: { trigger: map, start: 'top 80%', once: true } })
      .from('.map-rings circle', { scale: 0, transformOrigin: '360px 360px', duration: 1.4, stagger: 0.12, ease: 'expo.out' })
      .from('.map-km text, .map-city', { opacity: 0, duration: 0.6, stagger: 0.04 }, 0.4)
      .from('.map-ref circle', { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', duration: 0.6, stagger: 0.08, ease: 'back.out(3)' }, 0.7)
      .from('.map-ref text', { opacity: 0, x: -6, duration: 0.5, stagger: 0.08 }, 0.8)
      .from('.map-home', { opacity: 0, duration: 0.5 }, 0.3);
  }

  // Firmengeschichte: große Jahreszahl zählt mit
  const tl2 = $('[data-timeline]');
  if (tl2) {
    const yearEl = $('[data-tl-year]');
    const last = $$('.tl-list li', tl2).pop();
    if (last) last.dataset.year = String(new Date().getFullYear());
    const state = { y: 1958 };
    $$('.tl-list li', tl2).forEach((li) => {
      ScrollTrigger.create({
        trigger: li, start: 'top 62%', end: 'bottom 62%',
        onToggle(self) {
          li.classList.toggle('is-active', self.isActive);
          if (!self.isActive) return;
          gsap.to(state, { y: Number(li.dataset.year), duration: 0.9, ease: 'power3.out', overwrite: true, onUpdate: () => { yearEl.textContent = Math.round(state.y); } });
        },
      });
    });
  }

  // Großes Logo im Fuß
  const mark = $('[data-footer-mark]');
  if (mark) {
    gsap.from($('.logo', mark), { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: mark, start: 'top 85%', once: true } });
  }

  ScrollTrigger.refresh();
}

// Spät geladene Bilder verschieben die Abstände: einmal neu vermessen
window.addEventListener('load', () => ScrollTrigger.refresh());

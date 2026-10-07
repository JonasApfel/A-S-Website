// A&S Webwerk – Animationen und Interaktion.
// Bibliotheken: GSAP (inkl. ScrollTrigger und SplitText, kostenlos auch kommerziell) und Lenis (MIT).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

/* ---------- Sanftes Scrollen ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
window.__lenis = lenis;

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else target.scrollIntoView({ behavior: 'auto' });
}

/* ---------- Menü ---------- */
const menu = $('#menu');
const menuBtn = $('#menu-btn');
let menuOpen = false;
const menuLinks = $$('#menu nav a');
const menuTl = gsap.timeline({ paused: true })
  .set(menu, { visibility: 'visible' })
  .to(menu, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'expo.inOut' })
  .from(menuLinks, { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.7, ease: 'expo.out' }, '-=0.35')
  .from('.menu-foot', { opacity: 0, duration: 0.4 }, '-=0.4');

function setMenu(open) {
  menuOpen = open;
  document.documentElement.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open));
  $('.menu-btn-text').textContent = open ? 'Schließen' : 'Menü';
  if (open) { lenis?.stop(); menuTl.timeScale(1).play(); }
  else { lenis?.start(); menuTl.timeScale(1.6).reverse(); }
}
menuBtn.addEventListener('click', () => setMenu(!menuOpen));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

/* ---------- Ankerlinks ---------- */
$$('a[data-scroll]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) { setMenu(false); setTimeout(() => scrollToTarget(target), 450); }
    else scrollToTarget(target);
  });
});

/* ---------- Kopfzeile ein- und ausblenden ---------- */
const header = $('.header');
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate(self) {
    if (menuOpen) return;
    const y = self.scroll();
    header.classList.toggle('is-hidden', self.direction === 1 && y > 300);
  },
});

/* ---------- Mauszeiger und magnetische Buttons ---------- */
if (finePointer && !reduced) {
  const cursor = $('.cursor');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });
  document.addEventListener('pointerover', (e) => {
    cursor.classList.toggle('is-active', !!e.target.closest('a, button, summary, input, textarea'));
  });

  $$('.magnetic').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.3);
      my((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

/* ---------- Laufband ---------- */
const marquee = $('.marquee-track');
if (marquee && !reduced) {
  const loop = gsap.to(marquee, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate(self) {
      const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 400);
      gsap.to(loop, { timeScale: (self.direction === 1 ? 1 : -1) * (1 + Math.abs(v)), duration: 0.3, overwrite: true });
    },
  });
}

/* ---------- Formular (Netlify Forms) ---------- */
const form = $('#anfrage-form');
const statusEl = $('#form-status');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  statusEl.removeAttribute('data-state');
  statusEl.textContent = 'Wird gesendet …';
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)).toString(),
  })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      form.reset();
      statusEl.dataset.state = 'ok';
      statusEl.textContent = 'Danke, Ihre Anfrage ist angekommen. Wir melden uns zeitnah bei Ihnen.';
    })
    .catch(() => {
      statusEl.dataset.state = 'error';
      statusEl.textContent = 'Die Anfrage konnte gerade nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie eine E-Mail.';
    })
    .finally(() => { button.disabled = false; });
});

/* ---------- FAQ: weiches Auf- und Zuklappen ---------- */
$$('.faq details').forEach((d) => {
  const summary = $('summary', d);
  const answer = $('.answer', d);
  summary.addEventListener('click', (e) => {
    if (reduced) return;
    e.preventDefault();
    if (d.open) {
      gsap.to(answer, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(answer, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
    } else {
      d.open = true;
      gsap.fromTo(answer, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'power3.out', onComplete: () => ScrollTrigger.refresh() });
    }
  });
});

/* ---------- Animationen nach dem Laden der Schriften ---------- */
document.fonts.ready.then(() => {
  if (reduced) { import('./hero3d.js').then((m) => m.initHero($('#hero-canvas'), { reduced: true })); return; }

  // Hero: Buchstaben steigen aus der Fuge
  const heroSplit = SplitText.create('[data-hero-title] .line', { type: 'chars', mask: 'chars', aria: 'auto' });
  gsap.timeline({ delay: 0.15 })
    .from(heroSplit.chars, { yPercent: 115, duration: 1.2, stagger: 0.035, ease: 'expo.out' })
    .from('[data-hero-fade]', { y: 24, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out' }, 0.5)
    .from('.header .wrap > *', { y: -20, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.6);

  // Hero-Text schiebt sich beim Wegscrollen leicht nach oben
  gsap.to('.hero .wrap', {
    yPercent: -18, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Überschriften: Zeilen gleiten aus der Maske
  $$('[data-reveal]').forEach((el) => {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 110, duration: 1.1, stagger: 0.1, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      },
    });
  });

  // Weiche Einblendungen
  $$('[data-fade]').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  // Manifest: Wörter leuchten beim Scrollen auf
  const manifest = $('[data-manifest]');
  if (manifest) {
    const words = SplitText.create(manifest, { type: 'words', aria: 'auto' }).words;
    gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: manifest, start: 'top 80%', end: 'bottom 40%', scrub: true },
    });
  }

  // Leistungen: Karten stapeln sich
  const cards = $$('.card');
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.92 + i * 0.01, filter: 'brightness(0.8)', ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: () => `top ${96 + (i + 1) * 14}px`, scrub: true },
    });
  });

  // Bauablauf: horizontale Fahrt auf großen Bildschirmen
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const track = $('.track');
    const section = $('.ablauf');
    const bar = $('.progress-bar i');
    const num = $('.progress .num');
    const distance = () => track.scrollWidth - window.innerWidth;
    gsap.to(track, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: {
        trigger: section, start: 'top top', end: () => '+=' + distance(),
        pin: true, scrub: 1, invalidateOnRefresh: true,
        onUpdate(self) {
          gsap.set(bar, { scaleX: self.progress });
          num.textContent = Math.round(self.progress * 100) + ' %';
        },
      },
    });
  });
  mm.add('(max-width: 899px)', () => {
    $$('.panel').forEach((p) => gsap.from(p, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 88%', once: true } }));
  });

  // Zahlen zählen hoch
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const obj = { v: end === 0 ? 9 : 0 };
    gsap.to(obj, {
      v: end, duration: 1.6, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.textContent = Math.round(obj.v); },
    });
  });

  // Fotoflächen: leichte Parallaxe
  $$('[data-parallax] .photo-inner').forEach((el) => {
    gsap.fromTo(el, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Großer Schriftzug im Fuß
  const footSplit = SplitText.create('[data-footer-mark]', { type: 'chars', mask: 'chars', aria: 'auto' });
  gsap.from(footSplit.chars, {
    yPercent: 100, duration: 1.2, stagger: 0.04, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer', start: 'top 80%', once: true },
  });

  // 3D-Wand im Kopfbereich nachladen, damit der Text sofort steht
  const startHero = () => import('./hero3d.js').then((m) => m.initHero($('#hero-canvas'), { reduced: false, gsap, ScrollTrigger }));
  if ('requestIdleCallback' in window) requestIdleCallback(startHero, { timeout: 600 });
  else setTimeout(startHero, 200);

  ScrollTrigger.refresh();
});

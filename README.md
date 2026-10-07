# A&S Webwerk – Website

Onepager von A&S Webwerk (Jonas Apfel & Michael Stoiber GbR, Deggendorf).

## Technik
- HTML und CSS von Hand, keine Vorlage
- Animationen: [GSAP](https://gsap.com) mit ScrollTrigger und SplitText (kostenlos, auch kommerziell)
- Sanftes Scrollen: [Lenis](https://github.com/darkroomengineering/lenis) (MIT)
- 3D-Ziegelwand: [Three.js](https://threejs.org) (MIT)
- Schriften lokal: Archivo, Instrument Serif, JetBrains Mono (SIL Open Font License, siehe `fonts/LICENSES.txt`)
- Kein Tracking, keine Cookies, keine externen Dienste

## Ordner
- `index.html`, `impressum.html`, `datenschutz.html` – Seiten
- `css/style.css` – Gestaltung
- `src/` – Quellcode der Skripte
- `js/` – fertig gebaute Skripte (werden veröffentlicht)
- `fonts/` – Schriften

## Ändern
Texte direkt in `index.html` ändern. Nach Änderungen an `src/` einmal bauen:

```
npm install
npm run build
```

## Vor dem Livegang
1. Gelb markierte Stellen (`class="todo"`) ersetzen: Telefon, E-Mail, Anschrift, Text zu Michael, Fotos.
2. Impressum und Datenschutz mit einem Rechtstext-Dienst erstellen.
3. In Netlify unter „Forms“ Benachrichtigungen für das Formular „anfrage“ einschalten.

## Netlify
„Add new site → Import an existing project → GitHub“, dieses Repository wählen. Build-Befehl leer lassen, Publish-Verzeichnis `.`.

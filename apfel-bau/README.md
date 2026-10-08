# Apfel Bau – Website

Neue Website für die Apfel Bau GmbH & Co. KG, Bad Birnbach-Nindorf. Gebaut von A&S Webwerk.

## Idee
- **3D-Bauablauf:** Beim Scrollen entsteht ein Haus in sieben Abschnitten: Erdarbeiten mit Bagger, Keller, Mauerwerk mit Kran, Dachstuhl, Dach, Ausbau, Außenanlage. Am Ende geht das Licht an. Die Dachneigung von 50° stammt aus dem Logo.
- **Plankopf:** Rechts unten steht ein Schriftfeld wie auf einem Bauplan. Es zeigt den aktuellen Bauabschnitt.
- **Logo:** Unverändert. Aus dem Original-PNG pixelgenau als Vektorgrafik nachgezeichnet (`img/logo.svg`).
- **Inhalte:** Texte, Ansprechpartner, Firmengeschichte, Stellenanzeigen und Fotos stammen von apfel-bau.de.

## Vorbilder
Ausgezeichnete Bau- und Architekturseiten 2025/26 bei Awwwards, zum Beispiel Enerblock (Site of the Day), METRIC., Berch, Arc. und Built Environs. Übernommen haben wir die Mittel, nicht die Gestaltung: Bauplan-Ästhetik, große Kennzahlen, Projektliste mit Bild unter der Maus, Seitwärtsfahrt durch die Referenzen und eine sichtbare Karriere-Sektion.

## Technik
- HTML und CSS von Hand, keine Vorlage
- [Three.js](https://threejs.org) für das 3D-Modell (MIT), wird erst nach dem Logo nachgeladen
- [GSAP](https://gsap.com) mit ScrollTrigger und SplitText (kostenlos, auch kommerziell)
- [Lenis](https://github.com/darkroomengineering/lenis) für weiches Scrollen (MIT)
- Schriften lokal: Geist, Geist Mono, Instrument Serif (SIL Open Font License, siehe `fonts/LICENSES.txt`)
- Keine Cookies, kein Tracking, keine externen Dienste
- Ohne WebGL erscheint ein Foto, bei „Bewegung reduzieren“ steht das fertige Haus ohne Animationen

## Ordner
- `index.html` – Startseite
- `karriere.html` – Stellenanzeigen mit Kurzbewerbung (inklusive Google-for-Jobs-Daten)
- `impressum.html`, `datenschutz.html` – Rechtstexte (Entwürfe)
- `css/style.css` – Gestaltung
- `src/` – Quellcode der Skripte (`house3d.js` ist das 3D-Modell)
- `js/` – fertig gebaute Skripte, die veröffentlicht werden
- `img/` – Fotos als WebP in zwei Größen, Logo, Vorschaubild `og.jpg`

## Ändern
Texte direkt in den HTML-Dateien ändern. Nach Änderungen an `src/` einmal bauen:

```
npm install
npm run build
```

Neue Fotos als WebP in zwei Breiten ablegen: `name.webp` (1600 px) und `name-s.webp` (800 px).

## Vor dem Livegang
1. **Impressum:** Registergericht und HRA-Nummer der KG sowie Name, Sitz und HRB-Nummer der Komplementär-GmbH eintragen (gelb markiert). Danach prüfen lassen.
2. **Datenschutz:** Mit einem Rechtstext-Dienst erstellen. Die nötigen Angaben stehen schon auf der Seite.
3. **Bildrechte:** Klären, ob für Fotos der alten Website Rechte bei einem Fotografen oder bei der Agentur SEIDL liegen.
4. **Netlify:** Neue Website aus diesem Repository anlegen und als Base directory `apfel-bau` eintragen, Build-Befehl leer lassen. Den Rest regelt `apfel-bau/netlify.toml`. Unter „Forms“ Benachrichtigungen für `bauanfrage` und `bewerbung` einschalten.
5. **Domain:** apfel-bau.de auf Netlify umziehen, sobald alles passt.
6. **Stellen:** Wenn sich Stellen ändern, auch das `datePosted` im JSON-LD von `karriere.html` anpassen.

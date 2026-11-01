# Step 1 — Fondamenta: build, dati, stile, anteprima e controlli

Data: 2026-11-01 · Branch: `landing-migliore`

**Listino: 40 voci, tutte identiche a §2.3** (nomi, ordine, categorie e prezzi; verificato voce per voce dal controllo automatico, con la tabella attesa scritta nel controllo).

## 1. File creati o modificati

Dati e testi
- `content/centro.json`: tutti i dati di §2.1, §2.2, §2.4 e §2.5, con chiavi in italiano senza accenti (`telefono`, `telefonoE164`, `whatsappNumero`, `orari.giorni`, `orari.apertura`, `orari.chiusura`, `legale.partitaIva`…). Ogni voce «non indicato» vale `null`.
- `content/listino.json`: le 5 categorie e le 40 voci di §2.3, con la struttura JSON di §2.3 (brasiliana petto e addome uomo: 30 €).
- `content/testi.json`: tutti i testi di §8, in `comuni` (per sezione) e `pagine` (`home`, `viso`, `pedicure`, con percorso, ordine delle sezioni 3 e 4, testo WhatsApp e categoria aperta del listino), più i tre testi WhatsApp di §6. Telefono, orari, indirizzo, dati legali e percentuale dello sconto si scrivono come segnaposto (`{telefono}`, `{orari.giorni}`…) e si riempiono in build da `centro.json`, così ogni dato sta in un posto solo.

Build
- `build.mjs` (riscritto): motore di template severo (`{{}}`, `{{{}}}`, `{{> }}`, `{{#se}}`, `{{#ogni}}`, più `{{altrimenti}}` e `{{#se !chiave}}`). Errori con file, riga e chiave. Genera `/`, `/viso/`, `/pedicure/`, `404.html`, `robots.txt` e, solo con un URL assoluto, `sitemap.xml`. `formattaPrezzo` è l'unico punto che scrive i prezzi. Copia `src/css`, `src/js`, `src/fonts` e `src/img` in `dist/`, con `?v=hash8` su CSS, JS e font (anche negli `url()` del CSS). Genera il JSON-LD `BeautySalon` con gli orari ricavati da «dal lunedì al sabato» e i meta per pagina. `theme-color` si legge da `--sabbia` in `tokens.css`. Si importa anche come modulo: i controlli ne usano le funzioni.

Template
- `src/templates/pagina.html`: struttura di §6. Header, apertura, footer e segnaposti commentati per le sezioni 3–9, con viso e pedicure invertite su `/pedicure/`.
- `src/templates/404.html`: «Questa pagina non esiste.», link alla pagina iniziale, pulsanti Chiama e WhatsApp, `noindex`.
- `src/templates/parti/testa.html`: `<head>` comune (meta, Open Graph, theme-color, script di una riga per la classe `js`, preload di Marcellus 400 e Jost 400, CSS, JS, JSON-LD).
- `src/templates/parti/header.html`: logo provvisorio «Migliore» in Marcellus e link «Chiama». Da 768 px mostra anche il numero; sotto resta solo per i lettori di schermo.
- `src/templates/parti/apertura.html`: occhiello, H1, sottotitolo, pulsanti Chiama e WhatsApp, riga info e payoff. Niente foto.
- `src/templates/parti/footer.html`: logo piccolo, denominazione e P.IVA, indirizzo, telefono, email, Privacy e Cookie, ©anno. REA, sede legale, social e «Preferenze cookie» compaiono solo se indicati.
- `src/templates/icone/telefono.svg`, `fumetto.svg`, `posizione.svg`, `freccia.svg`: icone SVG disegnate a mano, inserite con `{{{icone.nome}}}`.

Stile
- `src/css/tokens.css`: tutti i token di §5 su `:root` (colori, font, scala con `clamp()`, spazi su base 8, raggi, misure, focus, durate e curva). A 1024 px cambiano sezione verticale (112 px) e logo (80 px).
- `src/css/base.css`: `@font-face`, reset leggero, `color-scheme: light`, body sabbia, tipografia, contenitore da 1120 px, pulsanti, focus, link, `.occhiello`, arco firma (SVG originale in `mask`, che sparisce senza supporto a `mask-image`), comparse `.js .appare` con ripiego e `prefers-reduced-motion`.
- `src/css/sezioni.css`: header, apertura e footer.
- `src/fonts/marcellus-400.woff2`, `jost-400.woff2`, `jost-500.woff2`: font solo latino, 34 KB in tutto, da Fontsource 5.3.0 (catena a, riuscita).
- `src/fonts/OFL-Marcellus.txt`, `src/fonts/OFL-Jost.txt`: le licenze OFL.

JavaScript
- `src/js/main.js` (1,5 KB, 0,8 KB compresso): comparse con IntersectionObserver e sfasamento letto da `--sfasamento`, solo senza riduzione del movimento. Aggiorna l'anno nel footer.

Studio
- `studio/anteprima.mjs`:
  - lancia la build, poi un server statico su `dist/` (porta 4173) con pretty URL come Netlify: `/viso/` → `viso/index.html`, `/viso` → 301 su `/viso/`, 404 con `404.html`. `POST /api/codice-sconto` → 501.
  - fa gli screenshot (pagina intera e primo schermo, 390 e 1440 px) e raccoglie gli errori di console e le richieste fallite.
  - prova i ripieghi: senza JS, con riduzione del movimento, con `main.js` bloccato.
  - opzioni `--solo-server`, `--step N`, `--porta N`, `--senza-build`. Se il browser di Playwright manca, usa il Chromium di sistema.
- `studio/controlli.mjs`: 24 controlli (elenco sotto).
- `studio/package.json` e `studio/package-lock.json`: aggiunti `@fontsource/marcellus` e `@fontsource/jost`.
- Rimossi i `.gitkeep` di `content/`, `src/css/`, `src/js/`, `src/fonts/` e `src/templates/parti/`, che ora hanno file.

## 2. Controlli

- `node build.mjs`: OK (codice 0).
- `html-validate` su `dist/**/*.html` (4 pagine): **0 errori**. Al primo giro dava 8 errori `no-trailing-whitespace`, prodotti dalle righe dei blocchi `{{#se}}` vuoti; ora la build toglie spazi finali e righe vuote multiple.
- `node --check`: OK su tutti i file JS (`build.mjs`, `src/js/main.js`, `studio/anteprima.mjs`, `studio/controlli.mjs`).
- `node studio/controlli.mjs`: **24/24 superati**:
  1. build con codice 0
  2. pagine generate
  3. `studio/` e `content/` fuori da `dist/`
  4. URL assoluto: senza URL niente canonical né sitemap; con `URL=https://esempio.netlify.app` ci sono canonical, og:url, sitemap e robots con la riga `Sitemap`
  5. niente `{{`, `}}`, `undefined`, `null`, `NaN`, ⟪ ⟫ nel testo e negli attributi
  6. html-validate a 0 errori
  7. un solo H1 per pagina, H1 diversi
  8. title e H1 come in §7
  9. `lang="it"`
  10. P.IVA in ogni pagina
  11. parole vietate di §8, più superlativi e promesse di §10 (testo, alt, meta, JSON-LD; esclusa la riga sul limite)
  12. nessuna risorsa da domini esterni; i link esterni ammessi sono solo wa.me, Google Maps e i social indicati
  13. `node --check`
  14. listino a 40 voci identiche a §2.3
  15. `formattaPrezzo`: le 5 forme, e il rifiuto delle voci errate
  16. motore severo: 7 errori tipici fermati con file e riga
  17. `?v=hash8` su CSS, JS e font, e file esistenti
  18. dati facoltativi null, mai la stringa «non indicato»
  19. footer condizionale
  20. link tel e WhatsApp, con il testo giusto per pagina
  21. JSON-LD BeautySalon
  22. meta per pagina
  23. nessun testo scritto nei template
  24. pesi (main.js ≤ 3 KB, JS ≤ 12 KB compresso, CSS ≤ 20 KB compresso, font ≤ 100 KB)
- Prova a vuoto dei controlli: in una copia di prova ho inserito una parola vietata, un segnaposto ⟪REA⟫, un prezzo sbagliato, un testo scritto nel template e uno script esterno. I controlli li hanno segnalati tutti. Con il REA compilato, la riga «Registro Imprese di Varese · REA …» compare nel footer.
- Pesi attuali: CSS 4,6 KB compressi (3 file), JS 0,8 KB compressi, font 34 KB.

## 3. Anteprima

`node studio/anteprima.mjs --step 1`: 14 screenshot in `studio/screenshot/step1/`, cioè `home`, `viso` e `pedicure` a 390 e 1440 px (pagina intera e primo schermo), più la 404 a 390 e 1440 px.

- **390 px**: header con «Migliore» a sinistra e «Chiama» con l'icona a destra. Sotto: occhiello in accento maiuscolo, H1 in Marcellus su tre righe, sottotitolo, «Chiama» (pillola scura) e «Scrivi su WhatsApp» (pillola con bordo) a tutta larghezza, la riga info che va a capo solo tra i segmenti, il payoff in Marcellus. Footer su sabbia chiara: logo, dati legali, contatti, Privacy, Cookie, filetto e ©2026.
- **1440 px**: contenuto largo al massimo 1120 px. Header con «Chiama · 352 060 1109». Testo dell'apertura nella colonna sinistra: la destra resta vuota fino alla foto dello Step 3. Footer su quattro colonne.
- Sistemato guardando gli screenshot:
  - la riga info si spezzava dentro «dalle 08:00 alle / 17:00», ora va a capo solo tra i segmenti;
  - il «·» prima del numero nell'header era decentrato;
  - il footer su mobile era troppo arioso.
- Ripieghi: senza JavaScript, con riduzione del movimento e con `main.js` bloccato, il contenuto è sempre visibile.
- **Errori di console e richieste fallite: 0** (`studio/screenshot/step1/console.txt`). C'era un 404 su `/favicon.ico`: la favicon vera (la farfalla) arriva allo Step 2, intanto `<link rel="icon" href="data:,">` evita la richiesta.

## 4. Dati mancanti o dubbi

- **Meta description**: §7 dice che cambia per pagina, ma CLAUDE.md non ne dà il testo. Le ho composte con H1 e sottotitolo di ogni pagina, senza parole nuove. Si cambiano in `content/testi.json › pagine.*.description`.
- **Testi della 404 non indicati**: per il title ho usato «Pagina non trovata · Migliore», per il link «Torna alla pagina iniziale». Testi neutri, modificabili in `testi.json`.
- **URL assoluti**: dominio non indicato e, in locale, nessuna variabile `URL`. Canonical, og:url e sitemap per ora sono omessi; su Netlify la variabile `URL` li attiva da sola, come verifica il controllo 4.
- **Immagini**:
  - og:image e `image` del JSON-LD arrivano con le immagini allo Step 2;
  - favicon: per ora `data:,`;
  - logo: per ora il testo «Migliore».
- **Link Privacy e Cookie**: puntano a `/privacy/` e `/cookie/`, che arrivano allo Step 7. Fino ad allora portano alla 404.
- **«Registro Imprese di Varese»**: la provincia del registro sta in `centro.json` (`legale.registroImprese`), perché nel footer di §8 è scritta accanto al REA. La riga compare solo quando c'è il REA.
- **Descrizioni viso**: in `centro.json` sono identiche a §2.2, con l'iniziale minuscola. La maiuscola sotto ogni voce la farà il CSS allo Step 4.
- **Spazi non separabili**: tra numero ed € nei prezzi e dentro il numero di telefono, così non vanno a capo. A vista non cambia nulla.
- **Aggiunte al motore oltre §4**: `{{altrimenti}}` (serve per la presentazione di Cristina: «se indicata, altrimenti testo predefinito») e `{{#se !chiave}}`.
- **Icone**: stanno in `src/templates/icone/`, una cartella interna a `src/templates/` che §1 non elenca. È lì perché §4 vuole gli SVG interni stampati con `{{{chiave}}}`.
- **Inline script**: lo script della classe `js` è inline. Allo Step 9 la Content-Security-Policy dovrà includerne l'hash.
- **Ordine delle voci viso**: resta aperto il dubbio dello Step 0 (§2.3 dice in due modi diversi quale va per prima). Default per lo Step 4: Antiage per prima.

## 5. Domande per me

1. **Immagini.** Il pacchetto `migliore-immagini.zip` serve per lo Step 2 e non è ancora nell'ambiente. Puoi caricarlo in `studio/originali/` del repository (o allegarlo)?
2. **REA e link.** Il numero REA e il link al profilo Instagram, se esistono, li aggiungo a `content/centro.json`: compaiono da soli nel footer.
3. **Branch principale.** Vuoi un `main` separato per la produzione su Netlify, o resta `landing-migliore` (oggi è il branch predefinito su GitHub)?

---

## Aggiornamento: decisioni sul report

Applicate le decisioni sui dubbi del report. I punti «Meta description» e «Testi della 404 non indicati» qui sopra sono superati.

1. File modificati
- `CLAUDE.md`, aggiornato su richiesta:
  - §1: `icone/*.svg` nell'elenco di `templates/`;
  - §2.3: ordine delle voci viso chiarito (Antiage per prima nella sezione, le altre nell'ordine dell'elenco; nel listino l'ordine del cartaceo);
  - §4: `{{altrimenti}}` e `{{#se !chiave}}` nella sintassi;
  - §7: meta description delle tre pagine;
  - §8: testi della pagina 404, e la nota sui link Privacy e Cookie che portano alla 404 fino allo Step 7.
- `content/testi.json`: meta description di §7. Il numero è scritto `{telefono}` e viene da `centro.json`. Testi della 404 di §8: title «Pagina non trovata · Migliore – Estetica Avanzata» e il testo nuovo.
- `src/templates/404.html`: il paragrafo «Forse il link è cambiato…» sotto l'H1. `noindex` c'era già.
- `studio/controlli.mjs`:
  - il controllo sugli URL assoluti diventa due controlli espliciti. Senza URL: canonical, og:url e sitemap omessi su tutte le pagine, robots senza `Sitemap`. Con `URL=https://esempio.netlify.app`: canonical, og:url e JSON-LD di ogni pagina, gli indirizzi della sitemap e robots usano quell'indirizzo. Quest'ultima build va in una cartella temporanea, così `dist/` resta la versione senza URL;
  - le meta description sono confrontate con il testo di §7, e la loro lunghezza deve stare tra 60 e 160 caratteri;
  - nuovo controllo sulla 404 come in §8: title, noindex, H1, testo, link e i due pulsanti con le loro destinazioni.

2. Controlli: build OK · html-validate 0 errori · `node --check` OK · **controlli 26/26**. Prova a vuoto: con una description sbagliata, il testo della 404 tolto e la build che ignora `URL`, i tre controlli nuovi falliscono come devono.

3. Anteprima: 14 screenshot in `studio/screenshot/step1/`. La 404 mostra H1, testo, link e pulsanti. Console: 0 errori, 0 richieste fallite.

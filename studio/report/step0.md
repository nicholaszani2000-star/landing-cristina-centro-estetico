# Step 0 — Brief e struttura del repository

Data: 2026-11-01 · Branch: `landing-migliore`

## Strumenti

| Strumento | Versione |
|---|---|
| git | 2.43.0 |
| node | v22.23.4 (≥ 20: nessun bisogno di nvm o fnm) |
| npm | 10.9.9 |
| playwright (studio) | 1.64.1 |
| sharp (studio) | 0.35.5 (libvips 8.18.7, codifica AVIF provata) |
| html-validate (studio) | 11.17.0 |
| Chromium | di sistema: `/opt/pw-browsers/chromium` (Chrome for Testing 153.0.8010.12); `which` trova `/usr/bin/google-chrome`, che è un wrapper dello stesso binario |

Installazione delle dipendenze di lavoro:
- `npm install --prefix studio`: riuscito al primo tentativo (23 pacchetti, 0 vulnerabilità).
- `npx --prefix studio playwright install chromium`: **fallito**. Playwright 1.64.1 vuole Chromium r1248 e lo scarica da `cdn.playwright.dev`, ma la policy di rete dell'ambiente lo blocca. Errore esatto: `Download failed: server returned code 403 body 'request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"'`.
- `--with-deps`: non l'ho tentato. Scarica dallo stesso host bloccato e il proxy dell'ambiente chiede di non ritentare i rifiuti di policy (403).
- Ripiego: il Chromium di sistema. Playwright 1.64.1 lo avvia con `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })`. Prova fatta: pagina caricata, screenshot a 390 e 1440 px, 0 errori di console. Allo Step 1, `anteprima.mjs` e `controlli.mjs` dovranno usare questo percorso quando manca il browser di Playwright.

## 1. File creati o modificati

- `CLAUDE.md`: il brief, copiato esattamente dal prompt dello Step 0.
- `.gitignore`: ignora `node_modules/`, `dist/`, `.netlify/`, `.env`, `.env.*`, `studio/node_modules/`, `studio/screenshot/` e `.DS_Store`.
- `netlify.toml`: build (`node build.mjs` → `dist`, NODE_VERSION 22), functions (`netlify/functions`, esbuild), header di sicurezza su `/*`, cache immutabile per `/fonts/*`, `/css/*` e `/js/*`, 30 giorni per `/img/*`. Nessuna variabile segreta. La CSP arriva allo Step 9.
- `package.json`: `"type": "module"`, script `build`, `anteprima` e `controlli`, `engines.node >=20`, nessuna dipendenza.
- `build.mjs`: build **provvisoria**. Svuota `dist/` e scrive `dist/index.html` («Migliore – Estetica Avanzata — in costruzione», `lang="it"`, `noindex`), poi esce con 0. Lo Step 1 lo sostituisce.
- `studio/package.json`: privato, `"type": "module"`, dipendenze di lavoro `playwright` ^1.64.1, `sharp` ^0.35.5 e `html-validate` ^11.17.0 (le ultime stabili oggi).
- `studio/package-lock.json`: versioni bloccate delle dipendenze di studio, così le reinstallazioni sono uguali.
- `.gitkeep` in `content/`, `src/templates/parti/`, `src/css/`, `src/js/`, `src/fonts/`, `src/img/`, `netlify/functions/`, `supabase/` e `studio/originali/`: tengono in git le cartelle ancora vuote.
- `studio/report/step0.md`: questo report.
- `studio/report/step0-albero.txt`: l'albero dei file, senza `node_modules` e `.git`.

## 2. Controlli

- `node build.mjs`: OK, esce con 0 e crea `dist/index.html`.
- `html-validate` su `dist/**/*.html`: **0 errori**. Al primo giro c'era 1 errore (`doctype-style`: il DOCTYPE va scritto in maiuscolo). Corretto in `<!DOCTYPE html>`.
- `node --check`: OK su `build.mjs`, l'unico file JS che esiste per ora.
- `node studio/controlli.mjs`: non esiste ancora, lo crea lo Step 1 (0/0).
- `studio/` in `dist/`: assente. `dist/` contiene solo `index.html`.
- `git check-ignore dist node_modules studio/node_modules`: tutti e tre ignorati. Per `node_modules` alla radice ho creato un attimo la cartella vuota: la regola `node_modules/` vale solo per le cartelle e git non valuta un percorso che non esiste. Ignorati anche `.env`, `.env.local`, `.netlify`, `studio/screenshot` e `.DS_Store`.

## 3. Anteprima

`studio/anteprima.mjs` arriva allo Step 1. Per provare la catena browser ho fatto una prova a mano sulla pagina provvisoria con Playwright e il Chromium di sistema:
- a 390 e a 1440 px si vede solo l'H1 «Migliore – Estetica Avanzata — in costruzione», senza stile, come previsto. `meta robots` = `noindex`.
- screenshot in `studio/screenshot/step0/index-390.png` e `index-1440.png` (ignorati da git).
- errori di console e richieste fallite: 0.

## 4. Dati mancanti o dubbi

Voci di §2 vuote o «non indicato», con il default che vale:
- REA (§2.1): non indicato. La riga REA nel footer non compare.
- Sede legale (§2.1): non indicata. Coincide con il centro e nel footer compare solo l'indirizzo del centro.
- Presentazione di Cristina (§2.1): non indicata. Si usa il testo predefinito di §8 («Sono Cristina e ti aspetto…»).
- Dominio (§2.1): non indicato. Si usa l'indirizzo `.netlify.app`: URL assoluti dalla variabile `URL` di Netlify, altrimenti omessi.
- Instagram (§2.1): non indicato. Nessun link, nessuna icona.
- Facebook (§2.1): non indicato. Nessun link, nessuna icona.
- Scheda Google (§2.1): non indicata. «Apri in Google Maps» usa la ricerca dell'indirizzo.
- Macchinari, marca e modello (§2.2): non indicati. Non si nominano macchinari.
- Durata del pedicure estetico (§2.2): non indicata. Non si scrive.
- Durata del pedicure avanzato (§2.2): non indicata. Non si scrive.
- Strumenti del pedicure (§2.2): non indicati. Non si nominano strumenti e la riga «Strumenti: …» non compare.
- GA4 (§2.5): non indicato. Resta spento.
- Pixel Meta (§2.5): non indicato. Resta spento.
- Progetto Supabase (§2.5): non indicato. Il codice sconto resta in modalità prova.
- Pacchetto immagini `migliore-immagini.zip` (§2.6): **non presente** nel repository né nell'ambiente, e `studio/originali/` è vuota. Serve per lo Step 2.

Dubbi:
- **Branch.** L'ambiente di lavoro aveva assegnato `claude/epic-albattani-sh8a53`. Come chiedono il prompt e CLAUDE.md ho lavorato su `landing-migliore` e pubblicato lì. Lo stesso commit è pubblicato anche su `claude/epic-albattani-sh8a53`, il branch assegnato dall'ambiente. Il repository era vuoto, quindi non c'era un branch predefinito da cui partire: `landing-migliore` è nato da zero ed è diventato il branch predefinito su GitHub (il primo pubblicato). Questo contrasta con «non si lavora mai direttamente sul branch principale».
- **Frasi di CLAUDE.md che sembrano un modello compilato male.** Le ho copiate così come sono, senza correggerle. Le leggerò così, salvo tua indicazione:
  - §8 Viso, «- Se Pulizia viso base: … è indicato, sotto ogni voce la sua descrizione…»: i dettagli viso ci sono, quindi sotto ogni voce va la sua descrizione (al massimo 2 frasi, 3 per la voce in evidenza), e le fasi di Revinol vanno in un elenco numerato.
  - §8 Viso, «- Se non indicati (non nominare macchinari) o Natinuel, … sono indicati, una riga «In cabina usiamo: …»»: i macchinari non sono indicati, la linea di prodotti sì, quindi compare la riga «In cabina usiamo: Natinuel, linea cosmetica professionale per centri estetici».
  - §8 Pedicure, «strumenti, solo se indicati: «Strumenti: non indicati (non nominare strumenti).»»: gli strumenti non sono indicati, quindi la riga non compare.
  - §8 Chi sono, «testo: se non indicata (usa il testo predefinito di §8) è indicata, usala così com'è; altrimenti …»: la presentazione non è indicata, quindi si usa il testo predefinito.
  - §8 Footer, «Registro Imprese di Varese · REA non indicato (la riga REA non compare)» (solo se indicato): il REA non è indicato, quindi la riga non compare.
- **Ordine delle voci viso (§2.3).** L'elenco dice «in quest'ordine: Pulizia viso base, Trattamento viso Antiage, …», ma subito dopo: «La voce «Trattamento viso Antiage» va per prima». Default per lo Step 4: Antiage per prima, con «In evidenza», poi le altre nell'ordine elencato (Pulizia viso base, contorno occhi e labbra, laminazione ciglia, laminazione sopracciglia). Il listino (§2.3, sezione 9) resta nell'ordine del cartaceo.
- **Reinstallazione del browser (§3.4).** `npx --prefix studio playwright install chromium` in questo ambiente non funziona (host bloccato). Il ripiego è il Chromium di sistema, come prevede §13.

## 5. Domande per me

1. Il pacchetto `migliore-immagini.zip` non è nell'ambiente. Puoi caricarlo nel repository (in `studio/originali/`) o allegarlo prima dello Step 2?
2. Il repository era vuoto, quindi `landing-migliore` è diventato il branch predefinito su GitHub. Vuoi un branch principale separato (per esempio `main`, da collegare a Netlify per la produzione), o va bene così?
3. Esistono un numero REA (Registro Imprese di Varese) o i link a Instagram, Facebook e alla scheda Google del centro? Se sì, li aggiungo a `content/centro.json` allo Step 1. Altrimenti restano omessi.

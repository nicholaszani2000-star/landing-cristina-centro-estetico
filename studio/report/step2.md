# Step 2 — Immagini e logo

Data: 2026-11-01 · Branch: `landing-migliore`

## Origine del pacchetto

- `git ls-files | grep -i migliore-immagini.zip`: nessun risultato. Lo zip non è sul branch, ma era allegato al prompt dello Step 2, e ho usato quel file.
- Elenco controllato prima di scompattare: 10 file e `LEGGIMI.txt`, nessun percorso anomalo. Ho scompattato in una cartella temporanea vuota e poi copiato in `studio/originali/`, con le sottocartelle `foto/`, `logo/` e `condivisione/`, più `LEGGIMI.txt`.
- **Impronte SHA-256: 10 su 10 identiche a `LEGGIMI.txt`.**
- Lo zip non è mai entrato nel repository, quindi non c'era niente da togliere con `git rm`.

## Immagini esportate

Strumento: **sharp 0.35.5** (libvips 8.18.7), senza bisogno dei ripieghi Pillow o ffmpeg.

Impostazioni:
- AVIF qualità 55, effort 6;
- WebP qualità 80;
- spazio colore sRGB;
- metadati rimossi (EXIF di 03 e 04 compreso);
- solo ridimensionamento per larghezza (lanczos3), proporzioni intatte, nessun filtro.

Gli originali sono già sRGB senza profilo ICC, quindi la conversione non cambia i pixel. Rilanciando l'esportazione si ottengono gli stessi 43 file, identici byte per byte.

| Immagine | Originale | Larghezza | AVIF | WebP |
|---|---|---|---|---|
| cristina-bancone | foto/01-cristina-bancone.png (941×1672) | 480 | 24,6 KB | 36,0 KB |
| cristina-bancone | | 720 | 40,9 KB | 61,6 KB |
| cristina-bancone | | 941 | 55,0 KB | 85,7 KB |
| ingresso | foto/02-ingresso.png (1346×1168) | 480 | 16,7 KB | 30,2 KB |
| ingresso | | 800 | 40,9 KB | 73,5 KB |
| ingresso | | 1200 | 81,6 KB | 141,6 KB |
| cabina-viso | foto/03-cabina-viso.png (941×1672) | 480 | 21,6 KB | 31,4 KB |
| cabina-viso | | 720 | 40,2 KB | 59,2 KB |
| cabina-viso | | 941 | 57,8 KB | 85,8 KB |
| cabina-lettino | foto/04-cabina-lettino.png (941×1672) | 480 | 22,5 KB | 34,4 KB |
| cabina-lettino | | 720 | 42,3 KB | 67,4 KB |
| cabina-lettino | | 941 | 63,9 KB | 102,5 KB |
| postazione-pedicure | foto/05-postazione-pedicure.png (941×1672) | 480 | 25,4 KB | 40,6 KB |
| postazione-pedicure | | 720 | 50,9 KB | 81,2 KB |
| postazione-pedicure | | 941 | 78,6 KB | 123,0 KB |
| listino-stampato | foto/06-listino-stampato.png (1536×1024) | 800 | 28,8 KB | 42,1 KB |
| listino-stampato | | 1536 | 74,2 KB | 109,5 KB |
| logo | logo/logo-trasparente.png (624×508) | 240 | — | 28,9 KB |
| logo | | 480 | — | 83,9 KB |
| logo | | 624 (= originale, < 960) | — | 108,4 KB |

Altri file:
- `logo.png` (ripiego): 240×195, 48,9 KB;
- `favicon-32.png`: 1,7 KB;
- `favicon-16.png`: 0,7 KB;
- `apple-touch-icon.png`: 180×180, 28,6 KB;
- `og.jpg`: 1200×630, 86,4 KB, copia identica all'originale.

Limiti di §9:
- foto 01 a 720: AVIF 40,9 KB e WebP 61,6 KB, contro 120 KB;
- foto più pesante: 02 a 1200 in WebP, 141,6 KB, contro 160 KB;
- foto 06 a 1536: 109,5 KB, contro 300 KB.

Colori: la media di ogni canale R, G, B dei file esportati differisce da quella dell'originale di **0,5 livelli su 255 al massimo**.

## 1. File creati o modificati

- `studio/originali/`:
  - `foto/` (6 PNG), `logo/` (3 PNG), `condivisione/og-1200x630.jpg`, `LEGGIMI.txt`: gli originali identici al pacchetto, 15 MB in tutto;
  - rimosso `.gitkeep`.
- `studio/esporta-immagini.mjs`:
  - verifica le impronte prima di partire ed esporta foto, logo, icone e immagine di condivisione con sharp;
  - non supera mai la larghezza originale;
  - scrive il manifesto `src/img/immagini.json`;
  - genera il contact sheet. Opzione `--senza-contact-sheet`.
- `src/img/`: 42 immagini più `immagini.json` (misure originali e larghezze esportate; lo legge la build e non finisce in `dist/`). Rimosso `.gitkeep`.
- `build.mjs`:
  - helper `immagine(manifesto, nome, alt, sizes, { priorita })`: genera un `<picture>` con un `<source>` per formato (AVIF, WebP), `srcset` dalle larghezze esportate e `<img>` con `width` e `height` dell'originale;
  - `<img>`: `loading="lazy" decoding="async"`, oppure `fetchpriority="high"` con `priorita`;
  - la build si ferma se manca un file, l'alt o `sizes`, o se una larghezza supera l'originale;
  - controlla che ogni `/img/…` citato nell'HTML esista;
  - legge il manifesto e non lo copia in `dist/`;
  - `og:image` più `og:image:width`, `og:image:height` e `og:image:alt`;
  - `image` nel JSON-LD, solo con un URL assoluto.
- `src/templates/parti/header.html`, `footer.html`: logo vero al posto del testo, con alt «Migliore – Estetica Avanzata».
- `src/templates/parti/testa.html`: favicon 32 e 16, `apple-touch-icon` e i meta `og:image`. Tolto il segnaposto `data:,`.
- `src/css/tokens.css`: `--logo-piede-altezza` (56 px); tolto `--testo-logo`, non più usato.
- `src/css/sezioni.css`: altezza del logo da token (64 px su mobile, 80 px da 1024 px, 56 px nel footer), larghezza automatica.
- `content/testi.json`:
  - aggiunti `header.logoAlt` e `footer.logoAlt` («{nome}») e `condivisione.ogImageAlt`;
  - tolte le chiavi che nessun template usava: `header.numero`, `footer.telefono` e `footer.email` (i contatti arrivano da `centro.json`).
- `studio/controlli.mjs`: 7 controlli nuovi, e il controllo con URL assoluto esteso a `og:image` e a `image` del JSON-LD.

## 2. Controlli

- `node build.mjs`: OK.
- `html-validate`: **0 errori** su 4 pagine.
- `node --check`: OK su tutti i file JS.
- `node studio/controlli.mjs`: **33/33 superati**. I nuovi:
  - impronte di `studio/originali/` uguali a `LEGGIMI.txt`;
  - ogni immagine citata in `src` e `srcset` esiste in `src/img` e in `dist/img`, e `src/img` contiene solo file del manifesto;
  - nessuna larghezza oltre l'originale e nessun ritaglio (proporzioni verificate su ogni file con sharp);
  - colori: media RGB entro ±2 dall'originale, e `og.jpg` identica byte per byte;
  - pesi entro §9 (foto 01 a 720 ≤ 120 KB; altre foto ≤ 160 KB; 06 a 1536 ≤ 300 KB; logo scaricato ≤ 40 KB);
  - ogni `<img>` con alt, width, height e caricamento come in §9;
  - favicon, apple-touch-icon e `og:image` con misure e alt nella `<head>` di ogni pagina.
- Prova a vuoto: in una copia ho introdotto un originale modificato di un byte, una foto ritagliata, una foto schiarita del 10%, un `<img>` senza alt e una favicon scollegata. I controlli li segnalano tutti; un alt mancante passato all'helper ferma già la build.

## 3. Anteprima

- Contact sheet: `studio/screenshot/step2/contact-sheet.png`, con ogni file, misure, peso e Δ RGB. Ogni foto è affiancata all'originale: stessa inquadratura e stessi colori.
- Logo trasparente al 100% e al 200% su sabbia e su sabbia chiara: **bordi puliti, nessun alone**. Uso `logo-trasparente.png`; `logo-sabbia.png` non serve.
  - Perché non ci sono aloni: lo sfondo è stato tolto separando il colore dal sabbia, quindi sul sabbia il logo ricompone esattamente l'originale. Sul sabbia chiara del footer lo scarto teorico è al massimo di circa 3 livelli su 255, e non si vede.
- `node studio/anteprima.mjs --step 2`: 14 screenshot in `studio/screenshot/step2/`.
  - **390 px**: logo vero a sinistra nell'header (64 px), «Chiama» a destra; footer con il logo piccolo (56 px).
  - **1440 px**: logo a 80 px. Il resto è come allo Step 1; la foto dell'apertura arriva allo Step 3.
- **Errori di console e richieste fallite: 0.** Ripieghi (senza JS, riduzione del movimento, `main.js` bloccato) tutti a posto.

## 4. Dati mancanti o dubbi

- **Peso del logo, scostamento dalla regola.** Con questo logo (acquerello più trasparenza), `logo-480.webp` (84 KB) e `logo-624.webp` (108 KB) superano i 40 KB con qualsiasi impostazione provata: WebP da q75 a q90, lossless, near-lossless. A schermo però il logo è largo al massimo 99 px, quindi ho aggiunto `logo-240.webp` (28,9 KB) al `srcset`: è il file che il browser scarica davvero, in header e footer, anche a densità 3× su telefono e 2× su desktop. Il controllo dei 40 KB verifica proprio il file scelto. 480 e 624 restano per densità più alte. `logo.png` di ripiego è a 240 px (48,9 KB) e lo scarica solo un browser senza WebP.
- **Qualità del WebP del logo**: q90 con alfa a 100, non indicata nel prompt. Serve per avere bordi puliti sulla trasparenza.
- **`{{{immagini.*}}}`**: §4 riserva le tre graffe a JSON-LD e SVG. Ora le uso anche per il `<picture>` generato dall'helper `immagine()`, che fa l'escape di tutti gli attributi.
- **og:image senza URL assoluto**: in locale è relativa (`/img/og.jpg`); su Netlify diventa assoluta da sola grazie alla variabile `URL`. `image` nel JSON-LD compare solo con l'URL assoluto.
- **og:image:alt**: CLAUDE.md non indica il testo. Ho usato «Logo di Migliore – Estetica Avanzata e Cristina Migliore al bancone del centro», che descrive l'immagine. Si cambia in `testi.json › comuni.condivisione.ogImageAlt`.
- **Logo dell'header con `loading="lazy"`**: §9 vuole lazy su tutto tranne la foto dell'apertura. Il logo è piccolo e sta in cima; se Lighthouse lo segnala allo Step 9, si può caricare subito.
- **Repository più pesante**: con gli originali in `studio/originali/` cresce di circa 15 MB, come previsto da §1.

## 5. Domande per me

1. **Logo**: va bene tenere 240, 480 e 624 (il browser scarica il 240), o preferisci togliere 480 e 624?
2. **CLAUDE.md §4**: aggiorno la riga sulle tre graffe aggiungendo «e `<picture>` generati dall'helper `immagine()`»?
3. **REA e Instagram**: esistono un numero REA o un link Instagram da mettere nel footer? Resta aperta anche la domanda sul branch `main`.

---

## Aggiornamento: decisioni sul report

Il punto «Peso del logo» e le domande 1–3 qui sopra sono superati.

1. File modificati
- `studio/esporta-immagini.mjs`: logo solo a 240 e 320 px, in AVIF con trasparenza (qualità 60, effort 6) e WebP (qualità 80, alfa 90). Eliminati 480, 624 e `logo.png`. Il manifesto indica `larghezzaImg: 240`. Il contact sheet mostra i quattro file su sabbia e sabbia chiara e il 320 al 200%: bordi puliti, nessun alone.
- `src/img/`: `logo-240.avif` 16,7 KB · `logo-240.webp` 24,4 KB · `logo-320.avif` 24,7 KB · `logo-320.webp` 37,9 KB. Ogni file sta sotto i 40 KB.
- `build.mjs`: l'`<img>` dell'helper usa la larghezza indicata dal manifesto, quindi per il logo `logo-240.webp`; tolto il ripiego PNG. `sizes` è uguale alla larghezza a schermo: 79 px, 99 px da 1024 px, 69 px nel footer. L'escape dell'alt (e di `sizes`) c'era già: ora lo verifica un controllo.
- `studio/anteprima.mjs`: esporta `avviaServer` e `apriBrowser`, usati dal nuovo controllo; l'anteprima completa parte solo quando lo script viene eseguito direttamente.
- `studio/controlli.mjs`:
  - il controllo dei pesi richiede logo solo a 240 e 320, AVIF e WebP, ogni file ≤ 40 KB;
  - nuovo controllo dell'helper `immagine()`: escape di alt e `sizes`, errore se mancano, `<img>` su `logo-240.webp`, `sizes` del logo uguale alla larghezza a schermo;
  - nuovo controllo con Playwright a densità 1, 2 e 3 (390 e 1440 px): il logo scaricato davvero è un AVIF ≤ 40 KB e a 1440 px con densità 3 è il 320;
  - `og:image:alt` confrontato con il testo di §8.
- `CLAUDE.md`:
  - §2.6: logo esportato a 240 e 320 px;
  - §4: le tre graffe valgono anche per il `<picture>` dell'helper;
  - §8: alt di `og:image`;
  - §9: limiti del logo.

2. File del logo scaricati davvero, misurati con Playwright:

| Pagina | densità 1 | densità 2 | densità 3 |
|---|---|---|---|
| 390 px (logo 79 px) | logo-240.avif | logo-240.avif | logo-240.avif |
| 1440 px (logo 99 px) | logo-240.avif | logo-240.avif | logo-320.avif (header) + logo-240.avif (footer) |

Su telefono a densità 3 il browser chiede 79 × 3 = 237 px e il 240 basta; il 320 arriva sul desktop a densità 3 (99 × 3 = 297 px).

3. REA e Instagram: restano `null`, quindi la riga REA e i social non compaiono. Arrivano allo Step 9.

4. Branch `main`: creato dal commit dello Step 0 (`7df733d`) e pubblicato su GitHub. Il lavoro continua su `landing-migliore`. **Da fare su GitHub**: impostare `main` come branch predefinito, perché da questa sessione non posso farlo (`gh` è riservato alle ricerche e gli strumenti GitHub disponibili non cambiano il branch predefinito). Percorso: Settings → General → Default branch → icona delle frecce → `main` → Update.

5. Controlli: build OK · html-validate 0 errori · `node --check` OK · **controlli 35/35**. Prova a vuoto: senza l'escape dell'alt nell'helper, il controllo nuovo fallisce. Anteprima: 14 screenshot in `studio/screenshot/step2/`, console a 0 errori e 0 richieste fallite.

# CLAUDE.md — Landing «Migliore – Estetica Avanzata»

Questo file è il brief del progetto e l'unica fonte di verità. Rileggilo all'inizio di ogni step. Se qualcosa qui è in conflitto con un prompt di step, vale questo file, a meno che il prompt non dica esplicitamente «aggiorna CLAUDE.md».

## §0 Chi sei e qual è l'obiettivo

Sei tre figure insieme:
- sviluppatore web senior: HTML, CSS e JavaScript senza framework, hosting statico su Netlify con Netlify Functions;
- creative technologist: design pulito, fotografico, coerente con il logo;
- copywriter CRO italiano: testi brevi, concreti, verificabili.

Il progetto: una landing page per «Migliore – Estetica Avanzata», centro estetico di Cristina Migliore in Via Roma 2/A, 21040 Caronno Varesino (VA). Si riceve solo su appuntamento.

Il traffico arriva soprattutto da annunci Meta (Facebook e Instagram), quasi tutto da telefono. Gli annunci spingono due cose: i trattamenti viso e il pedicure avanzato. La conversione principale è il contatto: tocco su «Chiama» o su «Scrivi su WhatsApp». La conversione secondaria è l'iscrizione email in cambio di un codice sconto.

Pubblico: donne e uomini della zona di Caronno Varesino e dei comuni vicini, che arrivano dal telefono, non conoscono ancora il centro e decidono in pochi secondi se fidarsi.

Criterio per ogni scelta, in quest'ordine:
1. è vero e legale (§10);
2. aiuta chi arriva da un annuncio a chiamare o scrivere;
3. è leggero e veloce sul telefono (§9);
4. è coerente con il logo e con il sabbia (§5).

Regola di lavoro: esegui solo lo step richiesto. Alla fine fai il report (§12), commit e push, poi FERMATI e aspetta il prossimo prompt. Non anticipare lavoro degli step successivi.

## §1 Il repository

Hosting: Netlify, collegato a questo repository GitHub. Il sito è statico, generato da `build.mjs` (Node, nessuna dipendenza esterna) nella cartella `dist/`. Netlify esegue `node build.mjs` e pubblica `dist/`.

Struttura obbligatoria:

```
/                         radice del repository
├─ CLAUDE.md              questo brief
├─ netlify.toml           build, functions, header
├─ package.json           script di build; nessuna dipendenza obbligatoria
├─ build.mjs              genera dist/ da content/ e src/
├─ content/
│  ├─ centro.json         dati del centro, contatti, orari, dati legali
│  ├─ testi.json          tutti i testi, per pagina
│  └─ listino.json        il listino prezzi (§2.3)
├─ src/
│  ├─ templates/          pagina.html, parti/*.html, icone/*.svg, privacy.html, cookie.html, 404.html
│  ├─ css/                tokens.css, base.css, sezioni.css
│  ├─ js/                 main.js, consenso.js, codice.js
│  ├─ fonts/              woff2 self-hosted
│  └─ img/                immagini ottimizzate (generate allo Step 2)
├─ netlify/functions/
│  └─ codice-sconto.mjs   la funzione del codice sconto (Step 8)
├─ supabase/
│  └─ iscritti.sql        tabella e funzione per le iscrizioni (Step 8)
└─ studio/                lavoro interno, mai pubblicato
   ├─ package.json        dipendenze di lavoro: playwright, sharp, html-validate
   ├─ originali/          foto e logo originali, identici a come li ha forniti il cliente
   ├─ esporta-immagini.mjs
   ├─ anteprima.mjs       server locale di dist/ + screenshot Playwright
   ├─ controlli.mjs       controlli automatici, crescono a ogni step
   ├─ report/            un file per step: stepN.md
   └─ screenshot/         screenshot 390 e 1440 px (ignorati da git)
```

Regole del repository:
- `studio/` non finisce mai in `dist/`. Le sue dipendenze stanno in `studio/package.json`, così Netlify non installa Playwright né sharp durante la build.
- `dist/`, `node_modules/`, `studio/node_modules/`, `studio/screenshot/`, `.netlify/` ed eventuali `.env*` sono in `.gitignore`.
- Branch di lavoro: `landing-migliore`. Non si lavora mai direttamente sul branch principale.
- L'ambiente reale (Netlify, dominio, Supabase, Meta, GA4) si collega solo all'ultimo step. Fino ad allora si lavora con l'anteprima locale (§13).

## §2 Dati del progetto

Ogni dato qui sotto è la fonte unica. Nel codice i dati stanno solo in `content/*.json` e si leggono da lì: mai scritti a mano nei template, nel CSS o nel JavaScript.

Regola generale: se un dato manca non inventarlo. Usa un testo neutro, oppure ometti l'elemento, e segnalalo nel report alla voce «Dati mancanti».

### §2.1 Centro e dati legali (content/centro.json)

- Nome del centro: Migliore – Estetica Avanzata
- Payoff: «Diventa la versione più bella di te»
- Titolare: Cristina Migliore
- Denominazione della ditta individuale: Migliore Cristina
- Partita IVA: 04123400121
- REA: non indicato (la riga REA non compare)
- Sede legale, se diversa dal centro: non indicata (coincide con il centro)
- Indirizzo del centro: Via Roma 2/A, 21040 Caronno Varesino (VA)
- Telefono (anche WhatsApp): 352 060 1109 · formato internazionale +393520601109 · numero per wa.me 393520601109
- Email: esteticamigliore@gmail.com
- Orari (aggiornati dalla titolare il 3 novembre 2026): dal martedì al venerdì, dalle 09:00 alle 18:00; il sabato, dalle 08:00 alle 14:00; lunedì e domenica chiuso · solo su appuntamento
- Presentazione di Cristina: non indicata (usa il testo predefinito di §8)
- Dominio: esteticamigliore.it, registrato su Register.it, DNS esterno puntato a Netlify. Indirizzo principale del sito: https://esteticamigliore.it, senza www (deciso il 3 novembre 2026: è l'indirizzo principale su Netlify, con HTTPS attivo, ed è quello verificato su Google Search Console). www.esteticamigliore.it, quando ha il suo record CNAME verso Netlify, porta lì da solo.
- Instagram: non indicato (nessun link) · Facebook: non indicato (nessun link) · Scheda Google: non indicata (il pulsante Maps usa la ricerca dell'indirizzo)

Regole condizionali:
- Se il REA non è indicato, la riga REA nel footer non compare.
- Se la sede legale non è indicata, nel footer compare solo l'indirizzo del centro.
- Un social senza link non compare: niente icone vuote.
- Gli orari sono a fasce: in `centro.json › orari.fasce` una voce per fascia (giorni, apertura, chiusura). Si scrivono come «dal martedì al venerdì, dalle 09:00 alle 18:00; il sabato, dalle 08:00 alle 14:00», su appuntamento. Nei dati strutturati (`openingHoursSpecification`) una specifica per fascia, con i giorni ricavati da «dal martedì al venerdì» e «il sabato»; se una fascia non si ricava senza ambiguità, ometti `openingHoursSpecification` e segnalalo.
- Il codice fiscale e il domicilio personale della titolare non compaiono mai nel sito.

### §2.2 Trattamenti in evidenza

Viso:
- Trattamento viso in evidenza: Trattamento viso Antiage
- Dettagli dei trattamenti viso, una riga per voce:
Pulizia viso base: detersione delicata, pulizia accurata delle impurità, maschera e crema finale scelte per il tuo tipo di pelle. Per una pelle più pulita, fresca e luminosa.
Trattamento viso Antiage: un trattamento professionale Natinuel, senza aghi, scelto in base alla tua pelle per renderla più luminosa, compatta e idratata, con linee sottili meno visibili e un colorito più uniforme. Uno dei trattamenti è Revinol, in tre fasi: esfoliazione delicata, maschera peel-off e siero finale, con retinolo, vitamina C, vitamina E e acido ialuronico. Fatto con costanza, aiuta la pelle a mantenere più a lungo un aspetto fresco e compatto.
Trattamento Antiage contorno occhi e labbra: un trattamento mirato sulle zone più delicate del viso, per idratare e attenuare l'aspetto delle linee sottili intorno a occhi e labbra.
Laminazione ciglia: ciglia più definite e incurvate, senza extension.
Laminazione sopracciglia: i peli vengono fissati nella forma scelta, per sopracciglia più ordinate e piene alla vista.
- Macchinari (marca e modello): non indicati (non nominare macchinari)
- Linee di prodotti usate: Natinuel, linea cosmetica professionale per centri estetici

Pedicure (le voci di «Include» sono separate da punto e virgola):
- Il pedicure estetico è la pedicure classica. Include: pediluvio; scostamento delle cuticole; taglio e limatura delle unghie; levigatura dei talloni; smalto (base, due mani di colore e top coat) o semipermanente, se li scegli; crema finale. Durata: 30 minuti senza smalto, 40 con smalto, 50 con semipermanente.
- Il pedicure avanzato aggiunge il lavoro con micromotore e frese. Include: pediluvio; scostamento delle cuticole; taglio e limatura delle unghie; lavoro con micromotore e frese sulle unghie e sulle zone dove la pelle si ispessisce; levigatura dei talloni; smalto o semipermanente, se li scegli. Durata: 45–50 minuti senza smalto, 50–55 con smalto, 60 con semipermanente.
- Strumenti e igiene: micromotore professionale con frese specifiche per le unghie e per la pelle; strumenti puliti con gli ultrasuoni, sterilizzati a secco e conservati in buste sigillate

Regole condizionali:
- Dettagli, macchinari, prodotti, strumenti e durate compaiono solo se indicati qui. Se mancano, la sezione usa solo i nomi del listino e il copy neutro di §8, senza descrizioni inventate.
- Un marchio di prodotto o un macchinario si nomina solo se indicato qui, con il nome esatto.
- Formato dei dettagli viso: una riga per voce, «Nome della voce: descrizione». Il nome coincide con il listino (§2.3). Una voce senza riga resta senza descrizione.
- Il nome di un protocollo (per esempio Revinol) si usa solo dentro la descrizione della sua voce, mai come voce nuova: le voci restano le 5 del listino.
- Dal produttore si prendono solo fatti verificabili: nome del trattamento, fasi, ingredienti. Non si copiano i suoi testi, le sue promesse, le sue foto prima/dopo, né i nomi di prodotto che richiamano trattamenti medici (per esempio con «Boto», «Filler», «Rx»).

### §2.3 Listino prezzi (content/listino.json)

È il listino stampato esposto in centro. Nomi, ordine e prezzi restano identici. Si uniforma solo la scrittura: «15 €», «da 30 a 40 €», «+ 5 €», «20 € / 25 €», «uomo» minuscolo. Sono prezzi finali per il cliente.

Struttura JSON: `{ "categorie": [ { "id", "titolo", "voci": [ { "nome", ...prezzo } ] } ] }`, dove il prezzo è uno di:
`"prezzo": 15` · `"da": 30, "a": 40` · `"da": 60` (solo minimo) · `"supplemento": 5` · `"prezzi": [20, 25]`.

Manicure e pedicure (id `mani-piedi`)
- Manicure senza smalto — 15 €
- Pedicure estetico senza smalto — 35 €
- Pedicure avanzato senza smalto — 40 €
- Applicazione smalto — + 5 €
- Pedicure estetico con semipermanente — 45 €
- Pedicure avanzato con semipermanente — 50 €
- Taglio unghie mani o piedi — 10 €
- Trattamento paraffina mani — 30 €
- Trattamento paraffina piedi — 35 €

Epilazione (id `epilazione`)
- Labbro superiore — 5 €
- Sopracciglia — 10 €
- Braccia — 15 €
- Ascelle — 10 €
- Pancia — 10 €
- Glutei — 10 €
- Inguine — 10 €
- Inguine completo — 15 €
- Mezza gamba (senza/con inguine) — 20 € / 25 €
- Gamba intera (senza/con inguine) — 30 € / 35 €
- Petto e addome uomo — da 30 a 40 €
- Schiena uomo — da 30 a 40 €

Epilazione brasiliana multidirezionale (id `brasiliana`)
- Labbro superiore — 10 €
- Ascelle — 15 €
- Pancia — 20 €
- Glutei — 20 €
- Inguine — 20 €
- Inguine completo — 25 €
- Petto e addome uomo — 30 €
- Schiena uomo — da 40 a 50 €

Massaggi (id `massaggi`)
- Massaggio gambe e addome — 35 €
- Massaggio schiena — 35 €
- Massaggio completo — 55 €

Trattamenti corpo e viso (id `corpo-viso`)
- Peeling corpo — da 50 a 60 €
- Trattamento corpo — da 60 €
- Pulizia schiena — 35 €
- Pulizia viso base — 55 €
- Trattamento viso Antiage — da 80 a 120 €
- Trattamento Antiage contorno occhi e labbra — 40 €
- Laminazione ciglia — 50 €
- Laminazione sopracciglia — 50 € (prezzo aggiornato dalla titolare il 3 novembre 2026; il listino stampato in foto 06 riporta ancora 30 €)

Le voci viso della sezione viso (§6) sono 5: Pulizia viso base, Trattamento viso Antiage, Trattamento Antiage contorno occhi e labbra, Laminazione ciglia, Laminazione sopracciglia. Nella sezione la voce «Trattamento viso Antiage» va per prima, con l'etichetta «In evidenza»; le altre seguono nell'ordine di questo elenco. Nel listino (sezione 9) l'ordine resta quello del cartaceo.

### §2.4 Codice sconto e promo email

- Sconto: 10%
- Validità del codice: 30 giorni dalla generazione
- Condizioni: su un trattamento a scelta, uno per persona, non cumulabile con altre promozioni
- Frequenza delle promo: circa una volta al mese
- Il codice si genera al momento, si mostra subito a schermo e si mostra a Cristina all'arrivo. Quando Brevo è attivo (Step 9) arriva anche via email, nello stesso momento, così la cliente non lo perde; fino ad allora solo a schermo. Uno per email: se la stessa email si iscrive di nuovo, riceve lo stesso codice.

### §2.5 Integrazioni (si collegano solo all'ultimo step)

- GA4: G-DFCM449BWE (attivo dal 6 novembre 2026: parte solo dopo «Accetta» o «Statistiche» nel banner, con Google Consent Mode; Google Signals va lasciato spento, la CSP ammette solo i domini base di GA4)
- Pixel Meta: 1682509193499996 (attivo dal 6 novembre 2026: parte solo dopo «Accetta» o «Marketing» nel banner, con consent revoke prima di init; eventi PageView, Contact e Lead. API Conversioni non ancora attiva: serve il token META_CAPI_TOKEN su Netlify)
- Progetto Supabase: migliore-estetica (bkcpnkrnhjirmbwnrozp), regione eu-central-1 (Francoforte), con supabase/iscritti.sql applicato. SUPABASE_URL è su Netlify; SUPABASE_SECRET_KEY è su Netlify dal 6 novembre 2026, segreta e solo nel contesto di produzione: lì le iscrizioni si salvano davvero, nei Deploy Preview e in locale il codice resta in modalità prova.
- Netlify: progetto esteticamigliore (https://esteticamigliore.netlify.app), collegato a GitHub dal 4 novembre 2026 con branch di produzione landing-migliore: ogni push su landing-migliore va online da solo (per un commit che non deve pubblicare, «[skip netlify]» nel messaggio). Dominio https://esteticamigliore.it con HTTPS attivo. Lo zip di studio/pacchetto-netlify.mjs resta solo come ripiego.
- Google Search Console: proprietà «Prefisso URL» https://esteticamigliore.it, verificata con il file HTML (content/centro.json › integrazioni.googleFileVerifica).
- Servizio email: Brevo (Francia). BREVO_API_KEY è su Netlify dal 6 novembre 2026, segreta e solo nel contesto di produzione. Mancano il mittente verificato (content/centro.json › integrazioni.servizioEmail.mittente) e l'ID della lista delle promo (servizioEmail.listaPromo): con il mittente il codice arriva anche via email; con la lista ogni iscritto entra da solo nella lista delle promo di Brevo, da cui Cristina invia le promo mensili.
- Chiavi segrete (Supabase, API Conversioni Meta, servizio email): MAI in questo file, MAI nel repository, MAI nella chat. Vanno solo nelle variabili d'ambiente di Netlify, con ambito «Functions».

### §2.6 Immagini (pacchetto «migliore-immagini.zip»)

Sono foto vere del centro. Restano identiche: niente ritocchi, niente rigenerazione, niente elementi aggiunti. Si fanno solo ridimensionamento e conversione in AVIF e WebP. La fusione con il sabbia la fa la pagina con il CSS (§5), non i file.

| File | Cosa mostra | Dove va |
|---|---|---|
| foto/01-cristina-bancone.png (941×1672) | Cristina sorridente al bancone, logo sul bancone | Apertura (hero), tutte e tre le pagine |
| foto/02-ingresso.png (1346×1168) | Ingresso del centro con insegna, di sera | «Dove siamo e orari» |
| foto/03-cabina-viso.png (941×1672) | Cabina con lettino, candele, poster di trattamento viso | Sezione viso, foto principale |
| foto/04-cabina-lettino.png (941×1672) | Cabina con lettino, lampada a lente, lavabo | «Chi sono» |
| foto/05-postazione-pedicure.png (941×1672) | Poltrona pedicure, poggiapiedi, carrello attrezzi | Sezione pedicure |
| foto/06-listino-stampato.png (1536×1024) | Il listino stampato, due facciate | Listino: link «Vedi il listino stampato» |
| logo/logo-trasparente.png (624×508) | Logo su fondo trasparente, senza payoff | Header e footer, esportato a 240 e 320 px |
| logo/logo-sabbia.png (624×508) | Lo stesso logo su fondo sabbia #F4DBCA | Riserva, se il trasparente dà problemi |
| logo/farfalla.png (210×210) | La farfalla del logo su fondo sabbia | Favicon e icona per iPhone |
| condivisione/og-1200x630.jpg | Logo e foto 01 su sabbia, per le anteprime dei link | Meta tag og:image |

Il logo è solo questo, con il cerchio nero: non si ridisegna, non si ricolora, non si sostituisce con quello bronzo che si vede sul bancone.

## §3 Regole d'oro

1. Nessun file esterno di template o tema: il progetto nasce da zero. File nuovi solo nella struttura di §1.
2. Alla fine di ogni step: `node build.mjs` senza errori, `html-validate` a 0 errori su `dist/**/*.html`, `node --check` su ogni file JS, `node studio/controlli.mjs` tutto verde.
3. Git: all'inizio di ogni step `git fetch` e `git pull` sul branch `landing-migliore`; alla fine commit «Step N: titolo» e push. Ogni step si può annullare con un revert.
4. L'ambiente può azzerarsi tra una sessione e l'altra: se mancano `studio/node_modules` o il browser di Playwright, reinstallali (`npm install --prefix studio`, `npx --prefix studio playwright install chromium`) prima di lavorare.
5. Mobile first: si progetta a 390 px, poi si allarga a 768 e 1440.
6. Ogni testo sta in `content/testi.json`: si cambia senza toccare template o CSS.
7. Niente dati finti: niente recensioni inventate, contatori, countdown, «posti limitati», «più richiesto», numeri di clienti.
8. Ogni effetto ha un ripiego: la pagina si legge tutta senza JavaScript, senza supporto a `mask-image` e con «riduci movimento» attivo.
9. Nessuna libreria, nessun CDN. Font self-hosted. JavaScript scritto a mano, piccolo.
10. Prezzi, orari, telefono e dati legali si leggono sempre da `content/*.json`. Il listino resta identico al cartaceo (§2.3).
11. Non chiedermi ciò che puoi procurarti o ricavare da solo. Chiedimi solo i dati che conosco io, nel report.
12. Le foto non si ritoccano (§2.6). Il ritaglio, quando serve, lo fa solo il CSS (`object-fit` e `object-position`); i file restano completi.
13. Nessun segreto nel repository. Se un valore sembra una chiave, fermati e segnalalo.

## §4 Architettura

File da creare, uno per riga:
- `netlify.toml` — `[build] command = "node build.mjs"`, `publish = "dist"`, `environment = { NODE_VERSION = "22" }`; `[functions] directory = "netlify/functions"`, `node_bundler = "esbuild"`; `[[headers]]` di sicurezza e cache.
- `package.json` — `"type": "module"`, script `build`, `anteprima`, `controlli`; `engines.node >= 20`; nessuna dipendenza.
- `build.mjs` — motore di template minimo e severo, scritto a mano.
- `content/centro.json`, `content/testi.json`, `content/listino.json` — i dati (§2) e i testi (§8).
- `src/templates/pagina.html` e `src/templates/parti/*.html` — una parte per sezione.
- `src/templates/privacy.html`, `cookie.html`, `404.html`.
- `src/css/tokens.css`, `base.css`, `sezioni.css`.
- `src/js/main.js` (comparse, barra contatti, anno), `consenso.js` (banner e caricamento dei tracciamenti), `codice.js` (modulo codice sconto).
- `netlify/functions/codice-sconto.mjs` — funzione in JavaScript (`.mjs`), così l'anteprima locale la importa senza strumenti in più.
- `supabase/iscritti.sql` — tabella, indici e funzione `iscrivi_email`.
- `studio/*` — come in §1.

Pagine generate:
- `dist/index.html` → `/`, pagina generica
- `dist/viso/index.html` → `/viso/`, per gli annunci viso
- `dist/pedicure/index.html` → `/pedicure/`, per gli annunci pedicure
- `dist/privacy/index.html`, `dist/cookie/index.html`, `dist/404.html`
- `dist/sitemap.xml`, `dist/robots.txt`

Requisiti verificati sulla documentazione ufficiale, con le loro insidie:
- `netlify.toml` sta nella radice e prevale sulle impostazioni dell'interfaccia di Netlify.
- Le variabili d'ambiente scritte in `netlify.toml` NON arrivano alle Functions. Le chiavi vanno nell'interfaccia o nella CLI di Netlify, con ambito Functions, segnate come segrete.
- La cartella delle Functions predefinita è `netlify/functions/` e deve stare fuori da `dist/`.
- Una Function con `config.path` risponde solo a quel percorso. Qui: `export const config = { path: "/api/codice-sconto", method: ["POST"] }`.
- Nelle Functions le variabili si leggono con `Netlify.env.get("NOME")`. Per l'anteprima locale usa un helper: `const env = (k) => globalThis.Netlify?.env.get(k) ?? process.env[k];`.
- Gli header di `netlify.toml` valgono solo per i file statici, non per le risposte delle Functions: quelle impostano i propri header nel codice.
- Pretty URLs è attivo di default: non creare redirect per aggiungere o togliere la barra finale, causano cicli.
- I Deploy Preview non vengono indicizzati da Google (`X-Robots-Tag: noindex` automatico).
- La variabile `URL` è disponibile durante la build con l'indirizzo principale del sito: usala per URL assoluti (canonical, og:url, sitemap); se manca, usa l'indirizzo principale di §2.1 (https://esteticamigliore.it); se anche il dominio non è indicato, ometti gli URL assoluti e segnalalo.
- `.netlify/` va in `.gitignore`.
- Supabase: RLS sempre attivo sulle tabelle in `public`. Creando la tabella in SQL bisogna attivarlo e dare i permessi esplicitamente. Qui: nessun permesso ad `anon` e `authenticated`, permessi solo a `service_role`. La chiave segreta o `service_role` scavalca RLS e non va mai nel browser.

Motore di template (`build.mjs`):
- Sintassi: `{{chiave.annidata}}` (testo con escape HTML), `{{{chiave}}}` (HTML già sicuro, solo per JSON-LD, SVG interni e il <picture> generato dall'helper immagine(), che fa da sé l'escape di alt e attributi), `{{> parte}}`, `{{#se chiave}}…{{altrimenti}}…{{/se}}` (con la negazione `{{#se !chiave}}`), `{{#ogni lista}}…{{/ogni}}`.
- Modalità severa, come gli strictFilters: una chiave mancante, una parte inesistente o un `{{` rimasto nell'output fermano la build con un errore che dice file e chiave.
- Aggiunge `?v=<hash8>` ai link di CSS, JS e font, calcolato sul contenuto.
- Genera i dati strutturati JSON-LD `BeautySalon` da `centro.json`: name, image, telephone, email, address, url (se c'è), openingHoursSpecification (se ricavabile), priceRange «€€».
- Genera `sitemap.xml` (solo con URL assoluti disponibili) e `robots.txt`.

Header (`netlify.toml`):
- `/*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`.
- `/fonts/*`: `Cache-Control: public, max-age=31536000, immutable`.
- `/css/*` e `/js/*`: `Cache-Control: public, max-age=31536000, immutable` (i link hanno `?v=hash`).
- `/img/*`: `Cache-Control: public, max-age=2592000`.
- Content-Security-Policy: allo Step 9, quando si conoscono i domini di GA4 e Meta.

## §5 Design system

Atmosfera: luce calda di sera, carta sabbia, silenzio. Le foto del centro hanno già luce gialla e calda: il sabbia le accoglie come una pagina di carta. Elegante e pulita, mai lussuosa in modo finto: niente oro, niente glitter.

Palette (token CSS in `tokens.css`, contrasti verificati WCAG):
- `--sabbia: #F4DBCA` — fondo principale, preso dal logo.
- `--sabbia-chiara: #FAEDE4` — solo per piccoli dettagli (per esempio lo stato «aperto» di una voce del listino); mai come fondo di sezione o di pagina.
- `--sabbia-profonda: #EBCBB5` — schede e blocchi in rilievo.
- `--crema: #FFF8F3` — campi dei moduli.
- `--inchiostro: #1F1612` — testi e pulsante principale. Contrasto 13,4:1 sul sabbia.
- `--inchiostro-tenue: #5C4537` — testi secondari e bordi dei campi. 6,7:1 sul sabbia.
- `--accento: #8C4318` — link, occhielli, piccoli dettagli. 5,4:1 sul sabbia, 4,7:1 sul sabbia profondo.
- `--linea: #D9B49C` — solo filetti decorativi, mai per testi o bordi di campi.
- `--farfalla: #EB7D40` — SOLO decorazione. 2,1:1 sul sabbia: vietato per testi, icone informative e bordi.

Il body ha `background: var(--sabbia)`. Niente modalità scura: la pagina è sempre sabbia, ma imposta `color-scheme: light`.

Fondo unico: tutto il sito è color sabbia. Ogni sezione e ogni pagina (codice sconto, listino, privacy, cookie e 404 comprese) ha fondo --sabbia, senza alternanza. Le sezioni si separano con lo spazio e con un filetto sottile --linea largo quanto il contenuto. --sabbia-profonda resta solo per i blocchi in rilievo dentro una sezione (scheda «Pedicure avanzato», blocco del codice sconto, pillola «In evidenza»); --crema solo per i campi dei moduli.

Font (self-hosted, woff2, solo caratteri latini):
- Titoli: Marcellus 400. Richiama il carattere del logo.
- Testi: Jost 400 e 500.
- Fallback: `Marcellus, "Cormorant Garamond", Georgia, serif` e `Jost, "Segoe UI", system-ui, sans-serif`.
- `font-display: swap`; precarica solo Marcellus 400 e Jost 400.

Scala tipografica (mobile → 1440 px, con `clamp()`):
- H1: 2.25rem → 3.5rem, interlinea 1.1, lettering 0.01em
- H2: 1.75rem → 2.5rem, interlinea 1.15
- H3: 1.25rem → 1.5rem
- Occhiello: Jost 500, 0.8125rem, maiuscolo, spaziatura 0.14em, colore `--accento`
- Testo: Jost 400, 1.0625rem (17 px), interlinea 1.6, larghezza massima 62ch
- Piccolo: 0.875rem

Spazi: base 8 px. Sezioni: 64 px sopra e sotto su mobile, 112 px da 1024 px. Margini laterali: 20 px su mobile, contenuto massimo 1120 px.

Pulsanti:
- Principale: fondo `--inchiostro`, testo `--sabbia`, forma a pillola (border-radius 999px), altezza minima 52 px, Jost 500 1rem, icona a sinistra.
- Secondario: bordo 1.5px `--inchiostro`, fondo trasparente, stesso formato.
- Hover: leggero schiarimento (opacity .9) e spostamento di 1 px; active: nessuno spostamento.
- Focus: anello `outline: 3px solid var(--accento); outline-offset: 3px` su tutto ciò che è interattivo.
- Icone: SVG inline disegnati a mano (telefono, fumetto per WhatsApp, posizione, freccia). Niente loghi di terzi.

Foto (la firma visiva del progetto):
- Ogni foto sfuma nel sabbia con `mask-image` sul bordo verso il testo: su mobile dal basso (`linear-gradient(to bottom, #000 72%, transparent)`), su desktop dal lato del testo. Il soggetto non viene mai coperto dalla sfumatura.
- Ripiego: dove `mask-image` non è supportato, la foto ha angoli arrotondati di 6 px e nessuna sfumatura.
- Proporzioni: fino a 767 px la foto si vede intera, in proporzione originale e a tutta larghezza. Tra 768 e 1023 px le foto verticali (01, 03, 04, 05) stanno in una cornice larga al massimo 520 px e centrata, con la stessa proporzione e lo stesso object-position del desktop, e sfumano in basso: intere a tutta larghezza sarebbero alte oltre 1300 px. La foto 02, orizzontale, resta intera. Da 1024 px la cornice è 4:5 (3:4 per la foto 01) con object-position dichiarato per ogni foto, scelto per tenere il soggetto al centro. La sfumatura in basso può arrivare all'86% dove serve a tenere nitido un dettaglio (per esempio la scritta MIGLIORE sul bancone).
- Ordine su mobile: fino a 1023 px, in ogni sezione con foto (tranne l'apertura) vengono prima occhiello, H2 e testo introduttivo, poi la foto, poi il resto (elenco, schede, pulsanti). Così due foto non arrivano mai una dopo l'altra e la sfumatura della foto dell'apertura passa sul testo della sezione successiva.

Dettaglio firma: un arco sottile «a pennello» (SVG originale disegnato da te, ispirato al cerchio del logo, non ricalcato) sopra l'occhiello di ogni H2. Colore `--accento` al 60%, larghezza 48 px. Una sola volta per sezione.

Movimento:
- Comparsa all'ingresso nello schermo: opacità 0 → 1 e spostamento 12 px → 0, 450 ms, `cubic-bezier(.2,.7,.2,1)`, sfasamento 60 ms tra elementi vicini.
- Si attiva solo se il JavaScript gira (classe `js` su `<html>`, impostata da uno script inline di una riga nel `<head>`): senza JS tutto è già visibile.
- Con `prefers-reduced-motion: reduce` nessuna animazione, nessuna transizione di posizione.
- Niente parallasse, niente video, niente 3D, niente effetti al passaggio del mouse sulle foto.

## §6 Struttura e strategia

Ordine delle sezioni (stesso template per le tre pagine; cambiano solo i testi dell'apertura e l'ordine delle sezioni 3 e 4):

1. Header — logo (altezza 64 px su mobile, 80 px da 1024 px: sotto queste misure la scritta MIGLIORE diventa illeggibile) a sinistra; a destra il link «Chiama» (da 768 px mostra anche il numero). Scopo: riconoscibilità e contatto immediato. Non fisso.
2. Apertura — occhiello, H1, sottotitolo, due pulsanti («Chiama» principale, «Scrivi su WhatsApp» secondario), riga info «Su appuntamento · dal martedì al venerdì, dalle 09:00 alle 18:00 · il sabato, dalle 08:00 alle 14:00», payoff piccolo in Marcellus, foto 01. Mobile: testo poi foto (sfuma in basso). Desktop: testo a sinistra, foto a destra (sfuma a sinistra). Scopo: in 3 secondi chi arriva capisce cosa, dove e come prenotare.
3. Viso (sulle pagine `/` e `/viso/`; quarta su `/pedicure/`) — foto 03, testo, voci viso dal listino senza prezzi, link «Vedi i prezzi ↓» al listino, pulsante WhatsApp con messaggio viso. Scopo: conferma dell'annuncio viso.
4. Pedicure avanzato (terza su `/pedicure/`) — foto 05, testo, confronto «Pedicure estetico / Pedicure avanzato» in due schede, riga sul limite (§8), link «Vedi i prezzi ↓», pulsante WhatsApp con messaggio pedicure. Scopo: spiegare perché non è la solita pedicure.
5. Chi sono — foto 04, titolo, presentazione di Cristina, payoff. Scopo: fiducia.
6. Come prenotare — tre passi numerati, pulsanti «Chiama» e «WhatsApp». Scopo: togliere l'ultimo dubbio.
7. Codice sconto — titolo, testo, modulo email con consenso, risultato con il codice. Scopo: catturare chi non è pronto a chiamare.
8. Dove siamo e orari — foto 02, indirizzo, pulsante «Apri in Google Maps», orari, telefono. Niente mappa incorporata (imposterebbe cookie prima del consenso). Scopo: farsi trovare.
9. Listino — categorie a fisarmonica con `<details>`/`<summary>` (funziona senza JS). Aperta di default: `corpo-viso` su `/viso/`, `mani-piedi` su `/pedicure/`, nessuna su `/`. Sotto: «Vedi il listino stampato» (apre l'immagine 06). Scopo: trasparenza, in secondo piano.
10. Footer — logo piccolo, dati legali, contatti, social se presenti, link Privacy, Cookie e «Preferenze cookie».

Barra contatti mobile: sotto i 768 px, fissa in basso, due pulsanti affiancati («Chiama», «WhatsApp»), fondo `--sabbia` con bordo superiore `--linea`, `padding-bottom: env(safe-area-inset-bottom)`. Si nasconde mentre i pulsanti dell'apertura sono visibili (IntersectionObserver). Senza JS resta sempre visibile. La pagina ha in fondo uno spazio pari alla barra, così il footer non resta coperto.

Pulsanti per pagina: apertura 2, viso 1, pedicure 1, come prenotare 2, dove siamo 1, barra mobile 2. Nessun altro pulsante.

Link WhatsApp: `https://wa.me/393520601109?text=` + testo codificato con `encodeURIComponent`, preso da `testi.json`:
- generale: «Ciao Cristina, vorrei prenotare un appuntamento.»
- viso: «Ciao Cristina, vorrei informazioni sui trattamenti viso.»
- pedicure: «Ciao Cristina, vorrei prenotare un pedicure avanzato.»
Link telefono: `tel:+393520601109`.

## §7 Varianti per campagna

Tre pagine statiche dallo stesso template, generate da `build.mjs`: niente parametri URL, niente JavaScript, niente sfarfallio. Gli annunci puntano a `/viso/` o `/pedicure/`, con i parametri UTM che mette Meta.

Per ogni pagina cambiano: `<title>`, meta description, H1, sottotitolo, ordine delle sezioni 3 e 4, testo WhatsApp, categoria del listino aperta. Ogni pagina ha il canonical su se stessa.

| Pagina | title | H1 |
|---|---|---|
| `/` | Migliore – Estetica Avanzata · Caronno Varesino | Trattamenti viso e pedicure avanzato a Caronno Varesino |
| `/viso/` | Trattamenti viso a Caronno Varesino · Migliore | Trattamenti viso a Caronno Varesino |
| `/pedicure/` | Pedicure avanzato a Caronno Varesino · Migliore | Pedicure avanzato a Caronno Varesino |

I `<title>` restano entro 60 caratteri (oltre, Google li taglia).

Meta description (60–160 caratteri, una per pagina):
- `/`: «Trattamenti viso, pedicure avanzato, epilazione e massaggi a Caronno Varesino. Solo su appuntamento: chiama o scrivi su WhatsApp al 352 060 1109.»
- `/viso/`: «Pulizia viso e trattamenti anti-age a Caronno Varesino, su appuntamento. Chiama o scrivi su WhatsApp al 352 060 1109.»
- `/pedicure/`: «Pedicure avanzato a Caronno Varesino: non la solita pedicure. Su appuntamento, chiama o scrivi su WhatsApp al 352 060 1109.»

Titoli alternativi da testare negli annunci (non vanno nel sito ora):
- Viso, simili: «Pulizia viso e anti-age a Caronno Varesino» · «Il tuo trattamento viso, su appuntamento» · «Trattamenti viso con Cristina, a Caronno Varesino»
- Viso, diversi: «Una pausa per la tua pelle» · «Diventa la versione più bella di te» · «Il tempo per la tua pelle, finalmente»
- Pedicure, simili: «Pedicure avanzato: oltre la pedicure classica» · «Pedicure avanzato su appuntamento, a Caronno Varesino» · «Piedi curati con il pedicure avanzato»
- Pedicure, diversi: «Passo di farfalla» · «Il pedicure che i tuoi piedi aspettavano» · «Torna a mostrare i piedi»

## §8 Copy

Tono: frasi brevi, seconda persona (tu), concrete. Nessun superlativo non dimostrabile («il migliore», «il più richiesto», «garantito», «definitivo», «miracoloso»). Il nome «Migliore» si usa solo come nome del centro e cognome di Cristina, mai come aggettivo comparativo.

Parole vietate ovunque nel sito (testi, alt, meta, JSON-LD): podologo/podologia/podologico (unica eccezione: la riga sul limite, che indirizza al podologo), podoestetica, curativo, terapeutico, medicale, medico (eccezione: la riga sul limite), cura di calli, duroni, verruche, unghie incarnite, micosi, «elimina», «risolve», «nuova apertura», «appena aperto», «inaugurazione».
Per i trattamenti viso sono vietati anche: dermatologico, biomedico, diagnosi, analisi della pelle, anamnesi, cellule e «a livello cellulare», DNA, collagene, elastina, fibroblasti, rigenera/rigenerante, ripara, infiammazione, acne, rosacea, couperose, cicatrici, filler, botox, mesoterapia, biorivitalizzazione, iniezioni, punture, peeling chimico, lifting, ringiovanisce, «invecchiamento cronologico», «rallenta l'invecchiamento». Al loro posto si descrive l'aspetto: pelle più luminosa, levigata, idratata, compatta, colorito più uniforme, aspetto delle linee sottili attenuato.

Testi predefiniti (vanno in `content/testi.json`):

Apertura `/`
- occhiello: «Estetica avanzata a Caronno Varesino»
- H1: «Trattamenti viso e pedicure avanzato a Caronno Varesino»
- sottotitolo: «Si riceve solo su appuntamento. Chiama o scrivi su WhatsApp e scegli il giorno che preferisci.»

Apertura `/viso/`
- occhiello: «Viso · Caronno Varesino»
- H1: «Trattamenti viso a Caronno Varesino»
- sottotitolo: «Pulizia viso e trattamenti anti-age, su appuntamento, in un ambiente caldo e tranquillo.»

Apertura `/pedicure/`
- occhiello: «Piedi · Caronno Varesino»
- H1: «Pedicure avanzato a Caronno Varesino»
- sottotitolo: «Non la solita pedicure: più attenzione alle zone dove la pelle si ispessisce, per piedi morbidi e curati.»

Comuni all'apertura
- pulsanti: «Chiama» · «Scrivi su WhatsApp»
- riga info: «Su appuntamento · dal martedì al venerdì, dalle 09:00 alle 18:00 · il sabato, dalle 08:00 alle 14:00»
- payoff: «“Diventa la versione più bella di te”»
- alt foto 01: «Cristina Migliore al bancone del centro Migliore – Estetica Avanzata»
- alt dell'immagine di condivisione (og:image): «Logo di Migliore – Estetica Avanzata e Cristina Migliore al bancone del centro»

Viso
- occhiello: «Viso» · H2: «Trattamenti viso»
- testo: «Dalla pulizia del viso ai trattamenti anti-age: in cabina scegli con Cristina il trattamento adatto alla tua pelle.»
- seconda frase, sempre presente: «Prima di iniziare guardate insieme la tua pelle e parlate delle tue abitudini: il trattamento si sceglie così.»
- etichetta voce in evidenza: «In evidenza»
- Se Pulizia viso base: detersione delicata, pulizia accurata delle impurità, maschera e crema finale scelte per il tuo tipo di pelle. Per una pelle più pulita, fresca e luminosa.
Trattamento viso Antiage: un trattamento professionale Natinuel, senza aghi, scelto in base alla tua pelle per renderla più luminosa, compatta e idratata, con linee sottili meno visibili e un colorito più uniforme. Uno dei trattamenti è Revinol, in tre fasi: esfoliazione delicata, maschera peel-off e siero finale, con retinolo, vitamina C, vitamina E e acido ialuronico. Fatto con costanza, aiuta la pelle a mantenere più a lungo un aspetto fresco e compatto.
Trattamento Antiage contorno occhi e labbra: un trattamento mirato sulle zone più delicate del viso, per idratare e attenuare l'aspetto delle linee sottili intorno a occhi e labbra.
Laminazione ciglia: ciglia più definite e incurvate, senza extension.
Laminazione sopracciglia: i peli vengono fissati nella forma scelta, per sopracciglia più ordinate e piene alla vista. è indicato, sotto ogni voce la sua descrizione, presa da lì così com'è (al massimo due frasi, tre per la voce in evidenza; se è più lunga, accorciala senza aggiungere nulla). Se la descrizione della voce in evidenza elenca delle fasi («in tre fasi: …»), mostrale come piccolo elenco numerato di al massimo 3 fasi.
- Se non indicati (non nominare macchinari) o Natinuel, linea cosmetica professionale per centri estetici sono indicati, una riga «In cabina usiamo: …» con il testo indicato.
- link: «Vedi i prezzi ↓» · pulsante: «Prenota il tuo trattamento viso»
- alt foto 03: «Cabina per i trattamenti viso del centro Migliore – Estetica Avanzata»

Pedicure avanzato
- occhiello: «Piedi» · H2: «Pedicure avanzato»
- testo: «Non la solita pedicure. Il pedicure estetico si prende cura dell'aspetto di unghie e piedi. Il pedicure avanzato aggiunge un lavoro approfondito con micromotore e frese professionali sulle unghie e sulle zone dove la pelle si ispessisce, per una pelle più liscia e morbida e unghie in ordine.»
- scheda 1, titolo «Pedicure estetico», sottotitolo «La pedicure classica», include: le voci del pedicure estetico di §2.2; sotto, «Durata: …» con il testo indicato, se c'è.
- scheda 2, titolo «Pedicure avanzato», sottotitolo «Un lavoro più approfondito», include: le voci del pedicure avanzato di §2.2; sotto, «Durata: …» con il testo indicato, se c'è. Scheda 2 in rilievo (`--sabbia-profonda`).
- strumenti e igiene, solo se indicati, sotto le schede: «Strumenti e igiene: …».
- riga sul limite (sempre presente, testo piccolo `--inchiostro-tenue`): «Unghie incarnite, verruche, diabete o dolore ai piedi? In questi casi rivolgiti a un podologo o al tuo medico.»
- link: «Vedi i prezzi ↓» · pulsante: «Prenota il pedicure avanzato»
- alt foto 05: «Postazione per manicure e pedicure del centro Migliore – Estetica Avanzata»
- Dalle note di Cristina non si riportano: calli, unghie ispessite o incarnite, ragadi, «base curativa», il marchio del micromotore. Si descrive l'aspetto e il metodo (§10).

Chi sono
- occhiello: «Chi sono» · H2: «Migliore è il mio cognome. Ed è anche una promessa.»
- testo: se non indicata (usa il testo predefinito di §8) è indicata, usala così com'è; altrimenti «Sono Cristina e ti aspetto nel mio centro di Caronno Varesino. Ricevo solo su appuntamento, così il tuo trattamento ha il suo tempo.»
- chiusura: il payoff «“Diventa la versione più bella di te”» in Marcellus
- alt foto 04: «Una delle cabine del centro Migliore – Estetica Avanzata»

Come prenotare
- occhiello: «Prenotare è semplice» · H2: «Come prenotare»
- 1 «Chiama o scrivi su WhatsApp al 352 060 1109.»
- 2 «Scegli il giorno e l'ora: dal martedì al venerdì, dalle 09:00 alle 18:00; il sabato, dalle 08:00 alle 14:00.»
- 3 «Vieni in Via Roma 2/A a Caronno Varesino: il tuo appuntamento è pronto.»

Codice sconto
- occhiello: «Per te» · H2: «10% di sconto sul tuo trattamento»
- testo: «Lascia la tua email: ricevi subito un codice sconto del 10% e, circa una volta al mese, le promo del centro.»
- campo: etichetta «La tua email», segnaposto «nome@esempio.it»
- consenso (casella non spuntata, obbligatoria per ricevere il codice): «Voglio ricevere via email le promozioni di Migliore – Estetica Avanzata su trattamenti viso e corpo, mani e piedi, epilazione e massaggi, circa una volta al mese. Posso cancellarmi quando voglio. Ho letto l'informativa privacy.» con link a `/privacy/`
- condizioni sotto il modulo: «Il codice vale 30 giorni, su un trattamento a scelta, uno per persona, non cumulabile con altre promozioni. Mostralo a Cristina quando arrivi.»
- pulsante: «Ricevi il codice»
- risultato: «Ecco il tuo codice» + codice grande + «Valido fino al [data]. Fai uno screenshot o mostralo dal telefono quando arrivi.» + solo se l'email è partita davvero: «Te l'abbiamo mandato anche via email.»
- errori: «Controlla l'indirizzo email.» · «Per ricevere il codice serve il consenso.» · «Qualcosa non ha funzionato. Riprova tra poco o scrivici su WhatsApp.»

Dove siamo e orari
- occhiello: «Dove siamo» · H2: «Ti aspettiamo a Caronno Varesino»
- indirizzo: «Via Roma 2/A, 21040 Caronno Varesino (VA)»
- orari: «dal martedì al venerdì, dalle 09:00 alle 18:00; il sabato, dalle 08:00 alle 14:00. Solo su appuntamento.»
- pulsante: «Apri in Google Maps» → `https://www.google.com/maps/search/?api=1&query=` + indirizzo completo codificato
- alt foto 02: «L'ingresso del centro Migliore – Estetica Avanzata in Via Roma 2/A»

Listino
- occhiello: «Prezzi» · H2: «Listino»
- testo: «Prezzi finali. È lo stesso listino che trovi in centro.»
- link: «Vedi il listino stampato»

Pagina 404
- title: «Pagina non trovata · Migliore – Estetica Avanzata» · meta robots noindex
- H1: «Questa pagina non esiste.»
- testo: «Forse il link è cambiato. Torna alla pagina iniziale o contattaci direttamente.»
- link: «Torna alla pagina iniziale» · pulsanti «Chiama» e «Scrivi su WhatsApp»

Footer
- «Migliore Cristina · P.IVA 04123400121» · «Registro Imprese di Varese · REA non indicato (la riga REA non compare)» (solo se indicato) · indirizzo · telefono · email · «© [anno] Migliore – Estetica Avanzata»
- link: «Privacy» · «Cookie» · «Preferenze cookie» (solo se il banner è attivo). Privacy e Cookie puntano a /privacy/ e /cookie/ fin dallo Step 1: fino allo Step 7 portano alla 404, ed è previsto.

## §9 Performance e accessibilità

Obiettivi, misurati con Lighthouse in modalità mobile sulla build di produzione:
- Performance ≥ 90, Accessibilità 100, Best practice ≥ 95, SEO 100.
- LCP ≤ 2,0 s; CLS ≤ 0,05; TBT ≤ 100 ms; INP ≤ 200 ms sul campo.
- JavaScript proprio ≤ 12 KB compresso in totale. GA4 e Meta si caricano solo dopo il consenso e non contano nel primo caricamento.
- CSS ≤ 20 KB compresso. Font ≤ 100 KB in totale.
- Immagini: AVIF con ripiego WebP in `<picture>`, `srcset` e `sizes` corretti, mai ingrandite oltre l'originale. Foto 01 ≤ 120 KB alla larghezza 720; altre foto ≤ 160 KB; foto 06 ≤ 300 KB alla larghezza 1536. Logo: solo 240 e 320 px, AVIF con trasparenza e WebP, ogni file ≤ 40 KB.
- `width` e `height` su ogni immagine; `loading="lazy"` e `decoding="async"` su tutte tranne la foto dell'apertura, che ha `fetchpriority="high"`.
- Contrasto AA (valori in §5), focus sempre visibile, aree di tocco ≥ 44×44 px, `lang="it"`, un solo H1 per pagina, titoli in ordine, link con testo che si capisce da solo, `<label>` su ogni campo, errori annunciati con `aria-live="polite"`.

## §10 Regole legali applicate al progetto

- La partita IVA 04123400121 compare nella home e in ogni pagina (art. 35 DPR 633/72). Nel footer: denominazione, sede, Registro Imprese e REA quando disponibile, contatti.
- Attività di estetista (L. 1/1990): sono escluse le prestazioni con finalità terapeutica. Nessuna parola o promessa terapeutica o sanitaria (elenco in §8).
- Pedicure avanzato: non si scrive mai «podologico» né si nominano condizioni da trattare. Si descrive solo l'aspetto estetico e il metodo. La riga sul limite indirizza al podologo.
- Trattamenti viso: si descrivono l'aspetto della pelle e il metodo, mai meccanismi biologici, condizioni della pelle o termini medici (elenco in §8). Le affermazioni del produttore restano del produttore: sul sito diventano solo fatti (nome, fasi, ingredienti) e benefici d'aspetto. Una pubblicità che promette più di quanto il servizio dà è una pratica commerciale ingannevole (Codice del Consumo, art. 21).
- Niente foto prima/dopo: né del produttore né di clienti. Il poster «REVINOL» sulla parete della foto 03 è parte della cabina vera e a dimensione web è illeggibile: la foto resta intera e non si ritaglia per nasconderlo. Il divieto vale per le immagini che il sito usa come prova di un risultato.
- Niente confronti con trattamenti medici («alternativa alle punture», «come il botox», «al posto del filler») e niente risultati in numeri o frazioni («rallenta di un terzo l'invecchiamento»): servono prove che il centro non ha. Si può dire solo ciò che è un fatto, per esempio «senza aghi».
- Nessuna promessa di risultato («garantito», «definitivo», «visibile dalla prima seduta»).
- Non scrivere «nuova apertura» o simili: il centro è già aperto da mesi.
- Prezzi: uguali al listino stampato, prezzi finali, niente prezzi barrati.
- Codice sconto: le condizioni (percentuale, durata, limiti) stanno accanto al modulo. Nessun conto alla rovescia, nessuna scarsità finta.
- Consenso email: casella non spuntata, testo specifico accanto alla casella con finalità e argomenti delle promo, link all'informativa. Il codice si dà in cambio del consenso: è un vantaggio a cui si può rinunciare, quindi va dichiarato chiaramente.
- Prova del consenso: per ogni iscrizione si salvano email, data e ora, testo esatto del consenso e sua versione, pagina di provenienza.
- Nessuna profilazione: niente «offerte personalizzate». Le promo sono uguali per tutti.
- Cookie: finché GA4 e Meta non sono configurati il sito non usa cookie, quindi nessun banner. Con GA4 o Meta: banner con «Rifiuta» e «Accetta» di uguale evidenza, «Personalizza», chiusura con X = rifiuto, nessun tracciamento prima del consenso, scelta ricordata per 6 mesi, link «Preferenze cookie» nel footer.
- Mappe: niente Google Maps incorporato, solo il link.
- Foto: vere, del centro e della titolare, senza ritocchi.
- Informativa privacy e cookie policy: bozze generate allo Step 7, da far verificare a un professionista prima del lancio degli annunci. Titolare del trattamento: Migliore Cristina. La data di ultimo aggiornamento è fissa (testi.json, legale.aggiornamento) e si cambia solo quando cambiano i testi legali.

## §11 Gli step

- Step 0 — Brief e struttura del repository
- Step 1 — Fondamenta: build, dati, stile, anteprima e controlli
- Step 2 — Immagini e logo
- Step 3 — Apertura, barra contatti e varianti delle tre pagine
- Step 4 — Sezione viso
- Step 5 — Sezione pedicure avanzato
- Step 6 — Chi sono, come prenotare, dove siamo e orari
- Step 7 — Listino, footer e pagine legali
- Step 8 — Codice sconto, banner cookie e tracciamenti spenti
- Step 9 — Controllo qualità, messa online e integrazioni

## §12 Report di fine step

Scrivilo in chat e salvalo in `studio/report/stepN.md`:
1. File creati o modificati: uno per riga, con una riga di spiegazione.
2. Controlli: esito di build, html-validate, `node --check`, `controlli.mjs` (numero di controlli superati su totali).
3. Anteprima: cosa si vede a 390 e a 1440 px, percorso degli screenshot, errori di console (devono essere zero).
4. Dati mancanti o dubbi: elenco puntato, ognuno con il default che hai usato.
5. Domande per me: solo su ciò che posso sapere io, al massimo 3.

Poi commit, push e FERMATI.

## §13 Anteprima senza ambiente reale

- `node build.mjs` genera `dist/`.
- `node studio/anteprima.mjs` avvia un server locale su `dist/` (porta 4173) che gestisce anche `POST /api/codice-sconto` importando `netlify/functions/codice-sconto.mjs` e passandogli una `Request` vera. Senza chiavi Supabase la funzione lavora in «modalità prova» (§ Step 8).
- Con Playwright (Chromium) fa screenshot a pagina intera di `/`, `/viso/` e `/pedicure/` a 390×844 e 1440×900, più uno del solo primo schermo per ciascuna. Salva in `studio/screenshot/stepN/`.
- Raccoglie gli errori di console e le richieste fallite: devono essere zero.
- `studio/controlli.mjs` contiene i controlli automatici. Ogni step ne aggiunge alcuni e non ne toglie nessuno. Stampa «✔ nome» o «✘ nome: motivo» ed esce con codice 1 se qualcosa fallisce.
- Se Playwright o Chromium non si installano, prova `npx playwright install --with-deps chromium`, poi un Chromium di sistema (`which chromium chromium-browser google-chrome`). Se nessuno funziona, salta gli screenshot, fai tutti gli altri controlli e dillo nel report.

# Step 9 — Controllo qualità, messa online e integrazioni

Date: 2026-11-02 (integrazioni preparate) e 2026-11-03 (parti A, B e C fase 1) · Branch: `landing-migliore` (copia su `claude/epic-albattani-sh8a53`)

Stato:
- **A. Controllo qualità**: fatto.
- **B. Pull request**: fatta, verso `main`.
- **C. Messa online**: ferma alla fase 1. Il progetto Netlify esiste, ma il repository va collegato dall'interfaccia (§6). Poi si verifica l'anteprima reale e si aspetta il tuo «ok, pubblica».
- **D ed E**: dopo il tuo «ok, pubblica».

## 0. Documentazione consultata

- **Supabase Cron**, pagina «Install» (https://supabase.com/docs/guides/cron/install), dal server MCP di Supabase:
  - `create extension pg_cron with schema pg_catalog`;
  - `grant usage on schema cron to postgres`;
  - `grant all privileges on all tables in schema cron to postgres`;
  - `cron.schedule` con un nome già esistente aggiorna il job invece di duplicarlo.
- **Brevo**, «Send a transactional email» (`POST https://api.brevo.com/v3/smtp/email`):
  - chiave nell'header `api-key`;
  - corpo con `sender`, `to`, `replyTo`, `subject`, `htmlContent`, `tags`;
  - risposta 201 quando l'email è accettata;
  - mittente verificato nell'account Brevo.
- **Google tag e Meta Pixel**, domini per la Content-Security-Policy:
  - Google: `*.googletagmanager.com` per lo script; `*.google-analytics.com` e `*.analytics.google.com` per le misure;
  - Meta: `connect.facebook.net` per lo script; `www.facebook.com` per le richieste.
- **Netlify**, contesto ufficiale dal server MCP:
  - gli header di `netlify.toml` valgono per i file statici;
  - le variabili delle Functions si impostano nell'interfaccia;
  - il server MCP di Netlify non ha un'operazione per collegare un repository (le sue operazioni: progetto, nome, variabili, moduli, accessi), quindi il collegamento si fa dall'interfaccia.

## 1. File creati o modificati

Integrazioni (commit «Step 9: controllo qualità e integrazioni»):
- `supabase/iscritti.sql`: `pulisci_iscritti()` (iscrizioni revocate o senza interazioni da oltre 24 mesi), eseguibile solo da `postgres`, lanciata ogni giorno alle 03:17 UTC da Supabase Cron. Già applicata sul progetto vero.
- `netlify/functions/codice-sconto.mjs`: invio del codice anche via email con Brevo, solo con `BREVO_API_KEY` e mittente in `centro.json`; `emailInviata` true solo se Brevo accetta; mai l'email nei log.
- `content/centro.json`: `integrazioni.servizioEmail.mittente: null`, da compilare.
- `content/testi.json`: `codiceSconto.email`, cioè i testi dell'email.
- `netlify.toml`: `Content-Security-Policy` con l'impronta dell'unico script inline e i soli domini di Google e Meta.

Parte A (commit «Step 9A: controllo qualità»):
- `studio/lighthouse.mjs` (nuovo): Lighthouse mobile su `/`, `/viso/` e `/pedicure/`, 3 esecuzioni per pagina, valore mediano, pesi per tipo, confronto con §9.
  - Misura la build di produzione con gli header di `netlify.toml` e la compressione brotli, come su Netlify.
  - Esce con errore se un obiettivo non è raggiunto.
  - Si lancia con `npm run lighthouse`.
- `studio/report/step9-lighthouse.json` (nuovo): i valori mediani dell'ultima misura.
- `studio/anteprima.mjs`:
  - modalità `produzione` del server: header di tutti i blocchi di `netlify.toml` (cache compresa) e brotli calcolato una volta per file, come la cache di Netlify;
  - screenshot anche a 1024 px;
  - la barra contatti nascosta dal CSSOM negli screenshot del codice, perché la CSP blocca i `<style>` aggiunti.
- `build.mjs`:
  - `minificaCss()`: il CSS in `dist/` è minificato (commenti e spazi), con le stringhe protette;
  - le descrizioni delle voci viso cominciano con la maiuscola;
  - il riquadro «Bozza» dipende da `testi.json › legale.verificata` e non più da `CONTEXT=production` (§3).
- `studio/esporta-immagini.mjs`: le foto verticali 01, 03, 04 e 05 si esportano anche a 800 px. Solo ridimensionamento, come da §2.6.
- `src/img/*-800.avif`, `src/img/*-800.webp` (8 nuovi) e `src/img/immagini.json`. I file già esistenti sono rimasti identici byte per byte.
- `content/testi.json`:
  - 24 apostrofi dritti diventati tipografici (’);
  - punto finale a «In cabina usiamo: ….»;
  - nuovo `legale.verificata: false`.
- `studio/controlli.mjs`: 101 controlli (erano 96 a inizio step), con 5 nuovi:
  - CSS minificato senza cambiarne il significato;
  - foto da 800 px scelte dal browser;
  - tipografia;
  - link e 404;
  - quattro larghezze.

  Più adattamenti:
  - i testi attesi dal brief passano da `tipografico()`;
  - il controllo del riquadro «Bozza» segue `legale.verificata`.
- `package.json`: script `lighthouse`.
- `studio/package.json` e `studio/package-lock.json`: `lighthouse` 12 tra gli strumenti di lavoro. Non finisce in `dist/`.
- `studio/report/step9.md`: questo report.

## 2. Controlli

- `CONTEXT=production node build.mjs`: OK. Riquadro «Bozza» presente, banner cookie spento perché non ci sono ID di GA4 e Meta.
- `html-validate` su `dist/**/*.html`: 0 errori.
- `node --check`: 9 file JS, tutti OK.
- `node studio/controlli.mjs`: **101/101**.
- Prova a vuoto in una copia del repository, con sei errori inseriti apposta. Tutti segnalati:
  - un apostrofo dritto;
  - uno spazio doppio;
  - un link rotto;
  - un elemento che fa scorrere la pagina in orizzontale a 1024 px;
  - una descrizione che comincia con la minuscola;
  - un minificatore che rompe `.a :focus`.

  L'unico altro «✘» della copia è il controllo sulle chiavi, che usa `git ls-files` e la copia non è un repository.
- `node studio/anteprima.mjs --step 9`: 45 screenshot, 0 errori di console, 0 richieste fallite. Ripieghi a posto: senza JS, con «riduci movimento» e senza `main.js`.

## 3. A. Controllo qualità

### A.1 Build di produzione
Tutto verde (§2).

### A.2 Lighthouse mobile, valore mediano su 3 esecuzioni

| Pagina | Performance | Accessibilità | Best practice | SEO | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 100 | 1,2 s | 1,8 s | 0 | 0 ms |
| `/viso/` | 99 | 100 | 100 | 100 | 1,2 s | 1,8 s | 0 | 0 ms |
| `/pedicure/` | 99 | 100 | 100 | 100 | 1,2 s | 1,8 s | 0 | 0 ms |

Obiettivi di §9: Performance ≥ 90, Accessibilità 100, Best practice ≥ 95, SEO 100, LCP ≤ 2,0 s, CLS ≤ 0,05, TBT ≤ 100 ms. **Tutti raggiunti.**

Cosa ho corretto:
- **Primo giro**: LCP mediano di `/` a 2,02 s, appena sopra l'obiettivo.
- **Correzioni**:
  - versione da 800 px delle foto verticali: a 412 px con densità 1,75 (il telefono di Lighthouse) e a 390 px con densità 2 il browser scaricava la 941;
  - CSS minificato: da 12,7 a 9,0 KB trasferiti;
  - nel server di misura, compressione calcolata una volta sola, come fa Netlify.
- **Dopo**: LCP 1,8 s su tutte e tre le pagine.

Restano due avvisi, voluti:
- `uses-long-cache-ttl`: le immagini hanno cache di 30 giorni, come da §4.
- `render-blocking-resources`: i 3 CSS. Uno stile inline violerebbe la CSP, che vuole `style-src 'self'`.

### A.3 Pesi al primo caricamento (trasferiti, compressi)

| Pagina | Totale | HTML | JS | CSS | Font | Immagini | Richieste |
|---|---|---|---|---|---|---|---|
| `/` | 171,1 KB | 6,8 KB | 4,0 KB | 9,0 KB | 36,4 KB | 112,2 KB | 14 |
| `/viso/` | 171,1 KB | 6,8 KB | 4,0 KB | 9,0 KB | 36,4 KB | 112,2 KB | 14 |
| `/pedicure/` | 185,7 KB | 6,8 KB | 4,0 KB | 9,0 KB | 36,4 KB | 126,7 KB | 14 |

Confronto con §9 (i pesi trasferiti comprendono gli header HTTP):

| Voce | Limite §9 | Misurato |
|---|---|---|
| JavaScript proprio, compresso | ≤ 12 KB | main.js 1,0 KB + codice.js 1,4 KB in gzip |
| CSS, compresso | ≤ 20 KB | 6,8 KB in gzip |
| Font | ≤ 100 KB | 33,6 KB in 3 file |
| Foto 01 a 720 px | ≤ 120 KB | 40,9 KB AVIF, 61,6 KB WebP |
| Altre foto | ≤ 160 KB | la più pesante è `ingresso-1200.webp`, 141,6 KB |
| Foto 06 a 1536 px | ≤ 300 KB | 74,2 KB AVIF, 109,5 KB WebP |
| Logo, ogni file | ≤ 40 KB | il più pesante è `logo-320.webp`, 37,9 KB |

### A.4 Rilettura dei testi
Ho riletto tutti i testi visibili, gli alt, i meta (title, description, Open Graph), i testi della privacy, della cookie policy e della 404, e quelli del modulo, dell'esito e dell'email.

Corretto:
- **Apostrofi**: 24 apostrofi dritti diventati tipografici (’), per esempio «L’ingresso del centro…», «Scegli il giorno e l’ora», «Te l’abbiamo mandato…» e il testo del consenso. La versione del consenso (SHA-256 del testo) cambia di conseguenza. Va bene: nessuno si è ancora iscritto.
- **Maiuscole**: le descrizioni delle voci viso cominciavano con la minuscola («un trattamento professionale…»). Nel brief seguono i due punti, ma in pagina sono un paragrafo sotto il titolo, quindi ora cominciano con la maiuscola. Le tre fasi di Revinol restano minuscole, perché continuano «in tre fasi:».
- **Punteggiatura**: aggiunto il punto finale a «In cabina usiamo: Natinuel, linea cosmetica professionale per centri estetici.», come «Strumenti e igiene: ….».

Verificato e lasciato così:
- **Virgolette**: «» per termini e nomi, per esempio «GDPR» e «Preferenze cookie»; “” solo per il payoff citato, come scrive §8. Nessuna virgoletta dritta.
- **Spazi**: nessuno spazio doppio, prima della punteggiatura, a inizio o a fine stringa.
- **Accenti**: «È lo stesso listino», «lunedì», «più», «perché» sono corretti.
- **Trattini negli intervalli**: in «45–50» c'è un trattino lungo (–) con caratteri invisibili che impediscono di andare a capo dentro l'intervallo.
- **«Antiage» e «anti-age»**: nel listino si scrive «Antiage», perché il nome resta identico al cartaceo (§2.3). Nei testi si scrive «anti-age», come in §7 e §8. È voluto dal brief: non l'ho uniformato.

Il nuovo controllo «tipografia» blocca d'ora in poi apostrofi e virgolette dritte, spazi doppi e spazi prima della punteggiatura.

### A.5 Rilettura legale (§10)

| Regola di §10 | Dove è rispettata |
|---|---|
| P.IVA nella home e in ogni pagina (art. 35 DPR 633/72); footer con denominazione, sede, Registro Imprese e REA se disponibile, contatti | Footer di tutte le pagine (landing, privacy, cookie, 404): «Migliore Cristina · P.IVA 04123400121», indirizzo, telefono, email. La riga REA non compare: il REA non è indicato. Controllo «footer definitivo su tutte le pagine». |
| Estetista (L. 1/1990): niente parole o promesse terapeutiche | Elenco delle parole vietate di §8 controllato su testo, alt, meta e JSON-LD di ogni pagina. Controllo «parole vietate». |
| Pedicure avanzato: mai «podologico», nessuna condizione da trattare, riga sul limite | Sezione pedicure: solo aspetto e metodo (micromotore e frese, zone dove la pelle si ispessisce). La riga sul limite rimanda al podologo e al medico. «podologo» e «medico» compaiono solo lì, una volta per pagina, mai sulla 404. |
| Viso: aspetto e metodo, niente meccanismi biologici o termini medici; del produttore solo fatti | Descrizioni dai dettagli di §2.2: Natinuel, Revinol come fase di una voce, fasi e ingredienti, benefici d'aspetto. Parole vietate per il viso controllate. |
| Niente foto prima/dopo | In pagina solo le 6 foto del centro. Il poster «REVINOL» della foto 03 resta, la foto non è ritagliata, ed è illeggibile a dimensione web. Nessuna immagine del produttore. |
| Niente confronti con trattamenti medici e niente risultati in numeri | L'unico fatto citato è «senza aghi». Vietati «botox», «filler», «iniezioni», «punture», «lifting»… |
| Nessuna promessa di risultato | Vietati «garantito», «definitivo», «miracoloso», «visibile dalla prima seduta». |
| Mai «nuova apertura» o simili | Vietati «nuova apertura», «appena aperto», «inaugurazione». |
| Prezzi uguali al listino stampato, finali, niente barrati | Listino: 40 righe identiche a §2.3 in ogni pagina (controllo voce per voce), prezzi finali, nessun `<del>` o `<s>`, nessun «€» nelle sezioni viso e pedicure. |
| Codice sconto: condizioni accanto al modulo, niente conto alla rovescia né scarsità finta | Condizioni sotto il pulsante e ripetute nel risultato. Nessun countdown, contatore o «posti limitati» (anche questi tra le parole vietate). |
| Consenso email: casella non spuntata, testo specifico con finalità e argomenti, link all'informativa, scambio dichiarato | Modulo: casella non spuntata e obbligatoria, testo completo di §8 con link a `/privacy/`. La privacy dice che senza consenso non si riceve il codice ma si può prenotare. |
| Prova del consenso: email, data e ora, testo e versione del consenso, pagina | Tabella `iscritti` su Supabase: `email`, `creato_il`, `consenso_testo`, `consenso_versione` (SHA-256), `pagina`, `utm`. Il testo arriva dal server, non dal browser. |
| Nessuna profilazione | Privacy: «Le promozioni sono uguali per tutti: nessuna profilazione.» Nessun dato di comportamento salvato. |
| Cookie: senza GA4 e Meta niente cookie né banner; con loro banner a norma | Oggi niente banner, niente `consenso.js`, nessuna richiesta verso Google o Meta. Nella build di prova il banner ha «Rifiuta» e «Accetta» di uguale evidenza, «Personalizza», X = rifiuto, nulla prima del consenso, scelta ricordata per 182 giorni, «Preferenze cookie» nel footer. Tutto controllato. |
| Mappe: niente Google Maps incorporato, solo il link | Solo il pulsante «Apri in Google Maps» (link di ricerca). La CSP ha `frame-ancestors 'none'` e nessun `frame-src` esterno. |
| Foto vere, senza ritocchi | Impronte SHA-256 degli originali, nessun ritaglio (proporzioni identiche), colori medi entro ±2, `og.jpg` identica byte per byte. Le nuove versioni da 800 px passano gli stessi controlli. |
| Privacy e cookie policy: bozze da far verificare; titolare Migliore Cristina; data di aggiornamento fissa | Titolare «Migliore Cristina». Data fissa «2 novembre 2026». Il riquadro «Bozza» resta in cima a privacy e cookie anche in produzione, finché non scrivi «privacy verificata» (`legale.verificata`). |
| §2.1: codice fiscale e domicilio della titolare mai nel sito | Nessun testo con il formato di un codice fiscale e nessun indirizzo diverso da Via Roma 2/A, 21040: controllato in tutte le pagine. |

### A.6 Link
Nuovo controllo «link», su tutte le pagine:
- ogni `href`, `src`, `srcset`, `action` e `og:image` interno risponde 200 (58 indirizzi diversi: pagine, CSS, JS, font, immagini e funzione) e ogni `#ancora` esiste;
- i link esterni sono solo:
  - `tel:+393520601109`;
  - `https://wa.me/393520601109?text=…`, con uno dei tre testi di `testi.json`;
  - Maps con `https://www.google.com/maps/search/?api=1&query=Via Roma 2/A, 21040 Caronno Varesino VA`;
  - `mailto:esteticamigliore@gmail.com`;
  - il Garante.
- `/pagina-che-non-esiste/` risponde 404 con la pagina «Questa pagina non esiste.»;
- `/viso` porta a `/viso/` con un 301.

Il testo WhatsApp giusto per ogni pagina e sezione era già controllato dagli Step 3–6.

### A.7 Quattro larghezze
Nuovo controllo su tutte le pagine (landing, privacy, cookie, 404) a 390, 768, 1024 e 1440 px:
- nessuno scroll orizzontale;
- nessun elemento fuori dallo schermo, tranne il campo trappola del modulo, che è fuori apposta;
- nessun testo tagliato. Il numero nell'header su mobile è nascosto apposta e resta leggibile dai lettori di schermo;
- ogni foto sfumata: fino a 767 px sull'immagine, da 768 px sulla cornice.

Screenshot in `studio/screenshot/step9/`:
- landing a 390, 768, 1024 e 1440 px, intere e primo schermo, più il fondo a 390;
- privacy, cookie e 404 alle quattro misure;
- modulo del codice;
- banner della build di prova.

Guardati:
- apertura a 390, 1024 e 1440;
- pagina intera a 1024;
- voci viso a 390, con le maiuscole nuove;
- privacy a 390, con il riquadro «Bozza» in cima;
- codice ottenuto.

Nessun problema.

## 4. B. Pull request

Commit «Step 9A: controllo qualità» e pull request da `landing-migliore` verso `main` (§7, link nel messaggio in chat). `main` contiene solo lo Step 0, quindi la pull request raccoglie gli Step 1–9.

## 5. Stato dei servizi

- **Supabase** (migliore-estetica, `bkcpnkrnhjirmbwnrozp`, eu-central-1 Francoforte): attivo.
  - Migrazioni `iscritti_codice_sconto` e `pulizia_iscritti_24_mesi`.
  - RLS attivo e senza policy; solo `service_role` legge e scrive.
  - Job `pulizia-iscritti` attivo.
  - Advisor: solo «RLS senza policy», che è voluto.

  Il prompt dello step dice «Progetto Supabase: non indicato», ma CLAUDE.md §2.5 lo indica, e vale CLAUDE.md. Finché `SUPABASE_SECRET_KEY` non è su Netlify, la funzione resta in modalità prova.
- **Netlify** (esteticamigliore, piano Free): progetto creato, `SUPABASE_URL` impostata. Nessun repository collegato e nessun deploy.
- **GA4, Meta Pixel, Brevo**: codice pronto, spenti finché mancano i dati.
- **DNS**: non toccato.

## 6. C. Messa online, fase 1: cosa serve da te

1. **Collega il repository al progetto che esiste già** (non crearne un altro: ha già il nome e `SUPABASE_URL`):
   - app.netlify.com → progetto **esteticamigliore** → Project configuration → Build & deploy → Continuous deployment → **Link repository**;
   - GitHub → `nicholaszani2000-star/landing-cristina-centro-estetico`;
   - **Branch to deploy: `main`**;
   - lascia vuoti Build command e Publish directory (li legge da `netlify.toml`) e conferma.
2. **Deploy Previews**: Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Deploy Previews: «Any pull request against your production branch / branch deploy branches».
3. Netlify crea da solo il Deploy Preview della pull request aperta: `deploy-preview-<N>--esteticamigliore.netlify.app`.
4. Scrivimi «collegato»: verifico il Deploy Preview (tre pagine, codice in modalità prova, 404, header con `curl -I`) e ti mando le prove da fare sul telefono.

`.netlify/` è già in `.gitignore`.

## 7. Dati mancanti o dubbi

- **Branch di produzione**: CLAUDE.md §2.5 dice `landing-migliore`, il prompt dello Step 9 dice il branch principale (`main`).
  - Con `landing-migliore` in produzione ogni push andrebbe online subito, senza anteprima né il tuo «ok». Non funzionerebbero il flusso a due tempi di questo step e le pull request con anteprima dello step D.
  - Per questo nei passi del §6 c'è `main`, il default che ho usato. Se confermi, aggiorno CLAUDE.md §2.5.
- **Riquadro «Bozza»**: prima spariva in produzione da solo. Ora resta finché non scrivi «privacy verificata», come chiede questo step.
- **GA4, pixel Meta, mittente Brevo, social, scheda Google, REA, sede legale**: non indicati. Default: spenti o assenti. Vanno nell'elenco finale (parte E).
- **Codice scaduto e stessa email**: oggi riceve lo stesso codice (regola «uno per email»).

## 8. Domande per te

1. Confermi `main` come branch di produzione su Netlify, con `landing-migliore` come branch di lavoro che passa da una pull request?
2. Quando hai collegato il repository, scrivimi «collegato»: verifico il Deploy Preview e ti mando le 6 prove da fare sul telefono.

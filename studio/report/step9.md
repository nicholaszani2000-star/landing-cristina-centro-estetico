# Step 9 — Controllo qualità, messa online e integrazioni

Data: 2026-11-02 · Branch: `landing-migliore` (copia su `claude/epic-albattani-sh8a53`)

La parte di codice dello Step 9 è finita e collaudata. Supabase è configurato e attivo. Il progetto Netlify esiste ma non ha ancora un deploy. Il sito andrà online quando le azioni del §5 saranno fatte: sono passaggi che può fare solo la titolare degli account, oppure che dipendono da dati che non ho.

## 0. Documentazione consultata

- **Supabase Cron**, pagina «Install» (https://supabase.com/docs/guides/cron/install), ricerca nella documentazione ufficiale con il server MCP di Supabase. Per installarlo:
  - `create extension pg_cron with schema pg_catalog`;
  - `grant usage on schema cron to postgres`;
  - `grant all privileges on all tables in schema cron to postgres`.

  `cron.schedule` con un nome già esistente aggiorna il job invece di duplicarlo, quindi il file si può rieseguire.
- **Brevo**, «Send a transactional email» (`POST https://api.brevo.com/v3/smtp/email`):
  - la chiave va nell'header `api-key`;
  - il corpo contiene `sender`, `to`, `replyTo`, `subject`, `htmlContent` e `tags`;
  - la risposta è 201 quando l'email è accettata;
  - il mittente deve essere un indirizzo o un dominio verificato nell'account Brevo.
- **Google tag e Meta Pixel**, domini da ammettere nella Content-Security-Policy:
  - Google: `*.googletagmanager.com` per lo script; `*.google-analytics.com` e `*.analytics.google.com` per le misurazioni.
  - Meta: `connect.facebook.net` per lo script; `www.facebook.com` per le richieste e il pixel immagine.
  - Il consenso funziona come allo Step 8: Google Consent Mode con `default` negato e poi `update`; Meta Pixel con `consent revoke` prima di `init` e poi `grant`.
- **Netlify**: contesto ufficiale dal server MCP. Gli header di `netlify.toml` valgono per i file statici. Le variabili d'ambiente per le Functions si impostano nell'interfaccia o nell'API, non in `netlify.toml`.

## 1. File creati o modificati

- `supabase/iscritti.sql`:
  - aggiunta `pulisci_iscritti()`, che cancella le iscrizioni revocate e quelle senza interazioni (iscrizione o uso del codice) da oltre 24 mesi, come promette l'informativa privacy;
  - `security invoker`; `execute` tolto a tutti i ruoli API, quindi la esegue solo `postgres`;
  - Supabase Cron la lancia ogni giorno alle 03:17 UTC (job `pulizia-iscritti`).
- `netlify/functions/codice-sconto.mjs`: invio dell'email con il codice tramite Brevo, nello stesso momento in cui il codice compare a schermo (§2.4).
  - Parte solo se ci sono sia `BREVO_API_KEY` (variabile di Netlify) sia il mittente in `centro.json`, e mai in modalità prova.
  - Il corpo HTML è costruito dai testi di `testi.json`, con escape: codice, scadenza in italiano, condizioni, telefono, indirizzo e firma.
  - `replyTo` è l'email del centro, così le risposte arrivano a Cristina.
  - C'è un timeout di 8 secondi. Se Brevo fallisce, il codice compare lo stesso e `emailInviata` resta `false`, quindi la riga «Te l'abbiamo mandato anche via email.» non compare.
  - Nei log finisce solo lo stato HTTP, mai l'email.
- `content/centro.json`: `integrazioni.servizioEmail.mittente: null`, l'indirizzo mittente verificato su Brevo, da compilare.
- `content/testi.json`: `codiceSconto.email` (oggetto, apertura, prenota, firma, piede) e la nota aggiornata.
- `netlify.toml`:
  - aggiunta la `Content-Security-Policy` su tutte le pagine;
  - solo file propri, più l'impronta sha256 dell'unico script inline (classe `js`);
  - Google e Meta ammessi solo dove servono a GA4 e al pixel;
  - `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`, `upgrade-insecure-requests`;
  - tolta la riga «CSP allo Step 9».
- `studio/anteprima.mjs`:
  - nuova `intestazioniNetlify()`: il server locale applica a ogni file statico gli header del blocco «/*» di `netlify.toml`, quindi la CSP si prova già in anteprima (senza `upgrade-insecure-requests`, perché in locale si usa http);
  - lo screenshot del codice nasconde la barra contatti dal CSSOM: con la CSP un `<style>` aggiunto verrebbe bloccato.
- `studio/controlli.mjs`: titolo «Step 9» e 4 controlli nuovi, quindi 96 in tutto:
  - CSP statica: direttive, impronta uguale allo script inline, nessuno stile o gestore inline;
  - CSP nel browser: nessuna violazione su tutte le pagine, inviando il codice, e nella build di prova dopo «Accetta»;
  - Brevo con un server finto: richiesta, mittente, `replyTo`, testi, nessun invio senza chiave o mittente o in modalità prova, nessuna email nei log;
  - pulizia dei dati su Postgres 16 locale.
- `studio/report/step9.md`: questo report.

## 2. Controlli

- `node build.mjs`: OK. URL assoluti da https://www.esteticamigliore.it, banner cookie spento (nessun ID di GA4 o Meta).
- `html-validate` su `dist/**/*.html`: 0 errori.
- `node --check` su `build.mjs`, `src/js/*.js`, `netlify/functions/*.mjs` e `studio/*.mjs`: OK.
- `node studio/controlli.mjs`: **96/96** superati.

## 3. Anteprima e Lighthouse

- `node studio/anteprima.mjs --step 9`: 36 screenshot in `studio/screenshot/step9/`. Console: 0 errori, 0 richieste fallite, anche con la CSP attiva.
  - Ripieghi visibili: senza JavaScript, con «riduci movimento» e senza `main.js`.
  - Guardati: apertura a 390 e 1440 px, identica allo Step 8; codice ottenuto a 390 px (codice, scadenza «2 dicembre 2026», «Copia il codice», condizioni).
- **Lighthouse 12**, modalità mobile, sulla build di produzione (`CONTEXT=production`), servita in locale con gli header di `netlify.toml` e compressione brotli, come su Netlify:

  | Pagina | Performance | Accessibilità | Best practice | SEO | LCP | CLS | TBT |
  |---|---|---|---|---|---|---|---|
  | `/` | 99 | 100 | 100 | 100 | 1,9 s | 0 | 0 ms |
  | `/viso/` | 99 | 100 | 100 | 100 | 1,9 s | 0 | 0 ms |
  | `/pedicure/` | 99 | 100 | 100 | 100 | 2,0 s | 0 | 0 ms |

  Tutti gli obiettivi del §9 sono raggiunti. Senza compressione l'LCP sale a 2,3 s: per questo la misura giusta è quella con brotli, che Netlify applica da solo.

  Lighthouse segnala ancora «immagini di dimensioni adeguate», con circa 47 KiB da risparmiare sulle foto dell'apertura e del viso. Il caso è un telefono emulato largo 412 px con densità 1,75, cioè 721 px: per un pixel supera la versione da 720 e scarica quella da 941. Sui telefoni veri (densità 2–3) serve comunque la 941, quindi l'ho lasciato così.

  La misura vera va rifatta sul dominio pubblicato.

## 4. Stato dei servizi

- **Supabase** (progetto migliore-estetica, `bkcpnkrnhjirmbwnrozp`, eu-central-1 Francoforte): attivo.
  - Migrazioni applicate: `iscritti_codice_sconto` e `pulizia_iscritti_24_mesi`.
  - RLS attivo e senza policy. `service_role` ha solo select, insert e update; la funzione è eseguibile solo da `service_role`.
  - Job `pulizia-iscritti` attivo.
  - Advisor: solo l'avviso informativo «RLS senza policy», voluto.
  - Tabella vuota: le prove erano in transazioni annullate.
- **Netlify** (progetto esteticamigliore, piano Free): creato, con `SUPABASE_URL` impostata.
  - Nessun deploy e nessun repository collegato: il deploy dalla sessione è bloccato dalla rete e il collegamento con GitHub si fa dall'interfaccia.
  - Sul piano Free l'ambito «Functions» delle variabili non è disponibile (errore 403): le variabili valgono per tutti gli ambiti. Va bene, perché il codice non le espone mai al browser.
- **GA4, Meta Pixel, Brevo**: il codice è pronto, ma restano spenti finché non arrivano i dati (§5).
- **DNS**: non toccato, come richiesto.

## 5. Cosa manca per andare online (azioni tue)

1. **Netlify, collega il repository**: Project configuration › Build & deploy › Link repository. Scegli `nicholaszani2000-star/landing-cristina-centro-estetico` con branch di produzione `landing-migliore`. Build command e cartella di pubblicazione arrivano da `netlify.toml`.
2. **Netlify, chiave Supabase**: Project configuration › Environment variables › `SUPABASE_SECRET_KEY`, segnata come segreta. La copi da Supabase › Project Settings › API Keys (`sb_secret_…`). Poi «Trigger deploy». Mai in chat.
3. **Brevo**:
   - verifica il mittente, cioè un indirizzo o un dominio;
   - crea la chiave API e mettila su Netlify come `BREVO_API_KEY`, segreta;
   - dimmi l'indirizzo mittente: lo scrivo in `centro.json` e, quando l'invio funziona, metto `inAttivazione: false`.
4. **GA4**: mandami l'ID `G-…`. Lo scrivo in `centro.json`, così il banner cookie si accende da solo e le pagine privacy e cookie si aggiornano.
5. **Meta**: dai al profilo collegato l'accesso all'account pubblicitario 1492127002822228 e al suo pixel, oppure mandami l'ID del pixel.
6. **Dominio**, solo dopo il primo deploy riuscito:
   - in Netlify › Domain management aggiungi `www.esteticamigliore.it` come principale;
   - su Register.it: `www` CNAME → `esteticamigliore.netlify.app` e `esteticamigliore.it` record A → `75.2.60.5`;
   - Netlify crea da solo il certificato HTTPS.
7. Prima degli annunci: fai verificare a un professionista privacy e cookie policy, che sono bozze (§10).

## 6. Dati mancanti o dubbi

- Indirizzo mittente Brevo: `null`. Default: nessun invio, codice solo a schermo.
- ID GA4 e pixel Meta: `null`. Default: tracciamenti e banner spenti.
- Codice scaduto e stessa email che si iscrive di nuovo: per ora riceve lo stesso codice, anche se è scaduto (regola «uno per email» del §2.4).
- Iscrizione a conferma singola: chiunque può far arrivare l'email con il codice a un indirizzo altrui. Il danno è limitato (una sola email per indirizzo, rate limit di 5 richieste al minuto). Una doppia conferma renderebbe più solida la prova del consenso.
- Non fatti, perché mancano i dati:
  - API Conversioni di Meta (servono pixel e token);
  - sincronizzazione degli iscritti con una lista Brevo per le promo mensili (serve l'ID della lista).

## 7. Domande per te

1. Codice scaduto: alla stessa email ridiamo lo stesso codice (oggi) o ne generiamo uno nuovo con altri 30 giorni?
2. Quale indirizzo userai come mittente su Brevo? Va bene anche esteticamigliore@gmail.com, ma con un indirizzo @esteticamigliore.it le email finiscono meno spesso nello spam.
3. Per le promo mensili vuoi che gli iscritti entrino in automatico in una lista Brevo? Se sì, mandami l'ID della lista quando la crei.

# Step 8 — Codice sconto, banner cookie e tracciamenti spenti

Data: 2026-11-02 · Branch: `landing-migliore`

Nessun servizio esterno è stato collegato: niente Supabase, Brevo, GA4 o Meta.

## 0. Documentazione consultata

- **Netlify Functions**: contesto ufficiale di Netlify («netlify-functions», dal server MCP di Netlify). Conferma:
  - il gestore `export default async (req, context)` che restituisce una `Response`;
  - `export const config` con `path`, `method` e `rateLimit` (`action`, `aggregateBy`, `windowSize`, `windowLimit`);
  - le variabili lette con `Netlify.env.get()` (quelle scritte in `netlify.toml` non arrivano alle Functions);
  - gli header di `netlify.toml` che non valgono per le Functions;
  - i dati statici da importare come modulo.

  `docs.netlify.com` non è raggiungibile da questa sessione: per il rate limit ho usato il riassunto della ricerca sulla pagina ufficiale (https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/). Il rate limit è disponibile su tutti i piani: sul piano Free fino a 2 regole nel codice per progetto, aggregazione per IP e dominio, `windowSize` da 1 a 180 secondi. Quindi `rateLimit` resta.
- **Supabase** (ricerca nella documentazione ufficiale, server MCP di Supabase):
  - «Row Level Security» (https://supabase.com/docs/guides/database/postgres/row-level-security): per le tabelle create in SQL l'RLS va attivato a mano, e a ogni ruolo vanno dati solo i permessi che servono;
  - «New API Keys» (https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys): la chiave segreta `sb_secret_…` va nell'header `apikey`, il gateway la traduce nel ruolo `service_role`; anche `Authorization: Bearer` con la stessa chiave è accettato (lo fa `supabase-js`). La funzione manda entrambi;
  - la chiamata RPC via REST (`POST /rest/v1/rpc/iscrivi_email`, parametri per nome) è quella delle pagine `rpc()` dei client. Non l'ho provata contro un Supabase vero (Step 9). Ho provato la funzione SQL su Postgres 16 e la chiamata HTTP con un Supabase finto nei controlli.
- **Google, Consent Mode**: https://developers.google.com/tag-platform/security/guides/consent e il riferimento di gtag https://developers.google.com/tag-platform/gtagjs/reference (dal riassunto della ricerca). Prima `gtag('consent', 'default', …)` con tutto negato, poi `gtag('consent', 'update', …)` per ciò che è concesso.
- **Meta Pixel, consenso**: https://developers.facebook.com/docs/meta-pixel/implementation/gdpr. La pagina non è raggiungibile da questa sessione (`developers.facebook.com` è fuori dalla rete ammessa); il contenuto viene dal riassunto della ricerca. `fbq('consent', 'revoke')` va chiamato su ogni pagina prima di `fbq('init')`, `fbq('consent', 'grant')` dopo il consenso.

## 1. File creati o modificati

- `supabase/iscritti.sql` (nuovo), da applicare allo Step 9:
  - in testa le istruzioni;
  - tabella `public.iscritti` con `email_norm` generata (`lower(trim(email))`) e unica, e `codice` unico;
  - RLS attivo senza policy; tolti tutti i permessi ad `anon`, `authenticated` e anche a `service_role` (Supabase li dà in automatico), poi a `service_role` solo `select, insert, update`;
  - `iscrivi_email(...)`: `security invoker`, `search_path = public`, `on conflict (email_norm) do nothing`; restituisce `codice, scadenza, nuovo`; `execute` solo a `service_role`.
- `netlify/functions/codice-sconto.mjs` (nuovo):
  - `config` con `path`, `method` e `rateLimit` (ip e dominio, 5 richieste in 60 s);
  - accetta JSON e moduli `x-www-form-urlencoded`; campo trappola `sito`; email valida entro 254 caratteri; consenso obbligatorio;
  - testo e versione del consenso dal server: `content/testi.json` e `content/centro.json` importati come moduli JSON (esbuild li accetta, provato con esbuild 0.25), versione = SHA-256 a 12 caratteri;
  - codice `MIG-` + 6 caratteri da `crypto.getRandomValues`; scadenza oggi (fuso Europe/Rome) + 30 giorni;
  - con `SUPABASE_URL` e `SUPABASE_SECRET_KEY` chiama `iscrivi_email`; se il codice collide (409/23505) riprova fino a 3 volte;
  - senza chiavi, «modalità prova» (`prova: true`, non salva nulla);
  - risposta JSON `{ codice, scadenza, nuovo, prova, emailInviata }`, con `emailInviata` sempre `false`; senza `Accept: application/json` una pagina HTML sabbia con il codice grande, la scadenza e il link per tornare;
  - errori 400 `email`, `consenso` o `richiesta` (trappola e richieste rotte, senza dettagli), 500 `server`;
  - `Cache-Control: no-store` su ogni risposta; nei log mai l'email.
- `src/templates/parti/codice.html` (nuovo), sezione 7:
  - modulo `post` su `/api/codice-sconto`; campo email con `<label>`, `type="email"`, `autocomplete`, `inputmode`, `required`;
  - casella del consenso non spuntata e `required`, con il testo completo e il link all'informativa;
  - trappola `sito` fuori dallo schermo (non `display:none`), `tabindex="-1"`, `autocomplete="off"`, etichetta «Lascia vuoto»;
  - campi nascosti `pagina`, `utm_*` ed `evento_id`; condizioni sotto il pulsante;
  - risultato con `aria-live="polite"`; errori accanto ai campi, annunciati.
- `src/templates/parti/banner-cookie.html` (nuovo): banner in un `<section>` con etichetta:
  - testo e link alla cookie policy;
  - «Rifiuta», «Personalizza», «Accetta» con lo stesso stile secondario e la stessa misura;
  - X = rifiuto;
  - pannello con gli interruttori «Statistiche» e «Marketing» (`role="switch"`, spenti) e «Salva le scelte».
- `src/js/codice.js` (nuovo, 3070 byte, 1,4 KB compresso):
  - legge le UTM e la pagina dall'indirizzo; genera `evento_id` (UUID);
  - invia JSON con `Accept: application/json`, disabilitando il pulsante;
  - mostra il codice grande con «Valido fino al 2 dicembre 2026…» e «Copia il codice»; «Te l'abbiamo mandato anche via email.» solo con `emailInviata: true`;
  - errori accanto al campo, con il focus sul primo;
  - a codice ottenuto chiama `window.migliore?.traccia("Lead", { evento_id })`.
- `src/js/consenso.js` (nuovo, solo con gli ID):
  - scelta in `localStorage` (con try/catch) per 182 giorni, poi si chiede di nuovo;
  - nessuno script prima del consenso;
  - «Statistiche»: gtag con `consent default` tutto negato, poi `update` di `analytics_storage`;
  - «Marketing»: pixel con `revoke` prima di `init`, poi `grant` e `PageView`;
  - `window.migliore.traccia` con tel → `clic_chiama`/`Contact`, wa.me → `clic_whatsapp`/`Contact`, Lead → `generate_lead`/`Lead` con `eventID`;
  - «Preferenze cookie» riapre il pannello; se un consenso viene ritirato la pagina si ricarica senza gli script;
  - col banner aperto la barra contatti si nasconde e la pagina lascia spazio in fondo.
- `src/templates/icone/avviso.svg`, `chiudi.svg` (nuove): icone degli errori e della X, disegnate a mano.
- `build.mjs`:
  - `datiTracciamenti()`: legge `ga4Id` e `metaPixelId`, ne controlla il formato e gestisce `TEST_TRACCIAMENTI=1` (ID finti `G-TEST000000` e `000000000000000`), che è vietato con `CONTEXT=production`;
  - `consenso.js` va in `dist/` e nella pagina, il banner e «Preferenze cookie» compaiono solo con almeno un ID;
  - `codice.js` solo sulle tre pagine;
  - `consensoConLink()` mette il link su «informativa privacy» nel testo del consenso.
- `content/centro.json`: `integrazioni.ga4` e `pixelMeta` diventano `ga4Id` e `metaPixelId`, come nel prompt; oggi sono `null`.
- `content/testi.json`:
  - testi nuovi del modulo: «Lascia vuoto», «Copia il codice», «Codice copiato», «Torna al sito», «Torna al modulo», «Il codice non è stato generato»;
  - testi del banner (blocco `banner`);
  - nella cookie policy il dato tecnico della scelta si chiama `migliore-consenso` («archiviazione locale, non un cookie»), come previsto allo Step 7;
  - nelle voci con `richiede`, i nomi nuovi degli ID.
- `src/templates/pagina.html`, `404.html`, `privacy.html`, `cookie.html`, `parti/testa.html`, `parti/footer.html`: sezione codice al posto del segnaposto; banner e `consenso.js` condizionali; «Preferenze cookie» legato a `tracciamenti.attivo`.
- `src/css/base.css`: `[hidden]` vince sempre (il modulo non spariva dopo l'invio, perché aveva `display: grid`).
- `src/css/sezioni.css`:
  - sezione 7: blocco su `--sabbia-profonda`; campi su `--crema` con bordo 1,5 px `--inchiostro-tenue`; casella del consenso con area di tocco di 44 px e quadratino di 24 px; codice in Marcellus con bordo tratteggiato accento; colonne 5/7 da 1024 px;
  - banner e interruttori;
  - pagina della funzione senza JavaScript;
  - «Preferenze cookie» nascosto senza JavaScript.
- `studio/anteprima.mjs`:
  - `POST /api/codice-sconto` passa una `Request` vera alla funzione, con un globale `Netlify` finto (`env.get` legge `process.env`);
  - il server può servire un'altra cartella (la build di prova);
  - screenshot del modulo (vuoto, errori, codice ottenuto) e del banner della build di prova a 390 px.
- `studio/controlli.mjs`: 15 controlli nuovi e 7 aggiornati (sotto).

## 2. Controlli

- `node build.mjs`: OK.
- html-validate: **0 errori**, sia sulla build normale sia su quella di prova con il banner. Sulla build di prova il banner era un `<div role="region">`: è diventato un `<section>`, come chiede html-validate.
- `node --check`: OK, funzione compresa.
- `node studio/controlli.mjs`: **92/92**.

I 15 nuovi:
1. modalità prova: codice `MIG-XXXXXX`, scadenza oggi + 30, `prova: true`, `emailInviata: false`, `no-store`;
2. la stessa email due volte, anche con maiuscole e spazi diversi, non dà errore;
3. errori: email non valida o troppo lunga → 400 «email», senza consenso → 400 «consenso», trappola piena o JSON rotto → 400 senza dettagli, GET → 405;
4. invio senza JavaScript (`javaScriptEnabled: false`): pagina HTML sabbia con il codice, la scadenza e il link di ritorno; senza consenso, pagina d'errore;
5. invio con JavaScript:
   - prima gli errori, col focus sul primo;
   - poi il codice, con la data in italiano e «Copia il codice», senza la riga dell'email;
   - UTM, pagina ed `evento_id` inviati;
   - con una risposta finta `emailInviata: true` compare «Te l'abbiamo mandato anche via email.»;
6. il modulo com'è richiesto, campo per campo; trappola fuori schermo; colori di blocco e campi;
7. funzione:
   - `config` esatta;
   - `Netlify.env.get`;
   - consenso preso dal server, uguale al testo accanto alla casella;
   - versione SHA-256 a 12 caratteri;
   - nessun log con l'email;
8. Supabase finto: chiamata con `apikey`; una collisione → nuovo tentativo con un altro codice; 4 collisioni o un errore → 500 «server»; nei log né email né chiave;
9. `iscritti.sql`: tabella, vincoli, RLS senza policy, permessi, `security invoker`, `search_path`, `on conflict`, `execute` solo a `service_role`, istruzioni in testa;
10. build normale: niente banner, `consenso.js` o «Preferenze cookie»; nessuna richiesta verso Google o Meta su nessuna pagina, neanche toccando «Chiama» o inviando il codice;
11. build di prova, con Google e Meta bloccati:
    - nessuna richiesta prima del consenso, né dopo «Rifiuta» o la X;
    - «Accetta» → richieste verso Google e Meta, anche dopo il ricaricamento;
    - la scelta resta, e dopo 183 giorni il banner ricompare;
    - `TEST_TRACCIAMENTI` con `CONTEXT=production` viene rifiutato;
    - html-validate sulla build di prova;
12. banner:
    - tre pulsanti identici per stile e misura (111×52 a 390 px); X di 44 px con etichetta; link alla cookie policy;
    - barra contatti nascosta col banner aperto;
    - interruttori spenti; salvando solo «Statistiche» parte solo Google;
    - «Preferenze cookie» riapre il pannello con la scelta salvata;
    - senza JavaScript né banner né «Preferenze cookie»;
13. eventi dopo «Accetta»: GA4 `clic_chiama, clic_whatsapp, generate_lead`; Meta `PageView, Contact, Contact, Lead`, con il Lead che ha `eventID` uguale a `evento_id`; prima del consenso nessun evento;
14. nessuna chiave nei file versionati o nuovi;
15. `codice.js` ≤ 3 KB; con il banner il JavaScript compresso resta sotto i 12 KB.

I 7 aggiornati, per i cambiamenti voluti da questo step:
- tre controlli usano i nomi nuovi `ga4Id` e `metaPixelId`: dati facoltativi, footer condizionale e footer definitivo;
- integrazioni delle pagine legali: ID nel formato giusto e il nome `migliore-consenso`;
- aree di tocco a 390 px: esenti i link dentro una frase, come prevede WCAG 2.5.8 (il link «informativa privacy» nel testo del consenso);
- «tutta color sabbia»: considera solo gli elementi che si vedono (i campi `type="hidden"` hanno un fondo bianco ma non sono mostrati);
- «fondo unico»: il blocco del codice sconto tra i rilievi ammessi da §5;
- pulsanti per pagina (§6): conta i pulsanti di contatto, che sono link. Il pulsante d'invio e «Copia il codice» sono controlli del modulo, verificati a parte (un solo invio).

**Chiavi**: le espressioni chiedono almeno 8 caratteri dopo `sb_secret_` ed `eyJhbGciOi`. Così il report e i controlli possono nominare i prefissi senza far scattare l'allarme, e una chiave vera viene trovata comunque.

**Prova a vuoto**, in una copia inizializzata come repository git, con questi errori:
- GA4 caricato prima del consenso;
- campo trappola ignorato;
- «Accetta» più evidente degli altri;
- riga dell'email sempre visibile;
- `consenso.js` sempre copiato;
- una chiave Supabase e un token Meta finti in due file.

Tutti segnalati.

**SQL provato davvero** su un Postgres 16 locale e usa e getta, con i ruoli e i permessi automatici di Supabase:
- iscrizione → `nuovo = t`; la stessa email con maiuscole e spazi diversi → stesso codice, `nuovo = f`;
- codice già usato → errore 23505;
- `anon` e `authenticated` non leggono, non scrivono e non eseguono la funzione;
- `service_role` ha solo INSERT, SELECT e UPDATE (un DELETE viene rifiutato), e la colonna identity funziona senza permessi sulla sequenza;
- il file si può rieseguire.

## 3. Anteprima

`node studio/anteprima.mjs --step 8`: 36 screenshot in `studio/screenshot/step8/`. **Console: 0 errori, 0 richieste fallite.**

- **390 px, sezione 7**:
  - arco, «Per te», H2 e testo; sotto il blocco in rilievo con «La tua email», il campo crema, la casella col testo del consenso e il link, «Ricevi il codice» a tutta larghezza, le condizioni;
  - errori (`codice-390-errori.png`): bordo accento sul campo e «Controlla l'indirizzo email.» e «Per ricevere il codice serve il consenso.» in accento con l'icona;
  - codice ottenuto (`codice-390-ottenuto.png`): «Ecco il tuo codice», il codice grande in Marcellus nel riquadro tratteggiato, «Valido fino al 2 dicembre 2026…», «Copia il codice», le condizioni.
- **1440 px**: introduzione a sinistra, blocco del modulo a destra (colonne 5/7).
- **Banner** (`banner-390.png`, `banner-390-pannello.png`, build di prova): in basso, non bloccante, la pagina resta leggibile. Testo con link alla cookie policy, tre pulsanti uguali e la X; nel pannello i due interruttori spenti e «Salva le scelte». La barra contatti non si vede finché il banner è aperto.

## 4. Dati mancanti o dubbi

- **Codice scaduto**: §2.4 dice che la stessa email riceve sempre lo stesso codice, e così fa `iscrivi_email`, anche dopo i 30 giorni. Vedi la domanda.
- **Conservazione di 24 mesi**: la privacy la promette, ma oggi nessun meccanismo cancella le iscrizioni vecchie. Va aggiunta una pulizia periodica allo Step 9, per esempio una funzione pianificata o `pg_cron` su Supabase.
- **Modalità prova online**: finché su Netlify mancano le chiavi Supabase, il modulo dà codici che non vengono salvati, e Cristina non può verificarli. Le chiavi si mettono allo Step 9, prima degli annunci.
- **Pagina senza JavaScript**: usa `/css/tokens.css`, `base.css` e `sezioni.css` senza `?v=hash`, perché la funzione non conosce gli hash della build. Con la cache di un anno su `/css/*`, chi ha già visto quella pagina può vedere il vecchio stile dopo una modifica al CSS. Riguarda solo quella pagina, usata da chi non ha JavaScript.
- **`evento_id`**: la funzione lo riceve ma non lo usa ancora; servirà allo Step 9 per l'API Conversioni (deduplica con il pixel).
- **Ritiro del consenso**: uno script già caricato non si può togliere; se si ritira un consenso dato, la pagina si ricarica senza quegli script.
- **Nomi**: `ga4` e `pixelMeta` diventano `ga4Id` e `metaPixelId` in `centro.json`, come nel prompt.
- **Rete della sessione**: `docs.netlify.com` e `developers.facebook.com` non sono raggiungibili da qui. Se vuoi che le legga direttamente, vanno aggiunte ai domini ammessi nelle impostazioni di rete dell'ambiente.

## 5. Domande per me

1. Se una cliente rimette la stessa email dopo che il suo codice è scaduto (oltre 30 giorni), deve ricevere lo stesso codice scaduto (come dice oggi §2.4) o un codice nuovo, valido altri 30 giorni?

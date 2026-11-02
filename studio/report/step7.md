# Step 7 — Listino, footer e pagine legali

Data: 2026-11-02 · Branch: `landing-migliore`

## 1. File creati o modificati

- `src/templates/parti/listino.html` (nuovo): sezione 9, al posto dell'ancora nascosta `#listino`.
  - Arco, «Prezzi», H2 «Listino», testo di §8.
  - Una `<details>` per categoria, nell'ordine di §2.3. Il `<summary>` mostra titolo, numero di voci e freccia; è aperta solo la categoria di §6 per la pagina.
  - Le voci stanno in un `<dl>`: nome in `<dt>`, prezzo in `<dd>`.
  - Link «Vedi il listino stampato» al WebP da 1536 px, in una nuova scheda.
- `src/templates/icone/apri.svg` (nuova): freccia del `<summary>`, disegnata a mano.
- `src/templates/privacy.html` e `src/templates/cookie.html` (nuovi): stesso header e footer della landing, testo su una colonna di 62ch, senza barra contatti.
- `src/templates/parti/legale-testata.html` (nuovo): riquadro «Bozza», H1, data di ultimo aggiornamento e introduzione.
- `src/templates/parti/legale-trattamento.html` (nuovo): un trattamento con Dati, Finalità, Base giuridica e Conservazione in un `<dl>`.
- `src/templates/pagina.html`:
  - `{{> listino}}` al posto del segnaposto;
  - `<body class="con-barra">`: lo spazio in fondo per la barra contatti ora c'è solo nelle pagine che hanno la barra. Prima c'era anche sulla 404.
- `build.mjs`:
  - `sezioneListino()`: categorie, conteggio delle voci e prezzi, scritti solo da `formattaPrezzo()`;
  - `datiLegali()`:
    - mostra le voci di privacy e cookie solo se l'integrazione che richiedono è indicata;
    - mostra il riquadro «Bozza» tranne quando `CONTEXT=production`;
    - data di ultimo aggiornamento: quella della build, in ora italiana;
    - sede: la sede legale se indicata, altrimenti l'indirizzo del centro;
  - genera `/privacy/` e `/cookie/`;
  - sitemap con `/privacy/` e `/cookie/` a priorità 0.3, le tre pagine della landing a 1.0, la 404 esclusa;
  - il riepilogo della build dice se il riquadro «Bozza» c'è.
- `content/testi.json`:
  - `listino.voce` e `listino.voci` per il conteggio;
  - blocchi nuovi `legali`, `privacy` e `cookie`. Ogni testo delle pagine legali sta qui, compresi l'elenco dei cookie e dei fornitori, con la chiave `richiede`.
- `content/centro.json`: `integrazioni.servizioEmail: null`. Quando lo indichi, il servizio email compare tra i fornitori.
- `src/css/sezioni.css`:
  - **listino**:
    - categorie separate da filetti `--linea`;
    - puntini `--linea` tra nome e prezzo;
    - prezzo sempre a destra e, se il nome va a capo, sull'ultima riga del nome;
    - la riga della categoria aperta (o sotto il mouse) è in sabbia chiara, come §5 ammette;
    - freccia che ruota di 90° all'apertura, senza transizione con «riduci movimento»;
    - da 1024 px colonne 5/7;
  - **pagine legali**: colonna di 62ch, H2 più piccoli di quelli della landing, riquadro «Bozza» con bordo accento sul sabbia;
  - **barra**: lo spazio in fondo passa da `body` a `.con-barra`.
- `studio/anteprima.mjs`: screenshot di `/privacy/` e `/cookie/` (pagina intera) a 390, 768 e 1440 px, con raccolta degli errori di console.
- `studio/controlli.mjs`: 10 controlli nuovi e 6 aggiornati (sotto).

## 2. Controlli

- `node build.mjs`: OK.
- html-validate: **0 errori** su tutte le pagine, privacy e cookie comprese.
- `node --check`: OK.
- `node studio/controlli.mjs`: **75/75 superati**.

I 10 nuovi:
- **Listino nell'HTML**: 40 righe in ogni pagina, identiche a §2.3. Confronta categorie, ordine, nomi, prezzi e numero di voci con l'elenco scritto a mano dentro il controllo, dentro un `<dl>`, e verifica che nella sezione non ci siano altri «€».
- **Categoria aperta**: una sola `<details open>` per pagina, quella di §6 (`corpo-viso` su `/viso/`, `mani-piedi` su `/pedicure/`), nessuna su `/` e sulla 404.
- **Listino a 390 px** (Playwright), a categorie aperte:
  - le 40 righe sono visibili e il testo coincide con §2.3;
  - il prezzo è allineato a destra e, quando il nome va a capo, in basso;
  - la freccia è ferma a categoria chiusa e ruotata di 90° a categoria aperta, senza transizione con «riduci movimento»;
  - ogni `<summary>` è alto almeno 44 px;
  - il link al listino stampato apre `/img/listino-stampato-1536.webp` in una nuova scheda.
- **Footer definitivo su tutte le pagine** (landing, 404, privacy, cookie):
  - denominazione e P.IVA, indirizzo, telefono, email, «© anno», Privacy e Cookie;
  - REA, sede legale, social e «Preferenze cookie» solo se indicati.
- **`/privacy/` e `/cookie/`**:
  - esistono, con un solo H1, header e footer, partita IVA;
  - title entro 60 caratteri, description di 60–160 caratteri;
  - niente barra contatti né JSON-LD;
  - il link all'altra pagina;
  - la data `<time>` uguale a quella della build.
- **Contenuto dell'informativa privacy**:
  - titolare con i dati di §2.1;
  - i trattamenti a) e b), ognuno con le quattro voci;
  - le basi giuridiche e i 24 mesi;
  - la frase sui tracciamenti spenti;
  - Netlify e Supabase, ma non Google né Meta;
  - le garanzie per gli Stati Uniti;
  - gli otto diritti con il Garante, e il link email.
- **Con le integrazioni indicate**: build vera in una copia, con GA4, pixel Meta e un servizio email di prova.
  - Compaiono i trattamenti c), i fornitori Google, Meta ed email, i 5 cookie (`Preferenze cookie`, `_ga`, `_ga_<ID>`, `_fbp`, `_fbc`) e «Preferenze cookie» nel footer.
  - Sparisce «Oggi il sito non usa cookie».
  - `datiLegali()` filtra le voci e si ferma su un'integrazione inesistente.
- **Riquadro «Bozza»**:
  - build ripetuta con `CONTEXT` vuoto, `deploy-preview` e `branch-deploy`: il riquadro sta in cima a privacy e cookie, prima dell'H1, e su nessun'altra pagina;
  - build con `CONTEXT=production`: in nessuna pagina.
- **Codice fiscale e indirizzi**: in tutte le pagine (testo, alt, meta, JSON-LD) nessun testo con il formato di un codice fiscale, nessun indirizzo diverso da «Via Roma 2/A» e nessun CAP diverso da 21040. Le espressioni sono provate anche su un esempio che deve essere segnalato.
- **Pagine legali a 390 px**: nessuno scroll orizzontale, colonna entro 62ch, link fuori dal testo di almeno 44 px.

I 6 aggiornati, per i cambiamenti voluti da questo step:
- **Sitemap** (controllo con `URL`): ora si aspetta 5 indirizzi con le priorità e nessuna 404. Prima erano solo i 3 della landing.
- **Sezione viso**: dallo Step 4 si aspettava l'ancora nascosta `#listino`. Ora verifica che `#listino` sia la sezione del listino, visibile.
- **Controlli «in ogni pagina»**: estesi a privacy e cookie: `lang="it"`, partita IVA, nessun `{{`/`null`, parole vietate di §8.

Prova a vuoto, in una copia con questi errori:
- categoria aperta anche su `/`;
- conteggio delle voci sbagliato;
- prezzo stampato due volte;
- freccia che non ruota;
- riquadro «Bozza» anche in produzione;
- un codice fiscale, «Via Garibaldi 12» e «21100» nel testo della privacy.

Tutti segnalati.

## 3. Anteprima

`node studio/anteprima.mjs --step 7`: 30 screenshot in `studio/screenshot/step7/`:
- tre pagine a 390, 768 e 1440 px, con primo schermo, pagina intera e fondo pagina a 390;
- privacy, cookie e 404 a tutte e tre le misure.

Ripieghi a posto. **Errori di console e richieste fallite: 0.**

- **390 px**:
  - il listino viene dopo «Dove siamo»: arco, «Prezzi», H2 e testo, poi le cinque categorie, una per riga, con titolo in Marcellus, «9 voci» e la freccia;
  - su `/viso/` è aperta «Trattamenti corpo e viso», su `/pedicure/` «Manicure e pedicure», su `/` nessuna;
  - in ogni riga: nome, puntini, prezzo in grassetto a destra;
  - «Trattamento Antiage contorno occhi e labbra» va a capo e il prezzo resta in basso a destra;
  - sotto, «Vedi il listino stampato», poi il footer e la barra.
- **1440 px**: introduzione a sinistra, categorie a destra; la categoria aperta ha la riga in sabbia chiara e la freccia rivolta in basso.
- **Privacy e cookie**:
  - in cima il riquadro «Bozza» con bordo accento, poi H1, «Ultimo aggiornamento: 2 novembre 2026» e l'introduzione;
  - nella privacy, i trattamenti in schede con filetto a sinistra; la cookie policy oggi dice «Oggi il sito non usa cookie»;
  - footer uguale alla landing, senza lo spazio vuoto della barra.

## 4. Dati mancanti o dubbi

- **Data di ultimo aggiornamento**: è la data della build, come chiesto. Cambia quindi a ogni pubblicazione, anche se i testi legali non cambiano. In alternativa posso usare la data dell'ultimo commit che li modifica.
- **Fornitori «responsabili del trattamento»**: li ho elencati come chiesto. Due punti da far verificare al professionista:
  - per il pixel, la giurisprudenza europea (sentenza Fashion ID) vede di solito Meta come contitolare della raccolta, non come responsabile;
  - con Netlify e Supabase vanno accettati i loro accordi sul trattamento dei dati (DPA) quando si collegano, allo Step 9.
- **Supabase**: «Supabase, Inc., sede negli Stati Uniti, database nell'Unione europea». La regione UE va scelta quando si crea il progetto, allo Step 9.
- **Servizio email**: non è indicato. Ho aggiunto `integrazioni.servizioEmail: null` in `centro.json`: con il nome, compare tra i fornitori.
- **Cookie di GA4 e Meta**: nomi e durate standard dei fornitori (`_ga` e `_ga_<ID>` 2 anni, `_fbp` e `_fbc` 3 mesi), visibili solo con le integrazioni attive. Il nome del cookie tecnico che ricorda la scelta lo fissa lo Step 8 (oggi «Preferenze cookie», 6 mesi come §10).
- **Conservazione GA4**: «al massimo 14 mesi» è il limite delle proprietà GA4 standard. Il valore si imposta in GA4 allo Step 9.
- **«Preferenze cookie» nel footer**: c'era già dallo Step 1 come blocco condizionale, e oggi non compare perché GA4 e Meta non sono indicati. Lo Step 8 gli darà il suo JavaScript.
- **Freccia con «riduci movimento»**: la freccia indica comunque lo stato (ruotata se aperta), ma passa da una posizione all'altra senza movimento, come vuole §5.
- **Garante**: l'indirizzo www.garanteprivacy.it è scritto nel testo ma non è un link. Il controllo sui link esterni ammette solo WhatsApp, Maps e i social indicati.
- **WhatsApp nella privacy**: ho aggiunto una nota al trattamento a): chi scrive su WhatsApp passa dal servizio di WhatsApp Ireland Limited, che ha la sua informativa.
- **Arco firma**: nelle pagine legali non c'è, perché c'è solo l'H1 e §5 mette l'arco sopra l'occhiello degli H2 della landing.

## 5. Domande per me

1. Data di ultimo aggiornamento delle pagine legali: va bene la data della build, o preferisci la data dell'ultima modifica ai testi legali?
2. Vuoi il Garante come link cliccabile? Aggiungerei www.garanteprivacy.it ai domini ammessi.
3. Quale servizio userai per le email promozionali (per esempio Brevo o Mailchimp)? Va nella privacy come fornitore.

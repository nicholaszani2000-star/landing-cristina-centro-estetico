# Step 6 — Chi sono, come prenotare, dove siamo e orari

Data: 2026-11-02 · Branch: `landing-migliore`

## 1. File creati o modificati

- `src/templates/parti/chi-sono.html` (nuovo), sezione 5:
  - arco, «Chi sono», H2;
  - testo: la presentazione se indicata, altrimenti il testo predefinito di §8 (`{{#se}}…{{altrimenti}}`);
  - foto 04 con l'alt di §8;
  - payoff in chiusura.
- `src/templates/parti/prenota.html` (nuovo), sezione 6:
  - occhiello, H2 e i tre passi di §8 in un `<ol>`;
  - «Chiama» (principale) e «Scrivi su WhatsApp» (secondario, testo WhatsApp della pagina, nuova scheda).
- `src/templates/parti/dove.html` (nuovo), sezione 8:
  - arco, «Dove siamo», H2, foto 02;
  - `<address>` con indirizzo, orari e telefono (link `tel:`), ognuno con la sua icona;
  - pulsante secondario «Apri in Google Maps» in nuova scheda;
  - nessuna mappa incorporata.
- `src/templates/pagina.html`: dopo viso e pedicure vengono chi sono, come prenotare, il commento segnaposto del codice sconto (sezione 7, Step 8), dove siamo, l'ancora del listino.
- `src/templates/icone/orologio.svg` (nuova): icona disegnata a mano per gli orari.
- `build.mjs`:
  - `linkMappa()`: la scheda Google se è indicata, altrimenti la ricerca di «Via Roma 2/A, 21040 Caronno Varesino VA», composta da via, CAP, comune e provincia di `centro.json`;
  - JSON-LD con `hasMap` (lo stesso link) e `sameAs` solo con i social indicati (oggi nessuno, quindi assente);
  - foto 04 e 02 con l'helper (`sizes` della foto 02: `(min-width: 1024px) 620px, (min-width: 768px) calc(100vw - 40px), 100vw`);
  - nei testi visibili il numero di telefono ha spazi non separabili, così non va mai a capo. Le meta description restano identiche a §7.
- `content/testi.json`: il secondo pulsante di «Come prenotare» diventa «Scrivi su WhatsApp», come chiede il prompt.
- `src/css/sezioni.css`:
  - **chi sono**:
    - fino a 1023 px introduzione, foto, payoff (cornice 4:5 di 520 px tra 768 e 1023 px);
    - da 1024 px foto a sinistra in cornice 4:5 (`object-position: 40% 55%`) che sfuma a destra, testo a destra;
    - payoff in Marcellus 1.5rem `--accento`;
  - **come prenotare**: numeri grandi in Marcellus `--accento`; passi in colonna sotto i 768 px, in riga da 768 px con un filetto sopra;
  - **dove siamo**:
    - fino a 1023 px introduzione, foto intera che sfuma in basso, contatti e pulsante;
    - da 1024 px testo a sinistra, foto a destra in proporzione originale, sfumata a sinistra;
  - ripieghi senza `mask-image`;
  - `text-wrap: balance` sui payoff.
- `studio/controlli.mjs`: 8 controlli nuovi; nel controllo del JSON-LD sono ammessi `hasMap` e `sameAs`.

## 2. Controlli

- `node build.mjs`: OK.
- html-validate: **0 errori**.
- `node --check`: OK.
- `node studio/controlli.mjs`: **64/64 superati**. I nuovi:
  - sezioni 5, 6 e 8 in tutte le pagine, nell'ordine di §6 (apertura → 3 → 4 → chi sono → come prenotare → segnaposto codice sconto → dove siamo → listino → footer);
  - pulsanti per pagina come in §6: apertura 2, viso 1, pedicure 1, come prenotare 2, dove siamo 1, barra 2;
  - chi sono: testo predefinito, payoff, foto 04, H2;
  - come prenotare: i tre passi esatti di §8 nell'`<ol>`, «Chiama» e «Scrivi su WhatsApp» con il testo della pagina;
  - dove siamo:
    - `<address>` con indirizzo e telefono;
    - link Maps uguale a `…query=Via%20Roma%202%2FA%2C%2021040%20Caronno%20Varesino%20VA`, in nuova scheda;
    - con la scheda Google indicata, il link usa quella (provato su dati finti);
    - foto 02;
    - `hasMap` nel JSON-LD;
  - nessun `<iframe>` nel sito;
  - orari identici in apertura, «Come prenotare» e «Dove siamo». Nei testi sono segnaposto di `centro.json`, mai scritti a mano: è la stessa fonte;
  - foto 04 con `object-position` 40% 55% da 768 px; foto 02 mai ritagliata, sfumata a sinistra da 1024 px.
- I controlli esistenti coprono già le sezioni nuove: H2 prima della foto su mobile, foto verticali al massimo di 520 px a 768 px, aree di tocco, landing tutta color sabbia.
- Prova a vuoto: in una copia ho messo un `<iframe>`, usato l'indirizzo tra parentesi per Maps, scritto a mano orari diversi in «Dove siamo» e invertito «Chi sono» e «Come prenotare». I controlli segnalano tutto.

## 3. Anteprima

`node studio/anteprima.mjs --step 6`: 24 screenshot in `studio/screenshot/step6/` (tre pagine a 390, 768 e 1440 px, primo schermo e pagina intera, fondo pagina a 390 px, 404).

- **390 px**:
  - chi sono: «Chi sono», H2 e testo, poi la foto della cabina intera che sfuma, poi il payoff in accento;
  - come prenotare: tre passi in colonna con i numeri grandi, poi «Chiama» e «Scrivi su WhatsApp» a tutta larghezza;
  - dove siamo: «Dove siamo» e H2, la foto dell'ingresso da bordo a bordo che sfuma, indirizzo, orari (con l'iniziale maiuscola, solo a vista), telefono, «Apri in Google Maps».
- **768 px**: foto 04 nella cornice di 520 px, passi in riga, foto 02 intera nel contenitore.
- **1440 px**:
  - chi sono: foto a sinistra con lettino e lampada a lente ben visibili, sfumata a destra; testo e payoff a destra;
  - come prenotare: passi in riga;
  - dove siamo: testo a sinistra, foto dell'ingresso a destra, intera, sfumata a sinistra.
- **Sistemato guardando gli screenshot**:
  - nel passo 1 il numero di telefono andava a capo («352 / 060 1109»);
  - il payoff di «Chi sono» lasciava «di te”» da solo.
- **Errori di console e richieste fallite: 0.**

## 4. Dati mancanti o dubbi

- **Fondi in sabbia chiara (conflitto con CLAUDE.md, come allo Step 5)**: il prompt chiede «Chi sono» su `--sabbia-chiara` (punto 1), l'alternanza sabbia/sabbia chiara tra le sezioni (punto 5) e un controllo «due sezioni vicine non hanno lo stesso fondo». CLAUDE.md §5 dice invece «la landing è tutta color sabbia … niente sezioni alternate su `--sabbia-chiara`», come mi avevi chiesto di ricordare, e questo prompt non chiede di aggiornarlo. Quindi:
  - tutte le sezioni restano sul sabbia;
  - il controllo sull'alternanza non l'ho aggiunto, perché fallirebbe per costruzione;
  - resta il controllo «landing tutta color sabbia», che ora verifica anche le sezioni nuove.

  Sequenza dei fondi, uguale sulle tre pagine:

  | Pagina | Fondi, nell'ordine |
  |---|---|
  | `/` | header sabbia · apertura sabbia · viso sabbia · pedicure sabbia · chi sono sabbia · come prenotare sabbia · (codice sconto, Step 8) · dove siamo sabbia · footer sabbia · barra sabbia |
  | `/viso/` | come `/` |
  | `/pedicure/` | come `/`, con pedicure prima di viso |

  Le sezioni si separano con lo spazio (64/112 px) e con l'arco firma sopra ogni occhiello, come dice §5.
- **Etichetta del pulsante WhatsApp in «Come prenotare»**: §6 descrive i pulsanti come «Chiama» e «WhatsApp», il prompt chiede «Scrivi su WhatsApp». Ho usato quella del prompt, più chiara e uguale all'apertura. La barra mobile resta «WhatsApp».
- **Indirizzo per Maps**: la ricerca usa «Via Roma 2/A, 21040 Caronno Varesino VA», senza parentesi, come chiede il prompt. L'indirizzo mostrato resta quello di §8, «… (VA)».
- **Orari in «Dove siamo»**: il testo di §8 comincia con la minuscola («dal lunedì al sabato, …»). Su riga propria la prima lettera diventa maiuscola solo a vista, con il CSS. È così anche il controllo «stessa fonte».
- **`sameAs`**: Instagram e Facebook non sono indicati, quindi il JSON-LD non ha `sameAs`. La scheda Google, quando c'è, va in `hasMap` e nel pulsante.

## 5. Domande per me

1. I prompt degli Step 5 e 6 chiedono ancora il sabbia chiara (scheda 1, «Chi sono», alternanza dei fondi), mentre CLAUDE.md dice «tutta color sabbia». Confermi che la regola di CLAUDE.md resta valida anche per i prossimi step (codice sconto, listino, pagine legali), o vuoi riaprire l'alternanza aggiornando §5?

# Step 4 — Sezione viso

Data: 2026-11-01 · Branch: `landing-migliore`

## 1. File creati o modificati

- `src/templates/parti/viso.html` (nuovo):
  - arco firma, occhiello «Viso», H2 «Trattamenti viso», testo di §8 e seconda frase;
  - elenco `<ul>` delle 5 voci (nome in `<h3>`, Jost 500; pillola «In evidenza» sulla prima; descrizione; fasi in `<ol>`);
  - riga «In cabina usiamo: …» solo se c'è il dato;
  - link «Vedi i prezzi ↓» → `#listino`;
  - pulsante principale «Prenota il tuo trattamento viso» → WhatsApp con il testo viso, in nuova scheda;
  - foto 03 con l'alt di §8;
  - comparse sui blocchi di testo.
- `src/templates/pagina.html`:
  - la sezione viso al posto del segnaposto, terza su `/` e `/viso/`, quarta su `/pedicure/`;
  - aggiunta `<section id="listino" hidden></section>`, l'ancora che lo Step 7 sostituirà.
- `content/testi.json`:
  - `comuni.viso.dettagli`: mappa `{ "Nome della voce": "descrizione" }`, ricavata riga per riga da CLAUDE.md §2.2 con uno script (nessun copia e incolla). I 5 nomi coincidono tutti con il listino;
  - `inCabina` è ora «In cabina usiamo: {cabina}».
- `content/centro.json`:
  - `trattamenti.viso.voci`: i 5 nomi della sezione, come riferimenti al listino. La build li cerca in `listino.json` e si ferma se uno non c'è; il nome mostrato viene dal listino;
  - tolto `dettagli`, spostato in `testi.json`.
- `build.mjs`:
  - `sezioneViso()` (esportata per i controlli): voci dal listino, la voce in evidenza per prima e le altre nell'ordine di §2.3. Prende le descrizioni dai dettagli solo per i nomi che coincidono con il listino, altrimenti un avviso;
  - `limitaFrasi()`: al massimo 2 frasi, 3 per la voce in evidenza; si accorcia senza aggiungere nulla;
  - `estraiFasi()`: «in tre fasi: A, B e C» diventa un elenco di 3 fasi con le parole originali; oltre 3 fasi, niente elenco;
  - `{cabina}` = macchinari e prodotti indicati (null se mancano entrambi);
  - link WhatsApp viso e foto 03 con l'helper (`sizes="(min-width: 1024px) 440px, (min-width: 768px) 520px, 100vw"`).
- `src/css/sezioni.css`, sezione viso:
  - fino a 767 px: foto intera da bordo a bordo che sfuma in basso, poi testo, elenco, pulsante;
  - tra 768 e 1023 px: cornice 4:5 larga al massimo 520 px e centrata, che sfuma in basso; il testo ha la stessa larghezza;
  - da 1024 px: colonne 5/7, foto a sinistra in cornice 4:5 con `object-position: 50% 55%`, che sfuma sul lato destro. La foto è allineata in alto e resta ferma (`sticky`) mentre si scorre l'elenco, più alto di lei;
  - voci separate da filetti `--linea`; descrizioni in `--inchiostro-tenue`, con la prima lettera maiuscola a vista (il testo resta com'è);
  - fasi con i numeri in Marcellus color accento (`::marker`);
  - pillola su `--sabbia-profonda` con testo `--accento` (4,7:1);
  - ripiego senza `mask-image`.
- `src/css/base.css`: `.sezione-chiara` sfuma nel sabbia sopra e sotto (`--passaggio-sezioni`, 64 px), così tra le sezioni non ci sono più linee nette.
- `src/css/sezioni.css`, footer: stesso passaggio morbido in alto.
- `src/css/tokens.css`:
  - rinominati i token delle sfumature: `--sfumatura-basso` (72%, il valore normale) e `--sfumatura-basso-dettaglio` (86%, dove un dettaglio deve restare nitido);
  - aggiunto `--passaggio-sezioni`.
- `studio/controlli.mjs`:
  - 6 controlli nuovi;
  - aggiornati il controllo sull'ordine delle sezioni (ora riconosce anche le sezioni vere) e quello sui link WhatsApp (nella sezione viso il testo è sempre quello viso, anche su `/` e `/pedicure/`).

## 2. Controlli

- `node build.mjs`: OK.
- html-validate: **0 errori**.
- `node --check`: OK.
- `node studio/controlli.mjs`: **48/48 superati**. I nuovi:
  - la sezione viso c'è in tutte e tre le pagine, nella posizione giusta (terza o quarta), con il sabbia chiaro su `/` e `/viso/`; l'ancora `#listino` esiste;
  - voci: esattamente le 5 di §2.3, nomi presenti in `listino.json`, «Trattamento viso Antiage» per prima e unica con «In evidenza»;
  - nessun «€» nella sezione;
  - un solo link WhatsApp, con il testo viso; pulsante principale; alt della foto 03 come in §8; link «Vedi i prezzi ↓» verso `#listino`;
  - dati non indicati: con dettagli, macchinari e prodotti a `null` il template non mostra descrizioni né la riga «In cabina usiamo», e le 5 voci restano. Con i dati reali la riga c'è e il testo è esatto;
  - dettagli:
    - ogni voce che ha una riga mostra la sua descrizione, fatta solo di parole del dettaglio;
    - nessuna voce mostra una descrizione che non c'è;
    - limite di 2 o 3 frasi;
    - un nome che non coincide con il listino viene ignorato e segnalato;
  - nessuna parola vietata per il viso (§8), senza distinguere maiuscole e minuscole; al massimo 3 fasi, solo nella voce in evidenza, in un `<ol>`.
- Prova a vuoto: in una copia ho messo «BOTOX» in un dettaglio e «€ 55» nel testo, e ho tolto l'ancora `#listino`. I controlli li segnalano tutti. Un nome dei dettagli scritto con una maiuscola diversa («Laminazione Ciglia») viene ignorato con un avviso e la voce resta senza descrizione, come deve.

## 3. Anteprima

`node studio/anteprima.mjs --step 4`: 24 screenshot in `studio/screenshot/step4/` (tre pagine a 390, 768 e 1440 px, primo schermo e pagina intera, più il fondo pagina a 390 px e la 404).

- **390 px**: dopo l'apertura, la foto della cabina da bordo a bordo; la sfumatura in basso copre solo pavimento e pianta, il lettino resta pulito. Poi occhiello con l'arco, H2, testo, seconda frase, le 5 voci:
  - Antiage con la pillola, la descrizione, le 3 fasi numerate e la frase finale;
  - poi Pulizia viso base, contorno occhi e labbra, laminazione ciglia, laminazione sopracciglia.
  - In fondo la riga «In cabina usiamo», «Vedi i prezzi ↓» e il pulsante a tutta larghezza.
  - Gli a capo sono buoni: il nome lungo va a capo come «Trattamento Antiage / contorno occhi e labbra».
- **768 px**: cornice 4:5 di 520 px centrata, con il lettino intero; il testo ha la stessa larghezza.
- **1440 px**:
  - foto a sinistra, ferma in alto mentre si scorre l'elenco; nella cornice 4:5 il lettino sta al centro e la sfumatura a destra copre solo il bancone di marmo;
  - testo a destra, pulsante «Prenota il tuo trattamento viso» di larghezza naturale;
  - su `/viso/` la sezione è su sabbia chiara, su `/pedicure/` sul sabbia.
- I passaggi tra sabbia e sabbia chiara ora sono sfumati: è sparito anche il bordo netto sotto la foto dell'apertura su mobile.
- **Sistemato guardando gli screenshot**: a 1440 px la foto centrata in verticale accanto a un elenco molto più alto lasciava un grande vuoto. Ora è allineata in alto e resta ferma mentre si scorre.
- **Errori di console e richieste fallite: 0.** Ripieghi a posto.

## 4. Dati mancanti o dubbi

- **Elenco delle voci viso**: per sapere quali voci del listino vanno nella sezione serve un elenco. Sta in `centro.json` come riferimenti per nome: la build li verifica sul listino e mostra il nome preso dal listino.
- **Descrizioni con l'iniziale minuscola** (come in §2.2): sotto il nome la prima lettera diventa maiuscola solo a vista, con il CSS. Le fasi restano minuscole perché seguono i due punti di «in tre fasi:».
- **Fasi senza ripetizioni**: la descrizione dell'Antiage è mostrata così: testo fino a «in tre fasi:», poi l'elenco delle 3 fasi, poi «Fatto con costanza…». Ogni parola è quella del dettaglio, niente è ripetuto o aggiunto.
- **Poster nella foto 03**: sulla parete della cabina c'è un poster del produttore («REVINOL», con piccole immagini). È la foto vera indicata in §2.6 per la sezione viso, e alle misure del sito il poster è appena leggibile; a 768 e 1440 px sta nell'angolo in alto a sinistra della cornice. Non so se le sue piccole immagini siano foto prima/dopo, che §10 vieta.
- **«Vedi i prezzi ↓»**: porta all'ancora nascosta `#listino`; finché lo Step 7 non crea il listino, il clic non sposta la pagina.
- **Passaggio morbido tra le sezioni**: aggiunto per togliere i bordi netti tra sabbia e sabbia chiara. Vale per tutte le sezioni chiare e per il footer.

## 5. Domande per me

1. Il poster «REVINOL» sulla parete della foto 03 contiene foto prima/dopo? Se sì, su tablet e desktop posso spostare l'inquadratura (`object-position`) per lasciarlo fuori. Su mobile la foto si vede intera per §5, quindi lì resterebbe.
2. Su mobile la foto dell'apertura e quella della cabina arrivano una dopo l'altra, circa 1400 px di foto prima del testo della sezione viso. Va bene così, o su mobile metto il testo della sezione prima della sua foto?

---

## Aggiornamento: landing tutta color sabbia e decisioni sul report

Le domande 1–2 e il punto «Passaggio morbido tra le sezioni» qui sopra sono superati.

1. Landing tutta color sabbia (tua richiesta: «la landing la voglio tutta color sabbia, ricordatelo»)
- `CLAUDE.md` §5:
  - `--sabbia-chiara` «mai come fondo»;
  - regola nuova: header, apertura, ogni sezione, footer e barra contatti hanno fondo `--sabbia` su tutte e tre le pagine, senza sezioni alternate né altri colori di fondo. Le sezioni si separano con lo spazio e con il dettaglio firma; `--sabbia-profonda` resta solo per piccoli blocchi in rilievo (etichette, scheda 2 del pedicure).
- Codice:
  - la sezione viso non ha più la classe `sezione-chiara`;
  - tolti la regola `.sezione-chiara` e il passaggio sfumato (`--passaggio-sezioni`) aggiunti allo Step 4;
  - il footer è sul sabbia.
- Controllo nuovo «landing tutta color sabbia»:
  - nel CSS il sabbia chiara compare solo come definizione del token, e non ci sono fondi sfumati;
  - nell'HTML nessuna classe `sezione-chiara`;
  - con Playwright, a 390 e 1440 px su tre pagine più la 404, il body è sabbia; header, main, sezioni, footer e barra sono sabbia o trasparenti; gli unici altri fondi ammessi sono la pillola su sabbia profonda, il pulsante principale in inchiostro e, dallo Step 8, i campi in crema.

2. Poster «REVINOL» nella foto 03: resta.
- `CLAUDE.md` §10: aggiunta la frase indicata in fondo alla riga «Niente foto prima/dopo…».
- L'inquadratura da 768 px (`object-position: 50% 55%`) è quella che mostra meglio la cabina: lettino al centro, bancone di marmo a destra. Non è stata scelta per nascondere il poster.

3. Ordine su mobile
- `CLAUDE.md` §5: aggiunta la riga «Ordine su mobile» subito dopo «Proporzioni».
- `src/templates/parti/viso.html`:
  - nel markup l'ordine ora è introduzione (occhiello, H2, testo, «Prima di iniziare…»), foto, dettagli (elenco, riga cabina, link, pulsante);
  - fino a 1023 px resta quest'ordine;
  - da 1024 px una griglia con aree (`foto intro` / `foto dettagli`) rimette la foto a sinistra, ferma mentre si scorre, come prima.
- `src/css/sezioni.css`: aree della griglia da 1024 px, larghezza di 520 px per introduzione e dettagli tra 768 e 1023 px.
- Controllo nuovo: a 390 e 768 px, in ogni sezione con foto (tranne l'apertura), l'H2 sta sopra la foto.

4. Controlli: build OK · html-validate 0 errori · `node --check` OK · **controlli 50/50**. Prova a vuoto, in una copia: con la foto rimessa prima dell'H2 e il body sul sabbia chiaro, i due controlli nuovi falliscono come devono.

5. Anteprima: 24 screenshot in `studio/screenshot/step4/` (tre pagine a 390, 768 e 1440 px, più fondo pagina a 390 px e 404). Console: 0 errori, 0 richieste fallite.
- **390 px**: la foto dell'apertura sfuma sul sabbia, poi arco, «Viso», H2 e il testo della sezione, poi la foto della cabina che sfuma in basso, poi le 5 voci e il pulsante. Footer sul sabbia.
- **768 px**: stesso ordine, foto nella cornice di 520 px centrata.
- **1440 px**: invariato, foto a sinistra, testo ed elenco a destra; tutto sabbia.

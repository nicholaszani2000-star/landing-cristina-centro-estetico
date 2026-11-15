# Step 5 — Sezione pedicure avanzato

Data: 2026-11-02 · Branch: `landing-migliore`

## 1. File creati o modificati

- `CLAUDE.md`:
  - §2.2: blocco «Pedicure» sostituito con i dati confermati da Cristina (voci di «Include» separate da punto e virgola, durate, strumenti e igiene);
  - §8, blocco «Pedicure avanzato»:
    - testo dopo la revisione (sotto, al punto 4);
    - nelle due schede «durata se indicata» → «sotto, «Durata: …» con il testo indicato, se c'è», e il vecchio elenco «include» → «le voci … di §2.2», che altrimenti contraddiceva i dati nuovi;
    - riga «strumenti e igiene, solo se indicati, sotto le schede»;
    - riga sulle note di Cristina da non riportare.
- `content/centro.json`, `trattamenti.pedicure`:
  - `estetico` e `avanzato` con `include` (testo con i punti e virgola, come nei dati) e `durata`;
  - `strumentiIgiene` al posto di `strumenti`.

  I valori li ho ricavati con uno script dal §2.2 appena aggiornato, senza ricopiarli a mano.
- `content/testi.json`, `comuni.pedicure`: testo rivisto; `strumentiIgiene` («Strumenti e igiene: {…}.») al posto di `strumenti`.
- `src/templates/parti/pedicure.html` (nuovo):
  - introduzione (arco, «Piedi», H2, testo), foto 05, poi i dettagli;
  - due schede (estetico prima, avanzato dopo nel DOM) con titolo, sottotitolo, elenco «include» con spunta SVG e durata;
  - riga «Strumenti e igiene» con lo scudo; riga sul limite con l'icona informativa;
  - link «Vedi i prezzi ↓» → `#listino`;
  - pulsante «Prenota il pedicure avanzato» → WhatsApp con il testo pedicure.
- `src/templates/pagina.html`: sezione pedicure al posto dei segnaposto, terza su `/pedicure/`, quarta su `/` e `/viso/`.
- `src/templates/icone/spunta.svg`, `scudo.svg`, `info.svg` (nuove): icone disegnate a mano.
- `build.mjs`:
  - `vociInclude()`: una voce per ogni elemento separato da punto e virgola, con la prima lettera maiuscola;
  - `sezionePedicure()`: le due schede, con titoli e durate da `testi.json` e voci da `centro.json`;
  - `intervalliUniti()`: «50–55» non va mai a capo dentro l'intervallo;
  - link WhatsApp pedicure e foto 05 con l'helper.
- `src/css/sezioni.css`, sezione pedicure:
  - fino a 767 px: introduzione, foto intera che sfuma in basso, schede una sotto l'altra, il resto;
  - tra 768 e 1023 px: foto nella cornice 4:5 di 520 px centrata, schede affiancate;
  - da 1024 px: colonne 7/5 con testo e schede a sinistra; foto a destra in cornice 4:5 (`object-position: 55% 60%`), ferma mentre si scorre, che sfuma a sinistra;
  - scheda 1 sul sabbia con filetto `--linea`; scheda 2 su `--sabbia-profonda` con bordo 1,5 px `--accento`;
  - spunte e scudo in accento; riga sul limite piccola in `--inchiostro-tenue`;
  - ripiego senza `mask-image`;
  - le regole di link e pulsante sono condivise con la sezione viso.
- `src/css/tokens.css`: `--raggio-scheda` (10 px).
- `studio/controlli.mjs`:
  - 6 controlli nuovi;
  - il controllo dei link WhatsApp ora tiene a parte anche la sezione pedicure;
  - l'elenco dei dati facoltativi usa `strumentiIgiene`.

## 2. Controlli

- `node build.mjs`: OK.
- html-validate: **0 errori**.
- `node --check`: OK.
- `node studio/controlli.mjs`: **56/56 superati**. I nuovi:
  - la sezione pedicure c'è in tutte e tre le pagine, terza su `/pedicure/` e quarta altrove, sul sabbia;
  - linguaggio: nella sezione non compare nessuna delle parole indicate (podologico, podologica, podoestetica, curativo, terapeutico, medicale, calli, duroni, verruche, unghie incarnite, micosi, elimina, risolve, garantito). Né le note escluse di Cristina (ragadi, unghie ispessite, «base curativa»). L'unica eccezione è la riga sul limite;
  - «podologo» e «medico» compaiono una volta per pagina, nella riga sul limite, e mai sulla 404;
  - nessun «€» nella sezione; un solo link WhatsApp, con il testo pedicure; link `#listino`; foto 05 con l'alt di §8, in lazy;
  - schede:
    - «Pedicure estetico» prima di «Pedicure avanzato» nel DOM;
    - voci uguali ai dati, una per ogni punto e virgola, con iniziale maiuscola e spunta;
    - durate e riga «Strumenti e igiene» uguali ai dati;
    - con durate e strumenti a `null` le righe spariscono e la riga sul limite resta;
  - foto 05: `object-position` 55% 60% da 768 px, sfumatura a sinistra da 1024 px, larga al massimo 520 px a 768 px.
- Il controllo già esistente sull'ordine su mobile (H2 prima della foto) ora verifica anche la sezione pedicure.
- Prova a vuoto: in una copia ho messo «calli», «medico» e «€» nel testo, invertito le schede e messo il testo WhatsApp viso sul pulsante. I controlli segnalano tutto.

## 3. Anteprima

`node studio/anteprima.mjs --step 5`: 24 screenshot in `studio/screenshot/step5/` (tre pagine a 390, 768 e 1440 px, primo schermo e pagina intera, fondo pagina a 390 px, 404).

- **390 px**: arco, «Piedi», H2 e testo; poi la foto della postazione intera, che sfuma in basso (poltrona, poggiapiedi e carrello visibili); poi le due schede una sotto l'altra, la riga «Strumenti e igiene» con lo scudo, la riga sul limite, il link e il pulsante a tutta larghezza.
- **768 px**: foto nella cornice di 520 px centrata, schede affiancate.
- **1440 px**: su `/pedicure/` la sezione segue subito l'apertura.
  - A sinistra testo e schede affiancate: la scheda «Pedicure avanzato» spicca su sabbia profonda con il bordo accento.
  - A destra la foto: nella cornice 4:5 con `object-position: 55% 60%` si vedono poltrona, poggiapiedi e carrello, e la sfumatura a sinistra non tocca la poltrona.
- **Sistemato guardando gli screenshot**: nella durata l'intervallo andava a capo come «50– / 55».
- **Errori di console e richieste fallite: 0.** Ripieghi a posto.

## 4. Dati mancanti o dubbi

- **Fondi in sabbia chiara (conflitto con CLAUDE.md)**: il prompt chiedeva il fondo `--sabbia-chiara` per la scheda 1 e per la sezione su `/pedicure/`. CLAUDE.md §5 invece dice «la landing è tutta color sabbia … niente `--sabbia-chiara`», come mi avevi chiesto di ricordare, e CLAUDE.md prevale sul prompt. Quindi:
  - la sezione resta sul sabbia;
  - la scheda 1 sta sul sabbia con un filetto `--linea`;
  - la scheda 2 resta in rilievo su `--sabbia-profonda` con bordo accento, come §5 consente.
- **Revisione del testo (punto 4)**, frase per frase come la leggerebbe un ispettore:
  - **Testo, frase cambiata.** Dal prompt: «Il pedicure avanzato aggiunge un lavoro approfondito con micromotore e frese professionali sulle unghie e sulle zone dove la pelle si ispessisce.» Dopo la revisione: «… sulle zone dove la pelle si ispessisce, per una pelle più liscia e morbida e unghie in ordine.»
    - Perché: da sola, «lavoro approfondito sulle zone dove la pelle si ispessisce» si può leggere come intervento su un problema dei piedi (proprio ciò che le parole vietate «calli» e «duroni» indicano). Con l'aspetto che si ottiene, la frase dice solo metodo e risultato estetico, come chiede §10.
    - Ho aggiornato §8.
  - **Frasi lasciate com'erano**:
    - «Non la solita pedicure.» e «Il pedicure estetico si prende cura dell'aspetto di unghie e piedi.»: parlano solo dell'aspetto;
    - le voci delle schede: sono i dati di Cristina e descrivono il metodo (pediluvio, frese, levigatura), senza condizioni da trattare;
    - le durate;
    - «Strumenti e igiene»: igiene degli strumenti, non una promessa sanitaria;
    - la riga sul limite.
  - **Fuori dalla sezione**: il sottotitolo dell'apertura di `/pedicure/` dice «per piedi morbidi e curati». Qui «curati» significa «ben tenuti» e lo ritengo corretto; non l'ho toccato, perché sta nell'apertura.
- **«Una sola volta in tutto il sito»**: la riga sul limite è nella sezione pedicure, e la sezione c'è su tutte e tre le pagine. Il controllo verifica quindi una sola volta per pagina, sempre nella riga sul limite, e zero sulla 404.
- **Larghezze a 768 px**: il testo e le schede usano tutta la larghezza del contenitore (le schede affiancate in 520 px sarebbero troppo strette), mentre la foto sta nella cornice di 520 px centrata.
- **Nessun titolo «Include» sopra gli elenchi**: §8 non lo prevede; titolo e sottotitolo della scheda bastano.
- **Marchio del micromotore**: non è nei dati e non compare, come vuole §8.

## 5. Domande per me

1. Confermi la scheda «Pedicure estetico» sul sabbia con un filetto, invece che su sabbia chiara? Se preferisci la sabbia chiara per la scheda, aggiungo in §5 un'eccezione per lei sola; la sezione resterebbe comunque sul sabbia.

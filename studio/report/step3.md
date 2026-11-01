# Step 3 — Apertura, barra contatti e varianti delle tre pagine

Data: 2026-11-01 · Branch: `landing-migliore`

## 1. File creati o modificati

- `src/templates/parti/apertura.html`: aggiunta la foto 01 con l'helper `immagine()` (priorità alta, `sizes="(min-width: 1024px) 480px, 100vw"`); «Scrivi su WhatsApp» si apre in una nuova scheda (`target="_blank" rel="noopener"`). Occhiello, H1, sottotitolo, pulsanti, riga info e payoff c'erano già dallo Step 1, con i testi della pagina.
- `src/templates/parti/barra-contatti.html` (nuovo): barra mobile con «Chiama» (`tel:`) e «WhatsApp» (testo della pagina, nuova scheda).
- `src/templates/pagina.html`: include la barra al posto del segnaposto.
- `src/templates/404.html`: anche qui WhatsApp in nuova scheda.
- `src/templates/parti/testa.html`: `viewport-fit=cover`, senza il quale `env(safe-area-inset-bottom)` vale 0 sugli iPhone.
- `build.mjs`:
  - foto dell'apertura generata con l'helper, `fetchpriority="high"` e senza `loading="lazy"`;
  - nei titoli (chiavi `h1` e `h2`) le parole brevi (a, e, di, in, il…) si legano alla parola che segue con uno spazio non separabile, così non restano appese in fondo alla riga; `testi.json` non cambia.
- `src/css/tokens.css`: token delle sfumature (72% in basso su mobile; 86% in basso e 22% a sinistra da 1024 px) e della barra (altezza = pulsante + 2 × 8 px, durata 200 ms).
- `src/css/base.css`: `font-synthesis: none` su titoli e payoff (Marcellus non ha corsivo né grassetto); `text-wrap: pretty` sui paragrafi, contro le parole orfane.
- `src/css/sezioni.css`:
  - apertura:
    - fino a 1023 px, pulsanti uno sotto l'altro a tutta larghezza e foto da bordo a bordo che sfuma in basso;
    - da 1024 px, colonne 7/5 con il testo centrato in verticale e la foto in cornice 3:4, `object-position: 50% 62%`;
    - sfumatura a sinistra sulla foto e in basso sulla cornice: due maschere su due elementi, senza `mask-composite`;
    - ripiego senza `mask-image`: foto dentro i margini, angoli di 6 px;
  - barra contatti: fissa, sotto i 768 px, transizione di opacità di 200 ms (nessuna con riduzione del movimento); in fondo al `body` uno spazio pari a barra più area sicura;
  - footer: link larghi almeno 44 px;
  - 404: link alla pagina iniziale alto 44 px.
- `src/js/main.js` (2,2 KB, 1 KB compresso): con IntersectionObserver la barra si nasconde mentre i pulsanti dell'apertura sono visibili. Senza IntersectionObserver resta sempre visibile.
- `studio/controlli.mjs`: browser e server condivisi dai controlli con Playwright; 6 controlli nuovi, controllo dei link esteso, regex del controllo 404 aggiornata (il pulsante WhatsApp ora ha `target` e `rel`).
- `studio/anteprima.mjs`: a 390 px anche lo screenshot del fondo pagina con la barra visibile (`*-390-fondo.png`).

## 2. Controlli

- `node build.mjs`: OK.
- html-validate: **0 errori**.
- `node --check`: OK su tutti i file JS.
- `node studio/controlli.mjs`: **41/41 superati**.

Controllo esteso:
- link `tel:+393520601109` e `https://wa.me/393520601109?text=` su ogni pagina, testo WhatsApp giusto per la pagina, `target="_blank" rel="noopener"`.

Controlli nuovi:
- varianti: title diversi e al massimo di 60 caratteri, description diverse tra 60 e 160 caratteri, ordine viso/pedicure giusto per pagina;
- una sola immagine con `fetchpriority="high"` per pagina, ed è la foto 01 con il suo `sizes`;
- JSON-LD valido:
  - JSON corretto;
  - tipi schema.org esistenti (BeautySalon, PostalAddress, OpeningHoursSpecification);
  - solo proprietà note, nessun campo vuoto o `null`;
  - telefono in formato internazionale, giorni e orari validi;
- Playwright a 390×844: i due pulsanti dell'apertura sono nel primo schermo, ogni elemento cliccabile visibile misura almeno 44×44 px, nessuno scroll orizzontale;
- barra contatti:
  - nascosta sull'apertura, visibile dopo;
  - in fondo alla pagina il footer finisce sopra la barra;
  - senza JS sempre visibile;
  - assente a 768 px;
- con `reducedMotion: 'reduce'` nessun elemento ha transizioni o animazioni di posizione.

Prova a vuoto: in una copia ho stretto i link del footer, tolto lo spazio in fondo per la barra, lasciato le transizioni dei pulsanti con «riduci movimento» e fatto sbordare la foto. I tre controlli interessati li hanno segnalati tutti.

## 3. Anteprima

`node studio/anteprima.mjs --step 3`: 17 screenshot in `studio/screenshot/step3/`.
- Per ognuna delle tre pagine: pagina intera a 390 e a 1440 px, primo schermo a 390 e a 1440 px, fondo pagina a 390 px con la barra.
- Più la 404 a 390 e a 1440 px.

- **390 px, primo schermo**:
  - logo, «Chiama» in alto, occhiello, H1 su tre righe («Trattamenti viso / e pedicure avanzato / a Caronno Varesino»), sottotitolo;
  - «Chiama» e «Scrivi su WhatsApp» a tutta larghezza, uno sotto l'altro, entro i primi 510 px circa, poi riga info e payoff;
  - barra nascosta.
- **390 px, scorrendo**: foto 01 da bordo a bordo, in proporzione originale, che sfuma nel sabbia; poi il footer.
  - In fondo la barra («Chiama» pieno, «WhatsApp» con bordo) è visibile e il footer finisce sopra di lei.
- **1440 px**: testo a sinistra centrato in verticale; foto a destra in cornice 3:4. Si vedono il volto di Cristina in alto e la scritta MIGLIORE sul bancone in basso. La sfumatura è morbida a sinistra e in basso.
- **Sistemato guardando gli screenshot**:
  - su `/viso/` l'H1 andava a capo come «Trattamenti viso a / Caronno Varesino», ora è «Trattamenti viso / a Caronno Varesino»;
  - il sottotitolo di `/viso/` lasciava «tranquillo.» da solo sulla seconda riga.
- **Errori di console e richieste fallite: 0.** Ripieghi (senza JS, riduzione del movimento, `main.js` bloccato): contenuto sempre visibile.

## 4. Dati mancanti o dubbi

- **Title tra 60 e 160 caratteri**: i title di §7 sono di 46–47 caratteri, e CLAUDE.md prevale sul prompt. Il controllo verifica che siano diversi tra loro e al massimo di 60 caratteri (oltre, Google li taglia). Il vincolo 60–160 lo applico alle description, come in §7.
- **Foto a tutta larghezza fino a 1023 px**: la foto va da bordo a bordo, oltre i margini di 20 px. Tra 768 e 1023 px viene molto alta: circa 1365 px a 768 px.
- **Sfumatura in basso da 1024 px**: all'86% e non al 72% del mobile, così la scritta MIGLIORE sul bancone resta nitida nella cornice 3:4.
- **Barra contatti**: il pulsante WhatsApp usa il testo della pagina. Non c'è sulla 404, che ha già i suoi due pulsanti.
- **Header**: era già conforme dallo Step 1 e 2 (logo alto 64/80 px che porta alla home, «Chiama», numero da 768 px, aree ≥ 44 px), quindi non l'ho toccato.
- **Passaggio tra foto e footer su mobile**: la sfumatura della foto finisce sul sabbia e il footer parte su sabbia chiara con un bordo netto. È provvisorio: dallo Step 4 dopo la foto arriva la sezione viso.

## 5. Domande per me

1. Tra 768 e 1023 px (tablet) la foto a tutta larghezza è molto alta, circa 1365 px a 768 px. Va bene così, o la limito a una larghezza massima, per esempio 560 px centrata?
2. Va bene che la barra contatti non compaia sulla pagina 404?

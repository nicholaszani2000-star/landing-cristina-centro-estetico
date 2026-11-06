# Cosa manca per andare live al 100%

Aggiornato il 6 novembre 2026.

## Già fatto

- **Sito online** su https://esteticamigliore.it (Netlify, progetto esteticamigliore, piano Free), con HTTPS attivo.
- **GA4 e pixel Meta attivi** (6 novembre): `G-DFCM449BWE` e `1682509193499996`. Partono solo dopo «Accetta» nel banner cookie, che ora compare con «Rifiuta», «Personalizza» e «Accetta». Privacy e cookie policy si sono aggiornate da sole, con data 6 novembre 2026.
- **Chiave segreta di Supabase su Netlify** (6 novembre): segreta, solo in produzione. Il codice sconto ora si salva davvero nella tabella `iscritti`.
  - Da fare: la chiave è passata in chat, quindi va sostituita. Su Supabase crea una chiave segreta nuova, mettila su Netlify al posto di quella vecchia, poi elimina quella vecchia.
- **GitHub collegato a Netlify** (4 novembre), con branch di produzione `landing-migliore`: ogni modifica salvata va online da sola, senza zip.
  - Primo deploy da GitHub: `6aeaf5ac`, commit `0f2a991`, con la laminazione sopracciglia a 50 € e i nuovi orari.
- **Google Search Console** verificato: proprietà «Prefisso URL» `https://esteticamigliore.it`, metodo «File HTML».
- **Supabase** in UE (Francoforte):
  - tabella delle iscrizioni protetta (RLS);
  - pulizia automatica dopo 24 mesi.
- **Chiave di Brevo su Netlify** (6 novembre): segreta, solo in produzione. Il codice per l’email con lo sconto e per la lista delle promo è pronto: parte quando arrivano il mittente e l’ID della lista.
  - Da fare: anche questa chiave è passata in chat, quindi va sostituita. Su Brevo crea una chiave nuova, mettila su Netlify al posto di quella vecchia, poi elimina quella vecchia.

## Cosa manca

Le righe sono in ordine di priorità. **Mai incollare in chat chiavi segrete** (Supabase, Brevo, token Meta): vanno solo su Netlify.

| Cosa manca | A cosa serve | Chi lo fornisce | Dove si trova o come si ottiene | Come si collega | Messaggio da incollare a Claude Code |
|---|---|---|---|---|---|
| **www.esteticamigliore.it** | Chi scrive l'indirizzo con il www oggi non arriva al sito. | Io | Register.it → Domini → esteticamigliore.it → DNS e servizi → gestione avanzata → aggiungi record: nome `www`, tipo **CNAME**, valore `esteticamigliore.netlify.app` | Record DNS + interfaccia Netlify: Domain management → Add domain alias → `www.esteticamigliore.it`. Netlify lo porta all'indirizzo principale, che resta esteticamigliore.it senza www (CLAUDE.md §2.1). | «Ho aggiunto il CNAME www e l'alias su Netlify: controlla che www.esteticamigliore.it porti a esteticamigliore.it.» |
| **Verifica di privacy e cookie policy** | Sono bozze, con il riquadro «Bozza» in cima. Vanno verificate prima degli annunci (§10). | Professionista privacy o commercialista | Fai leggere https://esteticamigliore.it/privacy/ e /cookie/ | Testi in `content/testi.json`. Togliere il riquadro è una riga (`legale.verificata`). | «Privacy verificata. Correzioni: [INCOLLA QUI le correzioni, oppure «nessuna»].» |
| **REA e sede legale** | Footer e pagine legali completi (art. 35 DPR 633/72). Oggi la riga REA non compare. | Commercialista (visura camerale) | Visura camerale di Migliore Cristina: «Numero REA» e sede legale | Campo `legale.rea` e `legale.sedeLegale` in `content/centro.json` | «REA: [INCOLLA QUI es. VA-123456]. Sede legale: [INCOLLA QUI, oppure «coincide con il centro»].» |
| **Eventi chiave in GA4** | In GA4 i contatti contano come conversioni | Io | analytics.google.com → Amministrazione → Visualizzazione dati → **Eventi** → attiva «Contrassegna come evento chiave» su `generate_lead`, `clic_chiama` e `clic_whatsapp` (compaiono dopo i primi clic veri). In Raccolta dati lascia **Google Signals spento**. | Interfaccia GA4 | «Eventi chiave impostati: [INCOLLA QUI lo screenshot].» |
| **Meta: verifica del dominio e accesso all’account pubblicitario** | Il pixel `1682509193499996` è già attivo sul sito, ma parte solo dopo «Accetta»: la procedura guidata di Meta lo vede solo se nella scheda che apre tocchi «Accetta» nel banner. Non serve incollare il codice da nessuna parte. Per usare il dominio negli annunci e vedere i risultati serve la verifica del dominio | Io | business.facebook.com → Impostazioni → Sicurezza del brand → **Domini** → aggiungi esteticamigliore.it → metodo «Tag meta» o «File HTML». Dai al tuo profilo l’accesso all’account pubblicitario 1492127002822228 | Codice di verifica nel sito, come per Google | «Verifica dominio Meta: [INCOLLA QUI il codice del meta tag o il nome del file].» |
| **API Conversioni Meta** (facoltativa) | `Lead` inviato anche dal server, più preciso, deduplicato con il browser | Io | Gestione eventi → pixel → Impostazioni → API Conversioni → genera token di accesso | Variabile segreta `META_CAPI_TOKEN` su Netlify, solo lì e mai in chat | «Ho messo META_CAPI_TOKEN su Netlify: attiva l'API Conversioni per il Lead.» |
| **Brevo: mittente e lista delle promo** | Il codice arriva anche via email; ogni iscritto entra da solo nella lista delle promo mensili (Brevo aggiunge il link di disiscrizione) | Io | La chiave è già su Netlify. app.brevo.com → **Mittenti, domini e IP** → aggiungi e verifica il mittente (meglio un indirizzo @esteticamigliore.it, oppure esteticamigliore@gmail.com). **Contatti → Liste** → crea la lista «Promo sito» → il suo **ID** (numero). In **Sicurezza → IP autorizzati** disattiva il blocco degli IP sconosciuti: Netlify non ha un IP fisso | Campi `servizioEmail.mittente` e `servizioEmail.listaPromo` in `content/centro.json` | «Mittente verificato: [INCOLLA QUI l'email]. ID lista promo: [INCOLLA QUI il numero].» |
| **Social** | Link nel footer e nei dati per Google (`sameAs`) | Cristina | Indirizzo del profilo Instagram e della pagina Facebook | Campi `social.instagram` e `social.facebook` in `content/centro.json` | «Instagram: [INCOLLA QUI l'URL]. Facebook: [INCOLLA QUI l'URL].» |
| **Scheda Google (Google Business Profile)** | Il pulsante «Apri in Google Maps» porta alla scheda con le recensioni, non alla ricerca dell'indirizzo | Cristina | business.google.com → scheda del centro → Condividi profilo → copia il link | Campo `social.schedaGoogle` in `content/centro.json` | «Scheda Google: [INCOLLA QUI il link].» |
| **Search Console: sitemap e indicizzazione** | Google mostra il sito nuovo al posto della versione senza stile | Io | Search Console → Sitemap → `sitemap.xml` → Invia. Controllo URL → `https://esteticamigliore.it/` → Richiedi indicizzazione (anche /viso/ e /pedicure/) | Interfaccia Search Console | «Sitemap inviata, ecco lo stato: [INCOLLA QUI lo screenshot].» |
| **Prova finale sul telefono** | Essere sicuri prima degli annunci | Io e Cristina | Su ogni pagina: Chiama, WhatsApp con il testo giusto, Maps, codice sconto (dopo la chiave Supabase), listino, privacy e cookie | Telefono | «Prova finale fatta: [INCOLLA QUI cosa non va, oppure «tutto ok»].» |

## Link per le campagne Meta

Sul dominio di produzione, che oggi è https://esteticamigliore.it senza www:

- Viso: https://esteticamigliore.it/viso/?utm_source=meta&utm_medium=paid_social&utm_campaign=viso
- Pedicure: https://esteticamigliore.it/pedicure/?utm_source=meta&utm_medium=paid_social&utm_campaign=pedicure
- Generale: https://esteticamigliore.it/?utm_source=meta&utm_medium=paid_social&utm_campaign=generale

Chiave Supabase e pixel Meta sono attivi. Prima di far partire gli annunci mancano ancora la verifica della privacy e la prova finale sul telefono (codice sconto compreso).

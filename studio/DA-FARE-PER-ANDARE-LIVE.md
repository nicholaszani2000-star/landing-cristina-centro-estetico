# Cosa manca per andare live al 100%

Aggiornato il 3 novembre 2026.

## Già fatto

- **Sito online** su https://esteticamigliore.it (Netlify, progetto esteticamigliore, piano Free), con HTTPS attivo.
  - Pubblicato trascinando lo zip del repository: Netlify costruisce il sito e installa la funzione del codice sconto.
- **Google Search Console** verificato: proprietà «Prefisso URL» `https://esteticamigliore.it`, metodo «File HTML».
- **Supabase** in UE (Francoforte):
  - tabella delle iscrizioni protetta (RLS);
  - pulizia automatica dopo 24 mesi.
- **Codice pronto per Brevo, GA4, pixel Meta e banner cookie**: si accendono da soli quando arrivano i dati.

## Cosa manca

Le righe sono in ordine di priorità. **Mai incollare in chat chiavi segrete** (Supabase, Brevo, token Meta): vanno solo su Netlify.

| Cosa manca | A cosa serve | Chi lo fornisce | Dove si trova o come si ottiene | Come si collega | Messaggio da incollare a Claude Code |
|---|---|---|---|---|---|
| **Chiave segreta Supabase** (`SUPABASE_SECRET_KEY`) | **Urgente.** Oggi il codice sconto è in modalità prova: compare a chi lo chiede ma **non viene salvato**, quindi Cristina non può controllarlo. | Io (titolare dell'account Supabase) | supabase.com → progetto **migliore-estetica** → Project Settings → API Keys → Secret keys → copia la chiave `sb_secret_…` | Interfaccia Netlify: esteticamigliore → Project configuration → Environment variables → Add a variable → nome `SUPABASE_SECRET_KEY`, spunta «Contains secret values» → poi un nuovo deploy (ritrascina lo zip o, con GitHub collegato, Trigger deploy) | «Ho messo SUPABASE_SECRET_KEY su Netlify e ho rifatto il deploy. Prova un'iscrizione sul sito vero, controlla che la riga arrivi su Supabase e che la stessa email riceva lo stesso codice.» |
| **Collegamento GitHub → Netlify** | Ogni modifica va online da sola, senza zip. Le pull request hanno un'anteprima prima di andare live. | Io | app.netlify.com → esteticamigliore → Project configuration → Build & deploy → Continuous deployment → **Link repository** → GitHub → `landing-cristina-centro-estetico` | Interfaccia Netlify. Branch di produzione: `main`, consigliato, con merge della pull request n. 1; oppure `landing-migliore`. Build e cartella le legge da `netlify.toml`. | «Ho collegato GitHub a Netlify con branch di produzione [INCOLLA QUI main oppure landing-migliore]. Controlla il deploy e aggiorna CLAUDE.md §2.5.» |
| **www.esteticamigliore.it** | Chi scrive l'indirizzo con il www oggi non arriva al sito. | Io | Register.it → Domini → esteticamigliore.it → DNS e servizi → gestione avanzata → aggiungi record: nome `www`, tipo **CNAME**, valore `esteticamigliore.netlify.app` | Record DNS + interfaccia Netlify: Domain management → Add domain alias → `www.esteticamigliore.it`. Netlify lo porta all'indirizzo principale. | «Ho aggiunto il CNAME www e l'alias su Netlify. Tengo esteticamigliore.it senza www come principale: aggiorna CLAUDE.md e centro.json.» |
| **Verifica di privacy e cookie policy** | Sono bozze, con il riquadro «Bozza» in cima. Vanno verificate prima degli annunci (§10). | Professionista privacy o commercialista | Fai leggere https://esteticamigliore.it/privacy/ e /cookie/ | Testi in `content/testi.json`. Togliere il riquadro è una riga (`legale.verificata`). | «Privacy verificata. Correzioni: [INCOLLA QUI le correzioni, oppure «nessuna»].» |
| **REA e sede legale** | Footer e pagine legali completi (art. 35 DPR 633/72). Oggi la riga REA non compare. | Commercialista (visura camerale) | Visura camerale di Migliore Cristina: «Numero REA» e sede legale | Campo `legale.rea` e `legale.sedeLegale` in `content/centro.json` | «REA: [INCOLLA QUI es. VA-123456]. Sede legale: [INCOLLA QUI, oppure «coincide con il centro»].» |
| **Proprietà GA4** | Statistiche delle visite e dei contatti (clic su Chiama, WhatsApp, codice). Con l'ID si accende anche il banner cookie. | Io | analytics.google.com → Amministrazione → Crea proprietà → Stream di dati Web → `https://esteticamigliore.it` → copia l'**ID misurazione** `G-…` | Campo `integrazioni.ga4Id` in `content/centro.json`, poi nuovo deploy | «Ecco l'ID GA4: [INCOLLA QUI G-…]. Attivalo, rifai lo zip e dimmi come impostare gli eventi chiave generate_lead, clic_chiama e clic_whatsapp.» |
| **Meta: pagina, account pubblicitario, pixel, dominio** | Misurare le campagne Facebook e Instagram (PageView, Contact, Lead dopo il consenso) e verificare il dominio. | Io | business.facebook.com → Gestione eventi → Origini dati → pixel → **ID** (15–16 cifre). Impostazioni dell'azienda → Sicurezza del brand → Domini → aggiungi esteticamigliore.it → metodo meta tag o file | ID in `integrazioni.metaPixelId`. Il codice di verifica del dominio lo metto nel sito come per Google. Accesso all'account pubblicitario 1492127002822228 al profilo collegato. | «Pixel Meta: [INCOLLA QUI l'ID]. Verifica dominio Meta: [INCOLLA QUI il codice del meta tag o il nome del file].» |
| **API Conversioni Meta** (facoltativa) | `Lead` inviato anche dal server, più preciso, deduplicato con il browser | Io | Gestione eventi → pixel → Impostazioni → API Conversioni → genera token di accesso | Variabile segreta `META_CAPI_TOKEN` su Netlify, solo lì e mai in chat | «Ho messo META_CAPI_TOKEN su Netlify: attiva l'API Conversioni per il Lead.» |
| **Servizio email Brevo** | Il codice arriva anche via email; lista per le promo mensili con link di disiscrizione | Io | app.brevo.com → in alto a destra → SMTP e API → API Keys → Generate. Mittenti, domini e IP → aggiungi e verifica il mittente (meglio un indirizzo @esteticamigliore.it). Contatti → Liste → crea lista → **ID** | Variabile segreta `BREVO_API_KEY` su Netlify. Mittente e ID lista in `content/centro.json` | «Ho messo BREVO_API_KEY su Netlify. Mittente verificato: [INCOLLA QUI l'email]. ID lista promo: [INCOLLA QUI il numero].» |
| **Social** | Link nel footer e nei dati per Google (`sameAs`) | Cristina | Indirizzo del profilo Instagram e della pagina Facebook | Campi `social.instagram` e `social.facebook` in `content/centro.json` | «Instagram: [INCOLLA QUI l'URL]. Facebook: [INCOLLA QUI l'URL].» |
| **Scheda Google (Google Business Profile)** | Il pulsante «Apri in Google Maps» porta alla scheda con le recensioni, non alla ricerca dell'indirizzo | Cristina | business.google.com → scheda del centro → Condividi profilo → copia il link | Campo `social.schedaGoogle` in `content/centro.json` | «Scheda Google: [INCOLLA QUI il link].» |
| **Search Console: sitemap e indicizzazione** | Google mostra il sito nuovo al posto della versione senza stile | Io | Search Console → Sitemap → `sitemap.xml` → Invia. Controllo URL → `https://esteticamigliore.it/` → Richiedi indicizzazione (anche /viso/ e /pedicure/) | Interfaccia Search Console | «Sitemap inviata, ecco lo stato: [INCOLLA QUI lo screenshot].» |
| **Prova finale sul telefono** | Essere sicuri prima degli annunci | Io e Cristina | Su ogni pagina: Chiama, WhatsApp con il testo giusto, Maps, codice sconto (dopo la chiave Supabase), listino, privacy e cookie | Telefono | «Prova finale fatta: [INCOLLA QUI cosa non va, oppure «tutto ok»].» |

## Link per le campagne Meta

Sul dominio di produzione, che oggi è https://esteticamigliore.it senza www:

- Viso: https://esteticamigliore.it/viso/?utm_source=meta&utm_medium=paid_social&utm_campaign=viso
- Pedicure: https://esteticamigliore.it/pedicure/?utm_source=meta&utm_medium=paid_social&utm_campaign=pedicure
- Generale: https://esteticamigliore.it/?utm_source=meta&utm_medium=paid_social&utm_campaign=generale

Prima di far partire gli annunci servono almeno tre cose: la chiave Supabase, la verifica della privacy e il pixel Meta (per misurare le campagne).

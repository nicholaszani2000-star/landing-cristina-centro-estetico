// studio/scheda-google.mjs — kit per la scheda del centro su Google (Profilo dell'attività su Google).
//
// Uso:  node studio/scheda-google.mjs
// Scrive in studio/pacchetto/ (ignorata da git):
//   scheda-google/                 cartella del kit
//     SCHEDA-GOOGLE.txt            guida passo passo e testi da copiare (dati presi da content/*.json)
//     foto/*.jpg                   le foto vere del centro (01–05), solo convertite in JPG, misure originali
//     foto/logo-720.png            il logo su fondo sabbia, in un quadrato 720×720 (il logo non cambia)
//   scheda-google.zip              lo stesso kit in uno zip, da scaricare sul telefono o sul computer
//
// La scheda la apre e la verifica la titolare su business.google.com: il sito non la può creare da solo.
// Dati, orari e prezzi arrivano da content/centro.json e content/listino.json, come nel sito, così non si
// contraddicono. La foto 06 (listino stampato) resta fuori: riporta ancora il vecchio prezzo della laminazione
// sopracciglia (CLAUDE.md §2.3). Le foto si convertono soltanto (CLAUDE.md §2.6, §3.12).

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { formattaPrezzo, testiOrari } from "../build.mjs";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const USCITA = join(STUDIO, "pacchetto");
const KIT = join(USCITA, "scheda-google");
const ZIP = join(USCITA, "scheda-google.zip");

const leggiJson = (file) => JSON.parse(readFileSync(join(RADICE, file), "utf8"));
const centro = leggiJson("content/centro.json");
const listino = leggiJson("content/listino.json");

// Testo semplice: niente spazi unificatori o separatori invisibili del sito.
const piano = (s) => String(s).replace(/[  ]/g, " ").replace(/⁠/g, "");

// Parole vietate (CLAUDE.md §8): la descrizione per Google segue le stesse regole del sito.
const VIETATE = [
  "podolog", "podoestetic", "curativ", "terapeutic", "medical", "medico", "calli", "duroni", "verruch", "incarnit",
  "micosi", "elimina", "risolve", "nuova apertura", "appena aperto", "inaugurazione", "dermatolog", "diagnosi",
  "collagene", "elastina", "rigenera", "ripara", "acne", "filler", "botox", "lifting", "ringiovanisce",
  "migliore estetista", "il migliore", "garantit", "definitiv", "miracolos",
];

// ---------------------------------------------------------------- testi

const { via, cap, comune, provincia, completo: indirizzoCompleto } = centro.indirizzo;
const orari = testiOrari(centro.orari).testo;
const sito = `${centro.indirizzoPrincipale}/?utm_source=google&utm_medium=organic&utm_campaign=scheda_google`;
const whatsapp = `https://wa.me/${centro.whatsappNumero}`;

const descrizione = [
  `${centro.nome} è il centro estetico di ${centro.titolare.completo} a ${comune}, in ${via}. Si riceve solo su appuntamento.`,
  "Trattamenti viso, dalla pulizia del viso ai trattamenti anti-age con prodotti professionali Natinuel; pedicure estetico e pedicure avanzato con micromotore e frese professionali; manicure, epilazione ed epilazione brasiliana multidirezionale, massaggi, trattamenti corpo, laminazione di ciglia e sopracciglia.",
  "Strumenti puliti con gli ultrasuoni, sterilizzati a secco e conservati in buste sigillate.",
  `Orari: ${orari}. Prenota con una chiamata o un messaggio su WhatsApp.`,
].join(" ");

if (descrizione.length > 750) throw new Error(`descrizione di ${descrizione.length} caratteri: Google ne ammette 750`);
for (const parola of VIETATE) {
  if (descrizione.toLowerCase().includes(parola)) throw new Error(`descrizione con una parola vietata: «${parola}»`);
}

// Orari nel formato del modulo di Google: un giorno per riga.
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const ORDINE = { lunedì: 0, martedì: 1, mercoledì: 2, giovedì: 3, venerdì: 4, sabato: 5, domenica: 6 };
const perGiorno = new Map();
for (const f of centro.orari.fasce) {
  const nomi = f.giorni.toLowerCase().match(/lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica/g) ?? [];
  if (!nomi.length) throw new Error(`fascia senza giorni riconoscibili: «${f.giorni}»`);
  const [primo, ultimo] = [ORDINE[nomi[0]], ORDINE[nomi.at(-1)]];
  const giorni = /^dal\s/.test(f.giorni.trim()) && nomi.length === 2 ? Array.from({ length: ultimo - primo + 1 }, (_, k) => primo + k) : nomi.map((n) => ORDINE[n]);
  for (const g of giorni) perGiorno.set(g, `${f.apertura}–${f.chiusura}`);
}
const righeOrari = GIORNI.map((g, i) => `  ${g.padEnd(10)} ${perGiorno.get(i) ?? "chiuso"}`).join("\n");

const servizi = listino.categorie
  .map((c) => [`  ${c.titolo}`, ...c.voci.map((v) => `    - ${v.nome}: ${piano(formattaPrezzo(v))}`)].join("\n"))
  .join("\n\n");

const FOTO = [
  { da: "01-cristina-bancone.png", a: "01-cristina-migliore-al-bancone.jpg", dove: "Team (o Interni)" },
  { da: "02-ingresso.png", a: "02-ingresso-via-roma-2a.jpg", dove: "Esterni: aiuta a riconoscere l'ingresso. Ottima anche come copertina" },
  { da: "03-cabina-viso.png", a: "03-cabina-trattamenti-viso.jpg", dove: "Interni" },
  { da: "04-cabina-lettino.png", a: "04-cabina.jpg", dove: "Interni" },
  { da: "05-postazione-pedicure.png", a: "05-postazione-manicure-pedicure.jpg", dove: "Interni" },
];

const testo = `SCHEDA DEL CENTRO SU GOOGLE — kit pronto
${centro.nome} · ${indirizzoCompleto}
Generato da studio/scheda-google.mjs con i dati del sito (content/centro.json e content/listino.json).

La scheda su Google (Profilo dell'attività su Google) è quella che compare a destra nella ricerca e su Google Maps,
con indicazioni stradali, orari, telefono, foto e recensioni. Il sito non la crea da solo: va aperta e verificata
dalla titolare. Ci vogliono 15 minuti, più i giorni che Google impiega per la verifica.

================================================================================================================
1. PRIMA DI TUTTO: ESISTE GIÀ?
================================================================================================================
Cerca su Google Maps «${centro.nome} ${comune}» e anche «estetista ${via} ${comune}».
- Se il centro compare già (Google a volte crea le schede da solo): aprila e tocca «Rivendica questa attività»
  oppure «Sei il proprietario di questa attività?». Non crearne una nuova: due schede si fanno concorrenza.
- Se non compare: vai su https://business.google.com e tocca «Gestisci ora» con l'account Google del centro
  (${centro.email}).

================================================================================================================
2. I DATI DA INSERIRE (copia e incolla)
================================================================================================================
Nome dell'attività:     ${centro.nome}
                        (esattamente così, come sull'insegna: Google penalizza le parole aggiunte al nome)
Categoria principale:   Centro estetico
Altre categorie:        scegli tra quelle che Google propone scrivendo «pedicure», «manicure», «epilazione»,
                        «massaggi», «trattamenti viso» (massimo 9)
Sede fisica:            Sì, i clienti vengono all'indirizzo
Indirizzo:              ${via}, ${cap} ${comune} ${provincia}, Italia
                        Controlla che lo spillo sulla mappa sia sull'ingresso: da lì Google calcola le indicazioni
Zona servita:           non serve (i clienti vengono al centro)
Telefono:               ${centro.telefono}  (${centro.telefonoE164})
Sito web:               ${sito}
                        (i parametri utm_ fanno vedere in GA4 quante visite arrivano dalla scheda)
Link per appuntamenti:  ${whatsapp}
Email:                  ${centro.email}

Orari:
${righeOrari}
Attributi:              «Solo su appuntamento» / «Appuntamento obbligatorio» se Google lo propone

Descrizione (${descrizione.length} caratteri su 750):
${descrizione}

================================================================================================================
3. SERVIZI E PREZZI (Modifica profilo → Servizi), uguali al listino del sito
================================================================================================================
${servizi}

================================================================================================================
4. FOTO (cartella «foto» di questo kit)
================================================================================================================
${FOTO.map((f) => `- ${f.a.padEnd(40)} ${f.dove}`).join("\n")}
- logo-720.png                             Logo
Sono le foto vere del centro, solo convertite in JPG. Il listino stampato non c'è: riporta ancora la laminazione
sopracciglia a 30 €, mentre il prezzo di oggi è quello del sito. Più avanti aggiungi foto nuove ogni tanto
(ingresso di giorno, una cabina, un dettaglio): le schede con foto recenti compaiono più spesso.

================================================================================================================
5. VERIFICA
================================================================================================================
Google sceglie il metodo: videochiamata, video registrato, SMS, email o cartolina.
Per il video (il più comune), in un'unica ripresa senza tagli:
- fuori: l'insegna, il numero civico e la via (${via});
- dentro: le cabine, la postazione pedicure, gli strumenti;
- una prova che il centro è tuo: apri la porta con le chiavi, oppure mostra il registratore di cassa o un documento
  dell'attività.
Finché la verifica non è finita, la scheda non compare a tutti.

================================================================================================================
6. DOPO LA VERIFICA: MANDA A CLAUDE IL LINK DELLA SCHEDA
================================================================================================================
Nella scheda: «Condividi profilo» → copia il link. Incollalo in chat. Il sito lo usa subito:
- il pulsante «Apri in Google Maps» porta alla scheda, con recensioni e indicazioni;
- i dati per Google del sito (JSON-LD) puntano alla scheda, così Google collega sito e scheda.

================================================================================================================
7. RECENSIONI
================================================================================================================
Dalla scheda: «Chiedi recensioni» → copia il link e mandalo su WhatsApp alle clienti dopo il trattamento.
Solo recensioni vere: niente recensioni scritte da te, da amici in cambio di sconti, o comprate (Google le toglie
e può sospendere la scheda). Rispondi a tutte, anche alle negative, con calma e senza dati personali.
`;

// ---------------------------------------------------------------- kit

rmSync(KIT, { recursive: true, force: true });
rmSync(ZIP, { force: true });
mkdirSync(join(KIT, "foto"), { recursive: true });
writeFileSync(join(KIT, "SCHEDA-GOOGLE.txt"), testo);

const ORIGINALI = join(STUDIO, "originali");
for (const f of FOTO) {
  const destinazione = join(KIT, "foto", f.a);
  await sharp(join(ORIGINALI, "foto", f.da)).flatten({ background: "#ffffff" }).jpeg({ quality: 88, mozjpeg: true }).toFile(destinazione);
  const { width, height, size } = await sharp(destinazione).metadata().then(async (m) => ({ ...m, size: readFileSync(destinazione).length }));
  if (width < 720 || height < 720 || size > 5 * 1024 * 1024) throw new Error(`${f.a}: ${width}×${height}, ${size} byte (Google vuole almeno 720×720 e al massimo 5 MB)`);
  console.log(`✔ foto/${f.a}  ${width}×${height}  ${Math.round(size / 1024)} KB`);
}

// Logo: il file originale su fondo sabbia, al centro di un quadrato dello stesso colore. Il logo non si tocca.
const logo = sharp(join(ORIGINALI, "logo", "logo-sabbia.png"));
const { width: lw, height: lh } = await logo.metadata();
const lato = 720;
const scala = Math.min(1, (lato * 0.86) / Math.max(lw, lh));
const [w, h] = [Math.round(lw * scala), Math.round(lh * scala)];
const ridotto = await logo.resize(w, h).png().toBuffer();
await sharp({ create: { width: lato, height: lato, channels: 3, background: "#F4DBCA" } })
  .composite([{ input: ridotto, left: Math.round((lato - w) / 2), top: Math.round((lato - h) / 2) }])
  .png()
  .toFile(join(KIT, "foto", "logo-720.png"));
console.log(`✔ foto/logo-720.png  ${lato}×${lato}`);

execFileSync("zip", ["-qr", ZIP, "scheda-google"], { cwd: USCITA });
console.log(`✔ ${ZIP.slice(RADICE.length + 1)}`);
console.log(`✔ ${join(KIT, "SCHEDA-GOOGLE.txt").slice(RADICE.length + 1)} (descrizione: ${descrizione.length}/750 caratteri)`);

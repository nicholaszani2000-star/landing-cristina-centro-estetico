// build.mjs — genera dist/ da content/ e src/ (CLAUDE.md §4).
// Nessuna dipendenza esterna: solo moduli integrati di Node.
//
// Uso:  node build.mjs               → dist/
//       node build.mjs --dist <dir>  → un'altra cartella (usato dai controlli)
// Variabile d'ambiente URL (la imposta Netlify): indirizzo principale del sito,
// serve per canonical, og:url, og:image, JSON-LD e sitemap. Se manca si usa
// l'indirizzo principale di content/centro.json (https://www.esteticamigliore.it).
//
// Motore di template, modalità severa:
//   {{chiave.annidata}}      testo con escape HTML (null o mancante = errore)
//   {{{chiave}}}             HTML già sicuro: solo JSON-LD e SVG interni
//   {{> parte}}              src/templates/parti/parte.html
//   {{#se chiave}}…{{altrimenti}}…{{/se}}   ({{#se !chiave}} per la negazione)
//   {{#ogni lista}}…{{/ogni}}  dentro: {{.}}, {{@indice}}, {{@numero}}, {{#se @ultimo}}
// Immagini: src/img/ e src/img/immagini.json li genera studio/esporta-immagini.mjs; il <picture> lo scrive
// l'helper immagine() e il template lo stampa con {{{immagini.nome}}}.
// Nei testi di content/testi.json i segnaposto {chiave} si riempiono con
// content/centro.json; se il dato vale null l'intera frase diventa null.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = dirname(fileURLToPath(import.meta.url));
const SRC = join(RADICE, "src");
const TEMPLATES = join(SRC, "templates");
const PARTI = join(TEMPLATES, "parti");
const ICONE = join(TEMPLATES, "icone");
const NBSP = " ";
const FASCIA_PREZZO = "€€"; // §4: priceRange del JSON-LD
const CHIAVI_VOCE = new Set(["nome", "prezzo", "da", "a", "supplemento", "prezzi"]);
const MANIFESTO = "src/img/immagini.json";
// Larghezze a schermo del logo (sizes): altezza del token --logo-altezza (64 px, 80 px da 1024 px) e
// --logo-piede-altezza (56 px) per le proporzioni del logo 624×508.
const SIZES_LOGO_TESTATA = "(min-width: 1024px) 99px, 79px";
const SIZES_LOGO_PIEDE = "69px";
// Foto 02 (orizzontale, «Dove siamo»): a tutta larghezza fino a 767 px, intera nel contenitore fino a 1023 px,
// colonna di 7/12 (~620 px) da 1024 px.
const SIZES_FOTO_DOVE = "(min-width: 1024px) 620px, (min-width: 768px) calc(100vw - 40px), 100vw";
// Foto delle sezioni (03 viso, 05 pedicure, 04 chi sono): a tutta larghezza fino a 767 px, cornice di 520 px
// tra 768 e 1023 px, colonna di 5/12 (~440 px) da 1024 px.
const SIZES_FOTO_SEZIONE = "(min-width: 1024px) 440px, (min-width: 768px) 520px, 100vw";
// Foto 01 dell'apertura: a tutta larghezza fino a 767 px, cornice di 520 px tra 768 e 1023 px,
// colonna destra (~480 px) da 1024 px.
const SIZES_FOTO_APERTURA = "(min-width: 1024px) 480px, (min-width: 768px) 520px, 100vw";
// Listino stampato (foto 06): il link «Vedi il listino stampato» apre il WebP a questa larghezza (§9: ≤ 300 KB).
const LARGHEZZA_STAMPATO = 1536;
// Tracciamenti (Step 8): ID finti per TEST_TRACCIAMENTI=1, solo per i controlli; mai in produzione.
const ID_PROVA = { ga4Id: "G-TEST000000", metaPixelId: "000000000000000" };
const FORMATO_ID = { ga4Id: /^G-[A-Z0-9]{6,12}$/, metaPixelId: /^\d{15,16}$/ };
// Modulo del codice sconto: la Netlify Function netlify/functions/codice-sconto.mjs (config.path).
const AZIONE_CODICE = "/api/codice-sconto";
// Sitemap: le pagine della landing prima, le pagine legali con priorità bassa; la 404 è esclusa.
const PRIORITA_LANDING = "1.0";
const PRIORITA_LEGALI = "0.3";

export class ErroreBuild extends Error {}
const errore = (dove, messaggio) => {
  throw new ErroreBuild(`${dove}: ${messaggio}`);
};
const rel = (p) => relative(RADICE, p).split(sep).join("/");

// ---------------------------------------------------------------- dati

/** Cerca «a.b.c» in un oggetto. Un passaggio su null restituisce null. */
export function ottieni(oggetto, percorso) {
  let valore = oggetto;
  for (const parte of percorso.split(".")) {
    if (valore === null) return { trovato: true, valore: null };
    if (typeof valore !== "object" || !(parte in valore)) return { trovato: false };
    valore = valore[parte];
  }
  return { trovato: true, valore };
}

const SEGNAPOSTO = /\{([A-Za-z]\w*(?:\.\w+)*)\}/g;

/** Riempie i segnaposto {chiave} di un testo. Dato null → l'intero testo vale null. */
export function componi(testo, dati, dove) {
  let nullo = false;
  const risultato = testo.replace(SEGNAPOSTO, (_, chiave) => {
    const r = ottieni(dati, chiave);
    if (!r.trovato) errore(dove, `segnaposto {${chiave}} sconosciuto (non esiste in content/centro.json)`);
    if (r.valore === null || r.valore === undefined) {
      nullo = true;
      return "";
    }
    if (typeof r.valore === "object") errore(dove, `segnaposto {${chiave}} non è un testo`);
    return String(r.valore);
  });
  if (nullo) return null;
  if (/[{}]/.test(risultato)) errore(dove, `graffa isolata o segnaposto non valido in «${testo}»`);
  return risultato;
}

// Nei titoli (chiavi h1 e h2) le parole brevi si legano alla parola che segue con uno spazio non
// separabile: niente «a» o «e» appese in fondo alla riga. Il testo in testi.json non cambia.
const PAROLE_BREVI = /(^|\s)(a|e|ed|i|o|di|da|in|su|con|per|tra|fra|il|lo|la|gli|le|un|uno|una|al|allo|alla|ai|agli|alle|del|della|nel|nella) (?=\S)/giu;
export const legaParoleBrevi = (testo) => testo.replace(PAROLE_BREVI, (_, prima, parola) => `${prima}${parola}${NBSP}`);

/** Nei testi visibili il numero di telefono non va mai a capo: spazi non separabili al suo interno. */
function numeroUnito(valore, numero) {
  if (typeof valore === "string") return valore.split(numero).join(numero.replace(/ /g, NBSP));
  if (Array.isArray(valore)) return valore.map((v) => numeroUnito(v, numero));
  if (valore && typeof valore === "object") return Object.fromEntries(Object.entries(valore).map(([k, v]) => [k, numeroUnito(v, numero)]));
  return valore;
}

function componiTutto(valore, dati, dove) {
  if (typeof valore === "string") return componi(valore, dati, dove);
  if (Array.isArray(valore)) return valore.map((v, i) => componiTutto(v, dati, `${dove}[${i}]`));
  if (valore && typeof valore === "object") {
    const uscita = {};
    for (const [chiave, v] of Object.entries(valore)) {
      if (chiave.startsWith("_")) continue;
      const composto = componiTutto(v, dati, `${dove}.${chiave}`);
      uscita[chiave] = (chiave === "h1" || chiave === "h2") && typeof composto === "string" ? legaParoleBrevi(composto) : composto;
    }
    return uscita;
  }
  return valore;
}

// ---------------------------------------------------------------- sezione viso

const NUMERI = { una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6 };

/** Al massimo n frasi, prese così come sono (si accorcia, non si aggiunge nulla). */
export function limitaFrasi(testo, n) {
  const frasi = testo.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [testo];
  return frasi.length <= n ? testo : frasi.slice(0, n).join("").trim();
}

/** «… in tre fasi: A, B e C. Seguito» → { prima: "… in tre fasi:", fasi: [A, B, C], dopo: "Seguito" }.
 *  Le fasi restano parole del testo originale; con più di 3 fasi o senza elenco restituisce null. */
export function estraiFasi(testo) {
  const m = testo.match(/^([\s\S]*?\bin (\w+) fasi:)\s*([^.]+)\.(?:\s+([\s\S]+))?$/);
  if (!m) return null;
  const n = NUMERI[m[2].toLowerCase()] ?? Number(m[2]);
  if (!Number.isInteger(n) || n < 2 || n > 3) return null;
  const elenco = m[3];
  const separatori = [...elenco.matchAll(/, | e /g)].slice(0, n - 1);
  if (separatori.length < n - 1) return null;
  const fasi = [];
  let da = 0;
  for (const sep of separatori) {
    fasi.push(elenco.slice(da, sep.index).trim());
    da = sep.index + sep[0].length;
  }
  fasi.push(elenco.slice(da).trim());
  return { prima: m[1].trim(), fasi, dopo: m[4]?.trim() || null };
}

/** Voci della sezione viso: nomi presi da listino.json, la voce in evidenza per prima, descrizioni dai
 *  dettagli (solo per nomi che coincidono con il listino), fasi della voce in evidenza in elenco. Nel brief la
 *  descrizione segue i due punti («Nome: descrizione»), quindi è minuscola; in pagina sta sotto il titolo, in
 *  un paragrafo a sé, e comincia con la maiuscola (le fasi restano minuscole: continuano «in tre fasi:»). */
export function sezioneViso({ listino, centro, dettagli }) {
  const dove = "content/centro.json › trattamenti.viso";
  const avvisi = [];
  const viso = centro.trattamenti.viso;
  const delListino = new Map(listino.categorie.flatMap((c) => c.voci.map((v) => [v.nome, v])));
  if (!Array.isArray(viso.voci) || viso.voci.length === 0) errore(dove, "«voci» deve elencare le voci viso del listino");
  for (const nome of viso.voci) if (!delListino.has(nome)) errore(dove, `la voce «${nome}» non esiste in content/listino.json`);
  if (viso.inEvidenza !== null && !viso.voci.includes(viso.inEvidenza)) errore(dove, `inEvidenza «${viso.inEvidenza}» non è tra le voci`);
  const mappa = dettagli ?? {};
  for (const nome of Object.keys(mappa)) {
    if (!viso.voci.includes(nome)) avvisi.push(`dettaglio viso ignorato: «${nome}» non coincide con una voce del listino`);
  }
  const ordine = viso.inEvidenza ? [viso.inEvidenza, ...viso.voci.filter((n) => n !== viso.inEvidenza)] : viso.voci;
  const voci = ordine.map((nome) => {
    const inEvidenza = nome === viso.inEvidenza;
    const intero = typeof mappa[nome] === "string" && mappa[nome].trim() ? mappa[nome].trim() : null;
    const breve = intero ? limitaFrasi(intero, inEvidenza ? 3 : 2) : null;
    if (breve !== intero) avvisi.push(`descrizione di «${nome}» accorciata a ${inEvidenza ? 3 : 2} frasi`);
    const fasi = inEvidenza && breve ? estraiFasi(breve) : null;
    return {
      nome: delListino.get(nome).nome,
      inEvidenza,
      descrizione: fasi ? maiuscola(fasi.prima) : breve && maiuscola(breve),
      fasi: fasi ? fasi.fasi : null,
      seguito: fasi ? fasi.dopo : null,
    };
  });
  const cabina = [viso.macchinari, viso.prodotti].filter((v) => typeof v === "string" && v.trim()).join(", ") || null;
  return { voci, cabina, avvisi };
}

// ---------------------------------------------------------------- sezione pedicure

// «50–55»: niente a capo dentro un intervallo di numeri (word joiner invisibile attorno al trattino).
export const intervalliUniti = (testo) => testo.replace(/(\d)\s*([–-])\s*(\d)/g, "$1\u2060$2\u2060$3");
const maiuscola = (testo) => testo.charAt(0).toLocaleUpperCase("it-IT") + testo.slice(1);

/** «pediluvio; taglio e limatura delle unghie; …» → ["Pediluvio", "Taglio e limatura delle unghie", …]. */
export function vociInclude(testo) {
  if (typeof testo !== "string" || !testo.trim()) return null;
  return testo.split(";").map((v) => v.trim()).filter(Boolean).map(maiuscola);
}

/** Le due schede del confronto: titoli e durate da testi.json, voci «include» da centro.json. */
export function sezionePedicure({ centro, t }) {
  const dati = centro.trattamenti.pedicure;
  const scheda = (chiave, testiScheda, classe) => ({
    classe,
    titolo: testiScheda.titolo,
    sottotitolo: testiScheda.sottotitolo,
    voci: vociInclude(dati[chiave]?.include),
    durata: testiScheda.durata && intervalliUniti(testiScheda.durata), // null se la durata non è indicata
  });
  return {
    schede: [
      scheda("estetico", t.pedicure.scheda1, "scheda-estetico"),
      scheda("avanzato", t.pedicure.scheda2, "scheda-avanzato"),
    ],
  };
}

// ---------------------------------------------------------------- prezzi

const numeroIt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const euro = (n) => `${numeroIt.format(n)}${NBSP}€`;

/** L'unico punto in cui si scrivono i prezzi: «15 €», «da 30 a 40 €», «da 60 €», «+ 5 €», «20 € / 25 €». */
export function formattaPrezzo(voce) {
  const dove = `content/listino.json «${voce?.nome ?? "?"}»`;
  for (const chiave of Object.keys(voce)) {
    if (!CHIAVI_VOCE.has(chiave)) errore(dove, `chiave «${chiave}» non prevista`);
  }
  const forme = ["prezzo", "da", "supplemento", "prezzi"].filter((k) => k in voce);
  if (forme.length !== 1) {
    errore(dove, `serve una sola forma di prezzo tra prezzo, da/a, supplemento, prezzi (trovate: ${forme.join(", ") || "nessuna"})`);
  }
  if ("a" in voce && !("da" in voce)) errore(dove, "«a» senza «da»");
  const num = (n) => {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) errore(dove, `prezzo non valido: ${JSON.stringify(n)}`);
    return n;
  };
  if ("prezzo" in voce) return euro(num(voce.prezzo));
  if ("supplemento" in voce) return `+${NBSP}${euro(num(voce.supplemento))}`;
  if ("prezzi" in voce) {
    if (!Array.isArray(voce.prezzi) || voce.prezzi.length < 2) errore(dove, "«prezzi» vuole almeno due numeri");
    return voce.prezzi.map((n) => euro(num(n))).join(" / ");
  }
  if ("a" in voce) {
    if (num(voce.a) <= num(voce.da)) errore(dove, "«a» deve essere maggiore di «da»");
    return `da ${numeroIt.format(voce.da)} a ${euro(voce.a)}`;
  }
  return `da ${euro(num(voce.da))}`;
}

// ---------------------------------------------------------------- listino

/** Categorie del listino per la sezione 9: ordine di listino.json, prezzi scritti solo da formattaPrezzo(),
 *  conteggio delle voci con le parole di testi.json. «aperta» la decide ogni pagina (§6). */
export function sezioneListino({ listino, t }) {
  return listino.categorie.map((c) => ({
    id: c.id,
    titolo: c.titolo,
    conteggio: `${c.voci.length} ${c.voci.length === 1 ? t.listino.voce : t.listino.voci}`,
    voci: c.voci.map((v) => ({ nome: v.nome, prezzo: formattaPrezzo(v) })),
  }));
}

// ---------------------------------------------------------------- pagine legali

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** «2 novembre 2026» → «2026-11-02» (per <time datetime>). Una data non valida ferma la build. */
export function dataIso(testo, dove = "content/testi.json › legale.aggiornamento") {
  const m = String(testo ?? "").trim().match(/^(\d{1,2}) (\p{L}+) (\d{4})$/u);
  const mese = m ? MESI.indexOf(m[2].toLowerCase()) + 1 : 0;
  const giorno = m ? Number(m[1]) : 0;
  const data = m && mese ? new Date(Date.UTC(Number(m[3]), mese - 1, giorno)) : null;
  if (!data || data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) {
    errore(dove, `data non valida «${testo}»: scrivila come «2 novembre 2026»`);
  }
  return `${m[3]}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/** Dati delle pagine privacy e cookie. Le voci di testi.json con «richiede» compaiono solo se quell'integrazione
 *  di centro.json è indicata («tracciamenti» = GA4 o pixel Meta); «inAttivazione» dell'integrazione aggiunge
 *  «in attivazione». Il riquadro «Bozza» compare in ogni contesto, produzione compresa, finché testi.json ›
 *  legale.verificata non è true: si mette true solo quando la titolare scrive «privacy verificata» (Step 9).
 *  La data di ultimo aggiornamento è fissa (testi.json › legale.aggiornamento, §10): non dipende dal giorno
 *  della build. */
export function datiLegali({ centro, t, aggiornamento, verificata = false }) {
  const integrazioni = centro.integrazioni ?? {};
  const tracciamenti = Boolean(integrazioni.ga4Id || integrazioni.metaPixelId);
  const attiva = (chiave, dove) => {
    if (chiave === null || chiave === undefined) return true;
    if (chiave === "tracciamenti") return tracciamenti;
    if (!(chiave in integrazioni)) errore(dove, `«richiede»: integrazione «${chiave}» inesistente in content/centro.json`);
    return Boolean(integrazioni[chiave]);
  };
  const filtra = (lista, dove) =>
    lista
      .filter((voce) => attiva(voce.richiede, dove))
      .map(({ richiede, ...resto }) => ({ ...resto, inAttivazione: Boolean(richiede && integrazioni[richiede]?.inAttivazione) }));
  return {
    bozza: verificata !== true,
    data: aggiornamento,
    dataIso: dataIso(aggiornamento),
    sede: centro.legale.sedeLegale ?? centro.indirizzo.completo,
    tracciamenti,
    trattamenti: filtra(t.privacy.trattamenti.voci, "content/testi.json › privacy.trattamenti"),
    fornitori: filtra(t.privacy.fornitori.voci, "content/testi.json › privacy.fornitori"),
    cookie: filtra(t.cookie.elenco, "content/testi.json › cookie.elenco"),
  };
}

// ---------------------------------------------------------------- tracciamenti e codice sconto

/** ID di GA4 e del pixel Meta da centro.json (o finti con TEST_TRACCIAMENTI=1). Senza ID: niente banner,
 *  niente consenso.js, niente «Preferenze cookie» (§10). */
export function datiTracciamenti(centro, ambiente = process.env, avvisi = []) {
  const integrazioni = { ...(centro.integrazioni ?? {}) };
  if (ambiente.TEST_TRACCIAMENTI === "1") {
    if (ambiente.CONTEXT === "production") errore("TEST_TRACCIAMENTI", "vietato con CONTEXT=production: gli ID finti non vanno mai online");
    Object.assign(integrazioni, ID_PROVA);
    avvisi.push(`TEST_TRACCIAMENTI=1: ID finti ${ID_PROVA.ga4Id} e ${ID_PROVA.metaPixelId} (solo per i controlli)`);
  }
  for (const [chiave, formato] of Object.entries(FORMATO_ID)) {
    const valore = integrazioni[chiave];
    if (valore !== null && valore !== undefined && !formato.test(String(valore))) {
      errore("content/centro.json", `integrazioni.${chiave} «${valore}» non ha il formato atteso`);
    }
  }
  const ga4Id = integrazioni.ga4Id || null;
  const metaPixelId = integrazioni.metaPixelId ? String(integrazioni.metaPixelId) : null;
  return { integrazioni, tracciamenti: { attivo: Boolean(ga4Id || metaPixelId), ga4Id, metaPixelId } };
}

/** Testo del consenso diviso attorno a «informativa privacy», che diventa il link a /privacy/. */
export function consensoConLink(consenso, testoLink, dove = "content/testi.json › codiceSconto.consenso") {
  const parti = consenso.split(testoLink);
  if (parti.length !== 2) errore(dove, `«${testoLink}» deve comparire una volta sola nel testo del consenso`);
  return { consensoPrima: parti[0], consensoLink: testoLink, consensoDopo: parti[1] };
}

// ---------------------------------------------------------------- template

const TOKEN = /\{\{\{\s*([^{}]*?)\s*\}\}\}|\{\{\s*([^{}]*?)\s*\}\}/g;
const PERCORSO = /^(?:\.|@?[A-Za-z]\w*(?:\.\w+)*)$/;

function rigaDi(sorgente, indice) {
  let riga = 1;
  for (let i = 0; i < indice; i++) if (sorgente.charCodeAt(i) === 10) riga++;
  return riga;
}

/** Trasforma un template in un albero di nodi. Errori con file e riga. */
export function compila(sorgente, file) {
  const radice = { tipo: "radice", figli: [] };
  radice.ramo = radice.figli;
  const pila = [radice];
  let ultimo = 0;

  const aggiungiTesto = (testo, inizio) => {
    const i = Math.max(testo.indexOf("{{"), testo.indexOf("}}"));
    if (i >= 0) errore(`${file}:${rigaDi(sorgente, inizio + i)}`, "«{{» o «}}» senza tag valido");
    if (testo) pila.at(-1).ramo.push({ tipo: "testo", valore: testo });
  };

  for (const m of sorgente.matchAll(TOKEN)) {
    aggiungiTesto(sorgente.slice(ultimo, m.index), ultimo);
    ultimo = m.index + m[0].length;
    const dove = `${file}:${rigaDi(sorgente, m.index)}`;
    const cima = pila.at(-1);

    if (m[1] !== undefined) {
      if (!PERCORSO.test(m[1])) errore(dove, `chiave non valida in «${m[0]}»`);
      cima.ramo.push({ tipo: "grezzo", percorso: m[1], dove });
      continue;
    }
    const corpo = m[2];
    let r;
    if ((r = corpo.match(/^>\s*([\w-]+)$/))) {
      cima.ramo.push({ tipo: "parte", nome: r[1], dove });
    } else if ((r = corpo.match(/^#(se|ogni)\s+(!?)(\S+)$/))) {
      if (!PERCORSO.test(r[3]) || (r[2] && r[1] !== "se")) errore(dove, `chiave non valida in «${m[0]}»`);
      const nodo = { tipo: r[1], percorso: r[3], nega: r[2] === "!", dove, figli: [], altrimenti: [] };
      nodo.ramo = nodo.figli;
      cima.ramo.push(nodo);
      pila.push(nodo);
    } else if (corpo === "altrimenti") {
      if (cima.tipo !== "se" || cima.ramo === cima.altrimenti) errore(dove, "{{altrimenti}} fuori posto (vale solo una volta dentro {{#se}})");
      cima.ramo = cima.altrimenti;
    } else if ((r = corpo.match(/^\/(se|ogni)$/))) {
      if (cima.tipo !== r[1]) {
        const aperto = cima.tipo === "radice" ? "nessun blocco aperto" : `aperto {{#${cima.tipo}}} a ${cima.dove}`;
        errore(dove, `{{/${r[1]}}} non corrisponde (${aperto})`);
      }
      pila.pop();
    } else if (PERCORSO.test(corpo)) {
      cima.ramo.push({ tipo: "valore", percorso: corpo, dove });
    } else {
      errore(dove, `sintassi non riconosciuta: «${m[0]}»`);
    }
  }
  aggiungiTesto(sorgente.slice(ultimo), ultimo);
  if (pila.length > 1) errore(pila.at(-1).dove, `{{#${pila.at(-1).tipo}}} non chiuso`);
  return radice;
}

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESCAPE[c]);
const vero = (v) => v !== null && v !== undefined && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0);

function risolvi(percorso, ambito, dove) {
  if (percorso === ".") return ambito.corrente;
  if (percorso.startsWith("@")) {
    const chiave = percorso.slice(1);
    if (!ambito.giro || !(chiave in ambito.giro)) errore(dove, `«${percorso}» si usa solo dentro {{#ogni}}`);
    return ambito.giro[chiave];
  }
  const primo = percorso.split(".")[0];
  for (let i = ambito.livelli.length - 1; i >= 0; i--) {
    const livello = ambito.livelli[i];
    if (livello && typeof livello === "object" && primo in livello) {
      const r = ottieni(livello, percorso);
      if (!r.trovato) errore(dove, `chiave «${percorso}» mancante`);
      return r.valore;
    }
  }
  errore(dove, `chiave «${percorso}» mancante`);
}

function stampabile(valore, percorso, dove) {
  if (valore === null || valore === undefined) {
    errore(dove, `chiave «${percorso}» vale null: per un dato facoltativo usa {{#se ${percorso}}}`);
  }
  if (typeof valore === "number") return String(valore);
  if (typeof valore !== "string") errore(dove, `chiave «${percorso}» non è un testo`);
  return valore;
}

/** Carica le parti da disco (con cache) e rende i template. */
export class Motore {
  constructor({ cartellaParti = PARTI, parti = null } = {}) {
    this.cartellaParti = cartellaParti;
    this.parti = parti; // per i test: { nome: "sorgente" }
    this.cache = new Map();
  }

  parte(nome, dove) {
    if (!this.cache.has(nome)) {
      let sorgente;
      let file;
      if (this.parti) {
        if (!(nome in this.parti)) errore(dove, `parte «${nome}» inesistente`);
        sorgente = this.parti[nome];
        file = `parti/${nome}.html`;
      } else {
        const percorso = join(this.cartellaParti, `${nome}.html`);
        if (!existsSync(percorso)) errore(dove, `parte «${nome}» inesistente (${rel(percorso)})`);
        sorgente = readFileSync(percorso, "utf8");
        file = rel(percorso);
      }
      this.cache.set(nome, compila(sorgente, file));
    }
    return this.cache.get(nome);
  }

  rendi(sorgente, contesto, file) {
    return this.#nodi(compila(sorgente, file).figli, { livelli: [contesto], corrente: contesto, giro: null }, 0);
  }

  #nodi(nodi, ambito, profondita) {
    let uscita = "";
    for (const nodo of nodi) uscita += this.#nodo(nodo, ambito, profondita);
    return uscita;
  }

  #nodo(nodo, ambito, profondita) {
    switch (nodo.tipo) {
      case "testo":
        return nodo.valore;
      case "valore":
        return escapeHtml(stampabile(risolvi(nodo.percorso, ambito, nodo.dove), nodo.percorso, nodo.dove));
      case "grezzo":
        return stampabile(risolvi(nodo.percorso, ambito, nodo.dove), nodo.percorso, nodo.dove);
      case "parte":
        if (profondita > 20) errore(nodo.dove, `parti annidate troppo a fondo (ciclo con «${nodo.nome}»?)`);
        return this.#nodi(this.parte(nodo.nome, nodo.dove).figli, ambito, profondita + 1);
      case "se":
        return this.#nodi(vero(risolvi(nodo.percorso, ambito, nodo.dove)) !== nodo.nega ? nodo.figli : nodo.altrimenti, ambito, profondita);
      case "ogni": {
        const lista = risolvi(nodo.percorso, ambito, nodo.dove);
        if (lista === null) return "";
        if (!Array.isArray(lista)) errore(nodo.dove, `«${nodo.percorso}» non è una lista`);
        return lista
          .map((elemento, i) =>
            this.#nodi(
              nodo.figli,
              {
                livelli: [...ambito.livelli, elemento],
                corrente: elemento,
                giro: { indice: i, numero: i + 1, primo: i === 0, ultimo: i === lista.length - 1 },
              },
              profondita,
            ),
          )
          .join("");
      }
      default:
        throw new Error(`nodo sconosciuto: ${nodo.tipo}`);
    }
  }
}

// ---------------------------------------------------------------- orari e JSON-LD

const GIORNI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
const GIORNI_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const senzaAccenti = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** «dal lunedì al sabato» → ["Monday", …, "Saturday"]; null se non si ricava senza ambiguità. */
export function ricavaGiorni(testo) {
  const m = senzaAccenti(String(testo ?? "")).trim().match(/^dal\s+(\S+)\s+al\s+(\S+)$/);
  if (!m) return null;
  const inizio = GIORNI.map(senzaAccenti).indexOf(m[1]);
  const fine = GIORNI.map(senzaAccenti).indexOf(m[2]);
  if (inizio < 0 || fine < 0 || fine < inizio) return null;
  return GIORNI_SCHEMA.slice(inizio, fine + 1);
}

/** Link «Apri in Google Maps»: la scheda Google se è indicata, altrimenti la ricerca dell'indirizzo. */
export function linkMappa(centro) {
  if (centro.social?.schedaGoogle) return centro.social.schedaGoogle;
  const { via, cap, comune, provincia } = centro.indirizzo;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${via}, ${cap} ${comune} ${provincia}`)}`;
}

function jsonLd(centro, base, immagineAssoluta, avvisi) {
  const dati = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: centro.nome,
    telephone: centro.telefonoE164,
    email: centro.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: centro.indirizzo.via,
      postalCode: centro.indirizzo.cap,
      addressLocality: centro.indirizzo.comune,
      addressRegion: centro.indirizzo.provincia,
      addressCountry: centro.indirizzo.nazione,
    },
  };
  if (base) dati.url = `${base}/`;
  if (immagineAssoluta) dati.image = immagineAssoluta;
  dati.hasMap = linkMappa(centro);
  const social = ["instagram", "facebook"].map((k) => centro.social?.[k]).filter(Boolean);
  if (social.length) dati.sameAs = social;
  if (!immagineAssoluta) avvisi.push("JSON-LD senza image: serve un URL assoluto");
  const giorni = ricavaGiorni(centro.orari.giorni);
  if (giorni) {
    dati.openingHoursSpecification = [
      { "@type": "OpeningHoursSpecification", dayOfWeek: giorni, opens: centro.orari.apertura, closes: centro.orari.chiusura },
    ];
  } else {
    avvisi.push(`openingHoursSpecification omesso: giorni non ricavabili da «${centro.orari.giorni}»`);
  }
  dati.priceRange = FASCIA_PREZZO;
  return JSON.stringify(dati).replace(/</g, "\\u003c");
}

// ---------------------------------------------------------------- immagini

/** <picture> con <source> AVIF e WebP, srcset dalle larghezze esportate, <img> con width/height
 *  dell'originale e loading/decoding/fetchpriority come in §9. Restituisce HTML già sicuro. */
export function immagine(manifesto, nome, alt, sizes, { priorita = false } = {}) {
  const dove = `immagine «${nome}»`;
  const voce = manifesto?.immagini?.[nome];
  if (!voce?.larghezze?.length) errore(dove, `non esiste in ${MANIFESTO} (esegui node studio/esporta-immagini.mjs)`);
  if (typeof alt !== "string" || !alt.trim()) errore(dove, "alt mancante");
  if (typeof sizes !== "string" || !sizes.trim()) errore(dove, "sizes mancante");
  if (!voce.formati.includes("webp")) errore(dove, "manca la versione WebP");
  const url = (w, formato) => `/img/${nome}-${w}.${formato}`;
  const esiste = (u) => existsSync(join(SRC, ...u.split("/").filter(Boolean)));
  for (const formato of voce.formati) {
    for (const w of voce.larghezze) {
      if (!esiste(url(w, formato))) errore(dove, `file mancante: src${url(w, formato)}`);
      if (w > voce.larghezza) errore(dove, `${w} px supera l'originale (${voce.larghezza} px)`);
    }
  }
  const sorgenti = voce.formati.map(
    (formato) => `<source type="image/${formato}" srcset="${voce.larghezze.map((w) => `${url(w, formato)} ${w}w`).join(", ")}" sizes="${escapeHtml(sizes)}">`,
  );
  // <img> in WebP: la larghezza indicata dal manifesto (larghezzaImg), altrimenti la seconda della serie.
  const larghezzaImg = voce.larghezzaImg ?? voce.larghezze[Math.min(1, voce.larghezze.length - 1)];
  if (!voce.larghezze.includes(larghezzaImg)) errore(dove, `larghezzaImg ${larghezzaImg} non è tra le larghezze esportate`);
  const ripiego = url(larghezzaImg, "webp");
  const caricamento = priorita ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<picture>${sorgenti.join("")}<img src="${ripiego}" alt="${escapeHtml(alt)}" width="${voce.larghezza}" height="${voce.altezza}" ${caricamento}></picture>`;
}

/** Ogni /img/… citato in src, href o srcset deve esistere in dist/. */
function controllaImmagini(html, dist, dove) {
  const citati = [];
  for (const m of html.matchAll(/\s(?:src|href|content)="(\/img\/[^"?#]+)"/g)) citati.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) citati.push(...m[1].split(",").map((parte) => parte.trim().split(/\s+/)[0]));
  for (const u of citati) {
    if (u.startsWith("/img/") && !existsSync(join(dist, ...u.split("/").filter(Boolean)))) errore(dove, `immagine inesistente: ${u}`);
  }
}

// ---------------------------------------------------------------- risorse

async function elencaFile(cartella) {
  if (!existsSync(cartella)) return [];
  const uscita = [];
  for (const voce of await readdir(cartella, { withFileTypes: true })) {
    if (voce.name.startsWith(".")) continue;
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) uscita.push(...(await elencaFile(percorso)));
    else uscita.push(percorso);
  }
  return uscita;
}

const hash8 = (contenuto) => createHash("sha256").update(contenuto).digest("hex").slice(0, 8);

/** Minifica il CSS senza cambiarne il significato: toglie i commenti, comprime gli spazi e li toglie intorno a
 *  { } ; , e dopo i due punti; toglie l'ultimo ; di ogni blocco. Le stringhe tra virgolette restano intatte
 *  (data: URL, grid-template-areas, list-style-type). Gli spazi prima dei due punti e intorno a + - > ~ restano:
 *  servono ai selettori discendenti (.a :focus) e a calc(). */
export function minificaCss(css) {
  const stringhe = [];
  // Una sola passata da sinistra: un commento con un apostrofo non viene scambiato per una stringa.
  const protetto = css.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?\*\//g, (_, stringa) =>
    stringa ? `\u0000${stringhe.push(stringa) - 1}\u0000` : "",
  );
  const corto = protetto
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .replace(/:\s+/g, ":")
    .replace(/;}/g, "}")
    .trim();
  return corto.replace(/\u0000(\d+)\u0000/g, (_, i) => stringhe[Number(i)]);
}

/** Copia src/{fonts,img,js,css} in dist/ e restituisce gli hash per URL ("/css/base.css" → "1a2b3c4d"). */
async function copiaRisorse(dist, { escludi = [] } = {}) {
  const hash = new Map();
  const scrivi = async (sorgente, contenuto) => {
    const url = "/" + relative(SRC, sorgente).split(sep).join("/");
    const destinazione = join(dist, ...url.split("/"));
    await mkdir(dirname(destinazione), { recursive: true });
    await writeFile(destinazione, contenuto);
    hash.set(url, hash8(contenuto));
  };
  for (const cartella of ["fonts", "img", "js"]) {
    for (const file of await elencaFile(join(SRC, cartella))) {
      if (file === join(RADICE, MANIFESTO)) continue; // il manifesto serve alla build, non al sito
      if (escludi.includes(file)) continue;
      await scrivi(file, await readFile(file));
    }
  }
  for (const file of await elencaFile(join(SRC, "css"))) {
    const css = (await readFile(file, "utf8")).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (intero, virgolette, url) => {
      if (url.startsWith("data:")) return intero;
      if (!url.startsWith("/fonts/") && !url.startsWith("/img/")) errore(rel(file), `url() non ammesso: «${url}» (solo /fonts/, /img/ o data:)`);
      if (!hash.has(url)) errore(rel(file), `url(${url}): file inesistente in src/`);
      return url.startsWith("/fonts/") ? `url(${virgolette}${url}?v=${hash.get(url)}${virgolette})` : intero;
    });
    if (/@import/i.test(css)) errore(rel(file), "@import non ammesso");
    await scrivi(file, minificaCss(css));
  }
  return hash;
}

/** Aggiunge ?v=hash8 ai riferimenti a /css/, /js/ e /fonts/ nell'HTML. */
function versiona(html, hash, dove) {
  return html.replace(/(\s(?:href|src))="(\/(?:css|js|fonts)\/[^"?#]+)"/g, (_, attributo, url) => {
    if (!hash.has(url)) errore(dove, `riferimento a un file inesistente: ${url}`);
    return `${attributo}="${url}?v=${hash.get(url)}"`;
  });
}

// ---------------------------------------------------------------- pagine

async function leggiJson(percorso) {
  const file = join(RADICE, percorso);
  if (!existsSync(file)) errore(percorso, "file mancante");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    errore(percorso, `JSON non valido: ${e.message}`);
  }
}

function urlBase(centro, avvisi) {
  // L'indirizzo principale di centro.json deve stare sul dominio indicato (con o senza www).
  const principale = centro.indirizzoPrincipale?.trim() || "";
  if (principale) {
    const host = /^https:\/\/([^/\s]+)\/?$/.exec(principale)?.[1];
    if (!host || (centro.dominio && host !== centro.dominio && host !== `www.${centro.dominio}`)) {
      errore("content/centro.json", `indirizzoPrincipale «${principale}» non è https:// sul dominio «${centro.dominio}»`);
    }
  }
  const candidato = process.env.URL?.trim() || principale || (centro.dominio ? `https://${centro.dominio}` : "");
  if (!candidato) {
    avvisi.push("nessun URL assoluto (variabile URL, indirizzo principale e dominio assenti): canonical, og:url e sitemap omessi");
    return null;
  }
  if (!process.env.URL?.trim()) avvisi.push(`URL assoluti dall'indirizzo principale di centro.json: ${candidato}`);
  if (!/^https?:\/\/[^\s/]+/.test(candidato)) errore("URL", `indirizzo non valido: «${candidato}»`);
  return candidato.replace(/\/+$/, "");
}

function coloreTema() {
  const css = readFileSync(join(SRC, "css", "tokens.css"), "utf8");
  const m = css.match(/--sabbia\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/);
  if (!m) errore("src/css/tokens.css", "token --sabbia mancante (serve per theme-color)");
  return m[1];
}

async function caricaIcone() {
  const icone = {};
  for (const file of await elencaFile(ICONE)) {
    if (file.endsWith(".svg")) icone[file.slice(ICONE.length + 1, -4)] = (await readFile(file, "utf8")).trim();
  }
  return icone;
}

function validaListino(listino) {
  if (!Array.isArray(listino?.categorie)) errore("content/listino.json", "manca l'elenco «categorie»");
  const id = new Set();
  let voci = 0;
  for (const categoria of listino.categorie) {
    if (!categoria.id || !categoria.titolo || !Array.isArray(categoria.voci)) errore("content/listino.json", "ogni categoria vuole id, titolo e voci");
    if (id.has(categoria.id)) errore("content/listino.json", `id ripetuto: ${categoria.id}`);
    id.add(categoria.id);
    for (const voce of categoria.voci) {
      if (!voce.nome) errore(`content/listino.json «${categoria.id}»`, "voce senza nome");
      formattaPrezzo(voce);
      voci++;
    }
  }
  return { id, voci };
}

function waLink(numero, testo) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`;
}

function controllaUscita(html, dove) {
  const senzaJsonLd = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  if (html.includes("{{") || senzaJsonLd.includes("}}")) errore(dove, "nell'uscita è rimasto un «{{» o «}}»");
}

async function main() {
  const inizio = Date.now();
  const argomenti = process.argv.slice(2);
  const iDist = argomenti.indexOf("--dist");
  const dist = iDist >= 0 ? resolve(argomenti[iDist + 1] ?? "") : join(RADICE, "dist");
  const protette = [SRC, join(RADICE, "content"), join(RADICE, "studio"), join(RADICE, "netlify")];
  if (dist === RADICE || RADICE.startsWith(dist + sep) || protette.some((p) => dist === p || dist.startsWith(p + sep))) {
    errore("build", `cartella di uscita non valida: ${dist}`);
  }
  const avvisi = [];

  const centroFile = await leggiJson("content/centro.json");
  const { integrazioni, tracciamenti } = datiTracciamenti(centroFile, process.env, avvisi);
  const centro = { ...centroFile, integrazioni };
  const testi = await leggiJson("content/testi.json");
  const listino = await leggiJson("content/listino.json");
  const { id: categorie, voci } = validaListino(listino);

  const anno = new Date().getFullYear();
  // {cabina}: macchinari e prodotti indicati in centro.json (null se mancano entrambi: la riga non compare)
  const cabina = sezioneViso({ listino, centro, dettagli: null }).cabina;
  const datiTesti = { ...centro, anno, cabina };
  const t = numeroUnito(componiTutto(testi.comuni, datiTesti, "content/testi.json › comuni"), centro.telefono);
  const viso = sezioneViso({ listino, centro, dettagli: t.viso.dettagli });
  avvisi.push(...viso.avvisi);
  // La riga info va a capo solo tra un segmento e l'altro («Su appuntamento · dal lunedì al sabato · …»).
  t.apertura.rigaInfoSegmenti = t.apertura.rigaInfo.split(" · ");
  const base = urlBase(centro, avvisi);
  if (!existsSync(join(RADICE, MANIFESTO))) errore(MANIFESTO, "manca: esegui node studio/esporta-immagini.mjs");
  const manifesto = await leggiJson(MANIFESTO);
  const og = manifesto.immagini.og;
  const stampato = manifesto.immagini["listino-stampato"];
  if (!stampato?.larghezze?.includes(LARGHEZZA_STAMPATO) || !stampato.formati?.includes("webp")) {
    errore(MANIFESTO, `listino stampato a ${LARGHEZZA_STAMPATO} px in WebP mancante`);
  }
  const categorieListino = sezioneListino({ listino, t });
  const legali = datiLegali({ centro, t, aggiornamento: testi.legale?.aggiornamento, verificata: testi.legale?.verificata });
  if (!og?.file || !existsSync(join(SRC, "img", og.file))) errore(MANIFESTO, "immagine di condivisione mancante");
  const condivisione = {
    ogImage: base ? `${base}/img/${og.file}` : `/img/${og.file}`,
    ogImageWidth: og.larghezza,
    ogImageHeight: og.altezza,
    ogImageAlt: t.condivisione.ogImageAlt,
  };

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  const hash = await copiaRisorse(dist, { escludi: tracciamenti.attivo ? [] : [join(SRC, "js", "consenso.js")] });

  const motore = new Motore();
  const comune = {
    centro,
    t,
    anno: String(anno),
    icone: await caricaIcone(),
    immagini: {
      logoTestata: immagine(manifesto, "logo", t.header.logoAlt, SIZES_LOGO_TESTATA),
      logoPiede: immagine(manifesto, "logo", t.footer.logoAlt, SIZES_LOGO_PIEDE),
      fotoApertura: immagine(manifesto, "cristina-bancone", t.apertura.altFoto, SIZES_FOTO_APERTURA, { priorita: true }),
      fotoViso: immagine(manifesto, "cabina-viso", t.viso.altFoto, SIZES_FOTO_SEZIONE),
      fotoPedicure: immagine(manifesto, "postazione-pedicure", t.pedicure.altFoto, SIZES_FOTO_SEZIONE),
      fotoChiSono: immagine(manifesto, "cabina-lettino", t.chiSono.altFoto, SIZES_FOTO_SEZIONE),
      fotoDove: immagine(manifesto, "ingresso", t.doveSiamo.altFoto, SIZES_FOTO_DOVE),
    },
    contatti: {
      telefono: centro.telefono.replace(/ /g, NBSP), // spazi non separabili: il numero non va a capo
      email: centro.email,
      indirizzo: centro.indirizzo.completo,
    },
    tracciamenti,
    codice: { azione: AZIONE_CODICE, ...consensoConLink(t.codiceSconto.consenso, t.codiceSconto.consensoTestoLink) },
    script: { codice: false },
    viso: { voci: viso.voci },
    pedicure: sezionePedicure({ centro, t }),
    link: {
      home: "/",
      tel: `tel:${centro.telefonoE164}`,
      email: `mailto:${centro.email}`,
      whatsappGenerale: waLink(centro.whatsappNumero, testi.whatsapp.generale),
      whatsappViso: waLink(centro.whatsappNumero, testi.whatsapp.viso),
      whatsappPedicure: waLink(centro.whatsappNumero, testi.whatsapp.pedicure),
      listino: "#listino",
      listinoStampato: `/img/listino-stampato-${LARGHEZZA_STAMPATO}.webp`,
      garante: t.privacy.diritti.garanteUrl,
      maps: linkMappa(centro),
      privacy: "/privacy/",
      cookie: "/cookie/",
    },
  };
  const tema = coloreTema();
  const ld = jsonLd(centro, base, base ? condivisione.ogImage : null, avvisi);

  const scrivi = async (file, html) => {
    controllaUscita(html, file);
    controllaImmagini(html, dist, file);
    const destinazione = join(dist, file);
    await mkdir(dirname(destinazione), { recursive: true });
    const pulito = html.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
    await writeFile(destinazione, versiona(pulito, hash, file));
  };

  const sorgentePagina = await readFile(join(TEMPLATES, "pagina.html"), "utf8");
  const generate = [];
  for (const [id, grezza] of Object.entries(testi.pagine)) {
    const dove = `content/testi.json › pagine.${id}`;
    const p = componiTutto(grezza, datiTesti, dove);
    if (!/^\/([\w-]+\/)?$/.test(p.percorso)) errore(dove, `percorso non valido: «${p.percorso}»`);
    if ([...p.ordine].sort().join() !== "pedicure,viso") errore(dove, "«ordine» deve contenere viso e pedicure, una volta ciascuno");
    if (!(p.whatsapp in testi.whatsapp)) errore(dove, `testo WhatsApp «${p.whatsapp}» inesistente`);
    if (p.listinoAperto !== null && !categorie.has(p.listinoAperto)) errore(dove, `categoria «${p.listinoAperto}» inesistente nel listino`);
    p.visoPrima = p.ordine[0] === "viso";

    const contesto = {
      ...comune,
      p,
      link: { ...comune.link, whatsapp: waLink(centro.whatsappNumero, testi.whatsapp[p.whatsapp]) },
      listino: { categorie: categorieListino.map((c) => ({ ...c, aperta: c.id === p.listinoAperto })) },
      script: { codice: true },
      meta: {
        title: p.title,
        description: p.description,
        canonical: base ? base + p.percorso : null,
        robots: null,
        ...condivisione,
        themeColor: tema,
      },
      jsonld: ld,
    };
    const file = p.percorso === "/" ? "index.html" : `${p.percorso.slice(1)}index.html`;
    await scrivi(file, motore.rendi(sorgentePagina, contesto, "src/templates/pagina.html"));
    generate.push(p.percorso);
  }

  const contesto404 = {
    ...comune,
    link: { ...comune.link, whatsapp: comune.link.whatsappGenerale },
    meta: { title: t.pagina404.title, description: null, canonical: null, robots: "noindex", ...condivisione, themeColor: tema },
    jsonld: null,
  };
  await scrivi("404.html", motore.rendi(await readFile(join(TEMPLATES, "404.html"), "utf8"), contesto404, "src/templates/404.html"));

  // Pagine legali (§10): stesso layout della landing, testi da testi.json (privacy, cookie, legali).
  const pagineLegali = [];
  for (const [id, percorso] of [["privacy", comune.link.privacy], ["cookie", comune.link.cookie]]) {
    const doc = t[id];
    const contestoLegale = {
      ...comune,
      doc,
      legali,
      link: { ...comune.link, whatsapp: comune.link.whatsappGenerale },
      meta: { title: doc.title, description: doc.description, canonical: base ? base + percorso : null, robots: null, ...condivisione, themeColor: tema },
      jsonld: null,
    };
    const file = `${percorso.slice(1)}index.html`;
    await scrivi(file, motore.rendi(await readFile(join(TEMPLATES, `${id}.html`), "utf8"), contestoLegale, `src/templates/${id}.html`));
    pagineLegali.push(percorso);
  }

  await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ""}`);
  if (base) {
    const url = [...generate.map((p) => [p, PRIORITA_LANDING]), ...pagineLegali.map((p) => [p, PRIORITA_LEGALI])]
      .map(([p, priorita]) => `  <url><loc>${escapeHtml(base + p)}</loc><priority>${priorita}</priority></url>`)
      .join("\n");
    await writeFile(
      join(dist, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${url}\n</urlset>\n`,
    );
  }

  for (const avviso of avvisi) console.log(`  · ${avviso}`);
  console.log(
    `✔ build in ${Date.now() - inizio} ms → ${rel(dist) || dist}: ${[...generate, ...pagineLegali].join(", ")}, 404.html, robots.txt` +
      `${base ? ", sitemap.xml" : ""} · listino ${voci} voci · riquadro «Bozza» ${legali.bozza ? "sì" : "no (privacy verificata)"}` +
      ` · banner cookie ${tracciamenti.attivo ? "sì" : "no (nessun ID di GA4 o Meta)"}`,
  );
}

const eseguitoDirettamente = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (eseguitoDirettamente) {
  main().catch((e) => {
    console.error(e instanceof ErroreBuild ? `✘ build fallita — ${e.message}` : e);
    process.exit(1);
  });
}

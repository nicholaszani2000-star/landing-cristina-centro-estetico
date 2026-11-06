// netlify/functions/codice-sconto.mjs — POST /api/codice-sconto (CLAUDE.md §2.4, §4, §10).
//
// Riceve email e consenso (JSON o modulo HTML), genera il codice «MIG-XXXXXX» valido 30 giorni e:
//   - con SUPABASE_URL e SUPABASE_SECRET_KEY: lo salva con la funzione iscrivi_email (supabase/iscritti.sql);
//     la stessa email riceve sempre lo stesso codice;
//   - senza chiavi: «modalità prova», restituisce un codice valido e non salva nulla (prova: true).
// Risponde in JSON se la richiesta accetta application/json, altrimenti con una pagina HTML (senza JavaScript).
// Testo e versione del consenso vengono dal server (content/testi.json), mai dal browser.
// Nei log non compare mai l'email. Con BREVO_API_KEY e un mittente in centro.json (integrazioni.servizioEmail.mittente)
// il codice salvato arriva anche via email; emailInviata è true solo se Brevo ha accettato l'invio (§2.4).
// Con BREVO_API_KEY e integrazioni.servizioEmail.listaPromo l'email entra anche nella lista delle promo di Brevo.
// Documentazione Brevo: «Send a transactional email» (POST /v3/smtp/email, header api-key, un solo tipo di corpo)
// e «Create a contact» (POST /v3/contacts con listIds e updateEnabled).
// Documentazione: contesto ufficiale Netlify Functions (gestore, config con path/method/rateLimit, Netlify.env.get).

import { createHash } from "node:crypto";
import centro from "../../content/centro.json" with { type: "json" };
import testi from "../../content/testi.json" with { type: "json" };

export const config = {
  path: "/api/codice-sconto",
  method: ["POST"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 5 },
};

const env = (k) => globalThis.Netlify?.env.get(k) ?? process.env[k];
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 simboli: niente 0/O, 1/I
const TENTATIVI = 1 + 3; // il primo invio più 3 nuovi tentativi se il codice collide
const MAX_CORPO = 10_000;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]{2,}$/;

// ------------------------------------------------------------------ testi dal server

/** Gli stessi segnaposto di build.mjs: {nome}, {codiceSconto.frequenzaPromo}, … presi da centro.json. */
export function componi(testo) {
  return testo.replace(/\{([A-Za-z]\w*(?:\.\w+)*)\}/g, (_, chiave) => {
    const valore = chiave.split(".").reduce((o, k) => (o == null ? undefined : o[k]), centro);
    if (valore == null || typeof valore === "object") throw new Error(`segnaposto {${chiave}} non valido`);
    return String(valore);
  });
}
const T = testi.comuni.codiceSconto;
export const CONSENSO_TESTO = componi(T.consenso);
export const CONSENSO_VERSIONE = createHash("sha256").update(CONSENSO_TESTO).digest("hex").slice(0, 12);
const VALIDITA = Number(centro.codiceSconto.validitaGiorni);

// ------------------------------------------------------------------ codice e scadenza

export function nuovoCodice() {
  const byte = crypto.getRandomValues(new Uint8Array(6));
  return "MIG-" + Array.from(byte, (b) => ALFABETO[b % ALFABETO.length]).join(""); // 256 è multiplo di 32: nessuno sbilanciamento
}

/** Oggi nel fuso Europe/Rome + giorni di validità, come «AAAA-MM-GG». */
export function scadenzaDa(adesso = new Date(), giorni = VALIDITA) {
  const [a, m, g] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(adesso)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(a, m - 1, g + giorni)).toISOString().slice(0, 10);
}

export const dataItaliana = (iso) =>
  new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

// ------------------------------------------------------------------ richiesta

async function leggiCampi(req) {
  const tipo = (req.headers.get("content-type") ?? "").toLowerCase();
  const corpo = await req.text();
  if (corpo.length > MAX_CORPO) return null;
  if (tipo.startsWith("application/json")) {
    try {
      const dati = JSON.parse(corpo);
      return dati && typeof dati === "object" && !Array.isArray(dati) ? dati : null;
    } catch {
      return null;
    }
  }
  if (tipo.startsWith("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(corpo));
  return null;
}

const testo = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const vero = (v) => v === true || ["on", "true", "1", "si", "sì"].includes(String(v ?? "").toLowerCase());
/** Solo percorsi interni del sito («/viso/»): niente indirizzi esterni nel link di ritorno. */
const percorso = (v) => (/^\/(?!\/)[\w\-/]*$/.test(testo(v)) ? testo(v) : "/");

// ------------------------------------------------------------------ Supabase

async function iscrivi({ email, pagina, utm }) {
  const url = env("SUPABASE_URL");
  const chiave = env("SUPABASE_SECRET_KEY");
  if (!url || !chiave) return { codice: nuovoCodice(), scadenza: scadenzaDa(), nuovo: true, prova: true };

  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    const risposta = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/iscrivi_email`, {
      method: "POST",
      headers: { apikey: chiave, Authorization: `Bearer ${chiave}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_email: email,
        p_codice: nuovoCodice(),
        p_scadenza: scadenzaDa(),
        p_consenso_testo: CONSENSO_TESTO,
        p_consenso_versione: CONSENSO_VERSIONE,
        p_pagina: pagina,
        p_utm: utm,
      }),
    });
    if (risposta.ok) {
      const [riga] = await risposta.json();
      if (!riga?.codice) throw new Error("risposta di iscrivi_email vuota");
      return { codice: riga.codice, scadenza: riga.scadenza, nuovo: riga.nuovo === true, prova: false };
    }
    const errore = await risposta.json().catch(() => ({}));
    if (risposta.status === 409 && errore.code === "23505") continue; // codice già usato: ne genero un altro
    throw new Error(`Supabase ${risposta.status} ${errore.code ?? ""}`.trim());
  }
  throw new Error("codice in collisione dopo tutti i tentativi");
}

// ------------------------------------------------------------------ email con il codice (Brevo)

const BREVO = "https://api.brevo.com/v3/smtp/email";
const E = T.email;

/** Corpo HTML dell'email: testi di testi.json (codiceSconto.email e risultato), nessun dato scritto qui. */
export function corpoEmail({ codice, scadenza }) {
  const riga = (s, stile = "") => `<p style="margin:0 0 16px${stile}">${h(s)}</p>`;
  return [
    "<!DOCTYPE html><html lang=\"it\"><body style=\"margin:0;padding:24px;font-family:Georgia,serif;font-size:17px;line-height:1.5\">",
    riga(componi(E.apertura)),
    riga(codice, ";font-size:32px;letter-spacing:4px;font-weight:bold"),
    riga(T.risultatoValidita.replace("[data]", dataItaliana(scadenza))),
    riga(componi(T.condizioni)),
    riga(componi(E.prenota)),
    riga(componi(E.firma)),
    riga(componi(E.piede), ";font-size:13px"),
    "</body></html>",
  ].join("");
}

/** Invia il codice via Brevo. Restituisce true solo se Brevo accetta (2xx); senza chiave o mittente non invia. */
export async function inviaEmail({ email, codice, scadenza }, mittente = centro.integrazioni?.servizioEmail?.mittente) {
  const chiave = env("BREVO_API_KEY");
  if (!chiave || !mittente) return false;
  try {
    const risposta = await fetch(BREVO, {
      method: "POST",
      headers: { "api-key": chiave, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: centro.nome, email: mittente },
        to: [{ email }],
        replyTo: { email: centro.email, name: centro.nome },
        subject: componi(E.oggetto),
        htmlContent: corpoEmail({ codice, scadenza }),
        tags: ["codice-sconto"],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!risposta.ok) console.error(`codice-sconto: Brevo ${risposta.status}`); // mai l'email nei log
    return risposta.ok;
  } catch (e) {
    console.error(`codice-sconto: Brevo ${e.name}`);
    return false;
  }
}

// ------------------------------------------------------------------ lista delle promo (Brevo)

const BREVO_CONTATTI = "https://api.brevo.com/v3/contacts";

/**
 * Mette l'email nella lista delle promo su Brevo (centro.json › integrazioni.servizioEmail.listaPromo): Brevo crea il
 * contatto o, se esiste già, lo aggiunge alla lista (updateEnabled). Non tocca chi si è disiscritto da Brevo.
 * Le promo mensili si creano e si inviano dal pannello di Brevo, con il link di disiscrizione che Brevo aggiunge da sé.
 * Restituisce true solo se Brevo accetta; senza chiave o senza un ID di lista valido non fa nulla.
 */
export async function aggiungiAllaLista({ email }, lista = centro.integrazioni?.servizioEmail?.listaPromo) {
  const chiave = env("BREVO_API_KEY");
  if (!chiave || !Number.isInteger(lista) || lista <= 0) return false;
  try {
    const risposta = await fetch(BREVO_CONTATTI, {
      method: "POST",
      headers: { "api-key": chiave, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, listIds: [lista], updateEnabled: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!risposta.ok) console.error(`codice-sconto: Brevo lista ${risposta.status}`); // mai l'email nei log
    return risposta.ok;
  } catch (e) {
    console.error(`codice-sconto: Brevo lista ${e.name}`);
    return false;
  }
}

// ------------------------------------------------------------------ risposte

const NO_CACHE = { "Cache-Control": "no-store" };
const json = (corpo, stato = 200) => Response.json(corpo, { status: stato, headers: NO_CACHE });

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const h = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPE[c]);

/** Pagina semplice per chi non ha JavaScript: stessi fogli di stile del sito, fondo sabbia. */
function pagina({ titolo, corpo, stato = 200 }) {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${h(titolo)}</title>
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/sezioni.css">
</head>
<body>
<main id="contenuto" class="sezione codice-pagina">
<div class="contenitore">
${corpo}
</div>
</main>
</body>
</html>
`;
  return new Response(html, { status: stato, headers: { ...NO_CACHE, "Content-Type": "text/html; charset=utf-8" } });
}

function paginaCodice({ codice, scadenza }, ritorno) {
  return pagina({
    titolo: `${T.risultatoTitolo} · ${centro.nome}`,
    corpo: `<h1>${h(T.risultatoTitolo)}</h1>
<p class="codice-valore">${h(codice)}</p>
<p>${h(T.risultatoValidita.replace("[data]", dataItaliana(scadenza)))}</p>
<p class="codice-pagina-link"><a href="${h(ritorno)}">${h(T.tornaAlSito)}</a></p>`,
  });
}

function paginaErrore(messaggio, ritorno, stato) {
  return pagina({
    titolo: `${T.paginaErroreTitolo} · ${centro.nome}`,
    stato,
    corpo: `<h1>${h(T.paginaErroreTitolo)}</h1>
<p>${h(messaggio)}</p>
<p class="codice-pagina-link"><a href="${h(ritorno)}">${h(T.tornaAlModulo)}</a></p>`,
  });
}

// ------------------------------------------------------------------ gestore

export default async (req) => {
  const vuoleJson = (req.headers.get("accept") ?? "").includes("application/json");
  if (req.method !== "POST") return json({ errore: "richiesta" }, 405);

  const campi = await leggiCampi(req);
  const ritorno = `${percorso(campi?.pagina)}#codice-sconto`;
  const errore = (chiave, stato = 400) =>
    vuoleJson ? json({ errore: chiave }, stato) : paginaErrore(T.errori[chiave] ?? T.errori.generico, ritorno, stato);

  // Richiesta non leggibile o campo trappola pieno: 400 senza dettagli (uguale per i due casi).
  if (!campi || testo(campi.sito)) return vuoleJson ? json({ errore: "richiesta" }, 400) : paginaErrore(T.errori.generico, ritorno, 400);

  const email = testo(campi.email, 300);
  if (!email || email.length > 254 || !EMAIL.test(email)) return errore("email");
  if (!vero(campi.consenso)) return errore("consenso");

  const utm = Object.fromEntries(
    ["source", "medium", "campaign", "content"].map((k) => [k, testo(campi[`utm_${k}`])]).filter(([, v]) => v),
  );
  try {
    const esito = await iscrivi({ email, pagina: percorso(campi.pagina), utm });
    // Email con il codice e lista delle promo solo se l'iscrizione è stata salvata davvero (non in modalità prova)
    // e Brevo è configurato. Le due chiamate vanno in parallelo; la lista non cambia la risposta.
    const [emailInviata] = esito.prova
      ? [false]
      : await Promise.all([inviaEmail({ email, codice: esito.codice, scadenza: esito.scadenza }), aggiungiAllaLista({ email })]);
    const risposta = { ...esito, emailInviata };
    return vuoleJson ? json(risposta) : paginaCodice(risposta, ritorno);
  } catch (e) {
    console.error(`codice-sconto: ${e.message}`); // mai l'email nei log
    return errore("server", 500);
  }
};

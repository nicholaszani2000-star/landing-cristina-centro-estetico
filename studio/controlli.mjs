// studio/controlli.mjs — controlli automatici (CLAUDE.md §13). Crescono a ogni step, nessuno si toglie.
// Uso: node studio/controlli.mjs   → «✔ nome» o «✘ nome: motivo»; codice di uscita 1 se qualcosa fallisce.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const DIST = join(RADICE, "dist");
const leggi = (p) => readFileSync(join(RADICE, p), "utf8");
const json = (p) => JSON.parse(leggi(p));
const rel = (p) => relative(RADICE, p).split(sep).join("/");

const build = await import(pathToFileURL(join(RADICE, "build.mjs")).href);
const { default: sharp } = await import("sharp").catch(() => ({ default: null })); // da studio/node_modules
const ORIGINALI = join(STUDIO, "originali");
const IMG = join(RADICE, "src", "img");
const centro = json("content/centro.json");
const testi = json("content/testi.json");

// Pagine generate: percorso in dist, pagina di testi.json (null per la 404)
const PAGINE = [
  ["index.html", "home"],
  ["viso/index.html", "viso"],
  ["pedicure/index.html", "pedicure"],
  ["404.html", null],
];
// Attesi da CLAUDE.md §7
const ATTESI_7 = {
  home: {
    title: "Migliore – Estetica Avanzata · Caronno Varesino",
    h1: "Trattamenti viso e pedicure avanzato a Caronno Varesino",
    description: "Trattamenti viso, pedicure avanzato, epilazione e massaggi a Caronno Varesino. Solo su appuntamento: chiama o scrivi su WhatsApp al 352 060 1109.",
  },
  viso: {
    title: "Trattamenti viso a Caronno Varesino · Migliore",
    h1: "Trattamenti viso a Caronno Varesino",
    description: "Pulizia viso e trattamenti anti-age a Caronno Varesino, su appuntamento. Chiama o scrivi su WhatsApp al 352 060 1109.",
  },
  pedicure: {
    title: "Pedicure avanzato a Caronno Varesino · Migliore",
    h1: "Pedicure avanzato a Caronno Varesino",
    description: "Pedicure avanzato a Caronno Varesino: non la solita pedicure. Su appuntamento, chiama o scrivi su WhatsApp al 352 060 1109.",
  },
};
// Attesi da CLAUDE.md §8, «Pagina 404»
const ATTESI_404 = {
  title: "Pagina non trovata · Migliore – Estetica Avanzata",
  h1: "Questa pagina non esiste.",
  testo: "Forse il link è cambiato. Torna alla pagina iniziale o contattaci direttamente.",
  link: "Torna alla pagina iniziale",
  pulsanti: ["Chiama", "Scrivi su WhatsApp"],
};
const URL_PROVA = "https://esempio.netlify.app";
// Indirizzo principale del sito, da CLAUDE.md §2.1 (scritto a mano qui, di proposito)
const INDIRIZZO_PRINCIPALE = "https://esteticamigliore.it";
// Listino atteso, voce per voce da CLAUDE.md §2.3 (scritto a mano qui, di proposito)
const LISTINO_ATTESO = {
  "mani-piedi|Manicure e pedicure": [
    ["Manicure senza smalto", "15 €"],
    ["Pedicure estetico senza smalto", "35 €"],
    ["Pedicure avanzato senza smalto", "40 €"],
    ["Applicazione smalto", "+ 5 €"],
    ["Pedicure estetico con semipermanente", "45 €"],
    ["Pedicure avanzato con semipermanente", "50 €"],
    ["Taglio unghie mani o piedi", "10 €"],
    ["Trattamento paraffina mani", "30 €"],
    ["Trattamento paraffina piedi", "35 €"],
  ],
  "epilazione|Epilazione": [
    ["Labbro superiore", "5 €"],
    ["Sopracciglia", "10 €"],
    ["Braccia", "15 €"],
    ["Ascelle", "10 €"],
    ["Pancia", "10 €"],
    ["Glutei", "10 €"],
    ["Inguine", "10 €"],
    ["Inguine completo", "15 €"],
    ["Mezza gamba (senza/con inguine)", "20 € / 25 €"],
    ["Gamba intera (senza/con inguine)", "30 € / 35 €"],
    ["Petto e addome uomo", "da 30 a 40 €"],
    ["Schiena uomo", "da 30 a 40 €"],
  ],
  "brasiliana|Epilazione brasiliana multidirezionale": [
    ["Labbro superiore", "10 €"],
    ["Ascelle", "15 €"],
    ["Pancia", "20 €"],
    ["Glutei", "20 €"],
    ["Inguine", "20 €"],
    ["Inguine completo", "25 €"],
    ["Petto e addome uomo", "30 €"],
    ["Schiena uomo", "da 40 a 50 €"],
  ],
  "massaggi|Massaggi": [
    ["Massaggio gambe e addome", "35 €"],
    ["Massaggio schiena", "35 €"],
    ["Massaggio completo", "55 €"],
  ],
  "corpo-viso|Trattamenti corpo e viso": [
    ["Peeling corpo", "da 50 a 60 €"],
    ["Trattamento corpo", "da 60 €"],
    ["Pulizia schiena", "35 €"],
    ["Pulizia viso base", "55 €"],
    ["Trattamento viso Antiage", "da 80 a 120 €"],
    ["Trattamento Antiage contorno occhi e labbra", "40 €"],
    ["Laminazione ciglia", "50 €"],
    ["Laminazione sopracciglia", "50 €"],
  ],
};
// Parole vietate di §8 (radici: «*» = qualsiasi desinenza)
const VIETATE = [
  "podolog*", "podoestetic*", "curativ*", "terapeutic*", "medic*", "cura di calli", "calli", "callo", "duron*",
  "verruc*", "unghie incarnite", "unghia incarnita", "micos*", "elimin*", "risolv*", "nuova apertura",
  "appena apert*", "inaugurazion*", "dermatolog*", "biomedic*", "diagnos*", "analisi della pelle", "anamnes*",
  "cellula", "cellule", "a livello cellulare", "dna", "collagen*", "elastin*", "fibroblast*", "rigener*",
  "ripara", "riparano", "riparare", "riparatore", "riparatrice", "infiamm*", "acne", "rosacea", "couperose",
  "cicatric*", "filler", "botox", "mesoterapi*", "biorivitalizz*", "iniezion*", "puntur*", "peeling chimico",
  "lifting", "ringiovan*", "invecchiamento cronologico", "rallenta l'invecchiamento", "rallenta l’invecchiamento",
  // tono e §10: superlativi e promesse non dimostrabili, scarsità finta
  "il migliore", "la migliore", "i migliori", "le migliori", "garantit*", "definitiv*", "miracolos*",
  "più richiest*", "posti limitati", "visibile dalla prima seduta",
];
const DOMINI_LINK_AMMESSI = ["wa.me", "www.google.com", "www.garanteprivacy.it"]; // il Garante dallo Step 7 (privacy)

// ---------------------------------------------------------------- strumenti

let superati = 0;
let falliti = 0;
async function controllo(nome, fn) {
  try {
    await fn();
    superati++;
    console.log(`✔ ${nome}`);
  } catch (e) {
    falliti++;
    console.log(`✘ ${nome}: ${e.message}`);
  }
}
function verifica(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio);
}
function elenca(cartella, filtro = () => true) {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella, { withFileTypes: true }).flatMap((v) => {
    if (v.name === "node_modules" || v.name.startsWith(".")) return [];
    if (/^google[0-9a-f]{16}\.html$/.test(v.name)) return []; // file di verifica di Search Console: non è una pagina (controllo apposta)
    const p = join(cartella, v.name);
    return v.isDirectory() ? elenca(p, filtro) : filtro(p) ? [p] : [];
  });
}
const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: "\u00A0" };
const decodifica = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (intero, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITA[e] ?? intero;
  });
function testoVisibile(html) {
  return decodifica(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|template|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}
/** Testi non visibili ma letti: title, meta description/og, alt, title, aria-label, placeholder. */
function testiNascosti(html) {
  const uscita = [];
  const titolo = html.match(/<title>([\s\S]*?)<\/title>/);
  if (titolo) uscita.push(titolo[1]);
  for (const m of html.matchAll(/<meta\s+(?:name|property)="(?:description|og:[\w:]+|twitter:[\w:]+)"\s+content="([^"]*)"/g)) uscita.push(m[1]);
  for (const m of html.matchAll(/\s(?:alt|title|aria-label|placeholder)="([^"]*)"/g)) uscita.push(m[1]);
  return decodifica(uscita.join(" \n "));
}
const jsonLdDi = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const pagina = (file) => readFileSync(join(DIST, file), "utf8");
const normalizzaSpazi = (s) => s.replace(/\u00A0/g, " ");
/** Il sito usa l’apostrofo tipografico (Step 9, rilettura); il brief lo scrive dritto: i testi attesi presi dal
 *  brief passano di qui prima del confronto. */
const tipografico = (s) => s.replace(/'/g, "’");
const regexVietata = (voce) => {
  const radice = voce.endsWith("*");
  const corpo = (radice ? voce.slice(0, -1) : voce).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?<!\\p{L})${corpo}${radice ? "\\p{L}*" : "(?!\\p{L})"}`, "iu");
};

/** Browser e server di dist/ condivisi dai controlli con Playwright (da anteprima.mjs). */
let sessione = null;
async function browserCondiviso() {
  if (!sessione) {
    const { avviaServer, apriBrowser } = await import(pathToFileURL(join(STUDIO, "anteprima.mjs")).href);
    const { browser, errore } = await apriBrowser();
    if (!browser) throw new Error(`browser non disponibile: ${errore}`);
    const server = await avviaServer(0);
    sessione = { browser, server, base: `http://localhost:${server.address().port}` };
  }
  return sessione;
}
const LINK_PAGINE = [["/", "home"], ["/viso/", "viso"], ["/pedicure/", "pedicure"]];
// Pagine legali (Step 7): file in dist, chiave di testi.json, percorso
const PAGINE_LEGALI = [["privacy/index.html", "privacy", "/privacy/"], ["cookie/index.html", "cookie", "/cookie/"]];

// ---------------------------------------------------------------- controlli

console.log("Controlli automatici · Step 9\n");

await controllo("build eseguita con codice 0", () => {
  const r = spawnSync(process.execPath, ["build.mjs"], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: "" } });
  verifica(r.status === 0, `codice ${r.status}\n${r.stderr || r.stdout}`);
});

await controllo("pagine generate: /, /viso/, /pedicure/, 404.html", () => {
  const mancanti = PAGINE.map(([f]) => f).filter((f) => !existsSync(join(DIST, f)));
  verifica(!mancanti.length, `mancano ${mancanti.join(", ")}`);
});

await controllo("studio/ e content/ non finiscono in dist/", () => {
  const sospetti = elenca(DIST).map(rel).filter((p) => /(^|\/)(studio|content|node_modules)(\/|$)|\.md$/.test(p.replace(/^dist\//, "")));
  verifica(!sospetti.length, sospetti.join(", "));
});

/** URL assoluti di una build in «cartella»: canonical, og:url, og:image, JSON-LD, sitemap e robots usano «indirizzo». */
function verificaUrlAssoluti(cartella, indirizzo) {
  const leggiDa = (f) => readFileSync(join(cartella, f), "utf8");
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = leggiDa(file);
    const qui = indirizzo + testi.pagine[id].percorso;
    verifica(html.includes(`<link rel="canonical" href="${qui}">`), `${file}: canonical diverso da ${qui}`);
    verifica(html.includes(`<meta property="og:url" content="${qui}">`), `${file}: og:url diverso da ${qui}`);
    verifica(html.includes(`<meta property="og:image" content="${indirizzo}/img/og.jpg">`), `${file}: og:image diverso da ${indirizzo}/img/og.jpg`);
    const ld = JSON.parse(jsonLdDi(html)[0]);
    verifica(ld.url === `${indirizzo}/`, `${file}: url del JSON-LD «${ld.url}»`);
    verifica(ld.image === `${indirizzo}/img/og.jpg`, `${file}: image del JSON-LD «${ld.image}»`);
  }
  for (const [file, , percorso] of PAGINE_LEGALI) {
    const html = leggiDa(file);
    verifica(html.includes(`<link rel="canonical" href="${indirizzo}${percorso}">`), `${file}: canonical diverso da ${indirizzo}${percorso}`);
    verifica(html.includes(`<meta property="og:image" content="${indirizzo}/img/og.jpg">`), `${file}: og:image non assoluto`);
  }
  // Dallo Step 7: anche /privacy/ e /cookie/, con priorità bassa; la 404 resta esclusa.
  const sitemap = leggiDa("sitemap.xml");
  const voci = [...sitemap.matchAll(/<url><loc>([^<]*)<\/loc><priority>([^<]*)<\/priority><\/url>/g)].map((m) => `${m[1]} ${m[2]}`);
  const attese = [["/", "1.0"], ["/viso/", "1.0"], ["/pedicure/", "1.0"], ["/privacy/", "0.3"], ["/cookie/", "0.3"]].map(([p, q]) => `${indirizzo}${p} ${q}`);
  verifica(voci.join() === attese.join(), `sitemap: ${voci.join(", ")}`);
  verifica(!/404/.test(sitemap), "la 404 è nella sitemap");
  const robots = leggiDa("robots.txt");
  verifica(/^User-agent: \*/m.test(robots) && robots.includes(`Sitemap: ${indirizzo}/sitemap.xml`), `robots.txt senza «Sitemap: ${indirizzo}/sitemap.xml»`);
  const html404 = leggiDa("404.html");
  verifica(!/rel="canonical"|property="og:url"/.test(html404), "la 404 non deve avere canonical né og:url");
  verifica(html404.includes(`<meta property="og:image" content="${indirizzo}/img/og.jpg">`), "404: og:image non assoluto");
}

await controllo(`senza la variabile URL: canonical, og:url, og:image, JSON-LD e sitemap.xml usano l'indirizzo principale ${INDIRIZZO_PRINCIPALE}`, () => {
  verifica(centro.dominio === "esteticamigliore.it", `dominio di centro.json «${centro.dominio}»`);
  verifica(centro.indirizzoPrincipale === INDIRIZZO_PRINCIPALE, `indirizzo principale di centro.json «${centro.indirizzoPrincipale}»`);
  // dist/ viene dalla build del primo controllo, eseguita con URL vuoto.
  verificaUrlAssoluti(DIST, INDIRIZZO_PRINCIPALE);
});

await controllo(`con URL=${URL_PROVA} node build.mjs: canonical, og:url, og:image, JSON-LD e sitemap.xml usano quell'indirizzo`, () => {
  // Stessa build con la variabile URL, ma in una cartella temporanea: dist/ resta la versione senza URL.
  const tmp = mkdtempSync(join(tmpdir(), "migliore-build-"));
  try {
    const r = spawnSync(process.execPath, ["build.mjs", "--dist", tmp], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: URL_PROVA } });
    verifica(r.status === 0, `build con URL fallita: ${r.stderr || r.stdout}`);
    verificaUrlAssoluti(tmp, URL_PROVA);
    verifica(!readFileSync(join(tmp, "index.html"), "utf8").includes(INDIRIZZO_PRINCIPALE), "con URL impostata compare ancora l'indirizzo principale");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await controllo("nessun {{, }}, undefined, null, NaN o segnaposto ⟪ ⟫ nel testo delle pagine", () => {
  const trovati = [];
  for (const [file] of [...PAGINE, ...PAGINE_LEGALI]) {
    const testo = testoVisibile(pagina(file)) + " \n " + testiNascosti(pagina(file));
    for (const [nome, re] of [
      ["{{", /\{\{/], ["}}", /\}\}/], ["undefined", /\bundefined\b/], ["null", /\bnull\b/], ["NaN", /\bNaN\b/],
      ["⟪", /\u27EA/], ["⟫", /\u27EB/], ["[object", /\[object /],
    ]) {
      if (re.test(testo)) trovati.push(`${file}: «${nome}»`);
    }
  }
  for (const p of ["content/centro.json", "content/testi.json", "content/listino.json"]) {
    if (/[\u27EA\u27EB]/.test(leggi(p))) trovati.push(`${p}: segnaposto ⟪ ⟫`);
  }
  verifica(!trovati.length, trovati.join(", "));
});

await controllo("html-validate: 0 errori su tutte le pagine", () => {
  const bin = join(STUDIO, "node_modules", "html-validate", "bin", "html-validate.mjs");
  verifica(existsSync(bin), "html-validate non installato: npm install --prefix studio");
  const file = elenca(DIST, (p) => p.endsWith(".html"));
  const r = spawnSync(process.execPath, [bin, ...file], { cwd: RADICE, encoding: "utf8" });
  verifica(r.status === 0, `\n${(r.stdout + r.stderr).trim()}`);
});

await controllo("un solo <h1> per pagina, H1 diversi tra le tre pagine", () => {
  const visti = new Map();
  for (const [file] of PAGINE) {
    const h1 = [...pagina(file).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    verifica(h1.length === 1, `${file}: ${h1.length} <h1>`);
    const testo = testoVisibile(h1[0][1]);
    verifica(!visti.has(testo), `${file} e ${visti.get(testo)} hanno lo stesso H1`);
    visti.set(testo, file);
  }
});

await controllo("title e H1 delle tre pagine come in §7", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const title = decodifica(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
    const h1 = testoVisibile(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1]);
    verifica(title === ATTESI_7[id].title, `${file}: title «${title}»`);
    verifica(h1 === ATTESI_7[id].h1, `${file}: H1 «${h1}»`);
  }
});

await controllo('lang="it" su ogni pagina', () => {
  for (const [file] of [...PAGINE, ...PAGINE_LEGALI]) verifica(/<html lang="it">/.test(pagina(file)), file);
});

await controllo("partita IVA 04123400121 in ogni pagina", () => {
  for (const [file] of [...PAGINE, ...PAGINE_LEGALI]) verifica(testoVisibile(pagina(file)).includes(`P.IVA ${centro.legale.partitaIva}`), file);
  verifica(centro.legale.partitaIva === "04123400121", "partita IVA diversa da §2.1 in content/centro.json");
});

await controllo("parole vietate di §8 assenti (testo, alt, meta, JSON-LD; eccezione: riga sul limite)", () => {
  const rigaLimite = testi.comuni.pedicure.rigaLimite;
  const trovate = [];
  for (const [file] of [...PAGINE, ...PAGINE_LEGALI]) {
    const html = pagina(file);
    let testo = [testoVisibile(html), testiNascosti(html), ...jsonLdDi(html)].join(" \n ");
    testo = normalizzaSpazi(testo).split(rigaLimite).join(" ");
    for (const voce of VIETATE) if (regexVietata(voce).test(testo)) trovate.push(`${file}: «${voce}»`);
  }
  verifica(!trovate.length, trovate.join(", "));
});

await controllo("nessuna risorsa da domini esterni (src, fogli di stile, script, url() nel CSS)", () => {
  const esterni = [];
  const esterno = (u) => /^(https?:)?\/\//i.test(u.trim());
  for (const file of elenca(DIST, (p) => p.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/<(img|script|iframe|source|video|audio|embed|object|track|input)\b[^>]*>/gi)) {
      for (const a of m[0].matchAll(/\s(?:src|srcset|data)="([^"]*)"/gi)) {
        if (a[1].split(",").some((parte) => esterno(parte))) esterni.push(`${rel(file)}: ${a[1]}`);
      }
    }
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      if (/rel="(canonical|alternate)"/.test(m[0])) continue;
      const href = m[0].match(/\shref="([^"]*)"/)?.[1] ?? "";
      if (esterno(href)) esterni.push(`${rel(file)}: ${href}`);
    }
    for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) {
      const href = decodifica(m[1]);
      if (!esterno(href)) continue;
      const host = new URL(href.startsWith("//") ? "https:" + href : href).host;
      const social = Object.values(centro.social).filter(Boolean).map((u) => new URL(u).host);
      const maps = host === "www.google.com" && href.startsWith("https://www.google.com/maps/");
      const garante = host === "www.garanteprivacy.it" && rel(file) === "dist/privacy/index.html";
      if (!(host === "wa.me" || maps || garante || social.includes(host))) esterni.push(`${rel(file)}: link a ${href}`);
    }
  }
  for (const file of elenca(DIST, (p) => p.endsWith(".css"))) {
    const css = readFileSync(file, "utf8");
    if (/@import/i.test(css)) esterni.push(`${rel(file)}: @import`);
    for (const m of css.matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^'")]+)/gi)) esterni.push(`${rel(file)}: ${m[1]}`);
  }
  verifica(!esterni.length, esterni.join(", "));
  verifica(DOMINI_LINK_AMMESSI.length === 3, "elenco domini ammessi alterato");
});

await controllo("ogni file JS passa node --check", () => {
  const file = [
    join(RADICE, "build.mjs"),
    ...elenca(join(RADICE, "src", "js"), (p) => /\.m?js$/.test(p)),
    ...elenca(STUDIO, (p) => /\.m?js$/.test(p) && !p.includes(`${sep}screenshot${sep}`)),
    ...elenca(join(RADICE, "netlify", "functions"), (p) => /\.m?js$/.test(p)),
  ];
  const errati = file.filter((f) => spawnSync(process.execPath, ["--check", f]).status !== 0).map(rel);
  verifica(!errati.length, errati.join(", "));
});

await controllo("listino: 40 voci, nomi, ordine e prezzi identici a §2.3", () => {
  const listino = json("content/listino.json");
  const attese = Object.entries(LISTINO_ATTESO);
  verifica(listino.categorie.length === attese.length, `${listino.categorie.length} categorie invece di ${attese.length}`);
  let totale = 0;
  listino.categorie.forEach((categoria, i) => {
    const [chiave, voci] = attese[i];
    verifica(`${categoria.id}|${categoria.titolo}` === chiave, `categoria ${i + 1}: «${categoria.id}|${categoria.titolo}» invece di «${chiave}»`);
    verifica(categoria.voci.length === voci.length, `${categoria.id}: ${categoria.voci.length} voci invece di ${voci.length}`);
    categoria.voci.forEach((voce, j) => {
      const [nome, prezzo] = voci[j];
      verifica(voce.nome === nome, `${categoria.id} n. ${j + 1}: «${voce.nome}» invece di «${nome}»`);
      const scritto = normalizzaSpazi(build.formattaPrezzo(voce));
      verifica(scritto === prezzo, `${categoria.id} «${nome}»: «${scritto}» invece di «${prezzo}»`);
      totale++;
    });
  });
  verifica(totale === 40, `${totale} voci invece di 40`);
});

await controllo("formattaPrezzo: le cinque forme di §2.3 (con spazi non separabili davanti a €)", () => {
  const casi = [
    [{ nome: "a", prezzo: 15 }, "15\u00A0€"],
    [{ nome: "b", da: 30, a: 40 }, "da 30 a 40\u00A0€"],
    [{ nome: "c", da: 60 }, "da 60\u00A0€"],
    [{ nome: "d", supplemento: 5 }, "+\u00A05\u00A0€"],
    [{ nome: "e", prezzi: [20, 25] }, "20\u00A0€ / 25\u00A0€"],
  ];
  for (const [voce, atteso] of casi) verifica(build.formattaPrezzo(voce) === atteso, `${JSON.stringify(voce)} → «${build.formattaPrezzo(voce)}»`);
  for (const errata of [{ nome: "x" }, { nome: "y", prezzo: 5, da: 3 }, { nome: "z", da: 40, a: 30 }, { nome: "w", prezzo: "15" }]) {
    let fermato = false;
    try {
      build.formattaPrezzo(errata);
    } catch {
      fermato = true;
    }
    verifica(fermato, `voce errata accettata: ${JSON.stringify(errata)}`);
  }
});

await controllo("motore di template severo: errori con file, riga e chiave", () => {
  const motore = new build.Motore({ parti: { ok: "<b>{{x}}</b>" } });
  verifica(motore.rendi("{{> ok}}{{#se s}}sì{{altrimenti}}no{{/se}}{{#se !s}}!{{/se}}", { x: "<&>", s: false }, "t") === "<b>&lt;&amp;&gt;</b>no!", "rendering di base errato");
  verifica(motore.rendi("{{#ogni l}}{{@numero}}{{.}}{{#se !@ultimo}},{{/se}}{{/ogni}}", { l: ["a", "b"] }, "t") === "1a,2b", "{{#ogni}} errato");
  verifica(motore.rendi("{{{h}}}", { h: "<i>" }, "t") === "<i>", "{{{grezzo}}} errato");
  const casi = [
    ["riga\n{{manca}}", {}, /t\.html:2: chiave «manca» mancante/],
    ["{{a.b}}", { a: { b: null } }, /t\.html:1: chiave «a\.b» vale null/],
    ["{{> fantasma}}", {}, /t\.html:1: parte «fantasma» inesistente/],
    ["\n\n{{#se a}}x", { a: 1 }, /t\.html:3: \{\{#se\}\} non chiuso/],
    ["{{/ogni}}", {}, /t\.html:1: \{\{\/ogni\}\} non corrisponde/],
    ["{{ x y }}", {}, /t\.html:1: sintassi non riconosciuta/],
    ["a {{ b", {}, /t\.html:1: «\{\{» o «\}\}» senza tag valido/],
  ];
  for (const [sorgente, contesto, atteso] of casi) {
    let messaggio = "";
    try {
      motore.rendi(sorgente, contesto, "t.html");
    } catch (e) {
      messaggio = e.message;
    }
    verifica(atteso.test(messaggio), `«${sorgente.replace(/\n/g, "⏎")}» → «${messaggio || "nessun errore"}»`);
  }
  let segnaposto = "";
  try {
    build.componi("Ciao {nome.sbagliato}", centro, "testi.x");
  } catch (e) {
    segnaposto = e.message;
  }
  verifica(/testi\.x: segnaposto \{nome\.sbagliato\} sconosciuto/.test(segnaposto), `segnaposto sconosciuto non fermato: «${segnaposto}»`);
  verifica(build.componi("REA {x.rea}", { x: { rea: null } }, "t") === null, "un dato null deve annullare la frase");
  verifica(build.componi("REA {x.rea}", { x: { rea: "VA-1" } }, "t") === "REA VA-1", "segnaposto non riempito");
});

await controllo("riferimenti a CSS, JS e font con ?v=hash8 e file esistenti", () => {
  for (const [file] of PAGINE) {
    const html = pagina(file);
    const riferimenti = [...html.matchAll(/\s(?:href|src)="(\/(?:css|js|fonts)\/[^"]*)"/g)].map((m) => m[1]);
    verifica(riferimenti.length >= 6, `${file}: solo ${riferimenti.length} riferimenti`);
    for (const r of riferimenti) {
      verifica(/\?v=[0-9a-f]{8}$/.test(r), `${file}: ${r} senza ?v=hash8`);
      verifica(existsSync(join(DIST, r.split("?")[0])), `${file}: ${r} non esiste in dist/`);
    }
  }
  for (const file of elenca(join(DIST, "css"))) {
    for (const m of readFileSync(file, "utf8").matchAll(/url\(\s*['"]?(\/fonts\/[^'")]+)/g)) verifica(/\?v=[0-9a-f]{8}$/.test(m[1]), `${rel(file)}: ${m[1]} senza ?v=hash8`);
  }
});

await controllo("dati facoltativi: null se non indicati, mai la stringa «non indicato»", () => {
  const nulli = [
    "legale.rea", "legale.sedeLegale", "presentazione", "dominio", "social.instagram", "social.facebook",
    "social.schedaGoogle", "trattamenti.viso.macchinari", "trattamenti.pedicure.estetico.durata",
    "trattamenti.pedicure.avanzato.durata", "trattamenti.pedicure.strumentiIgiene", "integrazioni.ga4Id",
    "integrazioni.metaPixelId", "integrazioni.supabase",
  ];
  for (const k of nulli) {
    const r = build.ottieni(centro, k);
    verifica(r.trovato, `${k} manca in content/centro.json`);
    verifica(r.valore === null || (typeof r.valore === "string" && r.valore.trim() !== ""), `${k} deve essere null o un testo`);
  }
  for (const p of ["content/centro.json", "content/testi.json", "content/listino.json"]) verifica(!/non indicat/i.test(leggi(p)), `${p} contiene «non indicato»`);
});

await controllo("footer condizionale: niente REA, sede legale, social o «Preferenze cookie» se non indicati", () => {
  const regole = [
    [centro.legale.rea, /\bREA\b/, "riga REA"],
    [centro.legale.sedeLegale, /Sede legale/, "sede legale"],
    [centro.social.instagram, /Instagram/, "Instagram"],
    [centro.social.facebook, /Facebook/, "Facebook"],
    [centro.social.schedaGoogle, /Scheda Google/, "Scheda Google"],
    [centro.integrazioni.ga4Id || centro.integrazioni.metaPixelId, /Preferenze cookie/, "Preferenze cookie"],
  ];
  for (const [file] of PAGINE) {
    const piede = testoVisibile(pagina(file).match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "");
    verifica(piede.includes(centro.indirizzo.completo), `${file}: footer senza indirizzo`);
    verifica(piede.includes(centro.email), `${file}: footer senza email`);
    verifica(normalizzaSpazi(piede).includes(centro.telefono), `${file}: footer senza telefono`);
    verifica(piede.includes("Privacy") && piede.includes("Cookie"), `${file}: footer senza link Privacy/Cookie`);
    for (const [dato, re, nome] of regole) verifica(Boolean(dato) === re.test(piede), `${file}: ${nome} ${dato ? "assente" : "presente senza dato"}`);
  }
});

await controllo("link tel:+393520601109 e https://wa.me/393520601109?text= su ogni pagina, testo WhatsApp giusto per la pagina, nuova scheda", () => {
  for (const [file, id] of PAGINE) {
    const html = pagina(file);
    const tel = [...html.matchAll(/href="(tel:[^"]*)"/g)].map((m) => m[1]);
    verifica(tel.length >= 2 && tel.every((t) => t === `tel:${centro.telefonoE164}`), `${file}: link tel errati ${tel.join(" ")}`);
    // Le sezioni viso e pedicure hanno il loro testo WhatsApp (controllato a parte); il resto usa quello della pagina.
    const sezioneViso = html.match(/<section[^>]*data-sezione="viso"[\s\S]*?<\/section>/)?.[0] ?? "";
    const sezionePedicure = html.match(/<section[^>]*data-sezione="pedicure"[\s\S]*?<\/section>/)?.[0] ?? "";
    const fuoriViso = html.replace(sezioneViso, "").replace(sezionePedicure, "");
    const wa = [...fuoriViso.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)].map((m) => new URL(decodifica(m[1])));
    const atteso = testi.whatsapp[id ? testi.pagine[id].whatsapp : "generale"];
    verifica(wa.length >= 1, `${file}: nessun link WhatsApp`);
    for (const u of wa) {
      verifica(u.pathname === `/${centro.whatsappNumero}`, `${file}: numero WhatsApp ${u.pathname}`);
      verifica(u.searchParams.get("text") === atteso, `${file}: testo WhatsApp «${u.searchParams.get("text")}»`);
    }
    for (const m of html.matchAll(/<a\b[^>]*href="https:\/\/wa\.me\/[^"]*"[^>]*>/g)) {
      verifica(/\starget="_blank"/.test(m[0]) && /\srel="noopener"/.test(m[0]), `${file}: link WhatsApp senza target="_blank" rel="noopener"`);
    }
    verifica(html.includes(`href="https://wa.me/${centro.whatsappNumero}?text=`), `${file}: manca https://wa.me/${centro.whatsappNumero}?text=`);
  }
});

await controllo("JSON-LD BeautySalon sulle tre pagine (orari ricavati dalle fasce: «dal martedì al venerdì» e «il sabato»)", () => {
  for (const [file, id] of PAGINE) {
    const blocchi = jsonLdDi(pagina(file));
    if (!id) {
      verifica(blocchi.length === 0, "la 404 non deve avere JSON-LD");
      continue;
    }
    verifica(blocchi.length === 1, `${file}: ${blocchi.length} blocchi JSON-LD`);
    const d = JSON.parse(blocchi[0]);
    verifica(d["@type"] === "BeautySalon" && d.name === centro.nome, `${file}: tipo o nome errati`);
    verifica(d.telephone === centro.telefonoE164 && d.email === centro.email, `${file}: contatti errati`);
    verifica(d.address?.streetAddress === centro.indirizzo.via && d.address?.postalCode === centro.indirizzo.cap, `${file}: indirizzo errato`);
    // Orari attesi da CLAUDE.md §2.1 (scritti a mano qui, di proposito): martedì–venerdì 09–18, sabato 08–14.
    const o = (d.openingHoursSpecification ?? []).map((x) => `${x.dayOfWeek.join(",")} ${x.opens}-${x.closes}`).join(" | ");
    verifica(o === "Tuesday,Wednesday,Thursday,Friday 09:00-18:00 | Saturday 08:00-14:00", `${file}: orari ${o}`);
    verifica(d.priceRange === "€€", `${file}: priceRange`);
  }
  verifica(build.ricavaGiorni("dal lunedì al venerdì")?.length === 5, "ricavaGiorni: lunedì-venerdì");
  verifica(build.ricavaGiorni("lunedì, mercoledì e sabato") === null, "ricavaGiorni: un testo ambiguo deve dare null");
  verifica(build.ricavaGiorni("il sabato")?.join() === "Saturday" && build.ricavaGiorni("sabato")?.join() === "Saturday", "ricavaGiorni: un giorno solo");
  verifica(build.ricavaGiorni("dal venerdì al martedì") === null, "ricavaGiorni: un intervallo al contrario deve dare null");
});

await controllo("meta per pagina: description di §7 (60–160 caratteri), og:title, og:description, og:type, og:locale, theme-color", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const atteso = ATTESI_7[id];
    const meta = (attr, nome) => decodifica(html.match(new RegExp(`<meta ${attr}="${nome}" content="([^"]*)"`))?.[1] ?? "");
    const descrizione = meta("name", "description");
    verifica(descrizione === atteso.description, `${file}: description «${descrizione}»`);
    verifica(descrizione.length >= 60 && descrizione.length <= 160, `${file}: description di ${descrizione.length} caratteri (60–160)`);
    verifica(meta("property", "og:title") === atteso.title, `${file}: og:title`);
    verifica(meta("property", "og:description") === atteso.description, `${file}: og:description`);
    verifica(meta("property", "og:type") === "website" && meta("property", "og:locale") === "it_IT", `${file}: og:type/og:locale`);
    verifica(meta("name", "theme-color").toUpperCase() === "#F4DBCA", `${file}: theme-color`);
    verifica(html.includes('<script>document.documentElement.classList.add("js")</script>'), `${file}: script della classe js`);
  }
  verifica(/<meta name="robots" content="noindex">/.test(pagina("404.html")), "404 senza noindex");
});

await controllo("nessun testo scritto nei template (tutto da content/)", () => {
  const problemi = [];
  for (const file of elenca(join(RADICE, "src", "templates"), (p) => p.endsWith(".html"))) {
    const sorgente = readFileSync(file, "utf8");
    const senzaTag = sorgente
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\{\{\{[^{}]*\}\}\}|\{\{[^{}]*\}\}/g, " ")
      .replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/gi, " ");
    const avanzo = senzaTag.replace(/<[^>]+>/g, " ").replace(/<!DOCTYPE html>/i, " ").replace(/[\s·|—–:;,.()/!?]+/g, "");
    if (avanzo) problemi.push(`${rel(file)}: «${avanzo.slice(0, 40)}»`);
    for (const m of senzaTag.matchAll(/\s(alt|title|aria-label|placeholder)="([^"]*)"/g)) {
      if (m[2].trim()) problemi.push(`${rel(file)}: ${m[1]}="${m[2]}"`);
    }
    if (/\d{3}\s?\d{3}\s?\d{4}|04123400121|esteticamigliore/.test(senzaTag)) problemi.push(`${rel(file)}: dato scritto a mano`);
  }
  verifica(!problemi.length, problemi.join(", "));
});

await controllo("pagina 404 come in §8: title, noindex, H1, testo, link e pulsanti", () => {
  const html = pagina("404.html");
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
  verifica(decodifica(html.match(/<title>([\s\S]*?)<\/title>/)[1]) === ATTESI_404.title, "title");
  verifica(/<meta name="robots" content="noindex">/.test(html), "manca meta robots noindex");
  verifica(testoVisibile(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") === ATTESI_404.h1, "H1");
  verifica(testoVisibile(main).includes(ATTESI_404.testo), "testo");
  verifica(new RegExp(`<a href="/">${ATTESI_404.link}</a>`).test(main), "link alla pagina iniziale");
  const pulsanti = [...main.matchAll(/<a class="pulsante[^"]*" href="([^"]*)"[^>]*>[\s\S]*?<span>([^<]*)<\/span><\/a>/g)];
  verifica(pulsanti.map((m) => m[2]).join() === ATTESI_404.pulsanti.join(), `pulsanti: ${pulsanti.map((m) => m[2]).join(", ")}`);
  verifica(pulsanti[0][1] === `tel:${centro.telefonoE164}` && pulsanti[1][1].startsWith(`https://wa.me/${centro.whatsappNumero}?text=`), "destinazioni dei pulsanti");
});

// ---------------------------------------------------------------- Step 2: immagini e logo

const manifesto = JSON.parse(leggi("src/img/immagini.json"));
const KB = 1024;
/** Tutti i file esportati: [{ nome, file, larghezza (attesa), formato }] dal manifesto. */
const fileEsportati = () =>
  Object.entries(manifesto.immagini).flatMap(([nome, v]) =>
    v.larghezze
      ? [...v.formati.flatMap((f) => v.larghezze.map((w) => ({ nome, file: `${nome}-${w}.${f}`, larghezza: w }))), ...(v.ripiego ? [{ nome, file: v.ripiego }] : [])]
      : [{ nome, file: v.file }],
  );
function impronteLeggimi() {
  const testo = readFileSync(join(ORIGINALI, "LEGGIMI.txt"), "utf8");
  return Object.fromEntries([...testo.matchAll(/^(\S+\.(?:png|jpg))\n.*\n\s+sha256 ([0-9a-f]{64})/gm)].map((m) => [m[1], m[2]]));
}
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

await controllo("originali intatti: le impronte SHA-256 di studio/originali/ coincidono con LEGGIMI.txt", () => {
  const attese = impronteLeggimi();
  verifica(Object.keys(attese).length === 10, `${Object.keys(attese).length} impronte in LEGGIMI.txt invece di 10`);
  const diverse = Object.entries(attese).filter(([f, h]) => !existsSync(join(ORIGINALI, f)) || sha(join(ORIGINALI, f)) !== h).map(([f]) => f);
  verifica(!diverse.length, diverse.join(", "));
});

await controllo("ogni immagine citata in src e srcset esiste (src/img e dist/img); src/img contiene solo file del manifesto", () => {
  const mancanti = [];
  for (const file of elenca(DIST, (p) => p.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    const citati = [
      ...[...html.matchAll(/\s(?:src|href|content)="(\/img\/[^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/\ssrcset="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((p) => p.trim().split(/\s+/)[0])),
    ];
    verifica(citati.length > 0, `${rel(file)}: nessuna immagine citata`);
    for (const u of citati) {
      if (!existsSync(join(DIST, u))) mancanti.push(`${rel(file)}: dist${u}`);
      if (!existsSync(join(RADICE, "src", u))) mancanti.push(`${rel(file)}: src${u}`);
    }
  }
  verifica(!mancanti.length, mancanti.join(", "));
  const attesi = new Set([...fileEsportati().map((e) => e.file), ...manifesto.icone.map((i) => i.file), "immagini.json"]);
  const estranei = readdirSync(IMG).filter((f) => !attesi.has(f));
  const assenti = [...attesi].filter((f) => !existsSync(join(IMG, f)));
  verifica(!estranei.length && !assenti.length, `estranei: ${estranei.join(", ") || "-"} · mancanti: ${assenti.join(", ") || "-"}`);
  verifica(!existsSync(join(DIST, "img", "immagini.json")), "il manifesto non deve finire in dist/");
});

await controllo("nessuna larghezza oltre l'originale e nessun ritaglio (proporzioni dell'originale)", async () => {
  verifica(sharp, "sharp non installato: npm install --prefix studio");
  const problemi = [];
  for (const [nome, v] of Object.entries(manifesto.immagini)) {
    const o = await sharp(join(ORIGINALI, v.originale)).metadata();
    verifica(o.width === v.larghezza && o.height === v.altezza, `${nome}: misure del manifesto diverse dall'originale`);
    for (const e of fileEsportati().filter((e) => e.nome === nome)) {
      const m = await sharp(join(IMG, e.file)).metadata();
      if (m.width > o.width) problemi.push(`${e.file}: ${m.width} px > ${o.width} px`);
      if (e.larghezza && m.width !== e.larghezza) problemi.push(`${e.file}: largo ${m.width} invece di ${e.larghezza}`);
      if (Math.abs(m.height - (m.width * o.height) / o.width) > 1) problemi.push(`${e.file}: ${m.width}×${m.height} non ha le proporzioni di ${o.width}×${o.height}`);
    }
  }
  const farfalla = await sharp(join(ORIGINALI, "logo", "farfalla.png")).metadata();
  for (const { file, lato } of manifesto.icone) {
    const m = await sharp(join(IMG, file)).metadata();
    if (m.width !== lato || m.height !== lato || lato > farfalla.width) problemi.push(`${file}: ${m.width}×${m.height}`);
  }
  verifica(!problemi.length, problemi.join(", "));
});

await controllo("colori invariati: media RGB di ogni file entro ±2 dall'originale; og.jpg identica byte per byte", async () => {
  verifica(sharp, "sharp non installato: npm install --prefix studio");
  const statistiche = async (file) => {
    if (!(await sharp(file).metadata()).hasAlpha) return sharp(file).stats();
    return sharp(await sharp(file).flatten({ background: "#F4DBCA" }).png().toBuffer()).stats();
  };
  const problemi = [];
  const coppie = [
    ...fileEsportati().map((e) => [e.file, manifesto.immagini[e.nome].originale]),
    ...manifesto.icone.map((i) => [i.file, "logo/farfalla.png"]),
  ];
  for (const [file, originale] of coppie) {
    const [a, b] = await Promise.all([statistiche(join(ORIGINALI, originale)), statistiche(join(IMG, file))]);
    const delta = [0, 1, 2].map((c) => Math.abs(b.channels[c].mean - a.channels[c].mean));
    if (Math.max(...delta) > 2) problemi.push(`${file}: Δ ${delta.map((d) => d.toFixed(1)).join("/")}`);
  }
  verifica(!problemi.length, problemi.join(", "));
  verifica(sha(join(IMG, manifesto.immagini.og.file)) === sha(join(ORIGINALI, manifesto.immagini.og.originale)), "og.jpg diversa dall'originale");
});

await controllo("pesi entro §9: foto 01 a 720 ≤ 120 KB, altre foto ≤ 160 KB, 06 a 1536 ≤ 300 KB, logo solo 240 e 320 px con ogni file ≤ 40 KB", () => {
  const problemi = [];
  const peso = (f) => statSync(join(IMG, f)).size;
  for (const [nome, v] of Object.entries(manifesto.immagini)) {
    if (!v.formati?.includes("avif")) continue; // solo le foto
    for (const formato of v.formati) {
      for (const w of v.larghezze) {
        const f = `${nome}-${w}.${formato}`;
        const limite = nome === "cristina-bancone" && w === 720 ? 120 : nome === "listino-stampato" && w === 1536 ? 300 : 160;
        if (peso(f) > limite * KB) problemi.push(`${f}: ${(peso(f) / KB).toFixed(1)} KB > ${limite} KB`);
      }
    }
  }
  // Logo (§9): solo 240 e 320 px, AVIF e WebP, ogni file ≤ 40 KB.
  const logo = manifesto.immagini.logo;
  verifica(logo.larghezze.join() === "240,320" && logo.formati.join() === "avif,webp", `logo: ${logo.larghezze.join("/")} in ${logo.formati.join("/")}`);
  for (const formato of logo.formati) {
    for (const w of logo.larghezze) {
      const f = `logo-${w}.${formato}`;
      if (peso(f) > 40 * KB) problemi.push(`${f}: ${(peso(f) / KB).toFixed(1)} KB > 40 KB`);
    }
  }
  verifica(!problemi.length, problemi.join(", "));
});

await controllo("helper immagine(): escape di alt e sizes, errori su alt o sizes mancanti; il logo usa logo-240.webp", () => {
  const html = build.immagine(manifesto, "logo", `A "B" <C> & 'D'`, `(x) "1px"`);
  verifica(html.includes(`alt="A &quot;B&quot; &lt;C&gt; &amp; &#39;D&#39;"`), `alt senza escape: ${html.match(/alt="[^"]*"/)?.[0]}`);
  verifica(html.includes(`sizes="(x) &quot;1px&quot;"`), "sizes senza escape");
  verifica(!/<C>/.test(html), "un tag passa dentro l'alt");
  for (const [alt, sizes] of [["", "10px"], ["Logo", ""]]) {
    let fermato = false;
    try {
      build.immagine(manifesto, "logo", alt, sizes);
    } catch {
      fermato = true;
    }
    verifica(fermato, `accettato alt «${alt}» / sizes «${sizes}»`);
  }
  verifica(/<img src="\/img\/logo-240\.webp"/.test(html), "l'<img> del logo non usa logo-240.webp");
  const testata = pagina("index.html").match(/<a class="testata-logo"[\s\S]*?<\/a>/)?.[0] ?? "";
  verifica(testata.includes('sizes="(min-width: 1024px) 99px, 79px"'), "sizes del logo dell'header diverso dalla larghezza a schermo (79 px, 99 px da 1024 px)");
});

await controllo("logo scaricato davvero (Playwright, densità 1, 2, 3): ogni file ≤ 40 KB; a densità 3 su desktop è il 320", async () => {
  const { browser, base } = await browserCondiviso();
  const risultati = [];
  {
    for (const [larghezza, altezza] of [[390, 844], [1440, 900]]) {
      for (const densita of [1, 2, 3]) {
        const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza }, deviceScaleFactor: densita });
        const pagina = await contesto.newPage();
        const scaricati = [];
        pagina.on("response", async (r) => {
          if (/\/img\/logo-/.test(r.url())) scaricati.push({ file: r.url().split("/img/")[1], byte: (await r.body()).length });
        });
        await pagina.goto(base + "/", { waitUntil: "networkidle" });
        await pagina.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); // il logo del footer è lazy
        await pagina.waitForTimeout(400);
        await pagina.waitForLoadState("networkidle");
        await contesto.close();
        verifica(scaricati.length > 0, `${larghezza} px × ${densita}: nessun logo scaricato`);
        for (const s of scaricati) {
          verifica(s.byte <= 40 * KB, `${larghezza} px × ${densita}: ${s.file} pesa ${(s.byte / KB).toFixed(1)} KB`);
          verifica(/^logo-(240|320)\.avif$/.test(s.file), `${larghezza} px × ${densita}: scaricato ${s.file} invece dell'AVIF`);
        }
        risultati.push(`${larghezza}×${densita}: ${[...new Set(scaricati.map((s) => s.file))].join("+")}`);
        if (larghezza === 1440 && densita === 3) verifica(scaricati.some((s) => s.file === "logo-320.avif"), `1440 px × 3: scaricato ${scaricati.map((s) => s.file).join(", ")} invece del 320`);
      }
    }
  }
  console.log(`    ${risultati.join(" · ")}`);
});

await controllo("ogni <img> ha alt, width e height; <picture> con AVIF/WebP e loading come in §9", () => {
  const problemi = [];
  for (const [file] of PAGINE) {
    const html = pagina(file);
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      if (!/\salt="[^"]+"/.test(tag)) problemi.push(`${file}: <img> senza alt`);
      if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) problemi.push(`${file}: <img> senza width/height`);
      if (!/fetchpriority="high"/.test(tag) && !(/loading="lazy"/.test(tag) && /decoding="async"/.test(tag))) problemi.push(`${file}: <img> senza loading="lazy" decoding="async"`);
    }
    for (const m of html.matchAll(/<picture>([\s\S]*?)<\/picture>/g)) {
      if (!/<source type="image\/webp" srcset="[^"]+" sizes="[^"]+">/.test(m[1])) problemi.push(`${file}: <picture> senza <source> WebP con sizes`);
    }
    const logo = html.match(/<a class="testata-logo"[\s\S]*?<\/a>/)?.[0] ?? "";
    if (!logo.includes('alt="Migliore – Estetica Avanzata"')) problemi.push(`${file}: logo dell'header senza alt «Migliore – Estetica Avanzata»`);
    if (!/<footer[\s\S]*<picture>[\s\S]*alt="Migliore – Estetica Avanzata"/.test(html)) problemi.push(`${file}: logo del footer mancante`);
  }
  verifica(!problemi.length, problemi.join(", "));
});

await controllo("favicon, apple-touch-icon e og:image (con misure e alt) nella <head> di ogni pagina", () => {
  for (const [file] of PAGINE) {
    const testa = pagina(file).match(/<head>[\s\S]*?<\/head>/)[0];
    verifica(testa.includes('<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">'), `${file}: favicon 32`);
    verifica(testa.includes('<link rel="icon" type="image/png" sizes="16x16" href="/img/favicon-16.png">'), `${file}: favicon 16`);
    verifica(testa.includes('<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">'), `${file}: apple-touch-icon`);
    verifica(!testa.includes('href="data:,"'), `${file}: è rimasto il segnaposto della favicon`);
    verifica(/<meta property="og:image" content="[^"]*\/img\/og\.jpg">/.test(testa), `${file}: og:image`);
    verifica(testa.includes('<meta property="og:image:width" content="1200">') && testa.includes('<meta property="og:image:height" content="630">'), `${file}: og:image:width/height`);
    verifica(testa.includes('<meta property="og:image:alt" content="Logo di Migliore – Estetica Avanzata e Cristina Migliore al bancone del centro">'), `${file}: og:image:alt diverso da §8`);
  }
});

// ---------------------------------------------------------------- Step 3: apertura, barra contatti, varianti

await controllo("varianti: title diversi (≤ 60 caratteri), description diverse (60–160), ordine viso/pedicure per pagina", () => {
  const titoli = new Set();
  const descrizioni = new Set();
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const title = decodifica(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
    const description = decodifica(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
    verifica(title.length <= 60, `${file}: title di ${title.length} caratteri (oltre 60 Google lo taglia)`);
    verifica(description.length >= 60 && description.length <= 160, `${file}: description di ${description.length} caratteri`);
    titoli.add(title);
    descrizioni.add(description);
    const ordine = [...html.matchAll(/<!-- sezione: (viso|pedicure)\b|data-sezione="(viso|pedicure)"/g)].map((m) => m[1] ?? m[2]).join(",");
    verifica(ordine === testi.pagine[id].ordine.join(","), `${file}: ordine delle sezioni 3 e 4 «${ordine}»`);
  }
  verifica(titoli.size === 3 && descrizioni.size === 3, "title o description ripetuti tra le pagine");
});

await controllo('una sola immagine con fetchpriority="high" per pagina, ed è la foto 01', () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const alte = [...pagina(file).matchAll(/<img\b[^>]*fetchpriority="high"[^>]*>/g)].map((m) => m[0]);
    verifica(alte.length === 1, `${file}: ${alte.length} immagini con fetchpriority="high"`);
    verifica(/src="\/img\/cristina-bancone-\d+\.webp"/.test(alte[0]) && !/loading="lazy"/.test(alte[0]), `${file}: la priorità alta non è sulla foto 01 (o è lazy)`);
    const sorgenti = pagina(file).match(/<div class="apertura-foto">([\s\S]*?)<\/div>/)?.[1] ?? "";
    verifica(sorgenti.includes('sizes="(min-width: 1024px) 480px, (min-width: 768px) 520px, 100vw"'), `${file}: sizes della foto 01`);
  }
});

await controllo("JSON-LD valido: JSON corretto, tipi schema.org esistenti, solo proprietà note, nessun campo vuoto o null", () => {
  const PROPRIETA = {
    BeautySalon: ["@context", "@type", "name", "image", "telephone", "email", "address", "url", "openingHoursSpecification", "priceRange", "hasMap", "sameAs"],
    PostalAddress: ["@type", "streetAddress", "postalCode", "addressLocality", "addressRegion", "addressCountry"],
    OpeningHoursSpecification: ["@type", "dayOfWeek", "opens", "closes"],
  };
  const GIORNI = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const visita = (nodo, dove) => {
    if (nodo === null || nodo === undefined || nodo === "" || (Array.isArray(nodo) && !nodo.length)) throw new Error(`${dove}: vuoto o null`);
    if (Array.isArray(nodo)) return nodo.forEach((v, i) => visita(v, `${dove}[${i}]`));
    if (typeof nodo !== "object") return;
    const tipo = nodo["@type"];
    verifica(tipo in PROPRIETA, `${dove}: tipo «${tipo}» non previsto`);
    for (const [k, v] of Object.entries(nodo)) {
      verifica(PROPRIETA[tipo].includes(k), `${dove}: proprietà «${k}» non prevista per ${tipo}`);
      visita(v, `${dove}.${k}`);
    }
  };
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const dati = JSON.parse(jsonLdDi(pagina(file))[0]);
    verifica(dati["@context"] === "https://schema.org" && dati["@type"] === "BeautySalon", `${file}: @context o @type`);
    visita(dati, file);
    verifica(/^\+39\d{9,10}$/.test(dati.telephone), `${file}: telephone non in formato internazionale`);
    for (const o of dati.openingHoursSpecification ?? []) {
      verifica(o.dayOfWeek.every((g) => GIORNI.includes(g)) && /^\d{2}:\d{2}$/.test(o.opens) && /^\d{2}:\d{2}$/.test(o.closes), `${file}: orari non validi`);
    }
  }
});

/** Apre una pagina a 390×844 (densità 1) con le opzioni date e restituisce { contesto, pagina }. */
async function apriMobile(percorso, opzioni = {}) {
  const { browser, base } = await browserCondiviso();
  const { senzaBanner, ...altre } = opzioni;
  // senzaBanner: la visitatrice ha già scelto (cookie rifiutati), quindi il banner non compare e non copre la pagina.
  const scelta = { cookies: [], origins: [{ origin: base, localStorage: [{ name: "migliore-consenso", value: JSON.stringify({ v: 1, t: Date.now(), statistiche: false, marketing: false }) }] }] };
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(senzaBanner ? { storageState: scelta } : {}), ...altre });
  const pagina = await contesto.newPage();
  await pagina.goto(base + percorso, { waitUntil: "networkidle" });
  return { contesto, pagina };
}

await controllo("390×844: pulsanti dell'apertura nel primo schermo, elementi cliccabili ≥ 44×44 px, nessuno scroll orizzontale", async () => {
  const problemi = [];
  for (const [percorso] of LINK_PAGINE) {
    const { contesto, pagina } = await apriMobile(percorso);
    const esito = await pagina.evaluate(() => {
      const pulsanti = [...document.querySelectorAll("[data-pulsanti-apertura] .pulsante")].map((el) => el.getBoundingClientRect());
      const visibile = (el) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.visibility !== "hidden" && st.display !== "none" && r.width > 0 && r.height > 0;
      };
      // Esenti, come in WCAG 2.5.8: i link dentro una frase (in linea, con altro testo attorno). Dallo Step 8.
      const inFrase = (el) =>
        el.tagName === "A" && getComputedStyle(el).display === "inline" && el.parentElement.textContent.trim().length > el.textContent.trim().length + 20;
      const piccoli = [...document.querySelectorAll("a[href], button, summary, input, select, textarea, [role='button']")]
        .filter(visibile)
        .filter((el) => !inFrase(el))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ el, r }) => `«${(el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
      return {
        pulsanti: pulsanti.map((r) => ({ top: r.top, bottom: r.bottom })),
        piccoli,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
      };
    });
    await contesto.close();
    if (esito.pulsanti.length !== 2) problemi.push(`${percorso}: ${esito.pulsanti.length} pulsanti nell'apertura`);
    for (const r of esito.pulsanti) if (r.top < 0 || r.bottom > 844) problemi.push(`${percorso}: pulsante fuori dal primo schermo (${Math.round(r.top)}–${Math.round(r.bottom)} px)`);
    if (esito.piccoli.length) problemi.push(`${percorso}: area di tocco < 44 px: ${esito.piccoli.join(", ")}`);
    if (esito.scrollWidth > esito.innerWidth) problemi.push(`${percorso}: scroll orizzontale (${esito.scrollWidth} > ${esito.innerWidth})`);
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("768 px: nessuna foto verticale supera i 520 px di larghezza; cornice 3:4 centrata, object-position 50% 62%", async () => {
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  for (const [percorso] of LINK_PAGINE) {
    const contesto = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const pagina = await contesto.newPage();
    await pagina.goto(base + percorso, { waitUntil: "networkidle" });
    const foto = await pagina.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((img) => img.naturalHeight > img.naturalWidth) // verticali: 01, 03, 04, 05 (il logo è orizzontale)
        .map((img) => {
          const r = img.getBoundingClientRect();
          const cornice = img.closest(".apertura-foto");
          const c = cornice?.getBoundingClientRect();
          return {
            src: img.currentSrc.split("/img/")[1],
            larghezza: r.width,
            altezza: r.height,
            sinistra: c ? c.left : r.left,
            destra: c ? innerWidth - c.right : innerWidth - r.right,
            posizione: getComputedStyle(img).objectPosition,
            cornice: Boolean(cornice),
          };
        }),
    );
    await contesto.close();
    if (!foto.length) problemi.push(`${percorso}: nessuna foto verticale trovata`);
    for (const f of foto) {
      if (f.larghezza > 520.5) problemi.push(`${percorso}: ${f.src} larga ${Math.round(f.larghezza)} px`);
      if (f.cornice) {
        if (Math.abs(f.altezza / f.larghezza - 4 / 3) > 0.01) problemi.push(`${percorso}: cornice non 3:4 (${Math.round(f.larghezza)}×${Math.round(f.altezza)})`);
        if (Math.abs(f.sinistra - f.destra) > 1) problemi.push(`${percorso}: cornice non centrata (${Math.round(f.sinistra)} / ${Math.round(f.destra)} px)`);
        if (f.posizione !== "50% 62%") problemi.push(`${percorso}: object-position ${f.posizione}`);
      }
    }
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("barra contatti: nascosta sull'apertura, compare scorrendo oltre, non copre il footer; senza JS sempre visibile; assente da 768 px (con il banner cookie, a scelta già fatta)", async () => {
  const problemi = [];
  const statoBarra = (pagina) =>
    pagina.evaluate(() => {
      const barra = document.querySelector("[data-barra-contatti]");
      const st = getComputedStyle(barra);
      return { visibile: st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.99, top: barra.getBoundingClientRect().top };
    });
  for (const [percorso] of LINK_PAGINE) {
    const { contesto, pagina } = await apriMobile(percorso, { senzaBanner: true });
    await pagina.waitForTimeout(300);
    if ((await statoBarra(pagina)).visibile) problemi.push(`${percorso}: barra visibile mentre si vedono i pulsanti dell'apertura`);
    const fineApertura = await pagina.evaluate(() => document.querySelector(".apertura").getBoundingClientRect().bottom + scrollY);
    await pagina.evaluate((y) => scrollTo(0, y), fineApertura);
    await pagina.waitForTimeout(450);
    if (!(await statoBarra(pagina)).visibile) problemi.push(`${percorso}: barra non visibile dopo l'apertura`);
    await pagina.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await pagina.waitForTimeout(450);
    const barra = await statoBarra(pagina);
    const fondoFooter = await pagina.evaluate(() => {
      const figli = [...document.querySelector("footer").querySelectorAll("p, a, li")];
      return Math.max(...figli.map((el) => el.getBoundingClientRect().bottom));
    });
    if (!barra.visibile) problemi.push(`${percorso}: barra non visibile in fondo alla pagina`);
    if (fondoFooter > barra.top + 0.5) problemi.push(`${percorso}: il footer finisce a ${Math.round(fondoFooter)} px, sotto la barra (${Math.round(barra.top)} px)`);
    const pulsantiBarra = await pagina.evaluate(() => [...document.querySelectorAll("[data-barra-contatti] .pulsante span")].map((s) => s.textContent));
    if (pulsantiBarra.join() !== [testi.comuni.barraContatti.chiama, testi.comuni.barraContatti.whatsapp].join()) problemi.push(`${percorso}: pulsanti della barra «${pulsantiBarra.join(", ")}»`);
    await contesto.close();

    const senzaJs = await apriMobile(percorso, { javaScriptEnabled: false });
    if (!(await statoBarra(senzaJs.pagina)).visibile) problemi.push(`${percorso}: senza JS la barra non è visibile`);
    await senzaJs.contesto.close();
  }
  const { browser, base } = await browserCondiviso();
  const largo = await browser.newContext({ viewport: { width: 768, height: 900 } });
  const p768 = await largo.newPage();
  await p768.goto(base + "/", { waitUntil: "networkidle" });
  if (await p768.evaluate(() => getComputedStyle(document.querySelector("[data-barra-contatti]")).display !== "none")) problemi.push("a 768 px la barra è presente");
  await largo.close();
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("con reducedMotion «reduce» nessun elemento ha transizioni o animazioni di posizione", async () => {
  const problemi = [];
  for (const [percorso] of LINK_PAGINE) {
    const { contesto, pagina } = await apriMobile(percorso, { reducedMotion: "reduce" });
    await pagina.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await pagina.waitForTimeout(300);
    const trovati = await pagina.evaluate(() => {
      const posizione = /^(all|transform|translate|rotate|scale|top|right|bottom|left|inset|margin|padding)/;
      const durata = (v) => v.split(",").map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000));
      const uscita = [];
      for (const el of document.querySelectorAll("*")) {
        const st = getComputedStyle(el);
        const proprieta = st.transitionProperty.split(",").map((p) => p.trim());
        const durate = durata(st.transitionDuration);
        proprieta.forEach((p, i) => {
          if (posizione.test(p) && (durate[i % durate.length] || 0) > 0.01) uscita.push(`${el.tagName.toLowerCase()}.${el.className}: transition ${p}`);
        });
        if (st.animationName !== "none" && durata(st.animationDuration).some((d) => d > 0.01)) uscita.push(`${el.tagName.toLowerCase()}.${el.className}: animation ${st.animationName}`);
      }
      return uscita;
    });
    await contesto.close();
    if (trovati.length) problemi.push(`${percorso}: ${trovati.slice(0, 5).join(", ")}`);
  }
  verifica(!problemi.length, problemi.join(" · "));
});

// ---------------------------------------------------------------- Step 4: sezione viso

const VOCI_VISO_ATTESE = [ // §2.3: la voce in evidenza per prima, poi le altre nell'ordine dell'elenco
  "Trattamento viso Antiage",
  "Pulizia viso base",
  "Trattamento Antiage contorno occhi e labbra",
  "Laminazione ciglia",
  "Laminazione sopracciglia",
];
const sezioneVisoDi = (html) => html.match(/<section[^>]*data-sezione="viso"[\s\S]*?<\/section>/)?.[0] ?? null;
/** Voci della sezione viso nell'HTML: nome, etichetta, descrizioni, fasi. */
function vociVisoDi(html) {
  return [...html.matchAll(/<li class="viso-voce[^"]*">([\s\S]*?)<\/li>\s*(?=<li class="viso-voce|<\/ul>)/g)].map((m) => {
    const nomeHtml = m[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
    return {
      nome: testoVisibile(nomeHtml.replace(/<span class="etichetta">[\s\S]*?<\/span>/, "")),
      etichetta: /<span class="etichetta">/.test(nomeHtml),
      descrizioni: [...m[1].matchAll(/<p class="viso-descrizione">([\s\S]*?)<\/p>/g)].map((d) => testoVisibile(d[1])),
      fasi: [...(m[1].match(/<ol class="viso-fasi">([\s\S]*?)<\/ol>/)?.[1] ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((f) => testoVisibile(f[1])),
    };
  });
}

await controllo("sezione viso in tutte e tre le pagine: terza su / e /viso/, quarta su /pedicure/", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const viso = sezioneVisoDi(html);
    verifica(viso, `${file}: sezione viso mancante`);
    const posApertura = html.indexOf('class="apertura"');
    const posViso = html.indexOf('data-sezione="viso"');
    const posPedicure = html.search(/<!-- sezione: pedicure|data-sezione="pedicure"/);
    const visoPrima = testi.pagine[id].ordine[0] === "viso";
    verifica(posApertura < posViso, `${file}: la sezione viso viene prima dell'apertura`);
    verifica(visoPrima ? posViso < posPedicure : posPedicure < posViso, `${file}: sezione viso ${visoPrima ? "non terza" : "non quarta"}`);
  }
  // Dallo Step 7 #listino è la sezione del listino vera (prima era un'ancora nascosta): il link «Vedi i prezzi» porta lì.
  verifica(/<section class="sezione listino" id="listino"/.test(pagina("index.html")) && !/id="listino" hidden/.test(pagina("index.html")), "#listino non è la sezione del listino");
});

await controllo("voci viso: esattamente le 5 di §2.3, nomi presi da listino.json, «Trattamento viso Antiage» per prima con «In evidenza»", () => {
  const nomiListino = new Set(json("content/listino.json").categorie.flatMap((c) => c.voci.map((v) => v.nome)));
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const voci = vociVisoDi(sezioneVisoDi(pagina(file)));
    verifica(voci.map((v) => v.nome).join(" | ") === VOCI_VISO_ATTESE.join(" | "), `${file}: voci «${voci.map((v) => v.nome).join(" | ")}»`);
    verifica(voci.every((v) => nomiListino.has(v.nome)), `${file}: una voce non esiste in listino.json`);
    verifica(voci.map((v) => v.etichetta).join() === "true,false,false,false,false", `${file}: l'etichetta «In evidenza» deve stare solo sulla prima voce`);
    verifica(sezioneVisoDi(pagina(file)).includes(`<span class="etichetta">${testi.comuni.viso.etichettaInEvidenza}</span>`), `${file}: testo dell'etichetta`);
  }
});

await controllo("sezione viso: nessun «€», pulsante WhatsApp con il testo viso, foto 03 con l'alt di §8", () => {
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const viso = sezioneVisoDi(pagina(file));
    verifica(!/€|&euro;|\bEUR\b/.test(viso), `${file}: un prezzo nella sezione viso`);
    const wa = [...viso.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)].map((m) => new URL(decodifica(m[1])));
    verifica(wa.length === 1, `${file}: ${wa.length} link WhatsApp nella sezione viso`);
    verifica(wa[0].searchParams.get("text") === testi.whatsapp.viso, `${file}: testo WhatsApp «${wa[0].searchParams.get("text")}»`);
    verifica(viso.includes(`${testi.comuni.viso.pulsante}</span>`) && /class="pulsante pulsante-principale"/.test(viso), `${file}: pulsante «${testi.comuni.viso.pulsante}»`);
    verifica(viso.includes('alt="Cabina per i trattamenti viso del centro Migliore – Estetica Avanzata"'), `${file}: alt della foto 03`);
    verifica(/src="\/img\/cabina-viso-\d+\.webp"/.test(viso) && /loading="lazy"/.test(viso), `${file}: foto 03 mancante o non lazy`);
    verifica(viso.includes(`href="#listino">${testi.comuni.viso.linkPrezzi}</a>`), `${file}: link «Vedi i prezzi ↓» verso #listino`);
  }
});

await controllo("dati non indicati: senza dettagli, macchinari e prodotti nessuna descrizione e nessuna riga «In cabina usiamo»", () => {
  const listino = json("content/listino.json");
  const vuoto = structuredClone(centro);
  vuoto.trattamenti.viso.macchinari = null;
  vuoto.trattamenti.viso.prodotti = null;
  const modello = build.sezioneViso({ listino, centro: vuoto, dettagli: null });
  verifica(modello.cabina === null, "cabina non nulla senza macchinari né prodotti");
  verifica(modello.voci.every((v) => v.descrizione === null && v.fasi === null && v.seguito === null), "descrizioni senza dettagli");
  verifica(build.componi("In cabina usiamo: {cabina}", { cabina: modello.cabina }, "t") === null, "la riga «In cabina usiamo» non sparisce");
  const motore = new build.Motore();
  const html = motore.rendi("{{> viso}}", {
    p: { visoPrima: true }, immagini: { fotoViso: "" }, icone: { fumetto: "" },
    t: { viso: { ...testi.comuni.viso, inCabina: null } }, viso: { voci: modello.voci }, link: { listino: "#listino", whatsappViso: "https://wa.me/1?text=x" },
  }, "prova");
  verifica(!/viso-descrizione|viso-fasi|viso-cabina/.test(html), "il template mostra descrizioni o la riga cabina senza dati");
  verifica(vociVisoDi(html).length === 5, "senza dettagli le 5 voci devono restare");
  // la riga cabina reale: solo se macchinari o prodotti sono indicati, con il testo esatto
  const indicati = [centro.trattamenti.viso.macchinari, centro.trattamenti.viso.prodotti].filter(Boolean).join(", ");
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const riga = sezioneVisoDi(pagina(file)).match(/<p class="viso-cabina[^"]*">([\s\S]*?)<\/p>/)?.[1];
    verifica(indicati ? decodifica(riga ?? "") === `In cabina usiamo: ${indicati}.` : riga === undefined, `${file}: riga «In cabina usiamo» «${riga}»`);
  }
});

await controllo("dettagli viso: ogni voce con una riga mostra la sua descrizione (parole del dettaglio), nessuna descrizione inventata; nomi diversi dal listino ignorati", () => {
  const dettagli = testi.comuni.viso.dettagli ?? {};
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    for (const v of vociVisoDi(sezioneVisoDi(pagina(file)))) {
      const fonte = dettagli[v.nome];
      if (!fonte) {
        verifica(!v.descrizioni.length && !v.fasi.length, `${file}: «${v.nome}» mostra una descrizione che non c'è nei dettagli`);
        continue;
      }
      verifica(v.descrizioni.length > 0, `${file}: «${v.nome}» senza descrizione`);
      // In pagina la descrizione è un paragrafo a sé e comincia con la maiuscola; nel dettaglio segue i due punti.
      const comeNelDettaglio = (pezzo) => pezzo.charAt(0).toLocaleLowerCase("it-IT") + pezzo.slice(1);
      for (const pezzo of [...v.descrizioni, ...v.fasi]) {
        const f = normalizzaSpazi(fonte);
        verifica(f.includes(normalizzaSpazi(pezzo)) || f.includes(comeNelDettaglio(normalizzaSpazi(pezzo))), `${file}: «${pezzo.slice(0, 50)}…» non viene dal dettaglio di «${v.nome}»`);
      }
      verifica(/^\p{Lu}/u.test(v.descrizioni[0]), `${file}: la descrizione di «${v.nome}» comincia con la minuscola`);
      const frasi = v.descrizioni.join(" ").match(/[^.!?]+[.!?]+/g)?.length ?? 0;
      verifica(frasi <= (v.etichetta ? 3 : 2), `${file}: «${v.nome}» ha ${frasi} frasi`);
    }
  }
  const finto = build.sezioneViso({ listino: json("content/listino.json"), centro, dettagli: { ...dettagli, "Pulizia viso profonda": "non deve comparire." } });
  verifica(finto.avvisi.some((a) => a.includes("Pulizia viso profonda")), "un nome che non coincide con il listino non viene segnalato");
  verifica(!finto.voci.some((v) => [v.descrizione, v.seguito].join(" ").includes("non deve comparire")), "un nome che non coincide con il listino viene usato");
  verifica(build.limitaFrasi("Uno. Due. Tre.", 2) === "Uno. Due.", "limitaFrasi non accorcia");
});

await controllo("sezione viso: nessuna parola vietata per il viso (§8, maiuscole o minuscole) e al massimo 3 fasi nella voce in evidenza", () => {
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const viso = sezioneVisoDi(pagina(file));
    const testo = normalizzaSpazi([testoVisibile(viso), testiNascosti(viso)].join(" \n "));
    const trovate = VIETATE.filter((voce) => regexVietata(voce).test(testo));
    verifica(!trovate.length, `${file}: ${trovate.join(", ")}`);
    const voci = vociVisoDi(viso);
    verifica(voci[0].fasi.length >= 1 && voci[0].fasi.length <= 3, `${file}: ${voci[0].fasi.length} fasi nella voce in evidenza`);
    verifica(voci.slice(1).every((v) => v.fasi.length === 0), `${file}: fasi su una voce non in evidenza`);
    verifica(/<ol class="viso-fasi">/.test(viso), `${file}: le fasi non sono un <ol>`);
  }
  const quattro = build.estraiFasi("Si fa in quattro fasi: a, b, c e d.");
  verifica(quattro === null, "con più di 3 fasi non va fatto l'elenco");
});

await controllo("landing tutta color sabbia (§5): nessun fondo di altri colori né sfumato, su tutte le pagine a 390 e 1440 px", async () => {
  // Nel CSS niente sfumature di fondo. Il sabbia chiara è ammesso solo per piccoli dettagli (§5, Step 6):
  // dove non può stare lo verifica il controllo «fondo unico» qui sotto.
  const css = ["tokens.css", "base.css", "sezioni.css"].map((f) => [f, leggi(`src/css/${f}`)]);
  for (const [f, testo] of css) {
    verifica(!/background(-image)?\s*:[^;]*gradient/i.test(testo), `src/css/${f}: fondo sfumato`);
  }
  for (const [file] of PAGINE) verifica(!/sezione-chiara/.test(pagina(file)), `${file}: classe sezione-chiara`);
  // Nel browser: ogni fondo è trasparente, sabbia, oppure uno dei piccoli elementi ammessi.
  const ammessi = { "rgb(244, 219, 202)": "sabbia", "rgb(250, 237, 228)": "sabbia chiara (piccoli dettagli)", "rgb(235, 203, 181)": "sabbia profonda (etichette, schede)", "rgb(31, 22, 18)": "inchiostro (pulsante principale)", "rgb(255, 248, 243)": "crema (campi dei moduli)" };
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  for (const [larghezza, altezza] of [[390, 844], [1440, 900]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
    for (const [percorso] of [...LINK_PAGINE, ["/pagina-che-non-esiste/"]]) {
      const pagina = await contesto.newPage();
      await pagina.goto(base + percorso, { waitUntil: "networkidle" });
      const fondi = await pagina.evaluate(() =>
        [document.documentElement, document.body, ...[...document.body.querySelectorAll("*")].filter((el) => el.getClientRects().length)].map((el) => {
          const st = getComputedStyle(el);
          return { el: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`, colore: st.backgroundColor, immagine: st.backgroundImage };
        }),
      );
      const corpo = fondi.find((f) => f.el.startsWith("body"));
      if (corpo.colore !== "rgb(244, 219, 202)") problemi.push(`${percorso} ${larghezza}: body ${corpo.colore}`);
      for (const f of fondi) {
        const trasparente = f.colore === "rgba(0, 0, 0, 0)" || f.colore === "transparent";
        if (!trasparente && !(f.colore in ammessi)) problemi.push(`${percorso} ${larghezza}: ${f.el} fondo ${f.colore}`);
        if (f.immagine !== "none") problemi.push(`${percorso} ${larghezza}: ${f.el} immagine di fondo ${f.immagine.slice(0, 40)}`);
        if (/^(header|main|section|footer|div\.barra-contatti)/.test(f.el) && !trasparente && f.colore !== "rgb(244, 219, 202)") problemi.push(`${percorso} ${larghezza}: ${f.el} non è sabbia`);
      }
      await pagina.close();
    }
    await contesto.close();
  }
  verifica(!problemi.length, [...new Set(problemi)].slice(0, 8).join(" · "));
});

// Tutte le pagine generate, con la 404 (dallo Step 7 entrano da sole anche /privacy/ e /cookie/).
function percorsiDist() {
  const pagine = elenca(DIST, (p) => p.endsWith("index.html")).map((p) => "/" + rel(p).replace(/^dist\//, "").replace(/index\.html$/, ""));
  return [...new Set(pagine)].sort().concat(existsSync(join(DIST, "404.html")) ? ["/pagina-che-non-esiste/"] : []);
}
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
// Colori presi da CLAUDE.md §5, non da tokens.css: così anche un token cambiato per sbaglio si vede.
const PALETTE = { sabbia: rgb("#F4DBCA"), chiara: rgb("#FAEDE4"), profonda: rgb("#EBCBB5"), crema: rgb("#FFF8F3"), linea: rgb("#D9B49C"), accento: rgb("#8C4318") };
// Gli unici blocchi in rilievo su --sabbia-profonda (§5): pillola, scheda «Pedicure avanzato», blocco del codice sconto.
const RILIEVI = [".etichetta", ".scheda-avanzato", ".codice-blocco"];

await controllo("fondo unico (§5): <body> e ogni <section> su --sabbia in ogni pagina, a 390, 768 e 1440 px; filetto --linea largo quanto il contenuto tra le sezioni e sopra il footer; sabbia profonda, crema e sabbia chiara solo dove ammessi", async () => {
  const { browser, base } = await browserCondiviso();
  const percorsi = percorsiDist();
  const problemi = [];
  let sezioniViste = 0;
  let schedeViste = 0;
  for (const [larghezza, altezza] of [[390, 844], [768, 1024], [1440, 900]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
    for (const percorso of percorsi) {
      const pg = await contesto.newPage();
      await pg.goto(base + percorso, { waitUntil: "networkidle" });
      const r = await pg.evaluate(({ P, RILIEVI }) => {
        const nome = (el) => el.dataset?.sezione || el.id || `${el.tagName.toLowerCase()}${el.classList[0] ? "." + el.classList[0] : ""}`;
        const st = (el, pseudo) => getComputedStyle(el, pseudo);
        const c = document.querySelector("main .contenitore");
        const contenuto = c.clientWidth - parseFloat(st(c).paddingLeft) - parseFloat(st(c).paddingRight);
        const visibili = [...document.querySelectorAll("main > section")].filter((s) => s.getClientRects().length);
        const separati = [...visibili.map((el, i) => [el, i > 0]), ...[...document.querySelectorAll("main ~ footer")].map((el) => [el, true])];
        // Chromium arrotonda nello stile calcolato il bordo di 1,5 px a 1 px: la larghezza si legge
        // dal CSS (CSSOM): l'ultima regola che vale per la scheda (anche dentro @media e @supports
        // attivi) e dichiara il bordo, con il token risolto. Stile e colore dallo stile calcolato.
        const regole = (lista) => [...lista].flatMap((x) =>
          x.cssRules && x.conditionText !== undefined
            ? (x instanceof CSSMediaRule ? matchMedia(x.conditionText).matches : CSS.supports(x.conditionText)) ? regole(x.cssRules) : []
            : [x],
        );
        const tutte = [...document.styleSheets].flatMap((f) => regole(f.cssRules)).filter((x) => x.selectorText && x.style);
        const bordoDichiarato = (el) => {
          const valori = tutte
            .filter((x) => { try { return el.matches(x.selectorText); } catch { return false; } })
            .map((x) => x.style.getPropertyValue("border-width") || x.style.getPropertyValue("border-top-width") || x.style.getPropertyValue("border").split(/\s+(?![^(]*\))/)[0])
            .filter(Boolean);
          return valori.at(-1) ?? "";
        };
        return {
          html: st(document.documentElement).backgroundColor,
          body: [st(document.body).backgroundColor, st(document.body).backgroundImage],
          sezioni: [...document.querySelectorAll("section")].map((s) => [nome(s), st(s).backgroundColor, st(s).backgroundImage]),
          filetti: separati.map(([el, atteso]) => {
            const b = st(el, "::before");
            return { nome: nome(el), atteso, c: b.content, w: parseFloat(b.width), h: parseFloat(b.height), colore: b.backgroundColor, pos: b.position, top: b.top };
          }),
          contenuto,
          schede: [...document.querySelectorAll(".scheda-estetico, .scheda-avanzato")].map((s) => {
            const x = st(s);
            const lati = ["Top", "Right", "Bottom", "Left"];
            const tipo = s.classList.contains("scheda-avanzato") ? "avanzato" : "estetico";
            const dichiarato = bordoDichiarato(s);
            const larghezza = dichiarato.replace(/var\((--[\w-]+)\)/, (_, n) => st(document.documentElement).getPropertyValue(n).trim());
            return { tipo, fondo: x.backgroundColor, larghezza, stili: [...new Set(lati.map((l) => x[`border${l}Style`]))], colori: [...new Set(lati.map((l) => x[`border${l}Color`]))] };
          }),
          fuoriPosto: [...document.body.querySelectorAll("*")].flatMap((el) => {
            const f = st(el).backgroundColor;
            if (f === P.profonda && !el.matches(RILIEVI.join(", "))) return [`${nome(el)} su sabbia profonda`];
            if (f === P.crema && !el.matches("input, textarea, select")) return [`${nome(el)} su crema`];
            if (f === P.chiara && (el.matches("main, section, header, footer, article, aside, .barra-contatti") || el.querySelector("section, h1, h2"))) return [`${nome(el)} su sabbia chiara`];
            return [];
          }),
        };
      }, { P: PALETTE, RILIEVI });
      await pg.close();
      const dove = `${percorso} ${larghezza}`;
      if (![PALETTE.sabbia, "rgba(0, 0, 0, 0)"].includes(r.html)) problemi.push(`${dove}: <html> ${r.html}`);
      if (r.body[0] !== PALETTE.sabbia || r.body[1] !== "none") problemi.push(`${dove}: <body> ${r.body.join(" ")}`);
      for (const [n, colore, immagine] of r.sezioni) {
        sezioniViste++;
        if (colore !== PALETTE.sabbia || immagine !== "none") problemi.push(`${dove}: <section> ${n} ${colore}${immagine !== "none" ? " " + immagine.slice(0, 30) : ""}`);
      }
      for (const f of r.filetti) {
        if (!f.atteso) {
          if (f.c !== "none" && f.c !== "normal") problemi.push(`${dove}: ${f.nome} (prima sezione) con filetto`);
          continue;
        }
        if (f.c === "none" || f.c === "normal") { problemi.push(`${dove}: ${f.nome} senza filetto`); continue; }
        if (f.colore !== PALETTE.linea) problemi.push(`${dove}: filetto di ${f.nome} ${f.colore}`);
        if (!(f.h > 0 && f.h <= 1)) problemi.push(`${dove}: filetto di ${f.nome} alto ${f.h} px`);
        if (Math.abs(f.w - r.contenuto) > 0.5) problemi.push(`${dove}: filetto di ${f.nome} largo ${f.w} px invece di ${r.contenuto}`);
        if (f.pos !== "absolute" || f.top !== "0px") problemi.push(`${dove}: filetto di ${f.nome} non sul bordo superiore`);
      }
      for (const s of r.schede) {
        schedeViste++;
        if (s.tipo === "estetico") {
          if (s.fondo !== PALETTE.sabbia) problemi.push(`${dove}: scheda «Pedicure estetico» su ${s.fondo}`);
          if (s.larghezza !== "1.5px" || s.stili.join() !== "solid" || s.colori.join() !== PALETTE.linea) problemi.push(`${dove}: scheda «Pedicure estetico» bordo «${s.larghezza} ${s.stili.join("/")} ${s.colori.join("/")}» invece di 1.5px solid --linea`);
        } else if (s.fondo !== PALETTE.profonda) problemi.push(`${dove}: scheda «Pedicure avanzato» su ${s.fondo}`);
      }
      problemi.push(...r.fuoriPosto.map((x) => `${dove}: ${x}`));
    }
    await contesto.close();
  }
  verifica(sezioniViste > 0 && schedeViste > 0, "nessuna sezione o scheda trovata");
  verifica(!problemi.length, [...new Set(problemi)].slice(0, 8).join(" · "));
});

await controllo("ordine su mobile (§5): a 390 e 768 px, in ogni sezione con foto (tranne l'apertura) l'H2 viene prima della foto", async () => {
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  let sezioniViste = 0;
  for (const [larghezza, altezza] of [[390, 844], [768, 1024]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
    for (const [percorso] of LINK_PAGINE) {
      const pagina = await contesto.newPage();
      await pagina.goto(base + percorso, { waitUntil: "networkidle" });
      const sezioni = await pagina.evaluate(() =>
        [...document.querySelectorAll("main section:not(.apertura)")]
          .filter((sez) => sez.querySelector("img") && sez.querySelector("h2"))
          .map((sez) => ({
            nome: sez.dataset.sezione || sez.id,
            h2: sez.querySelector("h2").getBoundingClientRect().top,
            foto: sez.querySelector("img").getBoundingClientRect().top,
          })),
      );
      for (const sez of sezioni) {
        sezioniViste++;
        if (!(sez.h2 < sez.foto)) problemi.push(`${percorso} ${larghezza} px: in «${sez.nome}» la foto (${Math.round(sez.foto)}) viene prima dell'H2 (${Math.round(sez.h2)})`);
      }
      await pagina.close();
    }
    await contesto.close();
  }
  verifica(sezioniViste > 0, "nessuna sezione con foto trovata");
  verifica(!problemi.length, problemi.join(" · "));
});

// ---------------------------------------------------------------- Step 5: sezione pedicure avanzato

const sezionePedicureDi = (html) => html.match(/<section[^>]*data-sezione="pedicure"[\s\S]*?<\/section>/)?.[0] ?? null;
const RIGA_LIMITE = testi.comuni.pedicure.rigaLimite;
const togliInvisibili = (s) => s.replace(/⁠/g, "");
/** Le schede del confronto nell'HTML: classe, titolo, sottotitolo, voci, durata. */
function schedeDi(sezione) {
  return [...sezione.matchAll(/<div class="scheda (scheda-\w+)[^"]*">([\s\S]*?)<\/div>/g)].map((m) => ({
    classe: m[1],
    titolo: testoVisibile(m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? ""),
    sottotitolo: testoVisibile(m[2].match(/<p class="scheda-sottotitolo">([\s\S]*?)<\/p>/)?.[1] ?? ""),
    voci: [...(m[2].match(/<ul class="scheda-voci">([\s\S]*?)<\/ul>/)?.[1] ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((v) => ({
      testo: testoVisibile(v[1]),
      spunta: /<svg\b/.test(v[1]),
    })),
    durata: togliInvisibili(testoVisibile(m[2].match(/<p class="scheda-durata">([\s\S]*?)<\/p>/)?.[1] ?? "")) || null,
  }));
}

await controllo("sezione pedicure in tutte e tre le pagine: terza su /pedicure/, quarta su / e /viso/, sul sabbia", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const sezione = sezionePedicureDi(html);
    verifica(sezione, `${file}: sezione pedicure mancante`);
    const posApertura = html.indexOf('class="apertura"');
    const posViso = html.indexOf('data-sezione="viso"');
    const posPedicure = html.indexOf('data-sezione="pedicure"');
    const pedicurePrima = testi.pagine[id].ordine[0] === "pedicure";
    verifica(posApertura < posPedicure, `${file}: la sezione pedicure viene prima dell'apertura`);
    verifica(pedicurePrima ? posPedicure < posViso : posViso < posPedicure, `${file}: sezione pedicure ${pedicurePrima ? "non terza" : "non quarta"}`);
    verifica(/<section class="sezione pedicure"/.test(sezione), `${file}: la sezione pedicure ha classi di fondo in più (la landing è tutta sabbia)`);
  }
});

await controllo("linguaggio della sezione pedicure: nessun termine sanitario (fuori dalla riga sul limite), nessuna nota esclusa di Cristina", () => {
  const vietate = [
    "podologico", "podologica", "podoestetic*", "curativ*", "terapeutic*", "medical*", "calli", "callo", "duron*",
    "verruc*", "unghie incarnite", "unghia incarnita", "micos*", "elimin*", "risolv*", "garantit*",
    // dalle note di Cristina che non si riportano (§8)
    "ragad*", "unghie ispessite", "unghia ispessita", "base curativa",
  ];
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const sezione = sezionePedicureDi(pagina(file));
    const testo = normalizzaSpazi([testoVisibile(sezione), testiNascosti(sezione)].join(" \n "));
    verifica(testo.includes(RIGA_LIMITE), `${file}: manca la riga sul limite`);
    const senzaLimite = testo.split(RIGA_LIMITE).join(" ");
    const trovate = vietate.filter((v) => regexVietata(v).test(senzaLimite));
    verifica(!trovate.length, `${file}: ${trovate.join(", ")}`);
  }
});

await controllo("«podologo» e «medico» compaiono una sola volta per pagina, nella riga sul limite (e mai sulla 404)", () => {
  for (const [file, id] of PAGINE) {
    const html = pagina(file);
    const testo = normalizzaSpazi([testoVisibile(html), testiNascosti(html), ...jsonLdDi(html)].join(" \n "));
    const podologo = testo.match(/(?<!\p{L})podolog\p{L}*/giu) ?? [];
    const medico = testo.match(/(?<!\p{L})medic\p{L}*/giu) ?? [];
    const attese = id ? 1 : 0;
    verifica(podologo.length === attese, `${file}: «podolog…» ${podologo.length} volte`);
    verifica(medico.length === attese, `${file}: «medic…» ${medico.length} volte`);
    if (id) {
      const limite = testoVisibile(html.match(/<p class="pedicure-limite[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? "");
      verifica(limite === RIGA_LIMITE, `${file}: riga sul limite «${limite}»`);
    }
  }
});

await controllo("sezione pedicure: nessun «€», pulsante WhatsApp con il testo pedicure, link #listino, foto 05 con l'alt di §8", () => {
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const sezione = sezionePedicureDi(pagina(file));
    verifica(!/€|&euro;|\bEUR\b/.test(sezione), `${file}: un prezzo nella sezione pedicure`);
    const wa = [...sezione.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)].map((m) => new URL(decodifica(m[1])));
    verifica(wa.length === 1, `${file}: ${wa.length} link WhatsApp nella sezione pedicure`);
    verifica(wa[0].searchParams.get("text") === testi.whatsapp.pedicure, `${file}: testo WhatsApp «${wa[0].searchParams.get("text")}»`);
    verifica(sezione.includes(`${testi.comuni.pedicure.pulsante}</span>`) && /class="pulsante pulsante-principale"/.test(sezione), `${file}: pulsante «${testi.comuni.pedicure.pulsante}»`);
    verifica(sezione.includes(`href="#listino">${testi.comuni.pedicure.linkPrezzi}</a>`), `${file}: link «Vedi i prezzi ↓» verso #listino`);
    verifica(sezione.includes('alt="Postazione per manicure e pedicure del centro Migliore – Estetica Avanzata"'), `${file}: alt della foto 05`);
    verifica(/src="\/img\/postazione-pedicure-\d+\.webp"/.test(sezione) && /loading="lazy"/.test(sezione), `${file}: foto 05 mancante o non lazy`);
  }
});

await controllo("schede: «Pedicure estetico» poi «Pedicure avanzato», voci e durate dai dati (una per punto e virgola, iniziale maiuscola, con spunta)", () => {
  const dati = centro.trattamenti.pedicure;
  const attese = [
    { classe: "scheda-estetico", titolo: "Pedicure estetico", sottotitolo: "La pedicure classica", chiave: "estetico" },
    { classe: "scheda-avanzato", titolo: "Pedicure avanzato", sottotitolo: "Un lavoro più approfondito", chiave: "avanzato" },
  ];
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const schede = schedeDi(sezionePedicureDi(pagina(file)));
    verifica(schede.map((s) => s.classe).join() === "scheda-estetico,scheda-avanzato", `${file}: ordine delle schede ${schede.map((s) => s.classe).join(", ")}`);
    schede.forEach((scheda, i) => {
      const a = attese[i];
      verifica(scheda.titolo === a.titolo && scheda.sottotitolo === a.sottotitolo, `${file}: titolo o sottotitolo della scheda ${i + 1}`);
      const fonte = (dati[a.chiave].include ?? "").split(";").map((v) => v.trim()).filter(Boolean);
      verifica(scheda.voci.length === fonte.length, `${file}: ${a.titolo}: ${scheda.voci.length} voci invece di ${fonte.length}`);
      scheda.voci.forEach((v, j) => {
        verifica(v.testo.toLowerCase() === fonte[j].toLowerCase(), `${file}: ${a.titolo}: voce «${v.testo}» invece di «${fonte[j]}»`);
        verifica(v.testo[0] === v.testo[0].toLocaleUpperCase("it-IT"), `${file}: ${a.titolo}: «${v.testo}» senza maiuscola`);
        verifica(v.spunta, `${file}: ${a.titolo}: «${v.testo}» senza spunta`);
      });
      const durata = dati[a.chiave].durata;
      verifica(durata ? scheda.durata === `Durata: ${durata}` : scheda.durata === null, `${file}: ${a.titolo}: durata «${scheda.durata}»`);
    });
    const igiene = testoVisibile(sezionePedicureDi(pagina(file)).match(/<p class="pedicure-igiene[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? "");
    verifica(dati.strumentiIgiene ? igiene === `Strumenti e igiene: ${dati.strumentiIgiene}.` : igiene === "", `${file}: riga strumenti e igiene «${igiene}»`);
  }
  verifica(build.vociInclude("pediluvio; ; crema finale ;") .join("|") === "Pediluvio|Crema finale", "vociInclude non divide sul punto e virgola");
  verifica(build.vociInclude(null) === null, "vociInclude con dati assenti");
  // Senza durate né strumenti: niente righe «Durata» né «Strumenti e igiene»
  const vuoto = structuredClone(centro);
  vuoto.trattamenti.pedicure.estetico.durata = null;
  vuoto.trattamenti.pedicure.avanzato.durata = null;
  vuoto.trattamenti.pedicure.strumentiIgiene = null;
  const tVuoto = { pedicure: { ...testi.comuni.pedicure, scheda1: { ...testi.comuni.pedicure.scheda1, durata: null }, scheda2: { ...testi.comuni.pedicure.scheda2, durata: null }, strumentiIgiene: null } };
  const html = new build.Motore().rendi("{{> pedicure}}", {
    t: tVuoto, pedicure: build.sezionePedicure({ centro: vuoto, t: tVuoto }), immagini: { fotoPedicure: "" },
    icone: { spunta: "", scudo: "", info: "", fumetto: "" }, link: { listino: "#listino", whatsappPedicure: "https://wa.me/1?text=x" },
  }, "prova");
  verifica(!/scheda-durata|pedicure-igiene/.test(html), "con durate e strumenti non indicati il template mostra comunque le righe");
  verifica(html.includes("pedicure-limite"), "la riga sul limite deve restare sempre");
});

await controllo("foto 05: object-position 55% 60% da 768 px, sfumatura a sinistra da 1024 px", async () => {
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  for (const [larghezza, altezza, maschera] of [[768, 1024, null], [1440, 900, "to right"]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
    const pagina = await contesto.newPage();
    await pagina.goto(base + "/pedicure/", { waitUntil: "networkidle" });
    const st = await pagina.evaluate(() => {
      const img = document.querySelector(".pedicure-foto img");
      const s = getComputedStyle(img);
      return { posizione: s.objectPosition, maschera: s.maskImage || s.webkitMaskImage, larghezza: img.getBoundingClientRect().width };
    });
    await contesto.close();
    if (st.posizione !== "55% 60%") problemi.push(`${larghezza} px: object-position ${st.posizione}`);
    if (maschera && !st.maschera.includes(maschera)) problemi.push(`${larghezza} px: sfumatura ${st.maschera}`);
    if (larghezza === 768 && st.larghezza > 520.5) problemi.push(`768 px: foto larga ${Math.round(st.larghezza)} px`);
  }
  verifica(!problemi.length, problemi.join(" · "));
});

// ---------------------------------------------------------------- Step 6: chi sono, come prenotare, dove siamo e orari

const MAPPA_ATTESA = "https://www.google.com/maps/search/?api=1&query=Via%20Roma%202%2FA%2C%2021040%20Caronno%20Varesino%20VA";
const sezioneDi = (html, nome) => html.match(new RegExp(`<section[^>]*data-sezione="${nome}"[\\s\\S]*?<\\/section>`))?.[0] ?? null;

await controllo("sezioni 5, 6 e 8 in tutte le pagine, nell'ordine di §6 (il segnaposto del codice sconto tra 6 e 8)", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const [terza, quarta] = testi.pagine[id].ordine;
    const segni = [
      ["apertura", html.indexOf('class="apertura"')],
      [terza, html.indexOf(`data-sezione="${terza}"`)],
      [quarta, html.indexOf(`data-sezione="${quarta}"`)],
      ["chi-sono", html.indexOf('data-sezione="chi-sono"')],
      ["come-prenotare", html.indexOf('data-sezione="come-prenotare"')],
      ["codice-sconto (segnaposto)", html.search(/<!-- sezione: codice-sconto|data-sezione="codice-sconto"/)],
      ["dove-siamo", html.indexOf('data-sezione="dove-siamo"')],
      ["listino", html.indexOf('id="listino"')],
      ["footer", html.indexOf("<footer")],
    ];
    const mancanti = segni.filter(([, pos]) => pos < 0).map(([n]) => n);
    verifica(!mancanti.length, `${file}: mancano ${mancanti.join(", ")}`);
    const ordine = [...segni].sort((a, b) => a[1] - b[1]).map(([n]) => n);
    verifica(ordine.join() === segni.map(([n]) => n).join(), `${file}: ordine ${ordine.join(" → ")}`);
  }
});

await controllo("pulsanti per pagina come in §6: apertura 2, viso 1, pedicure 1, come prenotare 2, dove siamo 1, barra 2", () => {
  const attesi = { apertura: 2, viso: 1, pedicure: 1, "come-prenotare": 2, "dove-siamo": 1 };
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    // Dallo Step 8: §6 conta i pulsanti di contatto, che sono link (<a>). Il pulsante d'invio del modulo del
    // codice sconto e «Copia il codice» sono controlli del modulo e si verificano a parte.
    const conta = (frammento) => (frammento?.match(/<a class="pulsante pulsante-/g) ?? []).length;
    const apertura = html.match(/<section class="apertura"[\s\S]*?<\/section>/)?.[0];
    verifica(conta(apertura) === attesi.apertura, `${file}: apertura con ${conta(apertura)} pulsanti`);
    for (const nome of ["viso", "pedicure", "come-prenotare", "dove-siamo"]) {
      verifica(conta(sezioneDi(html, nome)) === attesi[nome], `${file}: ${nome} con ${conta(sezioneDi(html, nome))} pulsanti`);
    }
    const barra = html.match(/<div class="barra-contatti"[\s\S]*?<\/div>/)?.[0];
    verifica(conta(barra) === 2, `${file}: barra con ${conta(barra)} pulsanti`);
    verifica(conta(html.match(/<main[\s\S]*<\/main>/)[0]) === 7, `${file}: ${conta(html.match(/<main[\s\S]*<\/main>/)[0])} pulsanti nel main invece di 7`);
  }
});

await controllo("chi sono: testo predefinito di §8 (presentazione non indicata), payoff, foto 04 con l'alt di §8", () => {
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const sez = sezioneDi(pagina(file), "chi-sono");
    const testo = testoVisibile(sez);
    const atteso = centro.presentazione ?? testi.comuni.chiSono.testoPredefinito;
    verifica(testo.includes(atteso), `${file}: testo di presentazione`);
    verifica(testoVisibile(sez.match(/<p class="chi-payoff[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? "") === `“${centro.payoff}”`, `${file}: payoff`);
    verifica(sez.includes('alt="Una delle cabine del centro Migliore – Estetica Avanzata"') && /cabina-lettino-\d+\.webp/.test(sez), `${file}: foto 04`);
    verifica(/<h2 id="chi-sono-titolo">Migliore è il\s?mio cognome\. Ed\s?è anche una\s?promessa\.<\/h2>/.test(sez.replace(/ /g, " ")), `${file}: H2`);
  }
});

await controllo("come prenotare: tre passi di §8 in un <ol>, «Chiama» e «Scrivi su WhatsApp» con il testo della pagina", () => {
  const attesi = [
    "Chiama o scrivi su WhatsApp al 352 060 1109.",
    "Scegli il giorno e l'ora: dal martedì al venerdì, dalle 09:00 alle 18:00; il sabato, dalle 08:00 alle 14:00.",
    "Vieni in Via Roma 2/A a Caronno Varesino: il tuo appuntamento è pronto.",
  ].map(tipografico);
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const sez = sezioneDi(pagina(file), "come-prenotare");
    const passi = [...(sez.match(/<ol class="passi">([\s\S]*?)<\/ol>/)?.[1] ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => normalizzaSpazi(testoVisibile(m[1])));
    verifica(passi.join(" | ") === attesi.join(" | "), `${file}: passi «${passi.join(" | ")}»`);
    verifica(sez.includes(`href="tel:${centro.telefonoE164}"`), `${file}: pulsante Chiama`);
    const wa = sez.match(/href="(https:\/\/wa\.me\/[^"]*)"/)?.[1];
    verifica(wa && new URL(decodifica(wa)).searchParams.get("text") === testi.whatsapp[testi.pagine[id].whatsapp], `${file}: testo WhatsApp di «Come prenotare»`);
    verifica(sez.includes(">Scrivi su WhatsApp</span>"), `${file}: etichetta «Scrivi su WhatsApp»`);
  }
});

await controllo("dove siamo: <address> con indirizzo e telefono, orari, link Maps con l'indirizzo codificato (nuova scheda), foto 02; hasMap nel JSON-LD", () => {
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const sez = sezioneDi(pagina(file), "dove-siamo");
    const indirizzo = sez.match(/<address[^>]*>([\s\S]*?)<\/address>/)?.[1] ?? "";
    verifica(testoVisibile(indirizzo).includes(centro.indirizzo.completo), `${file}: indirizzo fuori da <address>`);
    verifica(indirizzo.includes(`href="tel:${centro.telefonoE164}"`), `${file}: telefono nel blocco indirizzo`);
    const maps = [...sez.matchAll(/<a\b[^>]*href="(https:\/\/www\.google\.com\/maps\/[^"]*)"[^>]*>/g)];
    verifica(maps.length === 1, `${file}: ${maps.length} link Maps`);
    verifica(decodifica(maps[0][1]) === (centro.social.schedaGoogle ?? MAPPA_ATTESA), `${file}: link Maps «${decodifica(maps[0][1])}»`);
    verifica(/target="_blank"/.test(maps[0][0]) && /rel="noopener"/.test(maps[0][0]), `${file}: Maps senza nuova scheda`);
    verifica(sez.includes(">Apri in Google Maps</span>") && /pulsante-secondario/.test(maps[0][0]), `${file}: pulsante secondario «Apri in Google Maps»`);
    verifica(sez.includes('alt="L’ingresso del centro Migliore – Estetica Avanzata in Via Roma 2/A"') && /ingresso-\d+\.webp/.test(sez), `${file}: foto 02`);
    verifica(JSON.parse(jsonLdDi(pagina(file))[0]).hasMap === (centro.social.schedaGoogle ?? MAPPA_ATTESA), `${file}: hasMap del JSON-LD`);
    verifica(!("sameAs" in JSON.parse(jsonLdDi(pagina(file))[0])) || [centro.social.instagram, centro.social.facebook].some(Boolean), `${file}: sameAs senza social indicati`);
  }
  const conScheda = structuredClone(centro);
  conScheda.social.schedaGoogle = "https://maps.app.goo.gl/esempio";
  verifica(build.linkMappa(conScheda) === "https://maps.app.goo.gl/esempio", "con la scheda Google il pulsante non usa quel link");
});

await controllo("nessun <iframe> nel sito (niente mappe incorporate)", () => {
  const con = elenca(DIST, (p) => p.endsWith(".html")).filter((f) => /<iframe\b/i.test(readFileSync(f, "utf8")));
  verifica(!con.length, con.map(rel).join(", "));
});

await controllo("orari scritti in modo identico (stessa fonte: le fasce di centro.json) in apertura, «Come prenotare» e «Dove siamo»; fasce validate in build", () => {
  const fasce = centro.orari.fasce.map((f) => `${f.giorni}, dalle ${f.apertura} alle ${f.chiusura}`);
  verifica(fasce.join("; ") === "dal martedì al venerdì, dalle 09:00 alle 18:00; il sabato, dalle 08:00 alle 14:00", `fasce di centro.json diverse da §2.1: ${fasce.join("; ")}`);
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const blocchi = {
      apertura: testoVisibile(html.match(/<p class="apertura-info">([\s\S]*?)<\/p>/)?.[1] ?? ""),
      "come prenotare": testoVisibile(sezioneDi(html, "come-prenotare")),
      "dove siamo": testoVisibile(html.match(/<p class="dove-riga dove-orari">([\s\S]*?)<\/p>/)?.[1] ?? ""),
    };
    for (const [nome, testo] of Object.entries(blocchi)) {
      for (const f of fasce) verifica(testo.includes(f), `${file}: in «${nome}» manca «${f}»: «${testo.slice(0, 100)}»`);
    }
  }
  // stessa fonte: nei testi le ore e i giorni sono segnaposto di centro.json, mai scritti a mano
  const grezzi = [testi.comuni.apertura.rigaInfo, testi.comuni.comePrenotare.passi[1], testi.comuni.doveSiamo.orari];
  for (const g of grezzi) verifica(/\{orari\.(testo|riga)\}/.test(g) && !/\d{2}:\d{2}|lunedì|martedì|sabato/.test(g), `testo scritto a mano: «${g}»`);
  // fasce sbagliate fermano la build
  for (const sbagliate of [[], [{ giorni: "il sabato", apertura: "8:00", chiusura: "14:00" }], [{ giorni: "il sabato", apertura: "14:00", chiusura: "08:00" }]]) {
    let fermato = false;
    try {
      build.testiOrari({ fasce: sbagliate });
    } catch {
      fermato = true;
    }
    verifica(fermato, `fasce accettate: ${JSON.stringify(sbagliate)}`);
  }
});

await controllo("foto 04 e 02: object-position 40% 55% (chi sono) da 768 px; foto 02 intera, sfumata a sinistra da 1024 px", async () => {
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  for (const [larghezza, altezza] of [[768, 1024], [1440, 900]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
    const pagina = await contesto.newPage();
    await pagina.goto(base + "/", { waitUntil: "networkidle" });
    const st = await pagina.evaluate(() => {
      const chi = getComputedStyle(document.querySelector(".chi-foto img"));
      const dove = document.querySelector(".dove-foto img");
      const r = dove.getBoundingClientRect();
      const sd = getComputedStyle(dove);
      return { chi: chi.objectPosition, rapporto: r.width / r.height, naturale: dove.naturalWidth / dove.naturalHeight, maschera: sd.maskImage || sd.webkitMaskImage };
    });
    await contesto.close();
    if (st.chi !== "40% 55%") problemi.push(`${larghezza} px: chi sono object-position ${st.chi}`);
    if (Math.abs(st.rapporto - st.naturale) > 0.01) problemi.push(`${larghezza} px: foto 02 ritagliata (${st.rapporto.toFixed(3)} invece di ${st.naturale.toFixed(3)})`);
    if (larghezza === 1440 && !st.maschera.includes("to right")) problemi.push(`1440 px: foto 02 senza sfumatura a sinistra (${st.maschera})`);
  }
  verifica(!problemi.length, problemi.join(" · "));
});

// ---------------------------------------------------------------- Step 7: listino, footer e pagine legali

const sezioneListinoDi = (html) => html.match(/<section class="sezione listino" id="listino"[\s\S]*?<\/section>/)?.[0] ?? null;
/** Il listino com'è nell'HTML: [{ id, titolo, conteggio, aperta, voci: [[nome, prezzo]] }]. */
function listinoDi(html) {
  return [...sezioneListinoDi(html).matchAll(/<details class="listino-categoria" id="listino-([\w-]+)"( open)?>([\s\S]*?)<\/details>/g)].map((m) => ({
    id: m[1],
    aperta: Boolean(m[2]),
    titolo: testoVisibile(m[3].match(/<span class="listino-titolo">([\s\S]*?)<\/span>/)?.[1] ?? ""),
    conteggio: normalizzaSpazi(testoVisibile(m[3].match(/<span class="listino-conteggio">([\s\S]*?)<\/span>/)?.[1] ?? "")),
    dl: /<dl class="listino-voci">/.test(m[3]),
    voci: [...m[3].matchAll(/<div class="listino-voce"><dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map((v) => [
      normalizzaSpazi(testoVisibile(v[1])),
      normalizzaSpazi(testoVisibile(v[2])),
    ]),
  }));
}
// Categoria aperta di default per pagina, da CLAUDE.md §6 (scritta a mano qui, di proposito)
const APERTA_6 = { home: null, viso: "corpo-viso", pedicure: "mani-piedi" };

await controllo("listino nell'HTML: 40 righe in ogni pagina, identiche a §2.3 (categorie, ordine, nomi, prezzi, numero di voci), in <dl>", () => {
  const attese = Object.entries(LISTINO_ATTESO);
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    verifica(sezioneListinoDi(html), `${file}: sezione listino mancante`);
    const categorie = listinoDi(html);
    verifica(categorie.length === attese.length, `${file}: ${categorie.length} categorie invece di ${attese.length}`);
    let righe = 0;
    categorie.forEach((c, i) => {
      const [chiave, voci] = attese[i];
      verifica(`${c.id}|${c.titolo}` === chiave, `${file}: categoria ${i + 1} «${c.id}|${c.titolo}» invece di «${chiave}»`);
      verifica(c.dl, `${file}: «${c.titolo}» senza <dl>`);
      verifica(c.conteggio === `${voci.length} voci`, `${file}: «${c.titolo}» conteggio «${c.conteggio}»`);
      verifica(c.voci.length === voci.length, `${file}: «${c.titolo}» con ${c.voci.length} righe invece di ${voci.length}`);
      c.voci.forEach(([nome, prezzo], j) => {
        verifica(nome === voci[j][0] && prezzo === voci[j][1], `${file}: «${c.titolo}» riga ${j + 1}: «${nome} — ${prezzo}» invece di «${voci[j].join(" — ")}»`);
        righe++;
      });
    });
    verifica(righe === 40, `${file}: ${righe} righe invece di 40`);
    // Nessun altro prezzo nella sezione oltre a quelli delle righe
    const euro = (testoVisibile(sezioneListinoDi(html)).match(/€/g) ?? []).length;
    const attesi = attese.flatMap(([, v]) => v).reduce((n, [, prezzo]) => n + (prezzo.match(/€/g) ?? []).length, 0);
    verifica(euro === attesi, `${file}: ${euro} «€» nella sezione invece di ${attesi}`);
  }
});

await controllo("una sola <details open> per pagina, quella di §6: corpo-viso su /viso/, mani-piedi su /pedicure/, nessuna su /", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const aperte = [...html.matchAll(/<details\b[^>]*\sopen\b[^>]*>/g)];
    const attesa = APERTA_6[id];
    verifica(aperte.length === (attesa ? 1 : 0), `${file}: ${aperte.length} <details open>`);
    if (attesa) verifica(listinoDi(html).find((c) => c.aperta)?.id === attesa, `${file}: aperta «${listinoDi(html).find((c) => c.aperta)?.id}» invece di «${attesa}»`);
  }
  verifica(!/<details\b[^>]*\sopen/.test(pagina("404.html")), "404 con <details open>");
});

await controllo("listino a 390 px: ogni riga visibile una volta aperte le categorie, prezzo a destra (in basso se il nome va a capo), freccia SVG che ruota di 90° (senza transizione con «riduci movimento»), link al listino stampato", async () => {
  const problemi = [];
  for (const riduci of [false, true]) {
    const { contesto, pagina: pg } = await apriMobile("/", riduci ? { reducedMotion: "reduce" } : {});
    const r = await pg.evaluate(async () => {
      const icona = (d) => getComputedStyle(d.querySelector("summary .icona-apri"));
      const categorie = [...document.querySelectorAll("#listino details")];
      const chiusa = { transform: icona(categorie[0]).transform, durata: icona(categorie[0]).transitionDuration };
      categorie.forEach((d) => (d.open = true));
      await new Promise((ok) => setTimeout(ok, 500)); // fine della rotazione (160 ms)
      const righe = [...document.querySelectorAll("#listino .listino-voce")].map((riga) => {
        const [dt, dd] = [riga.querySelector("dt"), riga.querySelector("dd")].map((el) => el.getBoundingClientRect());
        const r = riga.getBoundingClientRect();
        const lineaDt = parseFloat(getComputedStyle(riga.querySelector("dt")).lineHeight);
        return { testo: riga.innerText.replace(/\s+/g, " ").trim(), visibile: r.height > 0 && r.width > 0, destra: Math.abs(dd.right - r.right), aCapo: dt.height > lineaDt * 1.5, basso: Math.abs(dd.bottom - dt.bottom), fuori: r.right > innerWidth || dd.right > innerWidth };
      });
      const aperta = icona(categorie[0]).transform;
      const sommari = categorie.map((d) => d.querySelector("summary").getBoundingClientRect().height);
      const link = document.querySelector("#listino .listino-stampato a");
      return { chiusa, aperta, righe, sommari, link: link && { href: link.getAttribute("href"), target: link.target, rel: link.rel } };
    });
    await contesto.close();
    const etichetta = riduci ? "riduci movimento" : "390 px";
    if (r.righe.length !== 40) problemi.push(`${etichetta}: ${r.righe.length} righe`);
    const attese = Object.values(LISTINO_ATTESO).flat().map(([n, p]) => `${n} ${p}`);
    r.righe.forEach((riga, i) => {
      if (!riga.visibile) problemi.push(`${etichetta}: riga ${i + 1} invisibile`);
      if (normalizzaSpazi(riga.testo) !== attese[i]) problemi.push(`${etichetta}: riga ${i + 1} «${riga.testo}» invece di «${attese[i]}»`);
      if (riga.destra > 1 || riga.fuori) problemi.push(`${etichetta}: prezzo non allineato a destra in «${riga.testo}»`);
      if (riga.aCapo && riga.basso > 6) problemi.push(`${etichetta}: prezzo non in basso in «${riga.testo}» (${riga.basso.toFixed(1)} px)`);
    });
    if (!r.righe.some((riga) => riga.aCapo)) problemi.push(`${etichetta}: nessun nome va a capo a 390 px (il caso non è verificato)`);
    if (r.chiusa.transform !== "none") problemi.push(`${etichetta}: freccia ruotata a categoria chiusa (${r.chiusa.transform})`);
    const m = r.aperta.match(/^matrix\(([-\d.e]+), ([-\d.e]+), ([-\d.e]+), ([-\d.e]+)/);
    if (!m || Math.abs(m[1]) > 0.01 || Math.abs(m[2] - 1) > 0.01) problemi.push(`${etichetta}: freccia non ruotata di 90° a categoria aperta (${r.aperta})`);
    if (riduci && parseFloat(r.chiusa.durata) !== 0) problemi.push(`riduci movimento: la freccia ha ancora una transizione (${r.chiusa.durata})`);
    if (!riduci && !(parseFloat(r.chiusa.durata) > 0)) problemi.push("390 px: la freccia non ha transizione");
    if (r.sommari.some((h) => h < 44)) problemi.push(`${etichetta}: <summary> più basso di 44 px`);
    if (!r.link || r.link.href !== "/img/listino-stampato-1536.webp" || r.link.target !== "_blank" || r.link.rel !== "noopener") problemi.push(`${etichetta}: link al listino stampato ${JSON.stringify(r.link)}`);
  }
  verifica(existsSync(join(DIST, "img", "listino-stampato-1536.webp")), "dist/img/listino-stampato-1536.webp mancante");
  const freccia = readFileSync(join(RADICE, "src", "templates", "icone", "apri.svg"), "utf8");
  verifica(/^<svg[^>]*aria-hidden="true"/.test(freccia), "la freccia non è un SVG decorativo (aria-hidden)");
  verifica(!problemi.length, [...new Set(problemi)].slice(0, 8).join(" · "));
});

/** Footer condizionale (§2.1, §8) su una pagina qualsiasi. */
function verificaFooter(file) {
  const piede = testoVisibile(pagina(file).match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "");
  verifica(piede, `${file}: footer mancante`);
  verifica(normalizzaSpazi(piede).includes(`${centro.legale.denominazione} · P.IVA ${centro.legale.partitaIva}`), `${file}: footer senza denominazione e P.IVA`);
  verifica(piede.includes(centro.indirizzo.completo) && piede.includes(centro.email) && normalizzaSpazi(piede).includes(centro.telefono), `${file}: footer senza indirizzo, email o telefono`);
  verifica(piede.includes(`© ${new Date().getFullYear()} ${centro.nome}`), `${file}: footer senza «© anno ${centro.nome}»`);
  verifica(/<a href="\/privacy\/">Privacy<\/a>/.test(pagina(file)) && /<a href="\/cookie\/">Cookie<\/a>/.test(pagina(file)), `${file}: link Privacy e Cookie`);
  const regole = [
    [centro.legale.rea, /\bREA\b/, "riga REA"],
    [centro.legale.sedeLegale, /Sede legale/, "sede legale"],
    [centro.social.instagram, /Instagram/, "Instagram"],
    [centro.social.facebook, /Facebook/, "Facebook"],
    [centro.integrazioni.ga4Id || centro.integrazioni.metaPixelId, /Preferenze cookie/, "Preferenze cookie"],
  ];
  for (const [dato, re, nome] of regole) verifica(Boolean(dato) === re.test(piede), `${file}: ${nome} ${dato ? "assente" : "presente senza dato"}`);
}

await controllo("footer definitivo su tutte le pagine (landing, 404, privacy, cookie): denominazione e P.IVA, indirizzo, telefono, email, «© anno», Privacy e Cookie; REA, sede legale, social e «Preferenze cookie» solo se indicati", () => {
  for (const [file] of [...PAGINE, ...PAGINE_LEGALI]) verificaFooter(file);
});

await controllo("/privacy/ e /cookie/: esistono, un solo H1, header e footer della landing, partita IVA, title e description, niente barra contatti, link tra le due pagine", () => {
  for (const [file, id, percorso] of PAGINE_LEGALI) {
    verifica(existsSync(join(DIST, file)), `${file} mancante`);
    const html = pagina(file);
    const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    verifica(h1.length === 1 && testoVisibile(h1[0][1]) === testi.comuni[id].h1, `${file}: H1`);
    verifica(/<header class="testata">/.test(html) && /<footer class="piede">/.test(html), `${file}: header o footer mancanti`);
    verifica(testoVisibile(html).includes(`P.IVA ${centro.legale.partitaIva}`), `${file}: partita IVA`);
    const title = decodifica(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
    verifica(title.length <= 60 && title.includes(centro.nome), `${file}: title «${title}»`);
    const description = decodifica(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
    verifica(description.length >= 60 && description.length <= 160, `${file}: description di ${description.length} caratteri`);
    verifica(!/class="barra-contatti"|class="con-barra"/.test(html), `${file}: barra contatti presente`);
    verifica(!/<script type="application\/ld\+json">/.test(html), `${file}: JSON-LD presente`);
    const altra = id === "privacy" ? "/cookie/" : "/privacy/";
    verifica(new RegExp(`<p class="legale-link"><a href="${altra}">`).test(html), `${file}: manca il link a ${altra}`);
    void percorso;
  }
});

await controllo("data di ultimo aggiornamento fissa (testi.json › legale.aggiornamento, §10): la stessa su privacy e cookie, anche con l'orologio della build spostato al 2030", () => {
  const data = testi.legale?.aggiornamento;
  // La data cambia solo quando cambiano i testi legali (6 novembre 2026: attivato GA4); non dipende dal giorno della build.
  verifica(/^\d{1,2} \p{L}+ \d{4}$/u.test(data ?? ""), `legale.aggiornamento «${data}»`);
  const riga = `<p class="legale-data">Ultimo aggiornamento: <time datetime="${build.dataIso(data)}">${data}</time></p>`;
  for (const [file] of PAGINE_LEGALI) verifica(pagina(file).includes(riga), `${file}: data diversa da «${data}»`);
  verifica(build.dataIso("2 novembre 2026") === "2026-11-02" && build.dataIso("31 dicembre 2027") === "2027-12-31", "dataIso non converte");
  for (const errata of ["31 febbraio 2026", "novembre 2026", "2/11/2026", "2 brumaio 2026", null]) {
    let fermato = false;
    try {
      build.dataIso(errata);
    } catch {
      fermato = true;
    }
    verifica(fermato, `data non valida accettata: «${errata}»`);
  }
  // Build con l'orologio finto al 15 gennaio 2030: la data delle pagine legali non cambia.
  const tmp = mkdtempSync(join(tmpdir(), "migliore-data-"));
  try {
    const orologio = "data:text/javascript," + encodeURIComponent(
      "const D=Date;const T=D.UTC(2030,0,15,12);globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:[T]))}static now(){return T}};",
    );
    const r = spawnSync(process.execPath, ["--import", orologio, "build.mjs", "--dist", tmp], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: "" } });
    verifica(r.status === 0, `build con l'orologio al 2030 fallita: ${r.stderr || r.stdout}`);
    verifica(readFileSync(join(tmp, "index.html"), "utf8").includes('data-anno="2030"'), "l'orologio finto non è stato usato dalla build");
    for (const [file] of PAGINE_LEGALI) verifica(readFileSync(join(tmp, file), "utf8").includes(riga), `${file}: con l'orologio al 2030 la data cambia`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await controllo("informativa privacy: titolare con i dati di §2.1, trattamenti a) e b) con dati, finalità, base giuridica e conservazione, fornitori Netlify e Supabase, garanzie USA, diritti e Garante", () => {
  const html = pagina("privacy/index.html");
  const testo = normalizzaSpazi(testoVisibile(html));
  for (const dato of [centro.legale.denominazione, centro.legale.partitaIva, centro.indirizzo.completo, centro.email, centro.telefono]) {
    verifica(testo.includes(dato), `titolare senza «${dato}»`);
  }
  const blocchi = [...html.matchAll(/<div class="legale-blocco">([\s\S]*?)<\/div>\s*(?=<div class="legale-blocco">|<h2)/g)].map((m) => m[1]);
  const schede = blocchi.filter((b) => /<dl class="legale-scheda">/.test(b));
  const attese = 2 + (centro.integrazioni.ga4Id ? 1 : 0) + (centro.integrazioni.metaPixelId ? 1 : 0);
  verifica(schede.length === attese, `${schede.length} trattamenti con scheda invece di ${attese} (a, b, più GA4 e Meta se indicati)`);
  for (const b of schede) {
    const dt = [...b.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);
    verifica(dt.join() === "Dati,Finalità,Base giuridica,Conservazione", `scheda «${testoVisibile(b.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? "")}»: ${dt.join(", ")}`);
  }
  verifica(/art\. 6, par\. 1, lett\. b/.test(testo) && /art\. 6, par\. 1, lett\. a/.test(testo), "basi giuridiche (misure precontrattuali e consenso)");
  verifica(testo.includes(tipografico("non oltre 24 mesi dall'ultima interazione")), "conservazione delle iscrizioni: 24 mesi");
  const tracciamenti = Boolean(centro.integrazioni.ga4Id || centro.integrazioni.metaPixelId);
  verifica(testo.includes("Oggi il sito non usa strumenti di statistica né di marketing") === !tracciamenti, tracciamenti ? "c'è la frase sui tracciamenti spenti, ma GA4 o Meta sono attivi" : "manca la frase sui tracciamenti spenti");
  verifica(/Netlify, Inc\. \(Stati Uniti\)/.test(testo) && /Supabase, Inc\. \(Stati Uniti\)/.test(testo), "fornitori Netlify e Supabase");
  const posta = centro.integrazioni.servizioEmail;
  const rigaPosta = tipografico(`${posta.nome} (${posta.sede}), per l'invio del codice sconto e delle promo${posta.inAttivazione ? ", in attivazione" : ""}.`);
  verifica(testo.includes(rigaPosta), `manca «${rigaPosta}»`);
  verifica(/Google Ireland/.test(testo) === Boolean(centro.integrazioni.ga4Id) && /Meta Platforms/.test(testo) === Boolean(centro.integrazioni.metaPixelId), "Google o Meta tra i fornitori non corrispondono agli ID di centro.json");
  verifica(/EU-US Data Privacy Framework/.test(testo) && /clausole contrattuali standard/.test(testo), "garanzie per gli Stati Uniti");
  for (const diritto of ["accesso", "rettifica", "cancellazione", "limitazione", "opposizione", "portabilità", "revocare il consenso", "Garante per la protezione dei dati personali"]) {
    verifica(testo.includes(diritto), `diritti: manca «${diritto}»`);
  }
  verifica(new RegExp(`<a href="mailto:${centro.email}">`).test(html), "diritti: manca il link email");
  verifica(html.includes('<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener">Garante per la protezione dei dati personali</a>'), "manca il link al Garante (https://www.garanteprivacy.it, nuova scheda)");
});

await controllo("pagine legali con GA4, pixel Meta e servizio email indicati (build in una copia): trattamenti c), fornitori Google, Meta e email, elenco dei cookie e «Preferenze cookie»; datiLegali() filtra per integrazione", () => {
  // Funzione: voci filtrate per integrazione, «richiede» sconosciuto = errore, bozza spenta solo con verificata true.
  const t = { privacy: { trattamenti: { voci: testi.comuni.privacy.trattamenti.voci }, fornitori: { voci: testi.comuni.privacy.fornitori.voci } }, cookie: { elenco: testi.comuni.cookie.elenco } };
  const conTutto = { ...centro, integrazioni: { ...centro.integrazioni, ga4Id: "G-PROVA123", metaPixelId: "123456789012345", servizioEmail: { nome: "Posta di prova", sede: "Paese di prova", inAttivazione: false } } };
  const senzaEmail = { ...centro, integrazioni: { ...centro.integrazioni, ga4Id: null, metaPixelId: null, servizioEmail: null } };
  const aggiornamento = testi.legale.aggiornamento;
  const pieno = build.datiLegali({ centro: conTutto, t, aggiornamento });
  const senzaTracciamenti = { ...centro, integrazioni: { ...centro.integrazioni, ga4Id: null, metaPixelId: null, servizioEmail: { ...centro.integrazioni.servizioEmail, inAttivazione: true } } };
  const vuoto = build.datiLegali({ centro: senzaTracciamenti, t, aggiornamento, verificata: true });
  const nessuno = build.datiLegali({ centro: senzaEmail, t, aggiornamento });
  verifica(pieno.trattamenti.length === 4 && vuoto.trattamenti.length === 2, `trattamenti ${pieno.trattamenti.length}/${vuoto.trattamenti.length}`);
  verifica(pieno.fornitori.length === 5 && vuoto.fornitori.length === 3 && nessuno.fornitori.length === 2, `fornitori ${pieno.fornitori.length}/${vuoto.fornitori.length}/${nessuno.fornitori.length}`);
  // Qui i testi sono quelli grezzi di testi.json: il servizio email si riconosce dal ruolo, non dal nome (segnaposto).
  const email = vuoto.fornitori.filter((f) => f.inAttivazione);
  verifica(email.length === 1 && email[0].ruolo.startsWith(tipografico("per l'invio del codice sconto")), "servizio email senza «in attivazione»");
  verifica(pieno.fornitori.every((f) => !f.inAttivazione), "«in attivazione» con inAttivazione false");
  verifica(pieno.cookie.length === 5 && vuoto.cookie.length === 0, `cookie ${pieno.cookie.length}/${vuoto.cookie.length}`);
  verifica(pieno.bozza === true && vuoto.bozza === false && nessuno.bozza === true, "bozza: deve sparire solo con verificata true");
  verifica(pieno.trattamenti.every((v) => !("richiede" in v)), "la chiave «richiede» arriva al template");
  let fermato = false;
  try {
    build.datiLegali({ centro, t: { ...t, cookie: { elenco: [{ nome: "x", richiede: "inesistente" }] } }, aggiornamento });
  } catch {
    fermato = true;
  }
  verifica(fermato, "«richiede» con un'integrazione inesistente accettato");
  // Build vera in una copia, con le integrazioni indicate: i blocchi condizionali si rendono senza errori.
  const tmp = mkdtempSync(join(tmpdir(), "migliore-legali-"));
  try {
    for (const voce of ["build.mjs", "content", "src"]) cpSync(join(RADICE, voce), join(tmp, voce), { recursive: true });
    writeFileSync(join(tmp, "content", "centro.json"), JSON.stringify(conTutto, null, 2));
    const r = spawnSync(process.execPath, ["build.mjs"], { cwd: tmp, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: "" } });
    verifica(r.status === 0, `build con integrazioni fallita: ${r.stderr || r.stdout}`);
    const privacy = normalizzaSpazi(testoVisibile(readFileSync(join(tmp, "dist", "privacy", "index.html"), "utf8")));
    const cookie = readFileSync(join(tmp, "dist", "cookie", "index.html"), "utf8");
    for (const atteso of ["Statistiche (Google Analytics 4)", "Marketing (pixel Meta)", "Google Ireland Limited (Irlanda)", "Meta Platforms Ireland Limited (Irlanda)", tipografico("Posta di prova (Paese di prova), per l'invio del codice sconto e delle promo.")]) {
      verifica(privacy.includes(atteso), `privacy con integrazioni: manca «${atteso}»`);
    }
    verifica(!privacy.includes("in attivazione"), "privacy con il servizio email attivo: c'è ancora «in attivazione»");
    verifica(!privacy.includes("Oggi il sito non usa strumenti di statistica"), "privacy con integrazioni: c'è ancora la frase sui tracciamenti spenti");
    const nomi = [...cookie.matchAll(/<h3 class="legale-cookie-nome">([^<]*)<\/h3>/g)].map((m) => decodifica(m[1]));
    verifica(nomi.join() === "migliore-consenso,_ga,_ga_<ID>,_fbp,_fbc", `cookie con integrazioni: ${nomi.join(", ")}`);
    verifica(!testoVisibile(cookie).includes("Oggi il sito non usa cookie"), "cookie con integrazioni: c'è ancora «Oggi il sito non usa cookie»");
    verifica(/Preferenze cookie/.test(testoVisibile(cookie.match(/<footer[\s\S]*?<\/footer>/)[0])), "footer senza «Preferenze cookie» con i tracciamenti indicati");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  // Oggi: la cookie policy dice che il sito non usa cookie e non elenca nessun cookie.
  const oggi = pagina("cookie/index.html");
  const cookieOggi = [...oggi.matchAll(/<h3 class="legale-cookie-nome">([^<]*)<\/h3>/g)].map((m) => decodifica(m[1]));
  const attesi = [
    ...(centro.integrazioni.ga4Id || centro.integrazioni.metaPixelId ? ["migliore-consenso"] : []),
    ...(centro.integrazioni.ga4Id ? ["_ga", "_ga_<ID>"] : []),
    ...(centro.integrazioni.metaPixelId ? ["_fbp", "_fbc"] : []),
  ];
  verifica(cookieOggi.join() === attesi.join(), `cookie policy di oggi: elenca «${cookieOggi.join(", ")}» invece di «${attesi.join(", ")}»`);
  verifica(testoVisibile(oggi).includes("Oggi il sito non usa cookie") === !attesi.length, "cookie policy di oggi: la frase «Oggi il sito non usa cookie» non corrisponde agli ID attivi");
});

await controllo("riquadro «Bozza»: in cima a privacy e cookie in ogni contesto, produzione compresa, finché legale.verificata non è true; con true sparisce (build ripetuta)", () => {
  const testoBozza = testi.comuni.legali.bozza;
  verifica(testi.legale.verificata === false, "testi.json › legale.verificata deve restare false finché la titolare non scrive «privacy verificata»");
  const build2 = (contesto, verificata) => {
    const tmp = mkdtempSync(join(tmpdir(), "migliore-bozza-"));
    try {
      for (const voce of ["build.mjs", "content", "src"]) cpSync(join(RADICE, voce), join(tmp, voce), { recursive: true });
      const copia = JSON.parse(readFileSync(join(tmp, "content", "testi.json"), "utf8"));
      copia.legale.verificata = verificata;
      writeFileSync(join(tmp, "content", "testi.json"), JSON.stringify(copia, null, 2));
      const r = spawnSync(process.execPath, ["build.mjs"], { cwd: tmp, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: contesto } });
      verifica(r.status === 0, `build con CONTEXT=${contesto} fallita: ${r.stderr || r.stdout}`);
      const dist = join(tmp, "dist");
      return Object.fromEntries(elenca(dist, (p) => p.endsWith(".html")).map((f) => [relative(dist, f).split(sep).join("/"), readFileSync(f, "utf8")]));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  };
  for (const contesto of ["", "deploy-preview", "branch-deploy", "production"]) {
    const pagine = build2(contesto, false);
    for (const [file, html] of Object.entries(pagine)) {
      const legale = PAGINE_LEGALI.some(([f]) => f === file);
      const presente = html.includes('class="legale-bozza"') && testoVisibile(html).includes(testoBozza);
      verifica(presente === legale, `CONTEXT=«${contesto}»: ${file} ${legale ? "senza" : "con"} riquadro «Bozza»`);
      if (legale) verifica(html.indexOf('class="legale-bozza"') < html.indexOf("<h1"), `CONTEXT=«${contesto}»: ${file}: il riquadro non è in cima`);
    }
  }
  const verificate = build2("production", true);
  for (const [file, html] of Object.entries(verificate)) {
    verifica(!html.includes("legale-bozza") && !testoVisibile(html).includes(testoBozza), `privacy verificata: ${file} con riquadro «Bozza»`);
  }
  verifica(Object.keys(verificate).includes("privacy/index.html") && Object.keys(verificate).includes("cookie/index.html"), "privacy verificata: pagine legali mancanti");
});

await controllo("nessun codice fiscale e nessun indirizzo diverso da §2.1 in nessuna pagina (testo, alt, meta, JSON-LD)", () => {
  const CODICE_FISCALE = /[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/;
  const VIA = /(?<!\p{L})(?:via|viale|piazza|piazzale|corso|largo|vicolo|strada|contrada|località|borgo|frazione)\s+(?:[A-ZÀ-Ý][\p{L}'’.]*\s+){1,4}\d+[A-Za-z]?(?:\/[A-Za-z0-9]+)?(?!\p{L})/giu;
  const problemi = [];
  for (const file of elenca(DIST, (p) => p.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    const testo = normalizzaSpazi([testoVisibile(html), testiNascosti(html), ...jsonLdDi(html)].join(" \n "));
    if (CODICE_FISCALE.test(html) || new RegExp(CODICE_FISCALE.source, "i").test(testo)) problemi.push(`${rel(file)}: formato di codice fiscale`);
    for (const m of testo.matchAll(VIA)) if (m[0] !== centro.indirizzo.via) problemi.push(`${rel(file)}: indirizzo «${m[0]}»`);
    for (const m of testo.matchAll(/(?<!\d)\d{5}(?!\d)/g)) if (m[0] !== centro.indirizzo.cap) problemi.push(`${rel(file)}: CAP «${m[0]}»`);
  }
  verifica(centro.indirizzo.via === "Via Roma 2/A" && centro.indirizzo.cap === "21040", "indirizzo di centro.json diverso da §2.1");
  // Prova: le espressioni riconoscono davvero un codice fiscale e un indirizzo diverso.
  verifica(CODICE_FISCALE.test("RSSMRA80A01H501U") && [..."Ci trovi in Via Garibaldi 12, 21100 Varese".matchAll(VIA)].length === 1, "espressioni di controllo non funzionano");
  verifica(!problemi.length, [...new Set(problemi)].slice(0, 8).join(" · "));
});

await controllo("pagine legali a 390 px: nessuno scroll orizzontale, colonna di testo ≤ 62ch, link fuori dal testo ≥ 44 px", async () => {
  const problemi = [];
  for (const [, , percorso] of PAGINE_LEGALI) {
    const { contesto, pagina: pg } = await apriMobile(percorso);
    const r = await pg.evaluate(() => {
      const colonna = document.querySelector(".legale-testo");
      const ch = (() => {
        const prova = document.createElement("span");
        prova.style.cssText = "position:absolute;visibility:hidden;font:inherit;width:62ch";
        colonna.append(prova);
        const w = prova.getBoundingClientRect().width;
        prova.remove();
        return w;
      })();
      const piccoli = [...document.querySelectorAll("a[href], button, summary")]
        .filter((el) => !el.closest("p:not(.legale-link), li:not(.piede-elenco li)") || el.closest(".piede-elenco"))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
        .map(({ el, r }) => `«${el.textContent.trim().slice(0, 25)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
      return { scroll: document.documentElement.scrollWidth > innerWidth, colonna: colonna.getBoundingClientRect().width, ch, piccoli };
    });
    await contesto.close();
    if (r.scroll) problemi.push(`${percorso}: scroll orizzontale`);
    if (r.colonna > r.ch + 1) problemi.push(`${percorso}: colonna di ${Math.round(r.colonna)} px oltre i 62ch (${Math.round(r.ch)} px)`);
    if (r.piccoli.length) problemi.push(`${percorso}: area di tocco < 44 px: ${r.piccoli.join(", ")}`);
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("codice sconto anche via email (§2.4): privacy, brief e testi dicono la stessa cosa (via email solo quando Brevo è attivo; «Te l'abbiamo mandato anche via email.» solo se l'email parte)", () => {
  const brief = leggi("CLAUDE.md");
  verifica(brief.includes("Quando Brevo è attivo (Step 9) arriva anche via email, nello stesso momento, così la cliente non lo perde; fino ad allora solo a schermo."), "CLAUDE.md §2.4 senza la regola sull'email del codice");
  verifica(brief.includes("+ solo se l'email è partita davvero: «Te l'abbiamo mandato anche via email.»"), "CLAUDE.md §8 senza la riga del risultato via email");
  verifica(testi.comuni.codiceSconto.risultatoEmail === tipografico("Te l'abbiamo mandato anche via email."), "testi.json: codiceSconto.risultatoEmail diverso da §8");
  const privacy = normalizzaSpazi(testoVisibile(pagina("privacy/index.html")));
  verifica(privacy.includes(tipografico("mandartelo anche via email, quando l'invio è attivo")), "privacy: la finalità b) non dice che il codice arriva via email quando l'invio è attivo");
  const email = centro.integrazioni.servizioEmail;
  verifica(email?.nome === "Brevo" && email.sede === "Francia", "centro.json: servizio email diverso da Brevo (Francia)");
  const riga = tipografico(`${email.nome} (${email.sede}), per l'invio del codice sconto e delle promo${email.inAttivazione ? ", in attivazione" : ""}.`);
  verifica(privacy.includes(riga), `privacy: manca «${riga}»`);
});

// ---------------------------------------------------------------- Step 8: codice sconto, banner cookie e tracciamenti spenti

const FUNZIONE = join(RADICE, "netlify", "functions", "codice-sconto.mjs");
const TRACCIANTI = /(^|\.)(googletagmanager\.com|google-analytics\.com|facebook\.net|facebook\.com)$/;
const oggiPiu = (giorni) => {
  const [a, m, g] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, g + giorni)).toISOString().slice(0, 10);
};
async function postaCodice(base, corpo, { json = true, accept = "application/json" } = {}) {
  const r = await fetch(`${base}/api/codice-sconto`, {
    method: "POST",
    headers: { "Content-Type": json ? "application/json" : "application/x-www-form-urlencoded", Accept: accept },
    body: json ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : new URLSearchParams(corpo).toString(),
  });
  const testo = await r.text();
  let dati = null;
  try { dati = JSON.parse(testo); } catch { /* HTML */ }
  return { stato: r.status, cache: r.headers.get("cache-control"), tipo: r.headers.get("content-type"), testo, dati };
}

await controllo("codice sconto in anteprima (modalità prova): email valida e consenso → codice MIG-XXXXXX, scadenza oggi + 30 giorni (ora italiana), prova true, emailInviata false, Cache-Control no-store", async () => {
  const { base } = await browserCondiviso();
  const r = await postaCodice(base, { email: "anna@esempio.it", consenso: true, pagina: "/viso/" });
  verifica(r.stato === 200 && r.dati, `stato ${r.stato}: ${r.testo.slice(0, 80)}`);
  verifica(/^MIG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(r.dati.codice), `codice «${r.dati.codice}»`);
  verifica(r.dati.scadenza === oggiPiu(centro.codiceSconto.validitaGiorni) && centro.codiceSconto.validitaGiorni === 30, `scadenza ${r.dati.scadenza} invece di ${oggiPiu(30)}`);
  verifica(r.dati.prova === true && r.dati.nuovo === true && r.dati.emailInviata === false, `campi: ${JSON.stringify(r.dati)}`);
  verifica(Object.keys(r.dati).sort().join() === "codice,emailInviata,nuovo,prova,scadenza", `chiavi della risposta: ${Object.keys(r.dati).join(", ")}`);
  verifica(r.cache === "no-store", `Cache-Control «${r.cache}»`);
});

await controllo("modalità prova: la stessa email due volte non dà errore (e maiuscole o spazi diversi nemmeno)", async () => {
  const { base } = await browserCondiviso();
  for (const email of ["luca@esempio.it", "luca@esempio.it", "  Luca@Esempio.IT "]) {
    const r = await postaCodice(base, { email, consenso: true });
    verifica(r.stato === 200 && /^MIG-/.test(r.dati?.codice ?? ""), `«${email}»: stato ${r.stato}`);
  }
});

await controllo("errori della funzione: email non valida → 400 «email», senza consenso → 400 «consenso», trappola piena → 400 senza dettagli, JSON rotto → 400, GET → 405; sempre no-store", async () => {
  const { base } = await browserCondiviso();
  const casi = [
    [{ email: "anna@", consenso: true }, 400, "email"],
    [{ email: "anna esempio.it", consenso: true }, 400, "email"],
    [{ email: `${"a".repeat(250)}@esempio.it`, consenso: true }, 400, "email"],
    [{ email: "anna@esempio.it" }, 400, "consenso"],
    [{ email: "anna@esempio.it", consenso: false }, 400, "consenso"],
    [{ email: "anna@esempio.it", consenso: true, sito: "https://spam.example" }, 400, "richiesta"],
    ["{rotto", 400, "richiesta"],
  ];
  for (const [corpo, stato, chiave] of casi) {
    const r = await postaCodice(base, corpo);
    verifica(r.stato === stato && r.dati?.errore === chiave, `${JSON.stringify(corpo).slice(0, 50)}: ${r.stato} ${r.testo.slice(0, 60)}`);
    verifica(Object.keys(r.dati).length === 1 && r.cache === "no-store", `${JSON.stringify(corpo).slice(0, 40)}: risposta con dettagli o senza no-store`);
  }
  const get = await fetch(`${base}/api/codice-sconto`);
  verifica(get.status === 405, `GET: ${get.status}`);
});

await controllo("invio senza JavaScript (Playwright, javaScriptEnabled: false): la funzione risponde con una pagina HTML con il codice, la scadenza e il link per tornare; senza consenso, pagina d'errore", async () => {
  const { browser, base } = await browserCondiviso();
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const pg = await contesto.newPage();
  await pg.goto(base + "/pedicure/", { waitUntil: "networkidle" });
  await pg.fill("#codice-email", "anna@esempio.it");
  await pg.check("#codice-consenso");
  await Promise.all([pg.waitForNavigation(), pg.click(".codice-invia")]);
  const ok = await pg.evaluate(() => ({ url: location.pathname, h1: document.querySelector("h1")?.textContent, codice: document.querySelector(".codice-valore")?.textContent, testo: document.body.innerText, ritorno: document.querySelector(".codice-pagina-link a")?.getAttribute("href"), fondo: getComputedStyle(document.body).backgroundColor }));
  verifica(ok.url === "/api/codice-sconto" && ok.h1 === testi.comuni.codiceSconto.risultatoTitolo, `pagina: ${ok.url} «${ok.h1}»`);
  verifica(/^MIG-[A-Z2-9]{6}$/.test(ok.codice ?? ""), `codice «${ok.codice}»`);
  const data = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${oggiPiu(30)}T00:00:00Z`));
  verifica(ok.testo.includes(`Valido fino al ${data}.`), `scadenza mancante (${data})`);
  verifica(ok.ritorno === "/pedicure/#codice-sconto", `link di ritorno «${ok.ritorno}»`);
  verifica(ok.fondo === "rgb(244, 219, 202)", `fondo ${ok.fondo}: la pagina non è sabbia`);
  // Senza consenso: required blocca il browser; la funzione, chiamata lo stesso, risponde con una pagina d'errore.
  const r = await postaCodice(base, { email: "anna@esempio.it", pagina: "/" }, { json: false, accept: "text/html" });
  verifica(r.stato === 400 && r.tipo.startsWith("text/html") && r.testo.includes(testi.comuni.codiceSconto.errori.consenso), `senza consenso: ${r.stato}`);
  await contesto.close();
});

await controllo("invio con JavaScript: codice grande con «Valido fino al …» in italiano, «Copia il codice», niente «Te l'abbiamo mandato anche via email.»; errori accanto al campo con focus sul primo; UTM, pagina ed evento_id (UUID) inviati", async () => {
  const { browser, base } = await browserCondiviso();
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await contesto.newPage();
  const inviati = [];
  pg.on("request", (r) => { if (r.url().endsWith("/api/codice-sconto")) inviati.push({ corpo: JSON.parse(r.postData()), accept: r.headers().accept }); });
  await pg.goto(base + "/viso/?utm_source=meta&utm_medium=paid&utm_campaign=viso-nov&utm_content=video1", { waitUntil: "networkidle" });
  await pg.click(".codice-invia");
  const primo = await pg.evaluate(() => ({ focus: document.activeElement.id, email: !document.getElementById("codice-errore-email").hidden, consenso: !document.getElementById("codice-errore-consenso").hidden, invalido: document.getElementById("codice-email").getAttribute("aria-invalid") }));
  verifica(primo.focus === "codice-email" && primo.email && primo.consenso && primo.invalido === "true", `errori: ${JSON.stringify(primo)}`);
  verifica(inviati.length === 0, "con errori il modulo non deve partire");
  await pg.fill("#codice-email", "anna@esempio.it");
  await pg.click(".codice-invia");
  verifica((await pg.evaluate(() => document.activeElement.id)) === "codice-consenso", "focus non sul consenso");
  await pg.check("#codice-consenso");
  await pg.click(".codice-invia");
  await pg.waitForSelector(".codice-ottenuto");
  const r = await pg.evaluate(() => ({ testo: document.querySelector(".codice-ottenuto").innerText, codice: document.querySelector(".codice-valore").textContent, modulo: document.querySelector("[data-codice-modulo]").hidden, copia: document.querySelector("[data-codice-copia]")?.textContent, focus: document.activeElement.className, live: document.querySelector("[data-codice-risultato]").getAttribute("aria-live") }));
  const data = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${oggiPiu(30)}T00:00:00Z`));
  verifica(/^MIG-[A-Z2-9]{6}$/.test(r.codice) && r.testo.includes(`Valido fino al ${data}.`), `risultato: ${r.testo.slice(0, 80)}`);
  verifica(r.copia === testi.comuni.codiceSconto.copia && r.modulo && r.live === "polite", `copia/modulo/live: ${JSON.stringify(r)}`);
  verifica(!r.testo.includes(testi.comuni.codiceSconto.risultatoEmail), "«Te l'abbiamo mandato anche via email.» con emailInviata false");
  verifica(r.focus.includes("codice-ottenuto-titolo"), `focus dopo il codice: ${r.focus}`);
  const c = inviati[0];
  verifica(inviati.length === 1 && c.accept.includes("application/json"), "invio JSON con Accept: application/json");
  verifica(c.corpo.utm_source === "meta" && c.corpo.utm_medium === "paid" && c.corpo.utm_campaign === "viso-nov" && c.corpo.utm_content === "video1" && c.corpo.pagina === "/viso/", `campi: ${JSON.stringify(c.corpo)}`);
  verifica(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(c.corpo.evento_id), `evento_id «${c.corpo.evento_id}»`);
  // La riga dell'email compare solo con emailInviata true (risposta finta).
  const pg2 = await contesto.newPage();
  await pg2.route("**/api/codice-sconto", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ codice: "MIG-ABCDEF", scadenza: "2026-12-15", nuovo: true, prova: false, emailInviata: true }) }));
  await pg2.goto(base + "/", { waitUntil: "networkidle" });
  await pg2.fill("#codice-email", "anna@esempio.it");
  await pg2.check("#codice-consenso");
  await pg2.click(".codice-invia");
  await pg2.waitForSelector(".codice-ottenuto");
  const t2 = await pg2.evaluate(() => document.querySelector(".codice-ottenuto").innerText);
  verifica(t2.includes(testi.comuni.codiceSconto.risultatoEmail) && t2.includes("Valido fino al 15 dicembre 2026."), `con emailInviata true: ${t2.slice(0, 120)}`);
  await contesto.close();
});

await controllo("modulo come richiesto: post su /api/codice-sconto; email con <label>, type email, autocomplete, inputmode, required; consenso non spuntato, required, testo completo e link a /privacy/; trappola «sito» fuori schermo (non display:none), tabindex -1, autocomplete off, etichetta «Lascia vuoto»; campi nascosti; condizioni sotto il pulsante; risultato aria-live", async () => {
  const cs = testi.comuni.codiceSconto;
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const s = sezioneDi(pagina(file), "codice-sconto");
    verifica(s, `${file}: sezione codice sconto mancante`);
    verifica(/<form class="codice-modulo" method="post" action="\/api\/codice-sconto"/.test(s), `${file}: form`);
    verifica(/<label class="campo-etichetta" for="codice-email">La tua email<\/label>/.test(s), `${file}: etichetta email`);
    const email = s.match(/<input[^>]*id="codice-email"[^>]*>/)?.[0] ?? "";
    for (const a of ['type="email"', 'autocomplete="email"', 'inputmode="email"', "required", 'name="email"', `placeholder="${cs.campoSegnaposto}"`]) verifica(email.includes(a), `${file}: campo email senza ${a}`);
    const casella = s.match(/<input[^>]*id="codice-consenso"[^>]*>/)?.[0] ?? "";
    verifica(casella.includes('type="checkbox"') && casella.includes("required") && !/\schecked/.test(casella), `${file}: casella del consenso`);
    const etichetta = s.match(/<label for="codice-consenso">([\s\S]*?)<\/label>/)?.[1] ?? "";
    verifica(decodifica(etichetta.replace(/<[^>]+>/g, "")) === build.componi(cs.consenso, centro, "testi") && /<a href="\/privacy\/">informativa privacy<\/a>/.test(etichetta), `${file}: testo del consenso o link`);
    const trappola = s.match(/<div class="trappola">([\s\S]*?)<\/div>/)?.[1] ?? "";
    verifica(/<label for="codice-sito">Lascia vuoto<\/label>/.test(trappola) && /name="sito"/.test(trappola) && /tabindex="-1"/.test(trappola) && /autocomplete="off"/.test(trappola), `${file}: campo trappola`);
    for (const n of ["pagina", "utm_source", "utm_medium", "utm_campaign", "utm_content", "evento_id"]) verifica(new RegExp(`<input type="hidden" name="${n}"`).test(s), `${file}: campo nascosto ${n}`);
    verifica(s.indexOf('class="pulsante pulsante-principale codice-invia" type="submit"') < s.indexOf('class="codice-condizioni"'), `${file}: condizioni non sotto il pulsante`);
    verifica((s.match(/type="submit"/g) ?? []).length === 1, `${file}: più di un pulsante d'invio`);
    verifica(/<div class="codice-risultato" aria-live="polite"/.test(s), `${file}: area risultato senza aria-live`);
  }
  const { browser, base } = await browserCondiviso();
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await contesto.newPage();
  await pg.goto(base + "/", { waitUntil: "networkidle" });
  const st = await pg.evaluate(() => {
    const el = document.querySelector(".trappola"), r = el.getBoundingClientRect(), campo = document.getElementById("codice-email"), cs = getComputedStyle(campo);
    const blocco = getComputedStyle(document.querySelector(".codice-blocco")).backgroundColor;
    return { display: getComputedStyle(el).display, fuori: r.right <= 0, fondoCampo: cs.backgroundColor, bordo: cs.borderTopColor, blocco };
  });
  await contesto.close();
  verifica(st.display !== "none" && st.fuori, `trappola: display ${st.display}, fuori schermo ${st.fuori}`);
  verifica(st.fondoCampo === "rgb(255, 248, 243)" && st.bordo === "rgb(92, 69, 55)" && st.blocco === "rgb(235, 203, 181)", `stile: ${JSON.stringify(st)}`);
});

await controllo("funzione: config con path /api/codice-sconto, method POST e rateLimit (ip e dominio, 5 in 60 s); Netlify.env.get; consenso e versione dal server (SHA-256, 12 caratteri) uguali alla pagina; mai l'email nei log", async () => {
  const f = await import(pathToFileURL(FUNZIONE).href);
  const atteso = { path: "/api/codice-sconto", method: ["POST"], rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 5 } };
  verifica(JSON.stringify(f.config) === JSON.stringify(atteso), `config: ${JSON.stringify(f.config)}`);
  const sorgente = readFileSync(FUNZIONE, "utf8");
  verifica(/globalThis\.Netlify\?\.env\.get\(k\) \?\? process\.env\[k\]/.test(sorgente), "lettura delle variabili senza Netlify.env.get");
  verifica(/import testi from "\.\.\/\.\.\/content\/testi\.json" with \{ type: "json" \}/.test(sorgente), "testi.json non importato come modulo");
  verifica(!/campi\.consenso_(testo|versione)|campi\.consensoTesto/.test(sorgente), "testo o versione del consenso letti dal browser");
  const testo = build.componi(testi.comuni.codiceSconto.consenso, centro, "testi");
  verifica(f.CONSENSO_TESTO === testo, "testo del consenso del server diverso da quello della pagina");
  verifica(f.CONSENSO_VERSIONE === createHash("sha256").update(testo).digest("hex").slice(0, 12), `versione «${f.CONSENSO_VERSIONE}»`);
  for (const m of sorgente.matchAll(/console\.\w+\(([^;]*)\);/g)) verifica(!/email/i.test(m[1]), `log con l'email: ${m[0].slice(0, 60)}`);
  verifica(!/SUPABASE_SECRET_KEY.*console|console.*chiave/.test(sorgente), "chiave nei log");
});

await controllo("funzione con Supabase finto: chiama POST /rest/v1/rpc/iscrivi_email con apikey; codice in collisione (409/23505) → nuovo tentativo; dopo 4 tentativi o su errore → 500 «server»; email mai nei log", async () => {
  const f = await import(pathToFileURL(FUNZIONE).href);
  const salvati = { url: process.env.SUPABASE_URL, chiave: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch, errore: console.error };
  const chiamate = [];
  const log = [];
  let risposte = [];
  try {
    process.env.SUPABASE_URL = "https://progetto-finto.supabase.co/";
    process.env.SUPABASE_SECRET_KEY = "chiave-finta-per-i-controlli";
    globalThis.fetch = async (url, opz) => {
      chiamate.push({ url, opz, corpo: JSON.parse(opz.body) });
      return risposte.shift()(JSON.parse(opz.body));
    };
    console.error = (...a) => log.push(a.join(" "));
    const invia = () => f.default(new Request("http://x/api/codice-sconto", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ email: "anna@esempio.it", consenso: true, pagina: "/viso/", utm_source: "meta" }) }));
    const collisione = () => new Response(JSON.stringify({ code: "23505" }), { status: 409 });
    risposte = [collisione, (b) => Response.json([{ codice: b.p_codice, scadenza: b.p_scadenza, nuovo: false }])];
    const r1 = await invia();
    const d1 = await r1.json();
    verifica(r1.status === 200 && d1.prova === false && d1.nuovo === false && d1.codice === chiamate[1].corpo.p_codice, `con collisione: ${JSON.stringify(d1)}`);
    verifica(chiamate[0].url === "https://progetto-finto.supabase.co/rest/v1/rpc/iscrivi_email" && chiamate[0].opz.method === "POST", `chiamata: ${chiamate[0].url}`);
    verifica(chiamate[0].opz.headers.apikey === "chiave-finta-per-i-controlli", "header apikey mancante");
    verifica(chiamate[0].corpo.p_codice !== chiamate[1].corpo.p_codice, "dopo la collisione il codice non cambia");
    verifica(Object.keys(chiamate[0].corpo).join() === "p_email,p_codice,p_scadenza,p_consenso_testo,p_consenso_versione,p_pagina,p_utm", `parametri: ${Object.keys(chiamate[0].corpo).join(",")}`);
    verifica(chiamate[0].corpo.p_consenso_testo === f.CONSENSO_TESTO && chiamate[0].corpo.p_utm.source === "meta" && chiamate[0].corpo.p_pagina === "/viso/", "consenso, utm o pagina inviati male");
    chiamate.length = 0;
    risposte = [collisione, collisione, collisione, collisione];
    const r2 = await invia();
    verifica(r2.status === 500 && (await r2.json()).errore === "server" && chiamate.length === 4, `4 collisioni: ${r2.status}, ${chiamate.length} tentativi`);
    risposte = [() => new Response("{}", { status: 503 })];
    const r3 = await invia();
    verifica(r3.status === 500 && JSON.stringify(await r3.json()) === '{"errore":"server"}', `errore Supabase: ${r3.status}`);
    verifica(log.length >= 2 && log.every((l) => !l.includes("anna") && !l.includes("chiave-finta")), `log: ${log.join(" | ")}`);
  } finally {
    if (salvati.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = salvati.url;
    if (salvati.chiave === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = salvati.chiave;
    globalThis.fetch = salvati.fetch;
    console.error = salvati.errore;
  }
});

await controllo("supabase/iscritti.sql: tabella con email_norm generata e unica, codice unico; RLS attivo senza policy; niente permessi ad anon e authenticated; service_role solo select, insert, update; iscrivi_email security invoker, search_path public, on conflict do nothing; execute solo a service_role; istruzioni in testa", () => {
  const sql = leggi("supabase/iscritti.sql");
  const senzaCommenti = sql.replace(/--[^\n]*/g, "");
  const attesi = [
    /create table if not exists public\.iscritti/,
    /id\s+bigint generated always as identity primary key/,
    /email_norm\s+text generated always as \(lower\(trim\(email\)\)\) stored/,
    /unique \(email_norm\)/,
    /unique \(codice\)/,
    /utm\s+jsonb/,
    /creato_il\s+timestamptz not null default now\(\)/,
    /usato_il\s+timestamptz null/,
    /disiscritto_il\s+timestamptz null/,
    /alter table public\.iscritti enable row level security;/,
    /revoke all on table public\.iscritti from anon, authenticated, service_role;/,
    /grant select, insert, update on table public\.iscritti to service_role;/,
    /create or replace function public\.iscrivi_email\(\s*p_email\s+text,\s*p_codice\s+text,\s*p_scadenza\s+date,\s*p_consenso_testo\s+text,\s*p_consenso_versione\s+text,\s*p_pagina\s+text,\s*p_utm\s+jsonb\s*\)/,
    /returns table \(codice text, scadenza date, nuovo boolean\)/,
    /security invoker/,
    /set search_path = public/,
    /on conflict \(email_norm\) do nothing/,
    /revoke execute on function public\.iscrivi_email\([^)]*\) from public, anon, authenticated;/,
    /grant execute on function public\.iscrivi_email\([^)]*\) to service_role;/,
  ];
  for (const re of attesi) verifica(re.test(senzaCommenti), `manca: ${re.source.slice(0, 70)}`);
  verifica(!/create policy/i.test(senzaCommenti), "c'è una policy");
  verifica(!/security definer/i.test(senzaCommenti), "funzione security definer");
  verifica(/^-- supabase\/iscritti\.sql[\s\S]*?COME APPLICARLO[\s\S]*?SUPABASE_SECRET_KEY/.test(sql), "istruzioni in testa al file");
  verifica(!/sb_secret_[A-Za-z0-9_-]{8,}/.test(sql), "una chiave nel file SQL");
});

await controllo("sito senza ID di GA4 e Meta (build in una copia con gli ID a null): niente banner, niente consenso.js (né nell'HTML né in dist/js), niente «Preferenze cookie»; nessuna richiesta verso Google o Meta, neanche inviando il codice o toccando i contatti", async () => {
  const copia = mkdtempSync(join(tmpdir(), "migliore-senza-id-"));
  let server = null;
  try {
    for (const voce of ["build.mjs", "content", "src"]) cpSync(join(RADICE, voce), join(copia, voce), { recursive: true });
    const c = JSON.parse(readFileSync(join(copia, "content", "centro.json"), "utf8"));
    c.integrazioni.ga4Id = null;
    c.integrazioni.metaPixelId = null;
    writeFileSync(join(copia, "content", "centro.json"), JSON.stringify(c, null, 2));
    const r = spawnSync(process.execPath, ["build.mjs"], { cwd: copia, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: "", TEST_TRACCIAMENTI: "" } });
    verifica(r.status === 0, `build senza ID fallita: ${r.stderr || r.stdout}`);
    const dist = join(copia, "dist");
    verifica(!existsSync(join(dist, "js", "consenso.js")), "dist/js/consenso.js presente");
    for (const file of elenca(dist, (f) => f.endsWith(".html"))) {
      const html = readFileSync(file, "utf8");
      const nome = relative(dist, file);
      verifica(!/data-banner-cookie|consenso\.js|data-preferenze-cookie|Preferenze cookie/.test(html), `${nome}: banner, consenso.js o «Preferenze cookie»`);
      verifica(!/googletagmanager|google-analytics|facebook\.net|fbq\(|gtag\(/.test(html), `${nome}: riferimenti a Google o Meta`);
    }
    const { avviaServer } = await import(pathToFileURL(join(STUDIO, "anteprima.mjs")).href);
    server = await avviaServer(0, { cartella: dist });
    const base = `http://127.0.0.1:${server.address().port}`;
    const { browser } = await browserCondiviso();
    const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tentate = [];
    await contesto.route((u) => TRACCIANTI.test(u.hostname), (rotta) => { tentate.push(rotta.request().url()); return rotta.abort(); });
    const pg = await contesto.newPage();
    for (const percorso of percorsiDist()) {
      await pg.goto(base + percorso, { waitUntil: "networkidle" });
      await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    }
    await pg.goto(base + "/", { waitUntil: "networkidle" });
    await pg.evaluate(() => window.addEventListener("click", (e) => { if (e.target.closest("a")) e.preventDefault(); }, true));
    await pg.click('[data-pulsanti-apertura] a[href^="tel:"]');
    await pg.fill("#codice-email", "anna@esempio.it");
    await pg.check("#codice-consenso");
    await pg.evaluate(() => document.querySelector(".codice-invia").form.requestSubmit());
    await pg.waitForSelector(".codice-ottenuto");
    verifica(await pg.evaluate(() => typeof window.migliore === "undefined" && typeof window.gtag === "undefined" && typeof window.fbq === "undefined"), "window.migliore, gtag o fbq definiti senza tracciamenti");
    await contesto.close();
    verifica(!tentate.length, `richieste: ${tentate.join(", ")}`);
  } finally {
    server?.close();
    rmSync(copia, { recursive: true, force: true });
  }
});

await controllo("sito vero con gli ID di centro.json (oggi solo GA4): banner con data-ga4 uguale all'ID, niente pixel né interruttore «Marketing» senza Meta, testo del banner con i soli cookie attivi, consenso.js in dist, «Preferenze cookie» in ogni pagina; prima della scelta nessuna richiesta a Google o Meta; dopo «Accetta» richieste solo verso i servizi attivi", async () => {
  const ga4 = centro.integrazioni.ga4Id;
  const meta = centro.integrazioni.metaPixelId;
  if (!ga4 && !meta) return; // senza ID vale il controllo precedente
  const home = pagina("index.html");
  verifica(home.includes(`data-ga4="${ga4}"`) === Boolean(ga4), `data-ga4 diverso da «${ga4}»`);
  verifica(/data-meta=/.test(home) === Boolean(meta), "data-meta non corrisponde al pixel Meta di centro.json");
  verifica(/data-categoria="marketing"/.test(home) === Boolean(meta), "interruttore «Marketing» non corrisponde al pixel Meta");
  verifica(/data-categoria="statistiche"/.test(home) === Boolean(ga4), "interruttore «Statistiche» non corrisponde a GA4");
  const tipi = [ga4 && "di statistica", meta && "di marketing"].filter(Boolean).join(" e ");
  verifica(testoVisibile(home.match(/<p class="banner-testo">([\s\S]*?)<\/p>/)?.[1] ?? "").startsWith(`Usiamo cookie ${tipi} solo se li accetti.`), `testo del banner senza «cookie ${tipi}»`);
  verifica(existsSync(join(DIST, "js", "consenso.js")), "dist/js/consenso.js mancante");
  for (const file of elenca(DIST, (f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    verifica(/consenso\.js/.test(html) && /data-preferenze-cookie/.test(html), `${rel(file)}: senza consenso.js o «Preferenze cookie»`);
  }
  const { browser, base } = await browserCondiviso();
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tentate = [];
  await contesto.route((u) => TRACCIANTI.test(u.hostname), (rotta) => { tentate.push(new URL(rotta.request().url()).hostname); return rotta.abort(); });
  const pg = await contesto.newPage();
  await pg.goto(base + "/", { waitUntil: "networkidle" });
  verifica(!tentate.length, `richieste prima della scelta: ${tentate.join(", ")}`);
  await pg.click('[data-consenso="accetta"]');
  await pg.waitForTimeout(800);
  verifica(tentate.some((h) => /googletagmanager/.test(h)) === Boolean(ga4), `GA4 dopo «Accetta»: ${tentate.join(", ") || "nessuna richiesta"}`);
  verifica(tentate.some((h) => /facebook/.test(h)) === Boolean(meta), `Meta dopo «Accetta»: ${tentate.join(", ") || "nessuna richiesta"}`);
  await contesto.close();
});

/** Build di prova con TEST_TRACCIAMENTI=1 (ID finti) in una cartella temporanea, servita da un secondo server. */
async function buildDiProva() {
  const tmp = mkdtempSync(join(tmpdir(), "migliore-tracciamenti-"));
  const r = spawnSync(process.execPath, ["build.mjs", "--dist", tmp], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: "", TEST_TRACCIAMENTI: "1" } });
  if (r.status !== 0) throw new Error(`build di prova fallita: ${r.stderr || r.stdout}`);
  const { avviaServer } = await import(pathToFileURL(join(STUDIO, "anteprima.mjs")).href);
  const server = await avviaServer(0, { cartella: tmp });
  return { tmp, server, base: `http://127.0.0.1:${server.address().port}`, chiudi: () => { server.close(); rmSync(tmp, { recursive: true, force: true }); } };
}

await controllo("build di prova (TEST_TRACCIAMENTI=1, ID finti, Google e Meta bloccati): nessuna richiesta prima del consenso; «Rifiuta» e X → ancora nessuna; «Accetta» → richieste verso entrambi; la scelta resta dopo il ricaricamento e scade dopo 182 giorni; vietata con CONTEXT=production", async () => {
  const vietata = spawnSync(process.execPath, ["build.mjs", "--dist", join(tmpdir(), "migliore-vietata")], { cwd: RADICE, encoding: "utf8", env: { ...process.env, TEST_TRACCIAMENTI: "1", CONTEXT: "production" } });
  verifica(vietata.status !== 0 && /TEST_TRACCIAMENTI/.test(vietata.stderr + vietata.stdout), "TEST_TRACCIAMENTI accettato con CONTEXT=production");
  const prova = await buildDiProva();
  const { browser } = await browserCondiviso();
  const problemi = [];
  try {
    verifica(readFileSync(join(prova.tmp, "index.html"), "utf8").includes('data-ga4="G-TEST000000" data-meta="000000000000000"'), "ID finti assenti dal banner");
    const validatore = join(STUDIO, "node_modules", "html-validate", "bin", "html-validate.mjs");
    const v = spawnSync(process.execPath, [validatore, ...elenca(prova.tmp, (f) => f.endsWith(".html"))], { cwd: RADICE, encoding: "utf8" });
    verifica(v.status === 0, `html-validate sulla build di prova:\n${(v.stdout + v.stderr).trim().slice(0, 400)}`);
    const nuovoContesto = async () => {
      const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const tentate = [];
      await contesto.route((u) => TRACCIANTI.test(u.hostname), (r) => { tentate.push(new URL(r.request().url()).hostname); return r.abort(); });
      const pg = await contesto.newPage();
      await pg.goto(prova.base + "/", { waitUntil: "networkidle" });
      return { contesto, pg, tentate };
    };
    const banner = (pg) => pg.isVisible("[data-banner-cookie]");
    // Rifiuta
    let { contesto, pg, tentate } = await nuovoContesto();
    if (!(await banner(pg))) problemi.push("banner non visibile alla prima visita");
    if (tentate.length) problemi.push(`richieste prima del consenso: ${tentate.join(", ")}`);
    await pg.click('[data-consenso="rifiuta"]');
    await pg.waitForTimeout(300);
    if ((await banner(pg)) || tentate.length) problemi.push(`dopo «Rifiuta»: banner ${await banner(pg)}, richieste ${tentate.join(", ")}`);
    await pg.reload({ waitUntil: "networkidle" });
    if ((await banner(pg)) || tentate.length) problemi.push("dopo «Rifiuta» e ricaricamento: banner di nuovo o richieste");
    // Scadenza: una scelta di 183 giorni fa non vale più
    await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem("migliore-consenso")); s.t -= 183 * 864e5; localStorage.setItem("migliore-consenso", JSON.stringify(s)); });
    await pg.reload({ waitUntil: "networkidle" });
    if (!(await banner(pg))) problemi.push("dopo 182 giorni il banner non ricompare");
    await contesto.close();
    // X = rifiuto
    ({ contesto, pg, tentate } = await nuovoContesto());
    await pg.click('[data-consenso="chiudi"]');
    const sceltaX = await pg.evaluate(() => JSON.parse(localStorage.getItem("migliore-consenso")));
    if (!sceltaX || sceltaX.statistiche || sceltaX.marketing || tentate.length) problemi.push(`X: ${JSON.stringify(sceltaX)}, richieste ${tentate.length}`);
    await contesto.close();
    // Accetta
    ({ contesto, pg, tentate } = await nuovoContesto());
    await pg.click('[data-consenso="accetta"]');
    await pg.waitForTimeout(800);
    const host = [...new Set(tentate)];
    if (!host.some((h) => /googletagmanager\.com$/.test(h)) || !host.some((h) => /facebook\.net$/.test(h))) problemi.push(`dopo «Accetta»: ${host.join(", ") || "nessuna richiesta"}`);
    tentate.length = 0;
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(500);
    if (await banner(pg)) problemi.push("dopo «Accetta» e ricaricamento il banner ricompare");
    if (!tentate.some((h) => /googletagmanager/.test(h)) || !tentate.some((h) => /facebook\.net/.test(h))) problemi.push(`dopo il ricaricamento gli script non ripartono: ${tentate.join(", ")}`);
    await contesto.close();
  } finally {
    prova.chiudi();
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("banner della build di prova: «Rifiuta», «Personalizza», «Accetta» con lo stesso stile e la stessa misura; pannello con «Statistiche» e «Marketing» spenti (role=switch); salvare solo «Statistiche» carica solo Google; «Preferenze cookie» nel footer riapre il pannello; barra contatti nascosta col banner aperto; link alla cookie policy", async () => {
  const prova = await buildDiProva();
  const { browser } = await browserCondiviso();
  const problemi = [];
  try {
    const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tentate = [];
    await contesto.route((u) => TRACCIANTI.test(u.hostname), (r) => { tentate.push(new URL(r.request().url()).hostname); return r.abort(); });
    const pg = await contesto.newPage();
    await pg.goto(prova.base + "/", { waitUntil: "networkidle" });
    const pulsanti = await pg.$$eval(".banner-pulsanti .pulsante", (b) => b.map((x) => { const r = x.getBoundingClientRect(); return { classe: x.className, testo: x.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), fondo: getComputedStyle(x).backgroundColor, bordo: getComputedStyle(x).borderTopColor }; }));
    if (pulsanti.map((p) => p.testo).join() !== "Rifiuta,Personalizza,Accetta") problemi.push(`pulsanti: ${pulsanti.map((p) => p.testo).join(", ")}`);
    if (new Set(pulsanti.map((p) => `${p.classe}|${p.w}|${p.h}|${p.fondo}|${p.bordo}`)).size !== 1) problemi.push(`pulsanti diversi: ${JSON.stringify(pulsanti)}`);
    if (pulsanti.some((p) => p.h < 44)) problemi.push("pulsanti sotto i 44 px");
    const chiudi = await pg.$eval("[data-consenso='chiudi']", (x) => { const r = x.getBoundingClientRect(); return [r.width, r.height, x.getAttribute("aria-label")]; });
    if (chiudi[0] < 44 || chiudi[1] < 44 || !chiudi[2]) problemi.push(`X: ${chiudi.join(" ")}`);
    if (!(await pg.isVisible('[data-banner-cookie] a[href="/cookie/"]'))) problemi.push("manca il link alla cookie policy");
    await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2));
    await pg.waitForTimeout(400);
    if (await pg.isVisible(".barra-contatti")) problemi.push("barra contatti visibile col banner aperto");
    await pg.click('[data-consenso="personalizza"]');
    const interruttori = await pg.$$eval("[data-categoria]", (c) => c.map((x) => [x.dataset.categoria, x.checked, x.getAttribute("role")]));
    if (JSON.stringify(interruttori) !== JSON.stringify([["statistiche", false, "switch"], ["marketing", false, "switch"]])) problemi.push(`interruttori: ${JSON.stringify(interruttori)}`);
    await pg.check('[data-categoria="statistiche"]');
    await pg.click('[data-consenso="salva"]');
    await pg.waitForTimeout(800);
    if (!tentate.some((h) => /googletagmanager/.test(h)) || tentate.some((h) => /facebook/.test(h))) problemi.push(`solo statistiche: ${[...new Set(tentate)].join(", ")}`);
    if (!(await pg.isVisible(".barra-contatti"))) problemi.push("barra contatti non torna dopo la scelta");
    await pg.click("[data-preferenze-cookie]");
    const stato = await pg.evaluate(() => ({ pannello: !document.getElementById("banner-pannello").hidden, stat: document.querySelector('[data-categoria="statistiche"]').checked, mkt: document.querySelector('[data-categoria="marketing"]').checked }));
    if (!stato.pannello || !stato.stat || stato.mkt) problemi.push(`«Preferenze cookie»: ${JSON.stringify(stato)}`);
    await contesto.close();
    const senzaJs = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const pj = await senzaJs.newPage();
    await pj.goto(prova.base + "/", { waitUntil: "networkidle" });
    if ((await pj.isVisible("[data-banner-cookie]")) || (await pj.isVisible("[data-preferenze-cookie]"))) problemi.push("senza JavaScript compaiono il banner o «Preferenze cookie»");
    await senzaJs.close();
  } finally {
    prova.chiudi();
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("eventi (build di prova, dopo «Accetta»): tel → GA4 clic_chiama e Meta Contact; wa.me → GA4 clic_whatsapp e Meta Contact; codice ottenuto → GA4 generate_lead e Meta Lead con eventID = evento_id; prima del consenso nessun evento", async () => {
  const prova = await buildDiProva();
  const { browser } = await browserCondiviso();
  const problemi = [];
  try {
    const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await contesto.route((u) => TRACCIANTI.test(u.hostname), (r) => r.abort());
    const pg = await contesto.newPage();
    await pg.goto(prova.base + "/", { waitUntil: "networkidle" });
    await pg.evaluate(() => window.addEventListener("click", (e) => { if (e.target.closest("a")) e.preventDefault(); }, true));
    await pg.evaluate(() => document.querySelector('[data-pulsanti-apertura] a[href^="tel:"]').click());
    if (await pg.evaluate(() => Boolean(window.dataLayer || window.fbq))) problemi.push("eventi o script prima del consenso");
    await pg.click('[data-consenso="accetta"]');
    await pg.evaluate(() => {
      document.querySelector('[data-pulsanti-apertura] a[href^="tel:"]').click();
      document.querySelector('[data-pulsanti-apertura] a[href^="https://wa.me/"]').click();
    });
    await pg.fill("#codice-email", "anna@esempio.it");
    await pg.check("#codice-consenso");
    await pg.evaluate(() => document.querySelector(".codice-invia").form.requestSubmit());
    await pg.waitForSelector(".codice-ottenuto");
    const ev = await pg.evaluate(() => ({
      ga4: window.dataLayer.filter((a) => a[0] === "event").map((a) => [a[1], a[2] && a[2].event_id]),
      meta: window.fbq.queue.filter((a) => a[0] === "track").map((a) => [a[1], a[3] && a[3].eventID]),
      evento: document.querySelector('[name="evento_id"]').value,
    }));
    const ga4 = ev.ga4.map((e) => e[0]).join();
    const meta = ev.meta.map((e) => e[0]).join();
    if (ga4 !== "clic_chiama,clic_whatsapp,generate_lead") problemi.push(`GA4: ${ga4}`);
    if (meta !== "PageView,Contact,Contact,Lead") problemi.push(`Meta: ${meta}`);
    if (ev.meta.at(-1)[1] !== ev.evento || ev.ga4.at(-1)[1] !== ev.evento || !ev.evento) problemi.push(`eventID del Lead diverso da evento_id (${JSON.stringify(ev)})`);
    await contesto.close();
  } finally {
    prova.chiudi();
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("nessuna chiave nel repository: nei file versionati (e nei nuovi non ignorati) nessuna chiave segreta Supabase (sb_secret_…), nessun JWT (eyJhbGciOi…) e nessun token Meta (EAA…)", () => {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: RADICE, encoding: "utf8" });
  verifica(r.status === 0, `git ls-files: ${r.stderr}`);
  const CHIAVI = [new RegExp("sb_" + "secret_[A-Za-z0-9_-]{8,}"), new RegExp("eyJhbGc" + "iOi[A-Za-z0-9_-]{8,}"), /EAA[A-Za-z0-9]{20,}/];
  const trovate = [];
  for (const f of r.stdout.split("\0").filter(Boolean)) {
    const pieno = join(RADICE, f);
    if (!existsSync(pieno) || !statSync(pieno).isFile() || statSync(pieno).size > 2_000_000 || /\.(png|jpe?g|webp|avif|woff2|ico|zip)$/i.test(f)) continue;
    const testo = readFileSync(pieno, "utf8");
    for (const re of CHIAVI) if (re.test(testo)) trovate.push(`${f}: ${re.source.slice(0, 12)}…`);
  }
  verifica(!trovate.length, trovate.join(", "));
  const prova = ["sb_" + "secret_abcdefgh12345678_x", "eyJhbGc" + "iOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "EAA" + "BwzLixnjYBO1234567890abcd"];
  verifica(prova.every((p, i) => CHIAVI[i].test(p)), "le espressioni non riconoscono una chiave di prova");
});

await controllo("codice.js ≤ 3 KB; con il banner (build di prova) main.js, codice.js e consenso.js compressi restano ≤ 12 KB", async () => {
  const codice = statSync(join(RADICE, "src", "js", "codice.js")).size;
  verifica(codice <= 3072, `codice.js ${codice} B`);
  const somma = ["main.js", "codice.js", "consenso.js"].reduce((t, f) => t + gzipSync(readFileSync(join(RADICE, "src", "js", f))).length, 0);
  verifica(somma <= 12288, `JS compresso con il banner: ${somma} B`);
});

// ---------------------------------------------------------------- Step 9: controllo qualità e integrazioni

const cspNetlify = () => leggi("netlify.toml").match(/^\s*Content-Security-Policy\s*=\s*"([^"]*)"/m)?.[1] ?? null;
/** Apre le pagine con gli header di netlify.toml (CSP compresa) e raccoglie le violazioni CSP. */
async function violazioniCsp(contesto, url, azione) {
  const pg = await contesto.newPage();
  await pg.addInitScript(() => {
    window.__violazioni = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__violazioni.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await pg.goto(url, { waitUntil: "networkidle" });
  if (azione) await azione(pg);
  await pg.waitForTimeout(300);
  const v = await pg.evaluate(() => window.__violazioni);
  await pg.close();
  return v;
}

await controllo("Content-Security-Policy in netlify.toml: direttive di base, impronta sha256 uguale all'unico script inline, nessuno stile o gestore inline; Google e Meta ammessi solo dove servono", () => {
  const csp = cspNetlify();
  verifica(csp, "Content-Security-Policy mancante nel blocco «/*» di netlify.toml");
  for (const d of ["default-src 'self'", "style-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
    verifica(csp.includes(d), `CSP senza «${d}»`);
  }
  // Con il dominio ancora in http (certificato non attivo) upgrade-insecure-requests manda CSS, immagini e font in
  // https e la pagina resta senza stile: è successo al primo deploy. Il passaggio a https lo fa Netlify.
  verifica(!csp.includes("upgrade-insecure-requests"), "CSP con upgrade-insecure-requests: in http la pagina resta senza CSS, immagini e font");
  verifica(!/unsafe-inline|unsafe-eval|\*\s|'\*'|\shttp:/.test(csp), "CSP con unsafe-inline, unsafe-eval, jolly o http:");
  const script = csp.match(/script-src ([^;]*)/)?.[1] ?? "";
  verifica(/https:\/\/\*\.googletagmanager\.com/.test(script) && /https:\/\/connect\.facebook\.net/.test(script), `script-src: ${script}`);
  const impronte = new Set();
  for (const file of elenca(DIST, (f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) {
      impronte.add(`sha256-${createHash("sha256").update(m[1]).digest("base64")}`);
    }
    verifica(!/\sstyle="/.test(html), `${rel(file)}: attributo style inline`);
    verifica(!/\son[a-z]+="/.test(html), `${rel(file)}: gestore di evento inline`);
    verifica(!/<style\b/.test(html), `${rel(file)}: <style> inline`);
  }
  verifica(impronte.size === 1, `script inline diversi: ${impronte.size}`);
  for (const i of impronte) verifica(script.includes(`'${i}'`), `l'impronta ${i} dello script inline non è nella CSP`);
});

await controllo("CSP nel browser (anteprima con gli header di netlify.toml): nessuna violazione su tutte le pagine, inviando il codice, e nella build di prova dopo «Accetta» (con le richieste verso Google e Meta tentate)", async () => {
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const percorso of percorsiDist()) {
    const v = await violazioniCsp(contesto, base + percorso);
    if (v.length) problemi.push(`${percorso}: ${v.join(", ")}`);
  }
  const v = await violazioniCsp(contesto, base + "/viso/", async (pg) => {
    await pg.fill("#codice-email", "anna@esempio.it");
    await pg.check("#codice-consenso");
    await pg.click(".codice-invia");
    await pg.waitForSelector(".codice-ottenuto");
  });
  if (v.length) problemi.push(`invio del codice: ${v.join(", ")}`);
  const csp = await (await fetch(base + "/")).headers.get("content-security-policy");
  if (!csp?.startsWith("default-src 'self'")) problemi.push("l'anteprima non applica la CSP di netlify.toml");
  await contesto.close();
  const prova = await buildDiProva();
  try {
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tentate = [];
    await c2.route((u) => TRACCIANTI.test(u.hostname), (r) => { tentate.push(new URL(r.request().url()).hostname); return r.abort(); });
    const v2 = await violazioniCsp(c2, prova.base + "/", async (pg) => {
      await pg.click('[data-consenso="accetta"]');
      await pg.waitForTimeout(800);
    });
    if (v2.length) problemi.push(`build di prova dopo «Accetta»: ${v2.join(", ")}`);
    if (!tentate.some((h) => /googletagmanager/.test(h)) || !tentate.some((h) => /facebook\.net/.test(h))) problemi.push(`con la CSP Google o Meta non partono: ${tentate.join(", ")}`);
    await c2.close();
  } finally {
    prova.chiudi();
  }
  verifica(!problemi.length, problemi.join(" · "));
});

await controllo("Brevo (finto): POST /v3/smtp/email con api-key, mittente di centro.json, replyTo, oggetto e corpo HTML dai testi (codice, scadenza in italiano, condizioni, telefono); true solo se Brevo accetta; senza chiave, senza mittente o in modalità prova nessun invio; mai l'email nei log", async () => {
  const f = await import(pathToFileURL(FUNZIONE).href);
  const salvati = { chiave: process.env.BREVO_API_KEY, url: process.env.SUPABASE_URL, segreta: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch, errore: console.error };
  const chiamate = [];
  const log = [];
  let risposta = () => new Response(JSON.stringify({ messageId: "<prova@brevo>" }), { status: 201 });
  try {
    globalThis.fetch = async (url, opz) => { chiamate.push({ url, opz }); return risposta(); };
    console.error = (...a) => log.push(a.join(" "));
    const dati = { email: "anna@esempio.it", codice: "MIG-ABC234", scadenza: "2026-12-02" };
    delete process.env.BREVO_API_KEY;
    verifica((await f.inviaEmail(dati, "codice@esteticamigliore.it")) === false && chiamate.length === 0, "senza BREVO_API_KEY parte un invio");
    process.env.BREVO_API_KEY = "chiave-brevo-finta";
    verifica((await f.inviaEmail(dati, null)) === false && chiamate.length === 0, "senza mittente parte un invio");
    verifica((await f.inviaEmail(dati, "codice@esteticamigliore.it")) === true, "con Brevo che accetta, emailInviata non è true");
    const c = chiamate[0];
    const corpo = JSON.parse(c.opz.body);
    verifica(c.url === "https://api.brevo.com/v3/smtp/email" && c.opz.method === "POST" && c.opz.headers["api-key"] === "chiave-brevo-finta", "endpoint, metodo o api-key");
    verifica(corpo.sender.email === "codice@esteticamigliore.it" && corpo.sender.name === centro.nome && corpo.to[0].email === "anna@esempio.it" && corpo.replyTo.email === centro.email, `mittente o destinatario: ${JSON.stringify(corpo.sender)}`);
    verifica(corpo.subject === build.componi(testi.comuni.codiceSconto.email.oggetto, centro, "testi"), `oggetto «${corpo.subject}»`);
    verifica(corpo.htmlContent && !("textContent" in corpo) && !("templateId" in corpo), "Brevo vuole un solo tipo di corpo: htmlContent");
    const testo = decodifica(corpo.htmlContent.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
    for (const atteso of ["MIG-ABC234", "Valido fino al 2 dicembre 2026.", build.componi(testi.comuni.codiceSconto.condizioni, centro, "testi"), centro.telefono, centro.indirizzo.completo]) {
      verifica(testo.includes(atteso), `email senza «${atteso}»`);
    }
    risposta = () => new Response("{}", { status: 400 });
    verifica((await f.inviaEmail(dati, "codice@esteticamigliore.it")) === false, "con Brevo che rifiuta, emailInviata è true");
    risposta = () => { throw new TypeError("rete"); };
    verifica((await f.inviaEmail(dati, "codice@esteticamigliore.it")) === false, "con la rete giù, emailInviata è true");
    verifica(log.length === 2 && log.every((l) => !l.includes("anna") && !l.includes("chiave-brevo")), `log: ${log.join(" | ")}`);
    // Gestore: modalità prova → nessun invio; con Supabase ma senza mittente in centro.json → nessun invio.
    chiamate.length = 0;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    const invia = () => f.default(new Request("http://x/api/codice-sconto", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ email: "anna@esempio.it", consenso: true }) }));
    const r1 = await (await invia()).json();
    verifica(r1.prova === true && r1.emailInviata === false && chiamate.length === 0, "in modalità prova parte l'email");
    process.env.SUPABASE_URL = "https://progetto-finto.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "chiave-finta";
    risposta = () => Response.json([{ codice: "MIG-ABC234", scadenza: "2026-12-02", nuovo: true }]);
    const r2 = await (await invia()).json();
    verifica(r2.prova === false && r2.emailInviata === (centro.integrazioni.servizioEmail?.mittente ? true : false), `con Supabase: ${JSON.stringify(r2)}`);
    verifica(chiamate.every((ch) => !String(ch.url).includes("/v3/smtp/email")) || centro.integrazioni.servizioEmail?.mittente, "senza mittente in centro.json è partita un'email da Brevo");
    const contatti = chiamate.filter((ch) => String(ch.url) === "https://api.brevo.com/v3/contacts").length;
    verifica(contatti === (centro.integrazioni.servizioEmail?.listaPromo ? 1 : 0), `chiamate alla lista promo di Brevo: ${contatti}`);
  } finally {
    for (const [k, v] of [["BREVO_API_KEY", salvati.chiave], ["SUPABASE_URL", salvati.url], ["SUPABASE_SECRET_KEY", salvati.segreta]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    globalThis.fetch = salvati.fetch;
    console.error = salvati.errore;
  }
});

await controllo("Brevo lista promo (finto): POST /v3/contacts con api-key, email, listIds con l'ID di centro.json e updateEnabled; true solo se Brevo accetta (201 o 204); senza chiave o senza un ID intero positivo nessuna chiamata; in modalità prova nessuna chiamata; mai l'email nei log", async () => {
  const f = await import(pathToFileURL(FUNZIONE).href);
  verifica(typeof f.aggiungiAllaLista === "function", "aggiungiAllaLista non esportata");
  const lista = centro.integrazioni.servizioEmail?.listaPromo;
  verifica(lista === null || (Number.isInteger(lista) && lista > 0), `centro.json › servizioEmail.listaPromo deve essere null o un numero intero positivo: ${JSON.stringify(lista)}`);
  const salvati = { chiave: process.env.BREVO_API_KEY, url: process.env.SUPABASE_URL, segreta: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch, errore: console.error };
  const chiamate = [];
  const log = [];
  let risposta = () => new Response(JSON.stringify({ id: 1 }), { status: 201 });
  try {
    globalThis.fetch = async (url, opz) => { chiamate.push({ url, opz }); return risposta(); };
    console.error = (...a) => log.push(a.join(" "));
    const dati = { email: "anna@esempio.it" };
    delete process.env.BREVO_API_KEY;
    verifica((await f.aggiungiAllaLista(dati, 7)) === false && chiamate.length === 0, "senza BREVO_API_KEY parte una chiamata");
    process.env.BREVO_API_KEY = "chiave-brevo-finta";
    for (const sbagliato of [null, 0, -3, 2.5, "7"]) {
      verifica((await f.aggiungiAllaLista(dati, sbagliato)) === false && chiamate.length === 0, `con lista ${JSON.stringify(sbagliato)} parte una chiamata`);
    }
    verifica((await f.aggiungiAllaLista(dati, 7)) === true, "con Brevo che crea il contatto (201) non restituisce true");
    const c = chiamate[0];
    const corpo = JSON.parse(c.opz.body);
    verifica(c.url === "https://api.brevo.com/v3/contacts" && c.opz.method === "POST" && c.opz.headers["api-key"] === "chiave-brevo-finta", "endpoint, metodo o api-key");
    verifica(corpo.email === "anna@esempio.it" && JSON.stringify(corpo.listIds) === "[7]" && corpo.updateEnabled === true, `corpo: ${c.opz.body}`);
    verifica(!("emailBlacklisted" in corpo), "la chiamata non deve cambiare chi si è disiscritto");
    risposta = () => new Response(null, { status: 204 });
    verifica((await f.aggiungiAllaLista(dati, 7)) === true, "con Brevo che aggiorna un contatto esistente (204) non restituisce true");
    risposta = () => new Response("{}", { status: 400 });
    verifica((await f.aggiungiAllaLista(dati, 7)) === false, "con Brevo che rifiuta restituisce true");
    risposta = () => { throw new TypeError("rete"); };
    verifica((await f.aggiungiAllaLista(dati, 7)) === false, "con la rete giù restituisce true");
    verifica(log.length === 2 && log.every((l) => !l.includes("anna") && !l.includes("chiave-brevo")), `log: ${log.join(" | ")}`);
    // Gestore in modalità prova: nessuna chiamata a Brevo.
    chiamate.length = 0;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    const r = await (await f.default(new Request("http://x/api/codice-sconto", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ email: "anna@esempio.it", consenso: true }) }))).json();
    verifica(r.prova === true && chiamate.length === 0, "in modalità prova parte una chiamata a Brevo");
  } finally {
    for (const [k, v] of [["BREVO_API_KEY", salvati.chiave], ["SUPABASE_URL", salvati.url], ["SUPABASE_SECRET_KEY", salvati.segreta]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    globalThis.fetch = salvati.fetch;
    console.error = salvati.errore;
  }
});

await controllo("pulizia dei dati (§10, privacy): pulisci_iscritti() cancella le iscrizioni revocate e quelle senza interazioni da oltre 24 mesi; nessuno tranne postgres la esegue; Supabase Cron la lancia ogni giorno", () => {
  const sql = leggi("supabase/iscritti.sql").replace(/--[^\n]*/g, "");
  for (const re of [
    /create or replace function public\.pulisci_iscritti\(\)\s*returns integer/,
    /where disiscritto_il is not null\s+or greatest\(creato_il, coalesce\(usato_il, creato_il\)\) < now\(\) - interval '24 months'/,
    /revoke execute on function public\.pulisci_iscritti\(\) from public, anon, authenticated, service_role;/,
    /create extension if not exists pg_cron with schema pg_catalog;/,
    /select cron\.schedule\('pulizia-iscritti', '\d+ \d+ \* \* \*', \$\$select public\.pulisci_iscritti\(\)\$\$\);/,
  ]) verifica(re.test(sql), `manca: ${re.source.slice(0, 60)}`);
  verifica(testi.comuni.privacy.trattamenti.voci[1].conservazione.includes("24 mesi"), "la privacy non dice più 24 mesi");
});

await controllo("CSS minificato in dist/ (Lighthouse «unminified-css») senza cambiarne il significato: per ogni file il browser legge le stesse regole dal sorgente e dal minificato; casi difficili (.a :focus, stringhe, commenti con apostrofi, calc)", async () => {
  const { browser } = await browserCondiviso();
  const pg = await browser.newPage();
  const regole = (testo) =>
    pg.evaluate((t) => {
      const foglio = new CSSStyleSheet();
      foglio.replaceSync(t);
      // Le custom property (--x: a, b) e le condizioni di @supports conservano gli spazi come sono scritti:
      // «a, b» e «a,b», «(x: y)» e «(x:y)» valgono uguale, quindi si confrontano senza spazi dopo virgole e due
      // punti. Tutto il resto il browser lo riscrive da sé in forma canonica.
      return [...foglio.cssRules].map((r) => r.cssText.replace(/([,:])\s+/g, "$1"));
    }, testo);
  try {
    for (const nome of ["tokens.css", "base.css", "sezioni.css"]) {
      const sorgente = leggi(`src/css/${nome}`);
      const corto = build.minificaCss(sorgente);
      const [a, b] = [await regole(sorgente), await regole(corto)];
      verifica(a.length > 0 && JSON.stringify(a) === JSON.stringify(b), `${nome}: regole diverse dopo la minificazione (${a.length} → ${b.length})`);
      verifica(corto.length < sorgente.length * 0.85, `${nome}: minificato solo del ${Math.round(100 - (corto.length / sorgente.length) * 100)}%`);
      const pubblicato = readFileSync(join(DIST, "css", nome), "utf8");
      verifica(!pubblicato.includes("\n") && !pubblicato.includes("/*"), `dist/css/${nome}: non è minificato`);
    }
    const difficile = `/* l'header: niente */ .a :focus , .b>.c { width : calc( 100% - 2rem ) ; content : "a  b ; c" ; } @media (min-width: 768px) { .d { grid-template-areas: "x y" 'z w'; } }`;
    const corto = build.minificaCss(difficile);
    verifica(corto.includes(".a :focus,") && corto.includes('"a  b ; c"') && corto.includes("calc( 100% - 2rem )") && !corto.includes("header"), `caso difficile: ${corto}`);
    verifica(JSON.stringify(await regole(difficile)) === JSON.stringify(await regole(corto)), `caso difficile: regole diverse (${corto})`);
  } finally {
    await pg.close();
  }
});

await controllo("tipografia (rilettura dello Step 9): in pagina, alt e meta solo apostrofi ’ e virgolette «» o “”, mai ' o \" dritti; nei testi nessuno spazio doppio, nessuno spazio prima di , . ; : ! ? e nessuno spazio a inizio o fine", () => {
  const problemi = [];
  for (const file of elenca(DIST, (p) => p.endsWith(".html"))) {
    const html = readFileSync(file, "utf8").replace(/<script\b[\s\S]*?<\/script>/gi, " ");
    const attributi = [...html.matchAll(/\s(?:alt|content|aria-label|title|placeholder)="([^"]*)"/g)].map((m) => decodifica(m[1])).filter((v) => !/^(https?:|\/|#|width=|[\d.]+$)/.test(v));
    const titolo = decodifica(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    for (const testo of [testoVisibile(html), titolo, ...attributi]) {
      if (/'/.test(testo)) problemi.push(`${rel(file)}: apostrofo dritto in «${testo.match(/.{0,30}'.{0,30}/)[0]}»`);
      if (/"/.test(testo)) problemi.push(`${rel(file)}: virgolette dritte in «${testo.match(/.{0,30}".{0,30}/)[0]}»`);
    }
  }
  const stringhe = [];
  const raccogli = (o, percorso) => {
    if (typeof o === "string") stringhe.push([percorso, o]);
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (!k.startsWith("_")) raccogli(v, `${percorso}.${k}`);
  };
  raccogli(testi, "testi");
  raccogli(json("content/listino.json"), "listino");
  for (const [percorso, s] of stringhe) {
    if (/ {2}/.test(s)) problemi.push(`${percorso}: spazio doppio`);
    if (/ [,.;:!?](?!\d)/.test(s)) problemi.push(`${percorso}: spazio prima della punteggiatura in «${s.match(/.{0,20} [,.;:!?].{0,10}/)[0]}»`);
    if (s !== s.trim()) problemi.push(`${percorso}: spazio a inizio o fine`);
    if (/'/.test(s)) problemi.push(`${percorso}: apostrofo dritto`);
  }
  verifica(!problemi.length, problemi.slice(0, 8).join(" · "));
});

await controllo("link (Step 9): ogni link e risorsa interna di ogni pagina risponde 200 dal server di anteprima, ogni #ancora esiste; i link esterni sono solo tel:, wa.me, Maps, mailto e Garante; un indirizzo inesistente risponde 404 con la pagina 404; /viso senza barra porta a /viso/", async () => {
  const { base } = await browserCondiviso();
  const problemi = [];
  const controllati = new Map();
  const idDi = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const dominio = new URL(INDIRIZZO_PRINCIPALE).host;
  for (const percorso of percorsiDist().filter((p) => !p.startsWith("/pagina-che-non-esiste"))) {
    const risposta = await fetch(base + percorso);
    const html = await risposta.text();
    if (risposta.status !== 200) problemi.push(`${percorso}: ${risposta.status}`);
    const riferimenti = [
      ...[...html.matchAll(/\s(?:href|src|action)="([^"]+)"/g)].map((m) => decodifica(m[1])),
      ...[...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(",").map((p) => p.trim().split(/\s+/)[0])),
      ...[...html.matchAll(/<meta property="og:image" content="([^"]+)"/g)].map((m) => m[1]),
    ];
    for (const r of riferimenti) {
      if (r.startsWith("#")) {
        if (r.length > 1 && !idDi(html).has(r.slice(1))) problemi.push(`${percorso}: ancora ${r} inesistente`);
        continue;
      }
      if (/^(tel:|mailto:|https:\/\/wa\.me\/|https:\/\/www\.google\.com\/maps\/|https:\/\/www\.garanteprivacy\.it)/.test(r)) {
        if (r.startsWith("tel:") && r !== `tel:${centro.telefonoE164}`) problemi.push(`${percorso}: ${r}`);
        if (r.startsWith("mailto:") && r !== `mailto:${centro.email}`) problemi.push(`${percorso}: ${r}`);
        if (r.startsWith("https://wa.me/") && !Object.values(testi.whatsapp).some((t) => r === `https://wa.me/${centro.whatsappNumero}?text=${encodeURIComponent(t)}`)) problemi.push(`${percorso}: ${r}`);
        if (r.startsWith("https://www.google.com/maps/")) {
          const q = new URL(r).searchParams;
          if (!r.startsWith("https://www.google.com/maps/search/?api=1&query=") || !q.get("query").startsWith(`${centro.indirizzo.via}, ${centro.indirizzo.cap} ${centro.indirizzo.comune}`)) problemi.push(`${percorso}: Maps ${r}`);
        }
        continue;
      }
      let url;
      try {
        url = new URL(r, base + percorso);
      } catch {
        problemi.push(`${percorso}: link non valido ${r}`);
        continue;
      }
      if (url.host === dominio) url = new URL(url.pathname + url.search, base); // og:image assoluto sul dominio
      else if (url.origin !== new URL(base).origin) {
        problemi.push(`${percorso}: link esterno non previsto ${r}`);
        continue;
      }
      const chiave = url.pathname + url.search;
      if (!controllati.has(chiave)) {
        const metodo = url.pathname === "/api/codice-sconto" ? "OPTIONS" : "GET";
        controllati.set(chiave, metodo === "GET" ? (await fetch(url)).status : 405);
      }
      if (controllati.get(chiave) !== 200 && url.pathname !== "/api/codice-sconto") problemi.push(`${percorso}: ${chiave} → ${controllati.get(chiave)}`);
      if (url.hash && url.hash.length > 1) {
        const destinazione = url.pathname === percorso ? html : await (await fetch(new URL(url.pathname, base))).text();
        if (!idDi(destinazione).has(url.hash.slice(1))) problemi.push(`${percorso}: ancora ${url.pathname}${url.hash} inesistente`);
      }
    }
  }
  const nessuna = await fetch(base + "/pagina-che-non-esiste/");
  const testo404 = await nessuna.text();
  if (nessuna.status !== 404 || !testo404.includes("Questa pagina non esiste.")) problemi.push(`indirizzo inesistente: ${nessuna.status}`);
  const senzaBarra = await fetch(base + "/viso", { redirect: "manual" });
  if (senzaBarra.status !== 301 || senzaBarra.headers.get("location") !== "/viso/") problemi.push(`/viso: ${senzaBarra.status} ${senzaBarra.headers.get("location")}`);
  verifica(controllati.size > 20, `solo ${controllati.size} indirizzi interni controllati`);
  verifica(!problemi.length, problemi.slice(0, 8).join(" · "));
});

await controllo("390, 768, 1024 e 1440 px su tutte le pagine (Step 9): nessuno scroll orizzontale, nessun elemento fuori dallo schermo, nessun testo tagliato; ogni foto sfumata (maschera sull'immagine o sulla sua cornice)", async () => {
  const { browser, base } = await browserCondiviso();
  const problemi = [];
  for (const larghezza of [390, 768, 1024, 1440]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: 900 } });
    const pg = await contesto.newPage();
    for (const percorso of percorsiDist()) {
      await pg.goto(base + percorso, { waitUntil: "load" });
      const esito = await pg.evaluate(() => {
        const fuori = [];
        // Testo nascosto per i lettori di schermo (1 × 1 px con clip): non è testo tagliato.
        const soloLettori = (el) => el.getBoundingClientRect().width <= 1 && getComputedStyle(el).clip !== "auto";
        for (const el of document.querySelectorAll("body *")) {
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden" || el.closest("[hidden], template") || soloLettori(el)) continue;
          if (el.closest(".trappola")) continue; // campo trappola del codice sconto: fuori schermo apposta (Step 8)
          const b = el.getBoundingClientRect();
          if (b.width && (b.right > innerWidth + 1 || b.left < -1)) fuori.push(`${el.tagName.toLowerCase()}.${el.classList[0] ?? ""} fuori schermo (${Math.round(b.left)}–${Math.round(b.right)})`);
          if (/hidden|clip/.test(`${s.overflowX} ${s.overflowY}`) && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim() && !el.querySelector("img")) fuori.push(`${el.tagName.toLowerCase()}.${el.classList[0] ?? ""} testo tagliato`);
        }
        const mascherata = (img) => {
          for (let el = img; el && el !== document.body; el = el.parentElement) {
            const s = getComputedStyle(el);
            if ((s.maskImage && s.maskImage !== "none") || (s.webkitMaskImage && s.webkitMaskImage !== "none")) return true;
          }
          return false;
        };
        const senza = [...document.querySelectorAll("main picture img")].filter((i) => !mascherata(i)).map((i) => i.getAttribute("alt"));
        return { scroll: document.documentElement.scrollWidth - innerWidth, fuori, senza };
      });
      if (esito.scroll > 0) problemi.push(`${percorso} ${larghezza} px: scroll orizzontale di ${esito.scroll} px`);
      for (const f of esito.fuori.slice(0, 3)) problemi.push(`${percorso} ${larghezza} px: ${f}`);
      for (const alt of esito.senza) problemi.push(`${percorso} ${larghezza} px: foto non sfumata «${alt}»`);
    }
    await contesto.close();
  }
  verifica(!problemi.length, problemi.slice(0, 8).join(" · "));
});

await controllo("Google Search Console: <meta name=\"google-site-verification\"> con il codice di centro.json in ogni pagina, una volta sola; senza codice nessun meta; un codice con «google-site-verification=» davanti o con caratteri strani ferma la build", () => {
  const codice = centro.integrazioni.googleVerifica;
  for (const file of elenca(DIST, (p) => p.endsWith(".html"))) {
    const meta = [...readFileSync(file, "utf8").matchAll(/<meta name="google-site-verification" content="([^"]*)">/g)].map((m) => m[1]);
    verifica(codice ? meta.length === 1 && meta[0] === codice : meta.length === 0, `${rel(file)}: meta di verifica «${meta.join(", ")}»`);
  }
  for (const sbagliato of [`google-site-verification=${codice ?? "x".repeat(43)}`, "codice con spazi e accenti è", "corto"]) {
    let fermato = false;
    try {
      build.datiTracciamenti({ ...centro, integrazioni: { ...centro.integrazioni, googleVerifica: sbagliato } }, {});
    } catch {
      fermato = true;
    }
    verifica(fermato, `codice «${sbagliato}» accettato`);
  }
});

await controllo("Google Search Console, metodo «File HTML»: il file di centro.json è nella radice di dist/ con esattamente «google-site-verification: <nome>», risponde 200 dall'anteprima, non è nella sitemap; html-validate lo salta; un nome sbagliato ferma la build", async () => {
  const nome = centro.integrazioni.googleFileVerifica;
  verifica(nome, "integrazioni.googleFileVerifica mancante in centro.json");
  const file = join(DIST, nome);
  verifica(existsSync(file), `dist/${nome} mancante`);
  verifica(readFileSync(file, "utf8") === `google-site-verification: ${nome}`, `dist/${nome}: contenuto «${readFileSync(file, "utf8")}»`);
  const { base } = await browserCondiviso();
  const r = await fetch(`${base}/${nome}`);
  verifica(r.status === 200 && (await r.text()) === `google-site-verification: ${nome}`, `/${nome}: ${r.status}`);
  if (existsSync(join(DIST, "sitemap.xml"))) verifica(!readFileSync(join(DIST, "sitemap.xml"), "utf8").includes(nome), "il file di verifica è nella sitemap");
  verifica(readFileSync(join(RADICE, ".htmlvalidateignore"), "utf8").includes("/dist/google*.html"), ".htmlvalidateignore senza /dist/google*.html");
  for (const sbagliato of ["google1308769860b5c5bc", "google-1308.html", "pagina.html"]) {
    let fermato = false;
    try {
      build.datiTracciamenti({ ...centro, integrazioni: { ...centro.integrazioni, googleFileVerifica: sbagliato } }, {});
    } catch {
      fermato = true;
    }
    verifica(fermato, `nome «${sbagliato}» accettato`);
  }
});

await controllo("foto verticali anche a 800 px (Lighthouse «uses-responsive-images»): a 390 px con densità 2 e a 412 px con densità 1,75 il browser sceglie la 800, non la 941", async () => {
  for (const nome of ["cristina-bancone", "cabina-viso", "cabina-lettino", "postazione-pedicure"]) {
    verifica(manifesto.immagini[nome].larghezze.join() === "480,720,800,941", `${nome}: larghezze ${manifesto.immagini[nome].larghezze.join("/")}`);
  }
  const { browser, base } = await browserCondiviso();
  for (const [larghezza, densita] of [[390, 2], [412, 1.75]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: 844 }, deviceScaleFactor: densita });
    const pg = await contesto.newPage();
    await pg.goto(base + "/", { waitUntil: "load" });
    const scelta = await pg.evaluate(() => document.querySelector(".apertura-foto img").currentSrc);
    verifica(/cristina-bancone-800\.avif/.test(scelta), `${larghezza} px × ${densita}: scelta ${scelta}`);
    await contesto.close();
  }
});

await controllo("pesi: main.js ≤ 3 KB, JS ≤ 12 KB e CSS ≤ 20 KB compressi, font ≤ 100 KB", () => {
  const somma = (filtro, gz) =>
    elenca(DIST, filtro).reduce((t, f) => t + (gz ? gzipSync(readFileSync(f)).length : statSync(f).size), 0);
  const main = statSync(join(DIST, "js", "main.js")).size;
  const js = somma((p) => p.endsWith(".js"), true);
  const css = somma((p) => p.endsWith(".css"), true);
  const font = somma((p) => p.endsWith(".woff2"), false);
  verifica(main <= 3072, `main.js ${main} B`);
  verifica(js <= 12288, `JS ${js} B compressi`);
  verifica(css <= 20480, `CSS ${css} B compressi`);
  verifica(font <= 102400, `font ${font} B`);
  verifica(existsSync(join(RADICE, "src", "fonts", "OFL-Marcellus.txt")) && existsSync(join(RADICE, "src", "fonts", "OFL-Jost.txt")), "licenze OFL mancanti");
});

if (sessione) {
  await sessione.browser.close();
  sessione.server.close();
}
console.log(`\n${superati}/${superati + falliti} controlli superati`);
process.exit(falliti ? 1 : 0);

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
    ["Laminazione sopracciglia", "30 €"],
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
const DOMINI_LINK_AMMESSI = ["wa.me", "www.google.com"];

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

console.log("Controlli automatici · Step 7\n");

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

await controllo("senza URL: canonical, og:url e sitemap.xml omessi", () => {
  verifica(!existsSync(join(DIST, "sitemap.xml")), "sitemap.xml presente senza URL assoluto");
  for (const [file] of PAGINE) {
    const html = pagina(file);
    verifica(!/rel="canonical"/.test(html), `${file}: canonical presente senza URL`);
    verifica(!/property="og:url"/.test(html), `${file}: og:url presente senza URL`);
  }
  const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
  verifica(/^User-agent: \*/m.test(robots), "robots.txt mancante o vuoto");
  verifica(!/Sitemap:/.test(robots), "robots.txt cita una sitemap che non esiste");
});

await controllo(`con URL=${URL_PROVA} node build.mjs: canonical, og:url, og:image e sitemap.xml usano quell'indirizzo`, () => {
  // Stessa build con la variabile URL, ma in una cartella temporanea: dist/ resta la versione senza URL.
  const tmp = mkdtempSync(join(tmpdir(), "migliore-build-"));
  try {
    const r = spawnSync(process.execPath, ["build.mjs", "--dist", tmp], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: URL_PROVA } });
    verifica(r.status === 0, `build con URL fallita: ${r.stderr || r.stdout}`);
    for (const [file, id] of PAGINE.filter(([, id]) => id)) {
      const html = readFileSync(join(tmp, file), "utf8");
      const indirizzo = URL_PROVA + testi.pagine[id].percorso;
      verifica(html.includes(`<link rel="canonical" href="${indirizzo}">`), `${file}: canonical diverso da ${indirizzo}`);
      verifica(html.includes(`<meta property="og:url" content="${indirizzo}">`), `${file}: og:url diverso da ${indirizzo}`);
      verifica(JSON.parse(jsonLdDi(html)[0]).url === `${URL_PROVA}/`, `${file}: url del JSON-LD`);
      verifica(html.includes(`<meta property="og:image" content="${URL_PROVA}/img/og.jpg">`), `${file}: og:image non assoluto`);
      verifica(JSON.parse(jsonLdDi(html)[0]).image === `${URL_PROVA}/img/og.jpg`, `${file}: image del JSON-LD`);
    }
    // Dallo Step 7: anche /privacy/ e /cookie/, con priorità bassa; la 404 resta esclusa.
    const sitemap = readFileSync(join(tmp, "sitemap.xml"), "utf8");
    const voci = [...sitemap.matchAll(/<url><loc>([^<]*)<\/loc><priority>([^<]*)<\/priority><\/url>/g)].map((m) => `${m[1]} ${m[2]}`);
    const attese = [["/", "1.0"], ["/viso/", "1.0"], ["/pedicure/", "1.0"], ["/privacy/", "0.3"], ["/cookie/", "0.3"]].map(([p, q]) => `${URL_PROVA}${p} ${q}`);
    verifica(voci.join() === attese.join(), `sitemap: ${voci.join(", ")}`);
    verifica(!/404/.test(sitemap), "la 404 è nella sitemap");
    verifica(readFileSync(join(tmp, "robots.txt"), "utf8").includes(`Sitemap: ${URL_PROVA}/sitemap.xml`), "robots.txt senza Sitemap");
    const html404 = readFileSync(join(tmp, "404.html"), "utf8");
    verifica(!/rel="canonical"|property="og:url"/.test(html404), "la 404 non deve avere canonical né og:url");
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
      if (!(host === "wa.me" || maps || social.includes(host))) esterni.push(`${rel(file)}: link a ${href}`);
    }
  }
  for (const file of elenca(DIST, (p) => p.endsWith(".css"))) {
    const css = readFileSync(file, "utf8");
    if (/@import/i.test(css)) esterni.push(`${rel(file)}: @import`);
    for (const m of css.matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^'")]+)/gi)) esterni.push(`${rel(file)}: ${m[1]}`);
  }
  verifica(!esterni.length, esterni.join(", "));
  verifica(DOMINI_LINK_AMMESSI.length === 2, "elenco domini ammessi alterato");
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
    "trattamenti.pedicure.avanzato.durata", "trattamenti.pedicure.strumentiIgiene", "integrazioni.ga4",
    "integrazioni.pixelMeta", "integrazioni.supabase",
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
    [centro.integrazioni.ga4 || centro.integrazioni.pixelMeta, /Preferenze cookie/, "Preferenze cookie"],
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

await controllo("JSON-LD BeautySalon sulle tre pagine (orari ricavati da «dal lunedì al sabato»)", () => {
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
    const o = d.openingHoursSpecification?.[0];
    verifica(o?.dayOfWeek?.join() === "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", `${file}: giorni ${o?.dayOfWeek}`);
    verifica(o.opens === centro.orari.apertura && o.closes === centro.orari.chiusura, `${file}: orari errati`);
    verifica(d.priceRange === "€€", `${file}: priceRange`);
  }
  verifica(build.ricavaGiorni("dal lunedì al venerdì")?.length === 5, "ricavaGiorni: lunedì-venerdì");
  verifica(build.ricavaGiorni("lunedì, mercoledì e sabato") === null, "ricavaGiorni: un testo ambiguo deve dare null");
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
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opzioni });
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
      const piccoli = [...document.querySelectorAll("a[href], button, summary, input, select, textarea, [role='button']")]
        .filter(visibile)
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

await controllo("barra contatti: nascosta sull'apertura, compare scorrendo oltre, non copre il footer; senza JS sempre visibile; assente da 768 px", async () => {
  const problemi = [];
  const statoBarra = (pagina) =>
    pagina.evaluate(() => {
      const barra = document.querySelector("[data-barra-contatti]");
      const st = getComputedStyle(barra);
      return { visibile: st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.99, top: barra.getBoundingClientRect().top };
    });
  for (const [percorso] of LINK_PAGINE) {
    const { contesto, pagina } = await apriMobile(percorso);
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
    verifica(indicati ? decodifica(riga ?? "") === `In cabina usiamo: ${indicati}` : riga === undefined, `${file}: riga «In cabina usiamo» «${riga}»`);
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
      for (const pezzo of [...v.descrizioni, ...v.fasi]) verifica(normalizzaSpazi(fonte).includes(normalizzaSpazi(pezzo)), `${file}: «${pezzo.slice(0, 50)}…» non viene dal dettaglio di «${v.nome}»`);
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
        [document.documentElement, document.body, ...document.body.querySelectorAll("*")].map((el) => {
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
// Gli unici blocchi in rilievo su --sabbia-profonda (§5). Lo Step 8 aggiunge il blocco del codice sconto.
const RILIEVI = [".etichetta", ".scheda-avanzato"];

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
    const conta = (frammento) => (frammento?.match(/class="pulsante pulsante-/g) ?? []).length;
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
    "Scegli il giorno e l'ora: dal lunedì al sabato, dalle 08:00 alle 17:00.",
    "Vieni in Via Roma 2/A a Caronno Varesino: il tuo appuntamento è pronto.",
  ];
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
    verifica(sez.includes('alt="L&#39;ingresso del centro Migliore – Estetica Avanzata in Via Roma 2/A"') && /ingresso-\d+\.webp/.test(sez), `${file}: foto 02`);
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

await controllo("orari scritti in modo identico (stessa fonte) in apertura, «Come prenotare» e «Dove siamo»", () => {
  const giorni = centro.orari.giorni;
  const ore = `dalle ${centro.orari.apertura} alle ${centro.orari.chiusura}`;
  for (const [file] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const blocchi = {
      apertura: testoVisibile(html.match(/<p class="apertura-info">([\s\S]*?)<\/p>/)?.[1] ?? ""),
      "come prenotare": testoVisibile(sezioneDi(html, "come-prenotare")),
      "dove siamo": testoVisibile(html.match(/<p class="dove-riga dove-orari">([\s\S]*?)<\/p>/)?.[1] ?? ""),
    };
    for (const [nome, testo] of Object.entries(blocchi)) {
      verifica(testo.includes(giorni) && testo.includes(ore), `${file}: orari diversi in «${nome}»: «${testo.slice(0, 80)}»`);
    }
  }
  // stessa fonte: nei testi le ore e i giorni sono segnaposto di centro.json, mai scritti a mano
  const grezzi = [testi.comuni.apertura.rigaInfo, testi.comuni.comePrenotare.passi[1], testi.comuni.doveSiamo.orari];
  for (const g of grezzi) verifica(g.includes("{orari.giorni}") && g.includes("{orari.apertura}") && g.includes("{orari.chiusura}") && !/\d{2}:\d{2}/.test(g), `testo scritto a mano: «${g}»`);
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
    [centro.integrazioni.ga4 || centro.integrazioni.pixelMeta, /Preferenze cookie/, "Preferenze cookie"],
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
    const oggi = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Rome" }).format(new Date());
    verifica(html.includes(`<time datetime="${oggi}">`), `${file}: data di ultimo aggiornamento diversa dalla build (${oggi})`);
    void percorso;
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
  verifica(schede.length === 2, `${schede.length} trattamenti con scheda invece di 2 (GA4 e Meta non sono indicati)`);
  for (const b of schede) {
    const dt = [...b.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);
    verifica(dt.join() === "Dati,Finalità,Base giuridica,Conservazione", `scheda «${testoVisibile(b.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? "")}»: ${dt.join(", ")}`);
  }
  verifica(/art\. 6, par\. 1, lett\. b/.test(testo) && /art\. 6, par\. 1, lett\. a/.test(testo), "basi giuridiche (misure precontrattuali e consenso)");
  verifica(testo.includes("non oltre 24 mesi dall'ultima interazione"), "conservazione delle iscrizioni: 24 mesi");
  verifica(testo.includes("Oggi il sito non usa strumenti di statistica né di marketing"), "manca la frase sui tracciamenti spenti");
  verifica(/Netlify, Inc\./.test(testo) && /Supabase, Inc\./.test(testo), "fornitori Netlify e Supabase");
  verifica(!/Google Ireland|Meta Platforms/.test(testo), "Google o Meta citati come fornitori senza integrazione");
  verifica(/EU-US Data Privacy Framework/.test(testo) && /clausole contrattuali standard/.test(testo), "garanzie per gli Stati Uniti");
  for (const diritto of ["accesso", "rettifica", "cancellazione", "limitazione", "opposizione", "portabilità", "revocare il consenso", "Garante per la protezione dei dati personali"]) {
    verifica(testo.includes(diritto), `diritti: manca «${diritto}»`);
  }
  verifica(new RegExp(`<a href="mailto:${centro.email}">`).test(html), "diritti: manca il link email");
});

await controllo("pagine legali con GA4, pixel Meta e servizio email indicati (build in una copia): trattamenti c), fornitori Google, Meta e email, elenco dei cookie e «Preferenze cookie»; datiLegali() filtra per integrazione", () => {
  // Funzione: voci filtrate per integrazione, «richiede» sconosciuto = errore, bozza spenta solo in produzione.
  const t = { privacy: { trattamenti: { voci: testi.comuni.privacy.trattamenti.voci }, fornitori: { voci: testi.comuni.privacy.fornitori.voci } }, cookie: { elenco: testi.comuni.cookie.elenco } };
  const conTutto = { ...centro, integrazioni: { ...centro.integrazioni, ga4: "G-PROVA", pixelMeta: "123", servizioEmail: "Posta di prova" } };
  const pieno = build.datiLegali({ centro: conTutto, t, contestoNetlify: "deploy-preview" });
  const vuoto = build.datiLegali({ centro, t, contestoNetlify: "production" });
  verifica(pieno.trattamenti.length === 4 && vuoto.trattamenti.length === 2, `trattamenti ${pieno.trattamenti.length}/${vuoto.trattamenti.length}`);
  verifica(pieno.fornitori.length === 5 && vuoto.fornitori.length === 2, `fornitori ${pieno.fornitori.length}/${vuoto.fornitori.length}`);
  verifica(pieno.cookie.length === 5 && vuoto.cookie.length === 0, `cookie ${pieno.cookie.length}/${vuoto.cookie.length}`);
  verifica(pieno.bozza === true && vuoto.bozza === false, "bozza: deve sparire solo con CONTEXT=production");
  verifica(pieno.trattamenti.every((v) => !("richiede" in v)), "la chiave «richiede» arriva al template");
  let fermato = false;
  try {
    build.datiLegali({ centro, t: { ...t, cookie: { elenco: [{ nome: "x", richiede: "inesistente" }] } } });
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
    for (const atteso of ["Statistiche (Google Analytics 4)", "Marketing (pixel Meta e API Conversioni)", "Google Ireland Limited", "Meta Platforms Ireland Limited", "Posta di prova"]) {
      verifica(privacy.includes(atteso), `privacy con integrazioni: manca «${atteso}»`);
    }
    verifica(!privacy.includes("Oggi il sito non usa strumenti di statistica"), "privacy con integrazioni: c'è ancora la frase sui tracciamenti spenti");
    const nomi = [...cookie.matchAll(/<h3 class="legale-cookie-nome">([^<]*)<\/h3>/g)].map((m) => decodifica(m[1]));
    verifica(nomi.join() === "Preferenze cookie,_ga,_ga_<ID>,_fbp,_fbc", `cookie con integrazioni: ${nomi.join(", ")}`);
    verifica(!testoVisibile(cookie).includes("Oggi il sito non usa cookie"), "cookie con integrazioni: c'è ancora «Oggi il sito non usa cookie»");
    verifica(/Preferenze cookie/.test(testoVisibile(cookie.match(/<footer[\s\S]*?<\/footer>/)[0])), "footer senza «Preferenze cookie» con i tracciamenti indicati");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  // Oggi: la cookie policy dice che il sito non usa cookie e non elenca nessun cookie.
  const oggi = pagina("cookie/index.html");
  verifica(testoVisibile(oggi).includes("Oggi il sito non usa cookie") && !/legale-cookie-nome/.test(oggi), "cookie policy di oggi: deve dire che il sito non usa cookie");
});

await controllo("riquadro «Bozza»: in cima a privacy e cookie nell'anteprima e nei Deploy Preview, mai con CONTEXT=production (build ripetuta)", () => {
  const testoBozza = testi.comuni.legali.bozza;
  const build2 = (contesto) => {
    const tmp = mkdtempSync(join(tmpdir(), "migliore-bozza-"));
    const r = spawnSync(process.execPath, ["build.mjs", "--dist", tmp], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: contesto } });
    verifica(r.status === 0, `build con CONTEXT=${contesto} fallita: ${r.stderr || r.stdout}`);
    const pagine = Object.fromEntries(elenca(tmp, (p) => p.endsWith(".html")).map((f) => [relative(tmp, f).split(sep).join("/"), readFileSync(f, "utf8")]));
    rmSync(tmp, { recursive: true, force: true });
    return pagine;
  };
  for (const contesto of ["", "deploy-preview", "branch-deploy"]) {
    const pagine = build2(contesto);
    for (const [file, html] of Object.entries(pagine)) {
      const legale = PAGINE_LEGALI.some(([f]) => f === file);
      const presente = html.includes('class="legale-bozza"') && testoVisibile(html).includes(testoBozza);
      verifica(presente === legale, `CONTEXT=«${contesto}»: ${file} ${legale ? "senza" : "con"} riquadro «Bozza»`);
      if (legale) verifica(html.indexOf('class="legale-bozza"') < html.indexOf("<h1"), `CONTEXT=«${contesto}»: ${file}: il riquadro non è in cima`);
    }
  }
  const produzione = build2("production");
  for (const [file, html] of Object.entries(produzione)) {
    verifica(!html.includes("legale-bozza") && !testoVisibile(html).includes(testoBozza), `CONTEXT=production: ${file} con riquadro «Bozza»`);
  }
  verifica(Object.keys(produzione).includes("privacy/index.html") && Object.keys(produzione).includes("cookie/index.html"), "CONTEXT=production: pagine legali mancanti");
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

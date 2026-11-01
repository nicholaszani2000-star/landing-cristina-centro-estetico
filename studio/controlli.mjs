// studio/controlli.mjs — controlli automatici (CLAUDE.md §13). Crescono a ogni step, nessuno si toglie.
// Uso: node studio/controlli.mjs   → «✔ nome» o «✘ nome: motivo»; codice di uscita 1 se qualcosa fallisce.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
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

// ---------------------------------------------------------------- controlli

console.log("Controlli automatici · Step 2\n");

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
    const sitemap = readFileSync(join(tmp, "sitemap.xml"), "utf8");
    const loc = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    verifica(loc.join() === ["/", "/viso/", "/pedicure/"].map((p) => URL_PROVA + p).join(), `sitemap: ${loc.join(", ")}`);
    verifica(readFileSync(join(tmp, "robots.txt"), "utf8").includes(`Sitemap: ${URL_PROVA}/sitemap.xml`), "robots.txt senza Sitemap");
    const html404 = readFileSync(join(tmp, "404.html"), "utf8");
    verifica(!/rel="canonical"|property="og:url"/.test(html404), "la 404 non deve avere canonical né og:url");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await controllo("nessun {{, }}, undefined, null, NaN o segnaposto ⟪ ⟫ nel testo delle pagine", () => {
  const trovati = [];
  for (const [file] of PAGINE) {
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
  for (const [file] of PAGINE) verifica(/<html lang="it">/.test(pagina(file)), file);
});

await controllo("partita IVA 04123400121 in ogni pagina", () => {
  for (const [file] of PAGINE) verifica(testoVisibile(pagina(file)).includes(`P.IVA ${centro.legale.partitaIva}`), file);
  verifica(centro.legale.partitaIva === "04123400121", "partita IVA diversa da §2.1 in content/centro.json");
});

await controllo("parole vietate di §8 assenti (testo, alt, meta, JSON-LD; eccezione: riga sul limite)", () => {
  const rigaLimite = testi.comuni.pedicure.rigaLimite;
  const trovate = [];
  for (const [file] of PAGINE) {
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
    "trattamenti.pedicure.avanzato.durata", "trattamenti.pedicure.strumenti", "integrazioni.ga4",
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

await controllo("link tel: e WhatsApp corretti su ogni pagina (testo WhatsApp per pagina)", () => {
  for (const [file, id] of PAGINE) {
    const html = pagina(file);
    const tel = [...html.matchAll(/href="(tel:[^"]*)"/g)].map((m) => m[1]);
    verifica(tel.length >= 2 && tel.every((t) => t === `tel:${centro.telefonoE164}`), `${file}: link tel errati ${tel.join(" ")}`);
    const wa = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)].map((m) => new URL(decodifica(m[1])));
    const atteso = testi.whatsapp[id ? testi.pagine[id].whatsapp : "generale"];
    verifica(wa.length >= 1, `${file}: nessun link WhatsApp`);
    for (const u of wa) {
      verifica(u.pathname === `/${centro.whatsappNumero}`, `${file}: numero WhatsApp ${u.pathname}`);
      verifica(u.searchParams.get("text") === atteso, `${file}: testo WhatsApp «${u.searchParams.get("text")}»`);
    }
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
  const pulsanti = [...main.matchAll(/<a class="pulsante[^"]*" href="([^"]*)">[\s\S]*?<span>([^<]*)<\/span><\/a>/g)];
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

await controllo("pesi entro §9: foto 01 a 720 ≤ 120 KB, altre foto ≤ 160 KB, 06 a 1536 ≤ 300 KB, logo scaricato ≤ 40 KB", () => {
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
  // Logo: il file che il browser sceglie dal srcset per le misure a schermo (sizes) e densità fino a 3× su telefono, 2× su desktop.
  const logo = manifesto.immagini.logo;
  for (const [file, misure] of [["index.html", [[79, 3], [99, 2]]], ["index.html", [[69, 3]]]]) {
    verifica(pagina(file).includes(`sizes="(min-width: 1024px) 99px, 79px"`) && pagina(file).includes('sizes="69px"'), "sizes del logo cambiati: aggiorna questo controllo");
    for (const [larghezzaCss, densita] of misure) {
      const w = logo.larghezze.find((x) => x >= larghezzaCss * densita) ?? Math.max(...logo.larghezze);
      const f = `logo-${w}.webp`;
      if (peso(f) > 40 * KB) problemi.push(`${f} (scelto a ${larghezzaCss} px × ${densita}): ${(peso(f) / KB).toFixed(1)} KB > 40 KB`);
    }
  }
  verifica(!problemi.length, problemi.join(", "));
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
    verifica(/<meta property="og:image:alt" content="[^"]+">/.test(testa), `${file}: og:image:alt`);
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

console.log(`\n${superati}/${superati + falliti} controlli superati`);
process.exit(falliti ? 1 : 0);

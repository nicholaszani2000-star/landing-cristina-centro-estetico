// studio/controlli.mjs — controlli automatici (CLAUDE.md §13). Crescono a ogni step, nessuno si toglie.
// Uso: node studio/controlli.mjs   → «✔ nome» o «✘ nome: motivo»; codice di uscita 1 se qualcosa fallisce.

import { spawnSync } from "node:child_process";
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
  home: { title: "Migliore – Estetica Avanzata · Caronno Varesino", h1: "Trattamenti viso e pedicure avanzato a Caronno Varesino" },
  viso: { title: "Trattamenti viso a Caronno Varesino · Migliore", h1: "Trattamenti viso a Caronno Varesino" },
  pedicure: { title: "Pedicure avanzato a Caronno Varesino · Migliore", h1: "Pedicure avanzato a Caronno Varesino" },
};
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

console.log("Controlli automatici · Step 1\n");

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

await controllo("URL assoluto: senza URL niente canonical né sitemap; con URL canonical, og:url e sitemap", () => {
  verifica(!existsSync(join(DIST, "sitemap.xml")), "sitemap.xml presente senza URL assoluto");
  verifica(!/rel="canonical"/.test(pagina("index.html")), "canonical presente senza URL assoluto");
  verifica(/^User-agent: \*/m.test(readFileSync(join(DIST, "robots.txt"), "utf8")), "robots.txt mancante o vuoto");
  const tmp = mkdtempSync(join(tmpdir(), "migliore-build-"));
  try {
    const r = spawnSync(process.execPath, ["build.mjs", "--dist", tmp], {
      cwd: RADICE,
      encoding: "utf8",
      env: { ...process.env, URL: "https://esempio.netlify.app/" },
    });
    verifica(r.status === 0, `build con URL fallita: ${r.stderr || r.stdout}`);
    const viso = readFileSync(join(tmp, "viso", "index.html"), "utf8");
    verifica(viso.includes('<link rel="canonical" href="https://esempio.netlify.app/viso/">'), "canonical di /viso/ errato");
    verifica(viso.includes('<meta property="og:url" content="https://esempio.netlify.app/viso/">'), "og:url di /viso/ errato");
    const sitemap = readFileSync(join(tmp, "sitemap.xml"), "utf8");
    for (const p of ["/", "/viso/", "/pedicure/"]) verifica(sitemap.includes(`<loc>https://esempio.netlify.app${p}</loc>`), `sitemap senza ${p}`);
    verifica(!/404/.test(sitemap), "la 404 non va nella sitemap");
    verifica(readFileSync(join(tmp, "robots.txt"), "utf8").includes("Sitemap: https://esempio.netlify.app/sitemap.xml"), "robots.txt senza Sitemap");
    verifica(!/rel="canonical"/.test(readFileSync(join(tmp, "404.html"), "utf8")), "la 404 non deve avere canonical");
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

await controllo("meta per pagina: description, og:title, og:description, og:type, og:locale, theme-color", () => {
  for (const [file, id] of PAGINE.filter(([, id]) => id)) {
    const html = pagina(file);
    const p = testi.pagine[id];
    const meta = (attr, nome) => decodifica(html.match(new RegExp(`<meta ${attr}="${nome}" content="([^"]*)"`))?.[1] ?? "");
    verifica(meta("name", "description") === p.description, `${file}: description`);
    verifica(meta("property", "og:title") === p.title, `${file}: og:title`);
    verifica(meta("property", "og:description") === p.description, `${file}: og:description`);
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

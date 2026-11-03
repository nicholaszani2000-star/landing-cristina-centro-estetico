// studio/lighthouse.mjs — Lighthouse mobile sulla build di produzione (CLAUDE.md §9, Step 9).
//
// Uso:  node studio/lighthouse.mjs              3 esecuzioni per pagina su /, /viso/, /pedicure/, valore mediano
//       node studio/lighthouse.mjs --volte 5    più esecuzioni
//       node studio/lighthouse.mjs --json FILE  salva anche i risultati grezzi (mediane e pesi) in un file JSON
//
// La build è quella di produzione (CONTEXT=production) in una cartella temporanea, con URL uguale all'indirizzo
// del server locale, così canonical e og:url puntano alla pagina misurata. Il server imita Netlify: header di
// netlify.toml (sicurezza, CSP, cache) e compressione brotli dei file di testo.
// Lighthouse è in studio/node_modules (npm install --prefix studio) e usa il Chromium di Playwright (CHROME_PATH).

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { avviaServer } from "./anteprima.mjs";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const PAGINE = [
  ["/", "/"],
  ["/viso/", "/viso/"],
  ["/pedicure/", "/pedicure/"],
];
// Obiettivi di CLAUDE.md §9 (punteggi 0–100, tempi in ms, pesi in byte compressi).
const OBIETTIVI = { performance: 90, accessibility: 100, "best-practices": 95, seo: 100, lcp: 2000, cls: 0.05, tbt: 100 };
const PESI = { script: 12 * 1024, stylesheet: 20 * 1024, font: 100 * 1024 };

const argomenti = process.argv.slice(2);
const valore = (nome) => {
  const i = argomenti.indexOf(nome);
  return i >= 0 ? argomenti[i + 1] : undefined;
};
const VOLTE = Number(valore("--volte") ?? 3);

function chrome() {
  const candidati = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean);
  const trovato = candidati.find((p) => existsSync(p));
  if (!trovato) throw new Error("Chromium non trovato: imposta CHROME_PATH");
  return trovato;
}

const mediana = (valori) => {
  const v = [...valori].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const kb = (b) => `${(b / 1024).toFixed(1).replace(".", ",")} KB`;
const secondi = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/** Lancia Lighthouse senza bloccare questo processo, che intanto serve le pagine. */
function lancia(argomentiLh) {
  return new Promise((ok) => {
    const figlio = spawn(join(STUDIO, "node_modules", ".bin", "lighthouse"), argomentiLh, { env: { ...process.env, CHROME_PATH: chrome() } });
    let errori = "";
    figlio.stderr.on("data", (d) => (errori += d));
    const limite = setTimeout(() => figlio.kill("SIGKILL"), 300_000);
    figlio.on("close", (codice) => {
      clearTimeout(limite);
      ok({ codice, errori });
    });
  });
}

/** Una esecuzione di Lighthouse: punteggi, metriche e byte trasferiti per tipo di risorsa. */
async function esegui(url, cartella, n) {
  const uscita = join(cartella, `lh-${n}.json`);
  const r = await lancia([url, "--quiet", "--chrome-flags=--headless=new --no-sandbox", "--only-categories=performance,accessibility,best-practices,seo", "--output=json", `--output-path=${uscita}`]);
  if (r.codice !== 0 || !existsSync(uscita)) throw new Error(`Lighthouse fallito su ${url}: ${r.errori.slice(-500)}`);
  const j = JSON.parse(readFileSync(uscita, "utf8"));
  const a = j.audits;
  const risorse = Object.fromEntries((a["resource-summary"]?.details?.items ?? []).map((i) => [i.resourceType, i.transferSize]));
  return {
    performance: j.categories.performance.score * 100,
    accessibility: j.categories.accessibility.score * 100,
    "best-practices": j.categories["best-practices"].score * 100,
    seo: j.categories.seo.score * 100,
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    si: a["speed-index"].numericValue,
    totale: risorse.total ?? 0,
    document: risorse.document ?? 0,
    script: risorse.script ?? 0,
    stylesheet: risorse.stylesheet ?? 0,
    font: risorse.font ?? 0,
    image: risorse.image ?? 0,
    richieste: (a["network-requests"]?.details?.items ?? []).length,
    sotto: Object.entries(a)
      .filter(([, x]) => x.score !== null && x.score < 0.9 && ["numeric", "binary", "metricSavings"].includes(x.scoreDisplayMode) && !x.id.endsWith("-insight"))
      .map(([id]) => id),
  };
}

async function main() {
  const lavoro = mkdtempSync(join(tmpdir(), "migliore-lh-"));
  const dist = join(lavoro, "dist");
  const server = await avviaServer(0, { cartella: dist, produzione: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const build = spawnSync(process.execPath, [join(RADICE, "build.mjs"), "--dist", dist], {
      cwd: RADICE,
      encoding: "utf8",
      env: { ...process.env, CONTEXT: "production", URL: base, TEST_TRACCIAMENTI: "" },
    });
    if (build.status !== 0) throw new Error(`build di produzione fallita:\n${build.stderr || build.stdout}`);
    console.log(`✔ build di produzione (CONTEXT=production) servita su ${base} con header di netlify.toml e brotli`);
    // Riscaldamento: ogni file di testo viene compresso una volta prima delle misure, come nella cache di Netlify.
    for (const [, percorso] of PAGINE) {
      const html = await (await fetch(base + percorso, { headers: { "Accept-Encoding": "br" } })).text();
      for (const m of html.matchAll(/\s(?:href|src)="(\/(?:css|js)\/[^"]+)"/g)) await fetch(base + m[1], { headers: { "Accept-Encoding": "br" } });
    }

    const risultati = {};
    for (const [nome, percorso] of PAGINE) {
      const giri = [];
      for (let n = 1; n <= VOLTE; n++) {
        giri.push(await esegui(base + percorso, lavoro, `${nome.replace(/\W/g, "") || "home"}-${n}`));
        process.stdout.write(`  · ${nome} ${n}/${VOLTE}: performance ${giri.at(-1).performance}, LCP ${secondi(giri.at(-1).lcp)}\n`);
      }
      const chiavi = Object.keys(giri[0]).filter((k) => k !== "sotto");
      risultati[nome] = Object.fromEntries(chiavi.map((k) => [k, mediana(giri.map((g) => g[k]))]));
      risultati[nome].sotto = [...new Set(giri.flatMap((g) => g.sotto))];
    }

    console.log(`\nValori mediani su ${VOLTE} esecuzioni (Lighthouse, modalità mobile):\n`);
    console.log("| Pagina | Performance | Accessibilità | Best practice | SEO | FCP | LCP | CLS | TBT |");
    console.log("|---|---|---|---|---|---|---|---|---|");
    for (const [nome, r] of Object.entries(risultati)) {
      console.log(`| \`${nome}\` | ${r.performance} | ${r.accessibility} | ${r["best-practices"]} | ${r.seo} | ${secondi(r.fcp)} | ${secondi(r.lcp)} | ${r.cls.toFixed(3).replace(".", ",")} | ${Math.round(r.tbt)} ms |`);
    }
    console.log("\nPesi trasferiti al primo caricamento (compressi, mediana):\n");
    console.log("| Pagina | Totale | HTML | JS | CSS | Font | Immagini | Richieste |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const [nome, r] of Object.entries(risultati)) {
      console.log(`| \`${nome}\` | ${kb(r.totale)} | ${kb(r.document)} | ${kb(r.script)} | ${kb(r.stylesheet)} | ${kb(r.font)} | ${kb(r.image)} | ${r.richieste} |`);
    }

    const problemi = [];
    for (const [nome, r] of Object.entries(risultati)) {
      for (const k of ["performance", "accessibility", "best-practices", "seo"]) if (r[k] < OBIETTIVI[k]) problemi.push(`${nome}: ${k} ${r[k]} < ${OBIETTIVI[k]}`);
      if (r.lcp > OBIETTIVI.lcp) problemi.push(`${nome}: LCP ${secondi(r.lcp)} > ${secondi(OBIETTIVI.lcp)}`);
      if (r.cls > OBIETTIVI.cls) problemi.push(`${nome}: CLS ${r.cls} > ${OBIETTIVI.cls}`);
      if (r.tbt > OBIETTIVI.tbt) problemi.push(`${nome}: TBT ${Math.round(r.tbt)} ms > ${OBIETTIVI.tbt} ms`);
      for (const [tipo, massimo] of Object.entries(PESI)) if (r[tipo] > massimo) problemi.push(`${nome}: ${tipo} ${kb(r[tipo])} > ${kb(massimo)}`);
    }
    console.log("\nAudit sotto 0,9 in almeno un'esecuzione:");
    for (const [nome, r] of Object.entries(risultati)) console.log(`  ${nome}: ${r.sotto.length ? r.sotto.join(", ") : "nessuno"}`);

    const json = valore("--json");
    if (json) writeFileSync(resolve(json), JSON.stringify({ volte: VOLTE, obiettivi: OBIETTIVI, risultati }, null, 2) + "\n");

    if (problemi.length) {
      console.log(`\n✘ obiettivi di §9 non raggiunti:\n  ${problemi.join("\n  ")}`);
      process.exitCode = 1;
    } else console.log("\n✔ obiettivi di §9 raggiunti su tutte le pagine (punteggi, LCP, CLS, TBT, pesi di JS, CSS e font)");
  } finally {
    server.close();
    rmSync(lavoro, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`✘ ${e.message}`);
  process.exit(1);
});

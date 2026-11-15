// studio/pacchetto-netlify.mjs — il sito pronto da trascinare su Netlify, in uno zip (Step 9).
//
// Uso:  node studio/pacchetto-netlify.mjs
// Scrive in studio/pacchetto/ (ignorata da git):
//   esteticamigliore-netlify.zip        il sito costruito per la produzione, da trascinare nei Deploys di Netlify
//   landing-migliore-repository.zip     tutto il repository (git archive del commit attuale), per archivio e per la CLI
//
// Il sito è la build di produzione (CONTEXT=production, URL dall'indirizzo principale di centro.json), più un file
// _headers con gli stessi header di netlify.toml (sicurezza, Content-Security-Policy, cache): nei deploy trascinati
// netlify.toml non c'è, _headers sì. Con il collegamento a GitHub non serve: lì vale netlify.toml.
// La funzione del codice sconto (netlify/functions) non è nello zip del sito: il trascinamento pubblica solo file
// statici. Con GitHub collegato, o con «netlify deploy --build», la funzione si installa da sola.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { avviaServer, regoleNetlify } from "./anteprima.mjs";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const USCITA = join(STUDIO, "pacchetto");
const SITO = join(USCITA, "esteticamigliore-netlify.zip");
const REPOSITORY = join(USCITA, "landing-migliore-repository.zip");

const elenca = (cartella) =>
  readdirSync(cartella, { withFileTypes: true }).flatMap((v) => (v.isDirectory() ? elenca(join(cartella, v.name)) : [join(cartella, v.name)]));

/** _headers nel formato di Netlify, dagli stessi blocchi di netlify.toml (CSP intera). */
export function fileHeaders() {
  const regole = regoleNetlify({ perAnteprima: false });
  if (!regole.length) throw new Error("netlify.toml senza blocchi [[headers]]");
  return regole.map((r) => [r.per, ...Object.entries(r.valori).map(([k, v]) => `  ${k}: ${v}`)].join("\n")).join("\n\n") + "\n";
}

async function verifica(cartella) {
  const problemi = [];
  for (const f of ["index.html", "viso/index.html", "pedicure/index.html", "privacy/index.html", "cookie/index.html", "404.html", "robots.txt", "sitemap.xml", "_headers"]) {
    if (!existsSync(join(cartella, f))) problemi.push(`manca ${f}`);
  }
  // Ogni riferimento interno delle pagine esiste nella cartella (?v=hash a parte).
  for (const file of elenca(cartella).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    const rif = [
      ...[...html.matchAll(/\s(?:href|src)="(\/[^"#]*)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(",").map((p) => p.trim().split(/\s+/)[0])),
    ];
    for (const r of rif) {
      const percorso = r.split("?")[0];
      const pieno = join(cartella, percorso.endsWith("/") ? percorso + "index.html" : percorso);
      if (percorso !== "/api/codice-sconto" && !existsSync(pieno)) problemi.push(`${relative(cartella, file)}: ${r} non esiste`);
    }
    if (/\{\{|null<|undefined/.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) problemi.push(`${relative(cartella, file)}: segnaposto rimasto`);
  }
  // Le pagine si aprono dal server di anteprima in modalità produzione.
  const server = await avviaServer(0, { cartella, produzione: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const p of ["/", "/viso/", "/pedicure/", "/privacy/", "/cookie/"]) {
      const r = await fetch(base + p);
      if (r.status !== 200) problemi.push(`${p}: ${r.status}`);
    }
    if ((await fetch(base + "/pagina-che-non-esiste/")).status !== 404) problemi.push("la 404 non risponde 404");
  } finally {
    server.close();
  }
  const csp = readFileSync(join(RADICE, "netlify.toml"), "utf8").match(/^\s*Content-Security-Policy\s*=\s*"([^"]*)"/m)?.[1];
  if (!csp || !readFileSync(join(cartella, "_headers"), "utf8").includes(`Content-Security-Policy: ${csp}`)) problemi.push("_headers: CSP diversa da netlify.toml");
  return problemi;
}

async function main() {
  mkdirSync(USCITA, { recursive: true });
  const lavoro = mkdtempSync(join(tmpdir(), "migliore-pacchetto-"));
  const sito = join(lavoro, "esteticamigliore");
  try {
    const build = spawnSync(process.execPath, [join(RADICE, "build.mjs"), "--dist", sito], {
      cwd: RADICE,
      encoding: "utf8",
      env: { ...process.env, CONTEXT: "production", URL: "", TEST_TRACCIAMENTI: "" },
    });
    if (build.status !== 0) throw new Error(`build di produzione fallita:\n${build.stderr || build.stdout}`);
    console.log(build.stdout.trim().split("\n").at(-1));
    writeFileSync(join(sito, "_headers"), fileHeaders());

    const problemi = await verifica(sito);
    if (problemi.length) throw new Error(`pacchetto non valido:\n  ${problemi.join("\n  ")}`);

    rmSync(SITO, { force: true });
    execFileSync("zip", ["-q", "-r", "-X", SITO, "."], { cwd: sito });
    const file = elenca(sito);
    const byte = file.reduce((t, f) => t + statSync(f).size, 0);
    console.log(`✔ ${relative(RADICE, SITO)}: ${file.length} file, ${(byte / 1024).toFixed(0)} KB scompattati, ${(statSync(SITO).size / 1024).toFixed(0)} KB lo zip`);
    console.log(`  in cima allo zip: ${readdirSync(sito).sort().join(", ")}`);

    rmSync(REPOSITORY, { force: true });
    const sporco = execFileSync("git", ["status", "--porcelain"], { cwd: RADICE, encoding: "utf8" }).trim();
    execFileSync("git", ["archive", "--format=zip", "--prefix=landing-cristina-centro-estetico/", "-o", REPOSITORY, "HEAD"], { cwd: RADICE });
    const commit = execFileSync("git", ["log", "-1", "--format=%h %s"], { cwd: RADICE, encoding: "utf8" }).trim();
    const quanti = execFileSync("git", ["ls-files"], { cwd: RADICE, encoding: "utf8" }).trim().split("\n").length;
    console.log(`✔ ${relative(RADICE, REPOSITORY)}: ${quanti} file del commit ${commit}, ${(statSync(REPOSITORY).size / 1024 / 1024).toFixed(1)} MB`);
    if (sporco) console.log(`  ⚠ ci sono modifiche non committate, che NON sono nello zip del repository:\n${sporco}`);
  } finally {
    rmSync(lavoro, { recursive: true, force: true });
  }
}

const eseguitoDirettamente = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  main().catch((e) => {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  });
}

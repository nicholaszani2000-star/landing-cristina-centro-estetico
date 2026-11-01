// studio/anteprima.mjs — server locale di dist/ + screenshot Playwright (CLAUDE.md §13).
//
// Uso:  node studio/anteprima.mjs                 build, server, screenshot, errori di console
//       node studio/anteprima.mjs --step 3        salva in studio/screenshot/step3/
//       node studio/anteprima.mjs --solo-server   tiene acceso il server (porta 4173)
//       opzioni: --porta N · --senza-build
// Senza --step la cartella è quella dello step in corso: ultimo studio/report/stepN.md + 1.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const DIST = join(RADICE, "dist");

const PAGINE = [
  ["home", "/"],
  ["viso", "/viso/"],
  ["pedicure", "/pedicure/"],
];
const MISURE = [
  [390, 844],
  [1440, 900],
];
const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// ---------------------------------------------------------------- argomenti

const argomenti = process.argv.slice(2);
const valore = (nome) => {
  const i = argomenti.indexOf(nome);
  return i >= 0 ? argomenti[i + 1] : undefined;
};
const soloServer = argomenti.includes("--solo-server");
const senzaBuild = argomenti.includes("--senza-build");
const portaRichiesta = Number(valore("--porta") ?? 4173);

function stepCorrente() {
  const richiesto = valore("--step");
  if (richiesto !== undefined) {
    if (!/^\d+$/.test(richiesto)) throw new Error(`--step vuole un numero, non «${richiesto}»`);
    return Number(richiesto);
  }
  const cartella = join(STUDIO, "report");
  const fatti = existsSync(cartella)
    ? readdirSync(cartella).map((f) => f.match(/^step(\d+)\.md$/)?.[1]).filter(Boolean).map(Number)
    : [];
  return fatti.length ? Math.max(...fatti) + 1 : 0;
}

// ---------------------------------------------------------------- server

function fileDi(percorso) {
  const pieno = normalize(join(DIST, percorso));
  if (pieno !== DIST && !pieno.startsWith(DIST + sep)) return null; // niente uscite da dist/
  return pieno;
}
const esisteFile = (p) => p && existsSync(p) && statSync(p).isFile();

async function rispondi(richiesta, risposta) {
  const url = new URL(richiesta.url, "http://anteprima.local");
  let percorso;
  try {
    percorso = decodeURIComponent(url.pathname);
  } catch {
    risposta.writeHead(400).end("URL non valido");
    return;
  }

  if (percorso === "/api/codice-sconto") {
    if (richiesta.method !== "POST") {
      risposta.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    // Step 8: qui l'anteprima importerà netlify/functions/codice-sconto.mjs.
    risposta.writeHead(501, { "Content-Type": "application/json; charset=utf-8" });
    risposta.end(JSON.stringify({ errore: "Il codice sconto arriva allo Step 8." }));
    return;
  }
  if (richiesta.method !== "GET" && richiesta.method !== "HEAD") {
    risposta.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  // Pretty URL come su Netlify: /viso/ → viso/index.html; /viso → 301 /viso/; /pagina → pagina.html
  let file = fileDi(percorso.endsWith("/") ? percorso + "index.html" : percorso);
  let stato = 200;
  if (!esisteFile(file)) {
    const cartella = fileDi(percorso);
    if (!percorso.endsWith("/") && cartella && esisteFile(join(cartella, "index.html"))) {
      risposta.writeHead(301, { Location: percorso + "/" + url.search }).end();
      return;
    }
    const html = fileDi(percorso + ".html");
    if (esisteFile(html)) file = html;
    else {
      file = join(DIST, "404.html");
      stato = 404;
      if (!esisteFile(file)) {
        risposta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
        return;
      }
    }
  }
  const corpo = await readFile(file);
  risposta.writeHead(stato, {
    "Content-Type": TIPI[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  risposta.end(richiesta.method === "HEAD" ? undefined : corpo);
}

export function avviaServer(porta) {
  return new Promise((ok, ko) => {
    const server = createServer((req, res) => {
      rispondi(req, res).catch((e) => {
        console.error(e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    server.once("error", ko);
    server.listen(porta, "127.0.0.1", () => ok(server));
  });
}

// ---------------------------------------------------------------- browser

export async function apriBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { errore: "Playwright non installato: npm install --prefix studio" };
  }
  try {
    return { browser: await chromium.launch() };
  } catch (primo) {
    // Ripiego (§13): Chromium di sistema.
    const candidati = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"];
    for (const nome of ["chromium", "chromium-browser", "google-chrome"]) {
      const r = spawnSync("which", [nome], { encoding: "utf8" });
      if (r.status === 0) candidati.push(r.stdout.trim());
    }
    for (const percorso of candidati.filter(Boolean)) {
      if (!existsSync(percorso)) continue;
      try {
        const browser = await chromium.launch({ executablePath: percorso, args: ["--no-sandbox"] });
        return { browser, nota: `Chromium di sistema: ${percorso}` };
      } catch {
        /* prova il prossimo */
      }
    }
    return { errore: `nessun Chromium avviabile (${primo.message.split("\n")[0]})` };
  }
}

/** Scorre la pagina fino in fondo per far scattare le comparse, poi torna in cima. */
async function scorriTutta(pagina) {
  await pagina.evaluate(async () => {
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
      scrollTo(0, y);
      await pausa(120);
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await pausa(700);
    scrollTo(0, 0);
    await pausa(200);
  });
}

// ---------------------------------------------------------------- main

async function main() {
  if (!senzaBuild) {
    const build = spawnSync(process.execPath, [join(RADICE, "build.mjs")], { cwd: RADICE, stdio: "inherit" });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }
  if (!existsSync(join(DIST, "index.html"))) {
    console.error("✘ dist/index.html mancante: esegui prima node build.mjs");
    process.exit(1);
  }

  if (soloServer) {
    await avviaServer(portaRichiesta);
    console.log(`Anteprima su http://localhost:${portaRichiesta}/  (Ctrl+C per fermare)`);
    return;
  }

  let server;
  try {
    server = await avviaServer(portaRichiesta);
  } catch {
    server = await avviaServer(0); // porta occupata: una libera qualsiasi
  }
  const base = `http://localhost:${server.address().port}`;
  const step = stepCorrente();
  const uscita = join(STUDIO, "screenshot", `step${step}`);
  await mkdir(uscita, { recursive: true });

  const { browser, errore, nota } = await apriBrowser();
  if (!browser) {
    console.log(`⚠ screenshot saltati: ${errore}`);
    server.close();
    return;
  }
  if (nota) console.log(`  · ${nota}`);

  const problemi = [];
  const salvati = [];
  for (const [larghezza, altezza] of MISURE) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza }, deviceScaleFactor: 1 });
    const giri = [...PAGINE, ["404", "/pagina-che-non-esiste/"]];
    for (const [nome, percorso] of giri) {
      const pagina = await contesto.newPage();
      const etichetta = `${nome} ${larghezza}px`;
      pagina.on("console", (m) => {
        if (m.type() !== "error" && m.type() !== "warning") return;
        const origine = m.location()?.url ?? "";
        // Sulla pagina 404 il browser segnala lo stato 404 del documento stesso: è atteso.
        if (nome === "404" && origine === base + percorso && /status of 404/.test(m.text())) return;
        problemi.push(`${etichetta} · console ${m.type()}: ${m.text()}${origine ? ` (${origine})` : ""}`);
      });
      pagina.on("pageerror", (e) => problemi.push(`${etichetta} · errore JS: ${e.message}`));
      pagina.on("requestfailed", (r) => problemi.push(`${etichetta} · richiesta fallita: ${r.url()} (${r.failure()?.errorText})`));
      pagina.on("response", (r) => {
        const atteso404 = nome === "404" && r.url() === base + percorso;
        if (r.status() >= 400 && !atteso404) problemi.push(`${etichetta} · HTTP ${r.status()}: ${r.url()}`);
      });
      const risposta = await pagina.goto(base + percorso, { waitUntil: "networkidle" });
      if (nome === "404" && risposta.status() !== 404) problemi.push(`404: stato ${risposta.status()} invece di 404`);
      await pagina.evaluate(() => document.fonts.ready);
      if (nome !== "404") {
        const schermo = join(uscita, `${nome}-${larghezza}-schermo.png`);
        await pagina.screenshot({ path: schermo });
        salvati.push(schermo);
      }
      await scorriTutta(pagina);
      if (larghezza < 768 && nome !== "404") {
        // Fondo pagina con la barra contatti mobile visibile
        await pagina.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await pagina.waitForTimeout(500);
        const fondo = join(uscita, `${nome}-${larghezza}-fondo.png`);
        await pagina.screenshot({ path: fondo });
        salvati.push(fondo);
        await pagina.evaluate(() => scrollTo(0, 0));
        await pagina.waitForTimeout(400);
      }
      const intera = join(uscita, `${nome}-${larghezza}.png`);
      await pagina.screenshot({ path: intera, fullPage: true });
      salvati.push(intera);
      await pagina.close();
    }
    await contesto.close();
  }
  // Ripieghi (§3.8): il contenuto resta visibile senza JS, con «riduci movimento» e se main.js non arriva.
  const opacitaMinima = (pagina) =>
    pagina.evaluate(() => Math.min(1, ...[...document.querySelectorAll(".appare")].map((el) => Number(getComputedStyle(el).opacity))));
  const ripieghi = [
    ["senza JavaScript", { javaScriptEnabled: false }, null, 300],
    ["riduci movimento", { reducedMotion: "reduce" }, null, 300],
    ["main.js non caricato", {}, (contesto) => contesto.route("**/js/main.js*", (r) => r.abort()), 3500],
  ];
  for (const [nome, opzioni, prepara, attesa] of ripieghi) {
    const contesto = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opzioni });
    if (prepara) await prepara(contesto);
    const pagina = await contesto.newPage();
    await pagina.goto(base + "/", { waitUntil: "load" });
    await pagina.waitForTimeout(attesa);
    const opacita = await opacitaMinima(pagina);
    if (opacita < 1) problemi.push(`ripiego «${nome}»: elementi .appare invisibili (opacità ${opacita})`);
    else console.log(`✔ ripiego «${nome}»: contenuto visibile`);
    await contesto.close();
  }

  await browser.close();
  server.close();

  const rapporto = problemi.length ? problemi.join("\n") : "nessun errore di console e nessuna richiesta fallita";
  await writeFile(join(uscita, "console.txt"), rapporto + "\n");
  console.log(`✔ ${salvati.length} screenshot in studio/screenshot/step${step}/`);
  if (problemi.length) {
    console.log(`✘ ${problemi.length} problemi:\n${rapporto}`);
    process.exit(1);
  }
  console.log("✔ console: 0 errori, 0 richieste fallite");
}

// Eseguito direttamente: anteprima completa. Importato (da controlli.mjs): solo server e browser.
const eseguitoDirettamente = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (eseguitoDirettamente) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

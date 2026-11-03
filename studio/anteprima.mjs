// studio/anteprima.mjs — server locale di dist/ + screenshot Playwright (CLAUDE.md §13).
//
// Uso:  node studio/anteprima.mjs                 build, server, screenshot, errori di console
//       node studio/anteprima.mjs --step 3        salva in studio/screenshot/step3/
//       pagine: /, /viso/, /pedicure/ (primo schermo, intera, fondo a 390), /privacy/, /cookie/ e 404 (intera);
//       modulo del codice sconto (vuoto, errori, codice ottenuto) e banner cookie della build di prova a 390 px
//       node studio/anteprima.mjs --solo-server   tiene acceso il server (porta 4173)
//       opzioni: --porta N · --senza-build
// Senza --step la cartella è quella dello step in corso: ultimo studio/report/stepN.md + 1.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync } from "node:zlib";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const DIST = join(RADICE, "dist");

const PAGINE = [
  ["home", "/"],
  ["viso", "/viso/"],
  ["pedicure", "/pedicure/"],
];
// Pagine legali (Step 7): solo pagina intera, a ogni misura.
const LEGALI = [
  ["privacy", "/privacy/"],
  ["cookie", "/cookie/"],
];
const MISURE = [
  [390, 844],
  [768, 1024],
  [1024, 768],
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

function fileDi(percorso, cartella = DIST) {
  const pieno = normalize(join(cartella, percorso));
  if (pieno !== cartella && !pieno.startsWith(cartella + sep)) return null; // niente uscite dalla cartella servita
  return pieno;
}

/** Header di netlify.toml per «/*» (sicurezza e Content-Security-Policy), da applicare ai file statici come fa
 *  Netlify. upgrade-insecure-requests si toglie solo qui: l'anteprima è in http, il sito vero in https. */
export function intestazioniNetlify() {
  return regoleNetlify().find((r) => r.per === "/*")?.valori ?? {};
}

/** Tutti i blocchi [[headers]] di netlify.toml: { per: "/fonts/*", valori: { … } }. */
export function regoleNetlify() {
  const toml = readFileSync(join(RADICE, "netlify.toml"), "utf8");
  return toml
    .split("[[headers]]")
    .slice(1)
    .map((blocco) => {
      const per = blocco.match(/^\s*for\s*=\s*"([^"]+)"\s*$/m)?.[1];
      const valori = [...blocco.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"\s*$/gm)].filter(([, k]) => k !== "for");
      return {
        per,
        valori: Object.fromEntries(
          valori.map(([, k, v]) => [k, k === "Content-Security-Policy" ? v.replace(/;?\s*upgrade-insecure-requests/, "") : v]),
        ),
      };
    })
    .filter((r) => r.per);
}

/** Header di netlify.toml che valgono per un percorso («/*» e i prefissi come «/fonts/*»), in ordine. */
function intestazioniPer(percorso, regole) {
  const valide = regole.filter((r) => (r.per.endsWith("*") ? percorso.startsWith(r.per.slice(0, -1)) : percorso === r.per));
  return Object.assign({}, ...valide.map((r) => r.valori));
}
const COMPRIMIBILI = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt", ".svg"]);

// ---------------------------------------------------------------- funzione del codice sconto

let funzione = null;
/** Importa netlify/functions/codice-sconto.mjs con un globale Netlify finto: env.get legge process.env.
 *  Senza SUPABASE_URL e SUPABASE_SECRET_KEY la funzione lavora in «modalità prova» (§13). */
async function funzioneCodice() {
  if (!funzione) {
    globalThis.Netlify ??= { env: { get: (k) => process.env[k] } };
    funzione = (await import(pathToFileURL(join(RADICE, "netlify", "functions", "codice-sconto.mjs")).href)).default;
  }
  return funzione;
}
async function corpoDi(richiesta) {
  const parti = [];
  for await (const parte of richiesta) parti.push(parte);
  return Buffer.concat(parti);
}
/** Passa alla funzione una Request vera (metodo, header, corpo) e scrive la sua Response. */
async function rispondiCodice(richiesta, risposta) {
  const intestazioni = new Headers();
  for (let i = 0; i < richiesta.rawHeaders.length; i += 2) intestazioni.append(richiesta.rawHeaders[i], richiesta.rawHeaders[i + 1]);
  const corpo = await corpoDi(richiesta);
  const req = new Request(new URL(richiesta.url, `http://${richiesta.headers.host ?? "localhost"}`), {
    method: richiesta.method,
    headers: intestazioni,
    body: ["GET", "HEAD"].includes(richiesta.method) ? undefined : corpo,
  });
  const res = await (await funzioneCodice())(req, { ip: richiesta.socket.remoteAddress, params: {} });
  risposta.writeHead(res.status, Object.fromEntries(res.headers));
  risposta.end(Buffer.from(await res.arrayBuffer()));
}
const esisteFile = (p) => p && existsSync(p) && statSync(p).isFile();

/** produzione = true imita Netlify anche su cache e compressione: header di tutti i blocchi di netlify.toml
 *  (Cache-Control compreso) e brotli per i file di testo, se il browser lo accetta. Serve a Lighthouse. */
async function rispondi(richiesta, risposta, cartella = DIST, intestazioni = {}, produzione = false) {
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
    await rispondiCodice(richiesta, risposta);
    return;
  }
  if (richiesta.method !== "GET" && richiesta.method !== "HEAD") {
    risposta.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  // Pretty URL come su Netlify: /viso/ → viso/index.html; /viso → 301 /viso/; /pagina → pagina.html
  let file = fileDi(percorso.endsWith("/") ? percorso + "index.html" : percorso, cartella);
  let stato = 200;
  if (!esisteFile(file)) {
    const sottocartella = fileDi(percorso, cartella);
    if (!percorso.endsWith("/") && sottocartella && esisteFile(join(sottocartella, "index.html"))) {
      risposta.writeHead(301, { Location: percorso + "/" + url.search }).end();
      return;
    }
    const html = fileDi(percorso + ".html", cartella);
    if (esisteFile(html)) file = html;
    else {
      file = join(cartella, "404.html");
      stato = 404;
      if (!esisteFile(file)) {
        risposta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
        return;
      }
    }
  }
  let corpo = await readFile(file);
  const estensione = extname(file).toLowerCase();
  const extra = produzione
    ? { "Cache-Control": "public, max-age=0, must-revalidate", ...intestazioniPer(percorso, regoleProduzione) }
    : { "Cache-Control": "no-store" };
  if (produzione && COMPRIMIBILI.has(estensione) && /\bbr\b/.test(richiesta.headers["accept-encoding"] ?? "")) {
    // Compresso una volta sola per file, come la cache di Netlify: senza, ogni richiesta pagherebbe la
    // compressione brotli e Lighthouse misurerebbe un server più lento di quello vero.
    const chiave = `${file}:${statSync(file).mtimeMs}`;
    if (!compressi.has(chiave)) compressi.set(chiave, brotliCompressSync(corpo));
    corpo = compressi.get(chiave);
    extra["Content-Encoding"] = "br";
    extra.Vary = "Accept-Encoding";
  }
  risposta.writeHead(stato, {
    ...intestazioni,
    "Content-Type": TIPI[estensione] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
  risposta.end(richiesta.method === "HEAD" ? undefined : corpo);
}
let regoleProduzione = [];
const compressi = new Map();

export function avviaServer(porta, { cartella = DIST, intestazioni = intestazioniNetlify(), produzione = false } = {}) {
  if (produzione) regoleProduzione = regoleNetlify();
  return new Promise((ok, ko) => {
    const server = createServer((req, res) => {
      rispondi(req, res, resolve(cartella), intestazioni, produzione).catch((e) => {
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

// ---------------------------------------------------------------- Step 8: modulo e banner

const TRACCIANTI = /(^|\.)(googletagmanager\.com|google-analytics\.com|facebook\.net|facebook\.com)$/;

/** Ascolta errori di console, errori JS e richieste fallite di una pagina. */
function sorveglia(pagina, etichetta, problemi) {
  pagina.on("console", (m) => (m.type() === "error" || m.type() === "warning") && problemi.push(`${etichetta} · console ${m.type()}: ${m.text()}`));
  pagina.on("pageerror", (e) => problemi.push(`${etichetta} · errore JS: ${e.message}`));
  pagina.on("requestfailed", (r) => !TRACCIANTI.test(new URL(r.url()).hostname) && problemi.push(`${etichetta} · richiesta fallita: ${r.url()}`));
}

/** Modulo del codice sconto: vuoto (390 e 1440), con gli errori e con il codice ottenuto (390). La barra contatti
 *  mobile si nasconde solo per questi ritagli, così il blocco si vede intero. */
async function screenshotCodice(browser, base, uscita, problemi, salvati) {
  for (const [larghezza, altezza] of [[390, 844], [1440, 900]]) {
    const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza }, reducedMotion: "reduce" });
    const pagina = await contesto.newPage();
    sorveglia(pagina, `codice sconto ${larghezza}px`, problemi);
    await pagina.goto(base + "/viso/?utm_source=meta", { waitUntil: "networkidle" });
    // Con la CSP (style-src 'self') un <style> aggiunto verrebbe bloccato: si nasconde la barra dal CSSOM, che è ammesso.
    await pagina.evaluate(() => document.querySelectorAll(".barra-contatti").forEach((b) => b.style.setProperty("display", "none", "important")));
    const sezione = pagina.locator("#codice-sconto");
    const salva = async (nome) => {
      const file = join(uscita, `codice-${larghezza}-${nome}.png`);
      await sezione.screenshot({ path: file });
      salvati.push(file);
    };
    await salva("vuoto");
    if (larghezza < 768) {
      await pagina.click(".codice-invia");
      await salva("errori");
      await pagina.fill("#codice-email", "anna@esempio.it");
      await pagina.check("#codice-consenso");
      await pagina.click(".codice-invia");
      await pagina.waitForSelector(".codice-ottenuto");
      await salva("ottenuto");
    }
    await contesto.close();
  }
}

/** Banner cookie nella build di prova (TEST_TRACCIAMENTI=1, ID finti) a 390 px, con Google e Meta bloccati. */
async function screenshotBanner(browser, uscita, problemi, salvati) {
  const tmp = mkdtempSync(join(tmpdir(), "migliore-banner-"));
  try {
    const build = spawnSync(process.execPath, [join(RADICE, "build.mjs"), "--dist", tmp], { cwd: RADICE, encoding: "utf8", env: { ...process.env, URL: "", CONTEXT: "", TEST_TRACCIAMENTI: "1" } });
    if (build.status !== 0) {
      problemi.push(`build di prova del banner fallita: ${build.stderr || build.stdout}`);
      return;
    }
    const server = await avviaServer(0, { cartella: tmp });
    const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await contesto.route((u) => TRACCIANTI.test(u.hostname), (r) => r.abort());
    const pagina = await contesto.newPage();
    sorveglia(pagina, "banner 390px", problemi);
    await pagina.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    await pagina.evaluate(() => document.fonts.ready);
    for (const [nome, azione] of [["banner-390", null], ["banner-390-pannello", '[data-consenso="personalizza"]']]) {
      if (azione) await pagina.click(azione);
      const file = join(uscita, `${nome}.png`);
      await pagina.screenshot({ path: file });
      salvati.push(file);
    }
    await contesto.close();
    server.close();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
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
    const giri = [...PAGINE, ...LEGALI, ["404", "/pagina-che-non-esiste/"]];
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
      const landing = PAGINE.some(([n]) => n === nome);
      if (landing) {
        const schermo = join(uscita, `${nome}-${larghezza}-schermo.png`);
        await pagina.screenshot({ path: schermo });
        salvati.push(schermo);
      }
      await scorriTutta(pagina);
      if (larghezza < 768 && landing) {
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
  await screenshotCodice(browser, base, uscita, problemi, salvati);
  await screenshotBanner(browser, uscita, problemi, salvati);

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

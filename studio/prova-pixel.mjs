// studio/prova-pixel.mjs — prova dal vivo del banner cookie e dei pixel Meta sul sito online.
//
// Uso:  node studio/prova-pixel.mjs [indirizzo]      (predefinito: l'indirizzo principale di content/centro.json)
// Apre il sito come una visitatrice nuova da telefono e controlla che:
//   - prima della scelta non parta nessuna richiesta verso Meta;
//   - dopo «Accetta» si carichino fbevents.js e la configurazione di ogni pixel di centro.json;
//   - ogni pixel riceva il suo PageView (www.facebook.com/tr con risposta 200).
// Manda un PageView vero a ogni pixel (con utm_source=prova_claude nell'indirizzo, per riconoscerlo). Il browser si
// presenta come un iPhone: con l'identità «HeadlessChrome» Meta carica lo script ma non manda eventi (provato il 15/11).
// Serve la rete verso il sito, connect.facebook.net e www.facebook.com. Esce con codice 1 se qualcosa non va.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const centro = JSON.parse(readFileSync(join(RADICE, "content", "centro.json"), "utf8"));
const PIXEL = String(centro.integrazioni.metaPixelId ?? "").split(",").filter(Boolean);
const SITO = new URL(process.argv[2] ?? centro.indirizzoPrincipale);
SITO.searchParams.set("utm_source", "prova_claude");

const opzioni = { args: ["--no-sandbox"] };
if (existsSync("/opt/pw-browsers/chromium")) opzioni.executablePath = "/opt/pw-browsers/chromium";
if (process.env.HTTPS_PROXY) opzioni.proxy = { server: process.env.HTTPS_PROXY };

const browser = await chromium.launch(opzioni);
// Identità di un iPhone vero: lo script di Meta non manda eventi ai browser automatici («HeadlessChrome»).
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const contesto = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE });
const pagina = await contesto.newPage();
const richieste = [];
pagina.on("requestfinished", async (r) => {
  const u = new URL(r.url());
  if (!/facebook\.(com|net)$/.test(u.hostname)) return;
  const risposta = await r.response().catch(() => null);
  richieste.push({ host: u.hostname, percorso: u.pathname, id: u.searchParams.get("id"), ev: u.searchParams.get("ev"), stato: risposta?.status() ?? 0 });
});

const problemi = [];
await pagina.goto(SITO.href, { waitUntil: "networkidle" });
if (richieste.length) problemi.push(`richieste a Meta prima della scelta: ${richieste.length}`);
if (!(await pagina.isVisible('[data-consenso="accetta"]'))) problemi.push("banner cookie non visibile");
else {
  await pagina.click('[data-consenso="accetta"]');
  await pagina.waitForTimeout(9000);
}
const righe = [];
for (const id of PIXEL) {
  const config = richieste.some((r) => r.percorso === `/signals/config/${id}` && r.stato === 200);
  const pv = richieste.filter((r) => r.host === "www.facebook.com" && r.percorso.startsWith("/tr") && r.id === id && r.ev === "PageView");
  const ok = config && pv.some((r) => r.stato === 200);
  righe.push(`${ok ? "✔" : "✘"} pixel ${id}: configurazione ${config ? "caricata" : "non caricata"}, PageView ${pv.map((r) => r.stato).join(", ") || "non inviato"}`);
  if (!ok) problemi.push(`pixel ${id} senza PageView riuscito`);
}
await browser.close();
console.log(`Prova dal vivo su ${SITO.origin} (${new Date().toISOString()})`);
for (const r of righe) console.log(r);
for (const p of problemi) console.log(`✘ ${p}`);
process.exit(problemi.length ? 1 : 0);

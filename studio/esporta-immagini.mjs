// studio/esporta-immagini.mjs — dagli originali di studio/originali/ alle immagini del sito in src/img/ (CLAUDE.md §2.6, §9).
//
// Regola: le foto restano identiche. Solo ridimensionamento (mai oltre l'originale) e conversione:
// AVIF qualità 55 effort 6, WebP qualità 80, spazio colore sRGB, metadati rimossi, nessun ritaglio,
// nessun filtro di colore, luce o nitidezza.
//
// Uso:  node studio/esporta-immagini.mjs                       esporta + contact sheet
//       node studio/esporta-immagini.mjs --senza-contact-sheet
// Scrive anche src/img/immagini.json: misure originali e larghezze esportate, letto da build.mjs.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(STUDIO, "..");
const ORIGINALI = join(STUDIO, "originali");
const IMG = join(RADICE, "src", "img");

const FOTO = [
  { file: "foto/01-cristina-bancone.png", nome: "cristina-bancone", larghezze: [480, 720, 941] },
  { file: "foto/02-ingresso.png", nome: "ingresso", larghezze: [480, 800, 1200] },
  { file: "foto/03-cabina-viso.png", nome: "cabina-viso", larghezze: [480, 720, 941] },
  { file: "foto/04-cabina-lettino.png", nome: "cabina-lettino", larghezze: [480, 720, 941] },
  { file: "foto/05-postazione-pedicure.png", nome: "postazione-pedicure", larghezze: [480, 720, 941] },
  { file: "foto/06-listino-stampato.png", nome: "listino-stampato", larghezze: [800, 1536] },
];
// Logo: 480 e 960 (960 solo se l'originale è largo almeno 960, altrimenti la misura originale), più 240:
// a schermo il logo è largo al massimo ~99 px, quindi il browser scarica il 240 (≤ 40 KB) anche a densità 3×.
const LOGO = { file: "logo/logo-trasparente.png", nome: "logo", larghezze: [240, 480, 960], ripiego: 240 };
const FARFALLA = { file: "logo/farfalla.png", icone: [["favicon-32.png", 32], ["favicon-16.png", 16], ["apple-touch-icon.png", 180]] };
const CONDIVISIONE = { file: "condivisione/og-1200x630.jpg", nome: "og", destinazione: "og.jpg" };

const AVIF = { quality: 55, effort: 6 };
const WEBP = { quality: 80 };
const WEBP_LOGO = { quality: 90, alphaQuality: 100 }; // il logo ha la trasparenza: bordi puliti
const PNG = { compressionLevel: 9, adaptiveFiltering: true, palette: false };

const kb = (byte) => Math.round((byte / 1024) * 10) / 10;
const rel = (p) => relative(RADICE, p);

// ---------------------------------------------------------------- impronte

/** Legge le impronte SHA-256 di LEGGIMI.txt: { "foto/01-…png": "ff1d…" }. */
function impronteAttese() {
  const testo = readFileSync(join(ORIGINALI, "LEGGIMI.txt"), "utf8");
  return Object.fromEntries([...testo.matchAll(/^(\S+\.(?:png|jpg))\n.*\n\s+sha256 ([0-9a-f]{64})/gm)].map((m) => [m[1], m[2]]));
}
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

function verificaOriginali() {
  const attese = impronteAttese();
  const errori = [];
  for (const [file, impronta] of Object.entries(attese)) {
    const percorso = join(ORIGINALI, file);
    if (!existsSync(percorso)) errori.push(`${file}: mancante`);
    else if (sha256(percorso) !== impronta) errori.push(`${file}: impronta diversa da LEGGIMI.txt`);
  }
  if (Object.keys(attese).length !== 10) errori.push(`LEGGIMI.txt: ${Object.keys(attese).length} impronte invece di 10`);
  if (errori.length) throw new Error(`originali non validi:\n  ${errori.join("\n  ")}`);
  return Object.keys(attese).length;
}

// ---------------------------------------------------------------- esportazione

async function originale(file) {
  const percorso = join(ORIGINALI, file);
  const m = await sharp(percorso).metadata();
  if (m.orientation && m.orientation !== 1) throw new Error(`${file}: orientamento EXIF ${m.orientation}, da verificare a mano`);
  return { percorso, larghezza: m.width, altezza: m.height };
}

/** Ridimensiona per larghezza (altezza in proporzione: nessun ritaglio), mai oltre l'originale. */
function pipeline(percorso, larghezza, larghezzaOriginale) {
  if (larghezza > larghezzaOriginale) throw new Error(`${percorso}: ${larghezza} px supera l'originale (${larghezzaOriginale} px)`);
  let p = sharp(percorso).toColourspace("srgb"); // senza withMetadata(): EXIF, XMP e ICC vengono rimossi
  if (larghezza < larghezzaOriginale) p = p.resize({ width: larghezza, withoutEnlargement: true, kernel: "lanczos3" });
  return p;
}

async function scrivi(p, destinazione) {
  const info = await p.toFile(destinazione);
  return { file: rel(destinazione), larghezza: info.width, altezza: info.height, byte: info.size };
}

async function main() {
  const conContactSheet = !process.argv.includes("--senza-contact-sheet");
  const quante = verificaOriginali();
  console.log(`✔ ${quante} originali identici a LEGGIMI.txt`);

  await rm(IMG, { recursive: true, force: true });
  await mkdir(IMG, { recursive: true });

  const manifesto = { _nota: "Generato da studio/esporta-immagini.mjs: non modificare a mano.", immagini: {}, icone: [] };
  const esportati = [];

  for (const foto of FOTO) {
    const o = await originale(foto.file);
    for (const w of foto.larghezze) {
      esportati.push({ gruppo: foto.nome, originale: foto.file, ...(await scrivi(pipeline(o.percorso, w, o.larghezza).avif(AVIF), join(IMG, `${foto.nome}-${w}.avif`))) });
      esportati.push({ gruppo: foto.nome, originale: foto.file, ...(await scrivi(pipeline(o.percorso, w, o.larghezza).webp(WEBP), join(IMG, `${foto.nome}-${w}.webp`))) });
    }
    manifesto.immagini[foto.nome] = { originale: foto.file, larghezza: o.larghezza, altezza: o.altezza, larghezze: foto.larghezze, formati: ["avif", "webp"] };
  }

  const ol = await originale(LOGO.file);
  const larghezzeLogo = [...new Set(LOGO.larghezze.map((w) => Math.min(w, ol.larghezza)))];
  for (const w of larghezzeLogo) {
    esportati.push({ gruppo: "logo", originale: LOGO.file, ...(await scrivi(pipeline(ol.percorso, w, ol.larghezza).webp(WEBP_LOGO), join(IMG, `logo-${w}.webp`))) });
  }
  esportati.push({ gruppo: "logo", originale: LOGO.file, ...(await scrivi(pipeline(ol.percorso, LOGO.ripiego, ol.larghezza).png(PNG), join(IMG, "logo.png"))) });
  manifesto.immagini.logo = { originale: LOGO.file, larghezza: ol.larghezza, altezza: ol.altezza, larghezze: larghezzeLogo, formati: ["webp"], ripiego: "logo.png" };

  // Icone dalla farfalla (già su fondo sabbia): solo ridimensionamento, mai più grandi dell'originale.
  const of = await originale(FARFALLA.file);
  for (const [nome, lato] of FARFALLA.icone) {
    esportati.push({ gruppo: "icone", originale: FARFALLA.file, ...(await scrivi(pipeline(of.percorso, lato, of.larghezza).png(PNG), join(IMG, nome))) });
    manifesto.icone.push({ file: nome, lato });
  }

  // Condivisione: copiata così com'è, byte per byte.
  await copyFile(join(ORIGINALI, CONDIVISIONE.file), join(IMG, CONDIVISIONE.destinazione));
  const oc = await originale(CONDIVISIONE.file);
  esportati.push({ gruppo: "og", originale: CONDIVISIONE.file, file: rel(join(IMG, CONDIVISIONE.destinazione)), larghezza: oc.larghezza, altezza: oc.altezza, byte: (await stat(join(IMG, CONDIVISIONE.destinazione))).size });
  manifesto.immagini.og = { originale: CONDIVISIONE.file, file: CONDIVISIONE.destinazione, larghezza: oc.larghezza, altezza: oc.altezza };

  await writeFile(join(IMG, "immagini.json"), JSON.stringify(manifesto, null, 2) + "\n");

  // Confronto colori: media dei canali dell'esportato contro l'originale (un ritocco la sposterebbe).
  // Le immagini con trasparenza si confrontano appoggiate sul sabbia, come appaiono nella pagina.
  const statistiche = async (file) => {
    if (!(await sharp(file).metadata()).hasAlpha) return sharp(file).stats();
    // stats() lavora sull'immagine d'ingresso: prima si appoggia sul sabbia in un buffer.
    return sharp(await sharp(file).flatten({ background: "#F4DBCA" }).png().toBuffer()).stats();
  };
  for (const e of esportati) {
    const [a, b] = await Promise.all([statistiche(join(ORIGINALI, e.originale)), statistiche(join(RADICE, e.file))]);
    e.deltaRgb = [0, 1, 2].map((c) => Math.round((b.channels[c].mean - a.channels[c].mean) * 10) / 10);
  }

  console.log("\nfile".padEnd(40) + "misure".padEnd(13) + "KB".padStart(7) + "   Δ media RGB");
  for (const e of esportati) {
    console.log(`${e.file.replace("src/img/", "")}`.padEnd(39) + `${e.larghezza}×${e.altezza}`.padEnd(13) + String(kb(e.byte)).padStart(7) + `   ${e.deltaRgb.join(" / ")}`);
  }
  await mkdir(join(STUDIO, "screenshot", "step2"), { recursive: true });
  await writeFile(join(STUDIO, "screenshot", "step2", "immagini-esportate.json"), JSON.stringify(esportati, null, 2) + "\n");
  console.log(`\n✔ ${esportati.length} file in src/img/ · manifesto src/img/immagini.json`);

  if (conContactSheet) await contactSheet(esportati);
}

// ---------------------------------------------------------------- contact sheet

async function contactSheet(esportati) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("⚠ contact sheet saltato: Playwright non installato");
    return;
  }
  const uscita = join(STUDIO, "screenshot", "step2");
  await mkdir(uscita, { recursive: true });
  const url = (p) => pathToFileURL(join(RADICE, p)).href;
  const sabbia = "#F4DBCA";
  const sabbiaChiara = "#FAEDE4";
  const etichetta = (e) => `<b>${e.file.replace("src/img/", "")}</b><br>${e.larghezza}×${e.altezza} · ${kb(e.byte)} KB<br>Δ RGB ${e.deltaRgb.join(" / ")}`;

  const righeFoto = FOTO.map((f) => {
    const voci = esportati.filter((e) => e.gruppo === f.nome);
    const piuGrande = (est) => voci.filter((e) => e.file.endsWith(est)).at(-1);
    return `<section><h2>${f.file}</h2>
      <div class="confronto">
        <figure><img src="${pathToFileURL(join(ORIGINALI, f.file)).href}"><figcaption><b>ORIGINALE</b> ${f.file}</figcaption></figure>
        <figure><img src="${url(piuGrande(".avif").file)}"><figcaption>${etichetta(piuGrande(".avif"))}</figcaption></figure>
        <figure><img src="${url(piuGrande(".webp").file)}"><figcaption>${etichetta(piuGrande(".webp"))}</figcaption></figure>
      </div>
      <div class="tutte">${voci.map((e) => `<figure><img src="${url(e.file)}"><figcaption>${etichetta(e)}</figcaption></figure>`).join("")}</div>
    </section>`;
  }).join("");

  const logo = esportati.filter((e) => e.gruppo === "logo");
  const icone = esportati.filter((e) => e.gruppo === "icone");
  const og = esportati.find((e) => e.gruppo === "og");
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><style>
    body { margin: 24px; font: 13px/1.4 system-ui, sans-serif; background: #fff; color: #1F1612; }
    h1 { font-size: 22px; } h2 { font-size: 15px; margin: 28px 0 8px; }
    figure { margin: 0; display: inline-block; vertical-align: top; }
    figcaption { margin-top: 4px; }
    .confronto { display: flex; gap: 16px; }
    .confronto img { height: 420px; width: auto; display: block; outline: 1px solid #ccc; }
    .tutte { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
    .tutte img { height: 140px; width: auto; display: block; outline: 1px solid #ccc; }
    .fondo { padding: 16px; display: inline-block; }
    .zoom { width: 520px; height: 300px; overflow: hidden; position: relative; display: inline-block; outline: 1px solid #ccc; }
    .zoom img { position: absolute; width: 1248px; height: auto; image-rendering: auto; }
  </style></head><body>
    <h1>Contact sheet · Step 2 · immagini esportate (AVIF q55 e6 · WebP q80 · sRGB · senza metadati)</h1>
    <p>Accanto a ogni originale, la versione AVIF e WebP più grande. Δ RGB = differenza della media dei canali R/G/B rispetto all'originale (0 = colori invariati).</p>
    ${righeFoto}
    <section><h2>Logo trasparente (${LOGO.file}) · su sabbia e sabbia chiara, al 100% e al 200%</h2>
      <div class="fondo" style="background:${sabbia}">${logo.filter((e) => e.file.endsWith(".webp")).map((e) => `<figure><img src="${url(e.file)}" style="height:${e === logo[0] ? 80 : 160}px"><figcaption>${etichetta(e)}</figcaption></figure>`).join(" ")}</div>
      <div class="fondo" style="background:${sabbiaChiara}"><figure><img src="${url(logo.find((e) => e.file.endsWith(".png")).file)}" style="height:160px"><figcaption>${etichetta(logo.find((e) => e.file.endsWith(".png")))}</figcaption></figure></div>
      <p>Zoom al 200% sui bordi (cerchio, scritta e farfalla):</p>
      <div class="fondo" style="background:${sabbia}"><div class="zoom" style="background:${sabbia}"><img src="${url("src/img/logo-" + manifestoLarghezzaLogo(logo) + ".webp")}" style="left:-40px;top:-380px"></div> <div class="zoom" style="background:${sabbia}"><img src="${url("src/img/logo-" + manifestoLarghezzaLogo(logo) + ".webp")}" style="left:-700px;top:-20px"></div></div>
      <div class="fondo" style="background:${sabbiaChiara}"><div class="zoom" style="background:${sabbiaChiara}"><img src="${url("src/img/logo-" + manifestoLarghezzaLogo(logo) + ".webp")}" style="left:-40px;top:-380px"></div> <div class="zoom" style="background:${sabbiaChiara}"><img src="${url("src/img/logo-" + manifestoLarghezzaLogo(logo) + ".webp")}" style="left:-700px;top:-20px"></div></div>
    </section>
    <section><h2>Icone dalla farfalla (${FARFALLA.file}, 210×210)</h2>
      <div class="fondo" style="background:#fff"><figure><img src="${pathToFileURL(join(ORIGINALI, FARFALLA.file)).href}"><figcaption><b>ORIGINALE</b> 210×210</figcaption></figure>
      ${icone.map((e) => `<figure><img src="${url(e.file)}"><figcaption>${etichetta(e)}</figcaption></figure>`).join(" ")}</div>
    </section>
    <section><h2>Condivisione (copiata così com'è)</h2>
      <figure><img src="${url(og.file)}" style="width:600px"><figcaption>${etichetta(og)}</figcaption></figure>
    </section>
  </body></html>`;
  const fileHtml = join(uscita, "contact-sheet.html");
  await writeFile(fileHtml, html);

  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  }
  const pagina = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await pagina.goto(pathToFileURL(fileHtml).href, { waitUntil: "load" });
  await pagina.screenshot({ path: join(uscita, "contact-sheet.png"), fullPage: true });
  await browser.close();
  console.log(`✔ contact sheet: ${rel(join(uscita, "contact-sheet.png"))}`);
}
const manifestoLarghezzaLogo = (logo) => Math.max(...logo.filter((e) => e.file.endsWith(".webp")).map((e) => e.larghezza));

main().catch((e) => {
  console.error(`✘ ${e.message}`);
  process.exit(1);
});

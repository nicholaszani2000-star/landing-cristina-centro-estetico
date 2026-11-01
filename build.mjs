// build.mjs PROVVISORIO (Step 0).
// Crea soltanto dist/index.html con una pagina minima «in costruzione».
// Lo Step 1 lo sostituisce con il motore di template vero (CLAUDE.md §4).
// Nessuna dipendenza: solo moduli integrati di Node.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = dirname(fileURLToPath(import.meta.url));
const dist = join(radice, "dist");

const pagina = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Migliore – Estetica Avanzata — in costruzione</title>
</head>
<body>
<main>
<h1>Migliore – Estetica Avanzata — in costruzione</h1>
</main>
</body>
</html>
`;

try {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, "index.html"), pagina, "utf8");
  console.log("build provvisoria: dist/index.html creato");
} catch (errore) {
  console.error("build fallita:", errore.message);
  process.exit(1);
}

// netlify/functions/diagnostica.mjs — POST /api/diagnostica: segnalazioni tecniche anonime dal browser.
//
// Serve a sapere, senza accesso ai pannelli di Meta e Google, se gli script partono davvero dopo il consenso:
//   - consenso.js, solo dopo «Accetta» (o la singola voce in «Personalizza»), segnala come è andato il caricamento:
//     meta-avviato, meta-non-avviato, meta-bloccato, ga4-caricato, ga4-bloccato; 5 secondi dopo l'avvio di Meta,
//     meta-inviato (il PageView è partito verso www.facebook.com/tr) o meta-non-inviato;
//   - il browser manda qui i rapporti della Content-Security-Policy (report-uri in netlify.toml).
// Ogni segnalazione diventa una riga nei log della funzione (Netlify → Logs → Functions).
// Nessun dato personale: niente IP, user agent, email o identificativi; delle pagine solo il percorso (mai i
// parametri come utm_ o fbclid), degli indirizzi bloccati solo origine e percorso. Risponde 204, senza cache.
// Nell'anteprima locale (studio/anteprima.mjs) le righe finiscono in memoria (contesto.segnalazioni), non nel log.

export const config = {
  path: "/api/diagnostica",
  method: ["POST"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
};

export const EVENTI = new Set(["meta-avviato", "meta-non-avviato", "meta-bloccato", "meta-inviato", "meta-non-inviato", "ga4-caricato", "ga4-bloccato"]);
const MAX_CORPO = 8_000;
const VUOTA = (stato, extra = {}) => new Response(null, { status: stato, headers: { "Cache-Control": "no-store", ...extra } });

/** Solo il percorso di una pagina (mai parametri), con caratteri sicuri per il log. */
export function percorso(valore) {
  try {
    return new URL(String(valore ?? ""), "https://sito.invalid").pathname.replace(/[^\w/.-]/g, "").slice(0, 80) || "/";
  } catch {
    return "?";
  }
}

/** Indirizzo bloccato da un rapporto CSP: origine e percorso; le parole chiave (inline, eval, data…) così come sono. */
export function bloccato(valore) {
  const v = String(valore ?? "");
  if (/^[a-z-]{1,20}$/i.test(v)) return v;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return u.protocol.replace(/[^\w-]/g, "");
    return (u.origin + u.pathname).replace(/[^\w/.:-]/g, "").slice(0, 120);
  } catch {
    return "?";
  }
}

/** Dettaglio di meta-inviato / meta-non-inviato: le richieste verso Meta come «host/percorso:tipo», solo quelle con
 *  la forma attesa (domini di Meta, niente parametri), al massimo 10. Tutto il resto si scarta. */
export function richieste(valore) {
  if (typeof valore !== "string" || !valore) return "";
  const voci = valore.split(" ").filter((v) => /^(connect|www)\.facebook\.(net|com)\/[\w/.-]{0,120}:[a-z]{1,20}$/.test(v)).slice(0, 10);
  return voci.length ? ` [${voci.join(" ")}]` : "";
}

/** La riga di log per una segnalazione, oppure null se non è una segnalazione riconosciuta. */
export function riga(dati) {
  const csp = dati?.["csp-report"];
  if (csp && typeof csp === "object") {
    const direttiva = String(csp["effective-directive"] ?? csp["violated-directive"] ?? "?").split(" ")[0].replace(/[^\w-]/g, "").slice(0, 40) || "?";
    return `diagnostica: csp ${direttiva} ${bloccato(csp["blocked-uri"])} su ${percorso(csp["document-uri"])}`;
  }
  if (typeof dati?.evento === "string" && EVENTI.has(dati.evento)) return `diagnostica: ${dati.evento} su ${percorso(dati.pagina)}${richieste(dati.dettaglio)}`;
  return null;
}

export default async (req, contesto) => {
  if (req.method !== "POST") return VUOTA(405, { Allow: "POST" });
  let dati;
  try {
    const testo = await req.text();
    if (testo.length > MAX_CORPO) return VUOTA(413);
    dati = JSON.parse(testo);
  } catch {
    return VUOTA(400);
  }
  const r = riga(dati);
  if (!r) return VUOTA(400);
  if (Array.isArray(contesto?.segnalazioni)) contesto.segnalazioni.push(r);
  else console.log(r);
  return VUOTA(204);
};

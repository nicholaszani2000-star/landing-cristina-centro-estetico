// consenso.js — banner cookie, consenso e tracciamenti (CLAUDE.md §10). La build lo include solo se in
// content/centro.json c'è l'ID di GA4 o del pixel Meta. Nessuno script di Google o Meta prima del consenso.
// Documentazione: Google Consent Mode (gtag consent default/update) e codice base del pixel Meta (init e PageView, caricato solo dopo il consenso).
(function () {
  "use strict";
  var d = document, radice = d.documentElement, banner = d.querySelector("[data-banner-cookie]");
  if (!banner) return;
  var CHIAVE = "migliore-consenso", VERSIONE = 1, DURATA = 182 * 864e5; // 182 giorni, poi si chiede di nuovo
  var ga4 = banner.getAttribute("data-ga4"), meta = banner.getAttribute("data-meta");
  var pannello = banner.querySelector(".banner-pannello"), personalizza = banner.querySelector('[data-consenso="personalizza"]');
  var caricati = { ga4: false, meta: false };
  // Nome dell'evento per GA4 e per Meta
  var EVENTI = { chiama: ["clic_chiama", "Contact"], whatsapp: ["clic_whatsapp", "Contact"], Lead: ["generate_lead", "Lead"] };

  function leggi() {
    try {
      var s = JSON.parse(localStorage.getItem(CHIAVE));
      if (s && s.v === VERSIONE && Date.now() - s.t < DURATA) return s;
    } catch (e) { /* archiviazione non disponibile: si chiede di nuovo */ }
    return null;
  }
  function salva(s) {
    try { localStorage.setItem(CHIAVE, JSON.stringify({ v: VERSIONE, t: Date.now(), statistiche: s.statistiche, marketing: s.marketing })); } catch (e) { /* niente */ }
  }
  // Diagnostica anonima (netlify/functions/diagnostica.mjs): solo dopo il consenso, dice se lo script è partito o
  // se il browser l'ha bloccato. Nessun dato personale: il nome dell'esito e il percorso della pagina.
  function segnala(esito, dettaglio) {
    try {
      navigator.sendBeacon("/api/diagnostica", new Blob([JSON.stringify({ evento: esito, pagina: location.pathname, dettaglio: dettaglio })], { type: "text/plain;charset=UTF-8" }));
    } catch (e) { /* niente */ }
  }
  // 5 secondi dopo l'avvio: il PageView è uscito dal browser verso www.facebook.com/tr? (Resource Timing del browser:
  // c'è la richiesta anche se la risposta non si può leggere). Se no, un blocco l'ha fermato dopo lo script.
  // Nel dettaglio, le richieste verso Meta (solo host e percorso, mai i parametri).
  function inviatoAMeta() {
    var voci = [], fb = [], inviato = false;
    try { voci = performance.getEntriesByType("resource"); } catch (e) { /* niente */ }
    for (var i = 0; i < voci.length; i++) {
      if (!/^https:\/\/(connect|www)\.facebook\.(net|com)\//.test(voci[i].name)) continue;
      fb.push(voci[i].name.split("?")[0].replace("https://", "") + ":" + (voci[i].initiatorType || "?"));
      if (/^https:\/\/www\.facebook\.com\/tr\b/.test(voci[i].name)) inviato = true;
    }
    segnala(inviato ? "meta-inviato" : "meta-non-inviato", fb.slice(0, 10).join(" "));
  }
  function script(src, nome, avviato) {
    var s = d.createElement("script");
    s.async = true;
    s.src = src;
    s.onerror = function () { segnala(nome + "-bloccato"); };
    s.onload = function () {
      segnala(avviato ? nome + (avviato() ? "-avviato" : "-non-avviato") : nome + "-caricato");
      if (nome === "meta") setTimeout(inviatoAMeta, 5000);
    };
    d.head.appendChild(s);
  }

  function caricaGa4() {
    if (!ga4 || caricati.ga4) return;
    caricati.ga4 = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", ga4);
    script("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga4), "ga4");
  }
  function caricaMeta() {
    if (!meta || caricati.meta) return;
    caricati.meta = true;
    var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
    if (!window._fbq) window._fbq = f;
    f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
    // fbevents.js, quando parte, mette callMethod sul suo fbq: se manca, lo script è arrivato ma non è partito.
    script("https://connect.facebook.net/en_US/fbevents.js", "meta", function () { return typeof f.callMethod === "function"; });
    // Come il codice base di Meta (init e PageView). Il consenso c'è già: questo script parte solo dopo «Accetta»
    // o «Marketing». Uno o più pixel: PageView, Contact e Lead vanno a tutti.
    meta.split(",").forEach(function (id) { f("init", id); });
    f("track", "PageView");
  }
  function applica(s) {
    if (s.statistiche) caricaGa4();
    if (s.marketing) caricaMeta();
  }

  function mostra(si) {
    banner.hidden = !si;
    radice.classList.toggle("banner-aperto", si);
    radice.style.setProperty("--spazio-banner", si ? banner.offsetHeight + "px" : "0px");
  }
  function apriPannello() {
    var s = leggi() || {};
    banner.querySelectorAll("[data-categoria]").forEach(function (c) { c.checked = s[c.getAttribute("data-categoria")] === true; });
    pannello.hidden = false;
    personalizza.setAttribute("aria-expanded", "true");
    mostra(true);
    pannello.querySelector("[tabindex]").focus();
  }
  function decidi(s) {
    var prima = leggi();
    salva(s);
    // Uno script già caricato non si può togliere: se il consenso si ritira, si ricarica la pagina senza.
    if (prima && ((prima.statistiche && !s.statistiche) || (prima.marketing && !s.marketing))) return location.reload();
    pannello.hidden = true;
    personalizza.setAttribute("aria-expanded", "false");
    mostra(false);
    applica(s);
  }
  function scelta(categoria) {
    var c = banner.querySelector('[data-categoria="' + categoria + '"]');
    return Boolean(c && c.checked);
  }

  banner.addEventListener("click", function (e) {
    var b = e.target.closest("[data-consenso]");
    if (!b) return;
    var azione = b.getAttribute("data-consenso");
    if (azione === "accetta") decidi({ statistiche: Boolean(ga4), marketing: Boolean(meta) });
    else if (azione === "rifiuta" || azione === "chiudi") decidi({ statistiche: false, marketing: false });
    else if (azione === "personalizza") apriPannello();
    else if (azione === "salva") decidi({ statistiche: scelta("statistiche"), marketing: scelta("marketing") });
  });

  // Tocchi su «Chiama» e WhatsApp; il codice sconto chiama window.migliore.traccia("Lead", { evento_id }).
  window.migliore = window.migliore || {};
  window.migliore.traccia = function (evento, dati) {
    var nomi = EVENTI[evento], id = dati && dati.evento_id;
    if (!nomi) return;
    if (caricati.ga4 && window.gtag) window.gtag("event", nomi[0], id ? { event_id: id } : {});
    if (caricati.meta && window.fbq) window.fbq("track", nomi[1], {}, id ? { eventID: id } : undefined);
  };
  d.addEventListener("click", function (e) {
    if (e.target.closest("[data-preferenze-cookie]")) return apriPannello();
    var a = e.target.closest("a[href]"), h = a ? a.getAttribute("href") : "";
    if (h.indexOf("tel:") === 0) window.migliore.traccia("chiama");
    else if (h.indexOf("https://wa.me/") === 0) window.migliore.traccia("whatsapp");
  });

  var s = leggi();
  if (s) applica(s);
  else mostra(true);
})();

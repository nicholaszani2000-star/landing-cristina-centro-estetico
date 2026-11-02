// codice.js: modulo codice sconto (§8). Senza JS risponde la funzione, in HTML.
(function () {
  "use strict";
  var d = document;
  function $(r, x) { return r.querySelector("[data-codice-" + x + "]"); }
  var f = $(d, "modulo");
  if (!f || !window.fetch) return;
  var el = f.elements, area = $(d, "risultato"), generico = $(d, "generico"), invia = f.querySelector("[type=submit]"),
    q = new URLSearchParams(location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) { if (q.get(k)) el[k].value = q.get(k).slice(0, 200); });
  el.pagina.value = location.pathname;
  f.noValidate = true;

  function errore(campo, si) {
    d.getElementById("codice-errore-" + campo).hidden = !si;
    el[campo].setAttribute("aria-invalid", si);
  }
  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }
  function mostra(r) {
    var c = $(d, "modello").content.cloneNode(true), s = $(c, "scadenza"), b = $(c, "copia");
    $(c, "valore").textContent = r.codice;
    s.textContent = s.textContent.replace("[data]", new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(r.scadenza + "T00:00:00Z")));
    $(c, "email").hidden = r.emailInviata !== true;
    if (navigator.clipboard) b.addEventListener("click", function () {
      navigator.clipboard.writeText(r.codice).then(function () { b.textContent = b.getAttribute("data-copiato"); });
    });
    else b.hidden = true;
    area.textContent = "";
    area.appendChild(c);
    f.hidden = true;
    area.querySelector("[tabindex]").focus();
  }

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = el.email.value.trim(), okEmail = email.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email), okConsenso = el.consenso.checked, dati = {};
    errore("email", !okEmail);
    errore("consenso", !okConsenso);
    generico.hidden = true;
    if (!okEmail || !okConsenso) return (okEmail ? el.consenso : el.email).focus();
    el.evento_id.value = uuid();
    new FormData(f).forEach(function (v, k) { dati[k] = v; });
    dati.consenso = true;
    invia.disabled = true;
    fetch(f.action, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(dati) })
      .then(function (r) { return r.json().then(function (j) { j.ok = r.ok; return j; }); })
      .then(function (j) {
        var m = window.migliore;
        if (j.ok && j.codice) {
          mostra(j);
          if (m && m.traccia) m.traccia("Lead", { evento_id: dati.evento_id });
        } else if (j.errore === "email" || j.errore === "consenso") {
          errore(j.errore, true);
          el[j.errore].focus();
        } else throw j;
      })
      .catch(function () { generico.hidden = false; })
      .then(function () { invia.disabled = false; });
  });
})();

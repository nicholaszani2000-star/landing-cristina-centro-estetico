// main.js — barra contatti mobile, comparse all'ingresso nello schermo e anno nel footer (CLAUDE.md §5, §6).
// Nessuna dipendenza. Senza JavaScript la pagina è già tutta visibile.
(function () {
  "use strict";
  var doc = document;
  var radice = doc.documentElement;

  // Anno corrente nel footer: il build scrive il suo anno in data-anno.
  var anno = String(new Date().getFullYear());
  doc.querySelectorAll("[data-anno]").forEach(function (el) {
    var annoBuild = el.getAttribute("data-anno");
    if (annoBuild && annoBuild !== anno) el.textContent = el.textContent.replace(annoBuild, anno);
  });

  // Barra contatti mobile: nascosta mentre i pulsanti dell'apertura sono visibili.
  // Senza IntersectionObserver resta sempre visibile; senza JS il CSS la lascia visibile.
  var barra = doc.querySelector("[data-barra-contatti]");
  var pulsantiApertura = doc.querySelector("[data-pulsanti-apertura]");
  if (barra) {
    if (pulsantiApertura && "IntersectionObserver" in window) {
      new IntersectionObserver(function (voci) {
        barra.classList.toggle("visibile", !voci[voci.length - 1].isIntersecting);
      }).observe(pulsantiApertura);
    } else {
      barra.classList.add("visibile");
    }
    radice.classList.add("barra-attiva");
  }

  // Comparse: solo se il movimento non è ridotto e c'è IntersectionObserver.
  var elementi = doc.querySelectorAll(".appare");
  if (!elementi.length) return;
  var ridotto = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (ridotto || !("IntersectionObserver" in window)) {
    elementi.forEach(function (el) { el.classList.add("visibile"); });
    return;
  }
  var sfasamento = parseFloat(getComputedStyle(radice).getPropertyValue("--sfasamento")) || 0;
  radice.classList.add("comparse-attive");
  var osservatore = new IntersectionObserver(function (voci) {
    var n = 0;
    voci.forEach(function (voce) {
      if (!voce.isIntersecting) return;
      voce.target.style.transitionDelay = n++ * sfasamento + "ms";
      voce.target.classList.add("visibile");
      osservatore.unobserve(voce.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  elementi.forEach(function (el) { osservatore.observe(el); });
})();

/* Bouton « Enregistrer en PDF » des documents (contrat, facture, page de
   signature). Script externe : la Content-Security-Policy du serveur interdit
   les scripts inline et les attributs onclick. */
(function () {
  "use strict";

  function printDocument() {
    window.print();
  }

  function init() {
    document.querySelectorAll("[data-print]").forEach((el) => {
      if (el.dataset.printBound) return;
      el.dataset.printBound = "1";
      el.addEventListener("click", printDocument);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.__docPrint = { init, print: printDocument };
})();
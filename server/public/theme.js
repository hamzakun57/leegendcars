/* Thème du back-office : sombre par défaut, clair sur simple demande.
   Chargé dans <head> pour poser le thème AVANT le premier rendu : sinon la page
   apparaît sombre une fraction de seconde puis « clignote » en clair. */
(function () {
  var CLE = "lc_theme";
  var racine = document.documentElement;

  function lire() {
    try {
      return localStorage.getItem(CLE) === "clair" ? "clair" : "sombre";
    } catch (e) {
      /* navigation privée ou cookies bloqués : on garde le défaut sombre */
      return "sombre";
    }
  }

  function appliquer(t) {
    if (t === "clair") racine.setAttribute("data-theme", "light");
    else racine.removeAttribute("data-theme");
  }

  appliquer(lire());

  /* Un seul écouteur sur le document : le bouton peut être ajouté plus tard par
     une autre partie de la page sans qu'on ait à rebrancher quoi que ce soit. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-theme-toggle]");
    if (!b) return;
    var suivant = lire() === "clair" ? "sombre" : "clair";
    try {
      localStorage.setItem(CLE, suivant);
    } catch (err) {
      /* sans stockage, le thème ne sera pas mémorisé — on bascule quand même */
    }
    appliquer(suivant);
    maj(b);
  });

  function maj(bouton) {
    var clair = lire() === "clair";
    bouton.setAttribute("aria-pressed", String(clair));
    bouton.setAttribute("title", clair ? "Passer en thème sombre" : "Passer en thème clair");
    bouton.setAttribute("aria-label", bouton.getAttribute("title"));
    var icone = bouton.querySelector("[data-icone]");
    var texte = bouton.querySelector("[data-texte]");
    if (icone) icone.textContent = clair ? "☀" : "☾";
    if (texte) texte.textContent = clair ? "Clair" : "Sombre";
  }

  window.lcTheme = {
    actuel: lire,
    basculer: function () {
      var suivant = lire() === "clair" ? "sombre" : "clair";
      try { localStorage.setItem(CLE, suivant); } catch (e) {}
      appliquer(suivant);
      return suivant;
    },
    maj: maj,
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-theme-toggle]").forEach(maj);
  });
})();
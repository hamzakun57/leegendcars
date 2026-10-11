/**
 * Configuration du back-office.
 *
 * Les mêmes réglages que le site public (assets/js/data.js), lus sans charger
 * tout le catalogue : le back-office n'a besoin que de l'adresse du projet et
 * de la clé publique.
 *
 * Rappel : cette clé est publique par nature. Elle n'accorde aucun droit ; ce
 * sont les règles d'accès de la base (supabase/policies.sql) qui décident de
 * ce qu'un visiteur peut lire ou écrire. La clé « service_role » ne doit
 * jamais apparaître dans un fichier servi au navigateur.
 */
(function () {
  "use strict";
  window.LCAdminConfig = {
    supabaseUrl: "https://dqygspzmndcsbkxeiulm.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxeWdzcHptbmRjc2JreGVpdWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NTkyODEsImV4cCI6MjEwNzIzNTI4MX0.2Xw305r5GJtBn85tnVPFs8MCLgJuiPLK9gnSSmu2pZI",
    /* « supabase » : le navigateur interroge Supabase (Netlify).
       « api »      : un serveur Express répond (fonctionnement en local). */
    source: "supabase",
  };
})();

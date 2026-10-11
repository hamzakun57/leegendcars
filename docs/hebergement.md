# ============================================================================
# Leegend Cars — hébergement
# ============================================================================
# Le site est désormais « client-first » :
#
#   Netlify          sert les fichiers (site public + back-office)
#   Supabase Auth    authentifie l'administrateur
#   Supabase Postgres  les données
#   Supabase Storage   les fichiers (photos, CIN, contrats)
#   Supabase Edge Functions  ce qui doit rester côté serveur :
#                     envoi de fichiers, contrat, facture, signature à distance
#
# Le serveur Express (dossier server/) est conservé et fonctionne toujours :
# il sert au développement local et sert de filet si un hébergeur Node est
# préféré. L'interface choisit son chemin toute seule, sans changer d'écran.
#
# ---------------------------------------------------------------------------
# 1. Préparer la base
# ---------------------------------------------------------------------------
#   npm run db:setup      # tables + règles d'accès + fonctions SQL
#   npm run db:setup      # idempotent : relançable sans risque
#
# 2. Compte administrateur
# ---------------------------------------------------------------------------
#   node scripts/create-admin.mjs leegend.cars099@gmail.com
#   → affiche un mot de passe généré, affiché une seule fois
#
# 3. Construire les fichiers statiques
# ---------------------------------------------------------------------------
#   npm run build
#   Produit : vendor/supabase.bundle.js, admin-assets/, admin/index.html,
#   admin/login.html et les gabarits de documents pour les Edge Functions.
#   Les pages d'administration sont générées depuis server/views.js : il n'y a
#   donc qu'une seule version de l'écran.
#
# 4. Déployer les Edge Functions
# ---------------------------------------------------------------------------
#   npm install -g supabase
#   supabase login
#   supabase link --project-ref dqygspzmndcsbkxeiulm
#   supabase functions deploy upload
#   supabase functions deploy document
#   supabase functions deploy signature
#
# 5. Déployer le site sur Netlify
# ---------------------------------------------------------------------------
#   git push          # Netlify déclenche « npm run build » automatiquement
#
# Aucune variable d'environnement n'est nécessaire chez Netlify : la seule
# clé présente dans le navigateur est la clé publique « anon », et elle ne
# donne aucun droit — les règles d'accès (supabase/policies.sql) décident de
# tout. La clé « service_role » reste exclusivement dans les Edge Functions,
# où Supabase la fournit automatiquement.
#
# ---------------------------------------------------------------------------
# Où va quoi
# ---------------------------------------------------------------------------
# | Élément            | Stockage                                  |
# |--------------------|-------------------------------------------|
# | Flotte             | table vehicles                            |
# | Réservations       | table reservations (+ payments, attachments)|
# | Clients            | table clients                             |
# | Maintenance        | table maintenance                         |
# | Photos, CIN, PDF   | bucket Storage « uploads »                 |
# | Connexion admin    | Supabase Auth + table admin_accounts       |
# | Contrats, factures | Edge Function « document »                 |
# | Signature          | Edge Function « signature »                |
#
# ---------------------------------------------------------------------------
# Sécurité en place
# ---------------------------------------------------------------------------
# - RLS activée sur toutes les tables, sans policy pour le rôle « anon ».
# - Un visiteur ne peut que lire la flotte active et envoyer une demande.
# - Un déclencheur force toute demande entrante à « nouvelle » : ni statut,
#   ni numéro de facture, ni encaissement, ni signature ne peuvent être
#   usurpés, même avec la clé publique.
# - Un compte connecté non administrateur n'accède à rien de plus.
# - Les Edge Functions exigent un administrateur authentifié, sauf la
#   signature, protégée par un jeton de 24 octets aléatoires.
# - Les fichiers sont validés sur leur signature binaire, jamais sur leur
#   nom : un script renommé en .jpg est refusé.
#
# ---------------------------------------------------------------------------
# Vérifier que tout va bien
# ---------------------------------------------------------------------------
#   npm test        # 238 contrôles sur les 9 suites
#
# Chaque suite est autonome et nettoie ce qu'elle a créé.
#
# ---------------------------------------------------------------------------
# Répartition des modes
# ---------------------------------------------------------------------------
# assets/js/data.js       CFG.source : « supabase » ou « api »
# server/public/admin-config.js   idem pour le back-office
#
# « auto » utilise Supabase s'il est configuré, le serveur sinon.
#
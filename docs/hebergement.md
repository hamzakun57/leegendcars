# Hébergement — Supabase (données) + Node Express (application)

Le site ne peut pas être hébergé sur Netlify : Netlify ne sert que des fichiers
statiques, or l'application a besoin d'un serveur Express pour `/admin`,
`/api/*`, les contrats et les pièces jointes.

## Où va quoi

| Donnée | Stockage | Pourquoi |
|---|---|---|
| Réservations, clients, véhicules | Supabase PostgreSQL | Survit aux redémarrages et aux déploiements |
| Photos de véhicules, CIN, permis, contrats | Supabase Storage (`uploads`) | Idem, 1 Go offerts |
| Session administrateur | Cookie signé + table `users` | — |
| PDF contrat / facture | Générés à la volée en HTML | Le navigateur imprime : aucun Chromium à héberger |

Supabase ne sert pas le code Node : il faut **en plus** un hébergeur qui exécute
`npm start`. C'est Render dans la configuration ci-dessous.

## 1. Base et stockage (déjà fait une fois)

```bash
npm run db:setup      # crée les tables + le bucket « uploads »
npm run migrate:sqlite   # importe l'ancien fichier SQLite (une seule fois)
```

`db:setup` est idempotent : on peut le relancer sans risque.

## 2. Variables d'environnement

Le fichier `.env` (ignoré par Git) sert en local ; les mêmes variables se
déclarent chez l'hébergeur. Les 4 valeurs viennent du dashboard Supabase.

| Variable | Origine |
|---|---|
| `DATABASE_URL` | Project Settings › Database › Connection string › **URI** (mode *Session pooler*) |
| `SUPABASE_URL` | Project Settings › API › **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings › API › **service_role** |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

`NODE_ENV=production` et `HOST=0.0.0.0` sont ajoutés par `render.yaml`.

⚠️ `SESSION_SECRET` doit être **identique** entre les environnements, sinon les
sessions ouvertes d'un côté ne sont pas reconnues de l'autre. Ne jamais le
versionner ni le coller dans un chat.

## 3. Mise en ligne sur Render

1. Pousser le dépôt sur GitHub.
2. Render → **New** → **Blueprint** → choisir le dépôt.
3. Renseigner `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (`sync: false` = Render les demandera). `SESSION_SECRET` est généré.
4. Déployer. Premier démarrage lent (build + import de la flotte si vide).

Le plan gratuit s'endort après 15 min d'inactivité ; la première visite attend
environ 50 s. Les données ne sont pas perdues pour autant : elles vivent dans
Supabase.

## 4. Après la mise en ligne

- Vérifier `https://<sous-domaine>/api/vehicles` → la flotte s'affiche.
- Créer le compte admin sur `/admin` (page de premier lancement).
- Brancher le domaine : dans Render, `Settings` → `Custom Domains`.
- Supabase → `Authentication` → `URL Configuration` → ajouter l'URL publique
  dans *Site URL* et *Redirect URLs*.

## Sécurité en place

- RLS activée sur toutes les tables, sans policy : la clé `anon` ne peut lire
  aucune donnée via l'API Supabase ; seul le serveur (rôle `postgres`) y accède.
- Bucket `uploads` privé ; les fichiers sont servis par une route Express.
- `/server/*`, `/.env`, `/node_modules/*` bloqués par le serveur.
- CSP stricte, `X-Frame-Options`, cookies `httpOnly` + `sameSite=strict`.

## Si le bucket est mal configuré

L'application bascule sur le disque local (`STORAGE_MODE=local`) quand
`SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` manquent : le site fonctionne,
mais les fichiers uploaded disparaissent au redémarrage. La ligne
`Stockage  Supabase Storage` au démarrage du serveur indique le mode actif.
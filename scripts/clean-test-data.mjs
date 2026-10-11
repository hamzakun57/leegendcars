/* Nettoyage des résidus laissés par des exécutions de test interrompues :
   véhicules « essai-* », suivis, comptes de test et dossiers de démonstration.
   Ne touche jamais « admin » ni les données de l'agence. */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const etapes = [
  ["suivis orphelins", "delete from maintenance where vehicle_slug in (select slug from vehicles where slug like 'essai-%' or name like 'Essai %' or name like 'Adaptateur %' or name like 'Types %')"],
  ["dossiers de test", "delete from reservations where created_by like 'test\\_%' or last_name like 'Public %' or last_name like 'Agent %' or created_by like 'mnt\\_%' or last_name like 'Comparaison %' or ref like 'EDGE-%' or ref like 'SONDE-%' or first_name in ('Edge','Navigateur','Sonde')"],
  ["clients de test", "delete from clients where last_name like 'Test%' or last_name in ('Nouveau client','Faux','Types')"],
  ["véhicules de test", "delete from vehicles where slug like 'essai-%' or name like 'Essai %' or name like 'Adaptateur %' or name like 'Types %'"],
  ["comptes de test", "delete from users where username like 'test\\_%' or username like 'mnt\\_%' or username like 'verif\\_%' or username like 'adapter\\_%' or username like 'types\\_%' or username like 'netlify\\_%'"],
  ["compteurs de test", "delete from counters where name like 'contract'"],
];

for (const [nom, sql] of etapes) {
  const r = await pool.query(sql);
  if (r.rowCount) console.log(`${nom.padEnd(20)} ${r.rowCount} ligne(s)`);
}

for (const t of ["users", "vehicles", "clients", "reservations", "payments", "attachments", "maintenance", "counters"]) {
  const { rows } = await pool.query(`select count(*)::int as n from ${t}`);
  console.log(`  ${t.padEnd(15)} ${rows[0].n}`);
}
await pool.end();
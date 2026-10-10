/* Verifie que chaque photo referencee en base est bien servie par le serveur. */
import pg from "pg";

const B = process.env.TEST_URL || "http://127.0.0.1:3199";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const v = await (await fetch(`${B}/api/vehicles`)).json();
let ko = 0, total = 0;
for (const veh of v.vehicles) {
  console.log(`${veh.slug} : ${veh.gallery.length} photo(s) exposee(s) par l'API`);
  for (const p of veh.gallery) {
    total++;
    const r = await fetch(`${B}/${p}`);
    if (r.status !== 200) ko++;
    console.log(`   ${r.status === 200 ? "OK     " : "CASSÉ  "} /${p} (${r.status}, ${r.headers.get("content-type")})`);
  }
}
const pieces = await pool.query("select stored_name from attachments");
for (const a of pieces.rows) {
  total++;
  const r = await fetch(`${B}/uploads/reservations/${a.stored_name}`);
  if (r.status !== 200) ko++;
  console.log(`   ${r.status === 200 ? "OK     " : "CASSÉ  "} piece ${a.stored_name} (${r.status})`);
}
console.log(`\n${total - ko}/${total} fichiers servis correctement`);
await pool.end();
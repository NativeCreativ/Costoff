/**
 * Clears ALL application data from the database while preserving schema, tables,
 * foreign keys, and Prisma migration history. Never touches `_prisma_migrations`
 * or any Prisma migration file, and never drops/alters any table.
 *
 * Usage (run from the project root):
 *   node scripts/reset-db-data.mjs
 *
 * Requires DATABASE_URL to be set (reads it from process.env, loaded from .env
 * via `node --env-file=.env` on Node 20.6+, or export it manually beforehand).
 * Refuses to run unless DATABASE_URL points at localhost/127.0.0.1, as a guard
 * against accidentally targeting a non-local database.
 */
import pg from 'pg';

const APPLICATION_TABLES = [
  'candidates',
  'client_contacts',
  'clients',
  'demand_assignments',
  'demand_interview_config',
  'demand_interview_rounds',
  'demand_status_events',
  'demand_ta_allocations',
  'demands',
  'dropdown_masters',
  'interviews',
  'offers',
  'onboardings',
  'profiles',
  'submission_events',
  'submissions',
  'super_admin_settings',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    console.error(`Refusing to run: DATABASE_URL host is "${url.hostname}", not localhost/127.0.0.1.`);
    console.error('This script only runs against a local database, as a safety guard.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  console.log(`Connected to ${url.hostname}:${url.port || 5432}${url.pathname}`);
  console.log(`Clearing ${APPLICATION_TABLES.length} application tables (CASCADE, no identity reset — all PKs are UUIDs)...\n`);

  // Capture the structure fingerprint first so we can prove afterwards that the
  // reset changed DATA only — no table dropped, no FK removed, no migration lost.
  const before = await snapshotStructure(client);
  const beforeNames = before.tableNames.join(',');
  console.log(
    `Before: ${before.tableCount} tables, ${before.fkCount} foreign keys, ` +
    `${before.migrationCount} applied migrations.\n`
  );

  const quoted = APPLICATION_TABLES.map((t) => `"${t}"`).join(', ');
  await client.query(`TRUNCATE TABLE ${quoted} CASCADE;`);

  console.log('Verifying row counts...\n');
  console.log('Table'.padEnd(30) + 'Row Count');
  console.log('-'.repeat(40));
  let allZero = true;
  for (const t of APPLICATION_TABLES) {
    const r = await client.query(`SELECT COUNT(*)::int AS count FROM "${t}"`);
    const count = r.rows[0].count;
    if (count !== 0) allZero = false;
    console.log(t.padEnd(30) + count);
  }
  console.log('-'.repeat(40));
  console.log(allZero ? 'All application tables: 0 rows confirmed.' : 'WARNING: some tables are not empty — see above.');

  console.log('\nVerifying structure was preserved...\n');
  const after = await snapshotStructure(client);
  const afterNames = after.tableNames.join(',');
  const checks = [
    ['tables still present',      after.tableCount === before.tableCount,    `${after.tableCount} (was ${before.tableCount})`],
    ['no table dropped/added',    afterNames === beforeNames,                afterNames === beforeNames ? 'identical set of ' + after.tableCount : 'SET CHANGED: ' + afterNames],
    ['foreign keys intact',       after.fkCount === before.fkCount,          `${after.fkCount} (was ${before.fkCount})`],
    ['migration history intact',  after.migrationCount === before.migrationCount, `${after.migrationCount} (was ${before.migrationCount})`],
  ];
  console.log('Check'.padEnd(28) + 'Result');
  console.log('-'.repeat(58));
  let structureOk = true;
  for (const [name, ok, detail] of checks) {
    if (!ok) structureOk = false;
    console.log(name.padEnd(28) + (ok ? 'OK  ' : 'FAIL') + '  ' + detail);
  }

  await client.end();
  if (!allZero || !structureOk) process.exit(1);
  console.log('\nReset complete: data cleared, schema and migrations preserved.');
}

/** Counts of everything that must NOT change: tables, foreign keys, migrations. */
async function snapshotStructure(client) {
  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const fks = await client.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'`
  );
  const migrations = await client.query(`SELECT COUNT(*)::int AS n FROM "_prisma_migrations"`);
  return {
    tableCount: tables.rows.length,
    tableNames: tables.rows.map((r) => r.tablename),
    fkCount: fks.rows[0].n,
    migrationCount: migrations.rows[0].n,
  };
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});

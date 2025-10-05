import { sql } from 'drizzle-orm';
import { db } from './src/db';
import * as fs from 'fs';

async function migrate() {
  const migration = fs.readFileSync('./drizzle/0002_legal_madame_hydra.sql', 'utf-8');

  console.log('Running migration...');
  await db.execute(sql.raw(migration));
  console.log('Migration complete!');

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

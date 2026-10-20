import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  // Every table, so drizzle-kit never sees a real table as unknown (it would offer to drop it).
  schema: ['./src/db/schema.ts', './src/db/lift-schema.ts', './src/db/performance-schema.ts', './src/db/health-schema.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

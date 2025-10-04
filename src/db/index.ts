import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Neon serverless HTTP client - optimized for serverless environments
export const sql = neon(connectionString);
export const db = drizzle(sql, { schema });

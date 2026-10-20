-- No-op. 0010-0012 were hand-written SQL without drizzle snapshots; this migration only records the
-- snapshot (meta/0013_snapshot.json) so drizzle-kit sees the real schema. Everything here is already applied.
SELECT 1;

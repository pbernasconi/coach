# Sync contract

How the Lift iPhone app and the coach web app (this repository's Next.js app) exchange data. Both sides
implement exactly this; change it here first.

## Model

- The iPhone is the source of writes. Every local write appends an outbox entry (`OutboxEntry`: entity,
  rowID, op, full-row JSON payload, idempotency key, createdAt).
- The server stores the latest version of every row and a monotonically increasing sequence number per
  stored change. Last writer wins per row, decided by the row's `updatedAt`.
- Deletes are soft: a deleted row is a normal row whose `deletedAt` is set. Nothing is hard-deleted.

## Auth

Every request carries `Authorization: Bearer <token>`. The token is a long random secret configured on the
server as `LIFT_SYNC_TOKEN` and stored on the iPhone in the Keychain. Wrong or missing token: `401`.

## Push

`POST /api/lift/sync/push`

```json
{
  "deviceId": "6F2C…",
  "changes": [
    {
      "idempotencyKey": "0A8B…",
      "entity": "exercise | session | sessionExercise | set | template | templateExercise",
      "rowId": "UUID",
      "op": "insert | update | delete",
      "payload": { "id": "UUID", "updatedAt": "2026-10-15T07:30:00.000Z", "deletedAt": null, "…": "…" }
    }
  ]
}
```

- Entities: `exercise`, `session`, `sessionExercise` and `set` (the logged work), and `template` and
  `templateExercise` (day templates such as "Upper A" and their ordered exercise slots: library exercise id, set
  count, `repMin`/`repMax`, optional `weightValue`/`weightUnit`, `restSeconds` and `kind`). A
  `templateExercise` belongs to a `template` through `templateID`; a `session` names the template it was planned
  from in `templateID`.
- At most 500 changes per request.
- `payload` is the outbox entry's JSON object as written by LiftStore (column names as keys, UUIDs as
  strings, dates as ISO 8601 with milliseconds and `Z`).
- The server applies each change in order. A change whose `idempotencyKey` was already applied is accepted
  again without effect. A change older than the stored row (by `updatedAt`) is accepted but does not
  overwrite.

Server clarifications (added with the server implementation; the client contract above is unchanged):

- Dates: LiftStore's `OutboxPayload` stores GRDB text (`2026-10-15 07:30:00.000`, UTC, no zone). LiftSync
  converts that text to ISO 8601 with `Z` before it pushes. The server accepts both forms, plus ISO
  offsets, for `updatedAt` and `deletedAt`. It stores the payload verbatim, so a pull returns whatever
  form was pushed. ISO 8601 with `Z` is still the wire format.
- UUIDs are compared case-insensitively. `payload.id` must equal `rowId`. Pulled `rowId`s are lower case,
  and payloads keep the case they were pushed with.
- A tie on `updatedAt` keeps the stored row: only a strictly newer row overwrites.
- The whole request fails with `400` if the body isn't JSON, if `deviceId` is missing, if there are more
  than 500 changes, or if any change lacks a UUID `idempotencyKey`. Any other problem with a single change
  goes in `rejected` with a reason (`invalid entity`, `invalid op`, `invalid rowId`, `invalid payload`,
  `payload.id missing or invalid`, `payload.id does not match rowId`, `payload.updatedAt missing or
  invalid`, `payload.deletedAt invalid`, `payload too large` (over 64 KB), `payload has text Postgres cannot
  store` (U+0000 or an unpaired surrogate in a key or string; Postgres `jsonb` refuses them, and a 500 would
  keep the entry in the outbox for ever, blocking every change behind it)).

Client clarifications (found by the end-to-end suite; the wire format is unchanged):

- Stamps cross between the database and the wire as text (`2026-10-15 07:30:00.191` ⇄ `2026-10-15T07:30:00.191Z`),
  never through `Date`, so every millisecond survives. Going through `Date` used to send about half of all stamps
  one millisecond early, so no two devices held identical rows.
- An edit's `updatedAt` is now, or one millisecond past the row's current `updatedAt` when this device's clock is
  not ahead of it. An edit made after pulling a version therefore always beats that version, even when the other
  device's clock runs ahead; before, the server dropped such an edit as older while the editing device kept it.

Response `200`:

```json
{ "accepted": ["0A8B…"], "rejected": [{ "idempotencyKey": "…", "reason": "invalid entity" }] }
```

The iPhone removes accepted and rejected entries from its outbox (rejected ones are logged; retrying an
invalid change cannot succeed). Network errors and `5xx` keep the entries for the next attempt.

## Pull

`GET /api/lift/sync/pull?cursor=<string>&limit=<1…500>`

- `cursor` is opaque to the client; omit it for a full pull.
- `limit` defaults to 500. A malformed `cursor` or `limit` gets `400`. When there is nothing new, the
  response repeats the cursor it was given (`"0"` for a full pull of an empty server).

Response `200`:

```json
{
  "changes": [{ "entity": "session", "rowId": "UUID", "payload": { "…": "…" } }],
  "cursor": "1287",
  "hasMore": false
}
```

- `changes` are in sequence order and include rows this device pushed (the client applies them
  idempotently by `updatedAt`).
- The client stores `cursor` and repeats while `hasMore` is true.

## Client schedule

Push then pull: on launch, when the app returns to the foreground, after a local write (debounced by a few
seconds), and on a manual "Sync now" in Settings. Logging never waits for the network.

## End-to-end test (local)

`lift/scripts/sync-e2e.sh` proves the contract with the real pieces and nothing deployed: it starts a throwaway
Postgres, applies `drizzle/0009_lift_sync.sql`, runs this app's server against it (`next dev`, with
`DATABASE_DRIVER=pg` so `src/db` uses node-postgres instead of Neon's HTTP driver, and a `LIFT_SYNC_TOKEN` generated
for the run), runs the curl smoke test from `DEFERRED.md`, then the opt-in LiftKit suites, and tears everything down.

```bash
export PATH=<swift toolchain>/usr/bin:$PATH   # swift 6.2; Postgres 14+ server binaries, node, openssl, curl
lift/scripts/sync-e2e.sh                       # --keep leaves Postgres and the server running
```

The suites live in `LiftKit/Tests/LiftSyncTests/EndToEnd`. Each phone is the real `LiftStore` on a temporary
on-disk database with the real `SyncEngine` and `URLSessionSyncTransport` (FoundationNetworking on Linux). They are
skipped unless `LIFT_SYNC_E2E_URL` is set (plus `LIFT_SYNC_E2E_TOKEN`), so a plain `swift test` and CI never need a
server. `SyncEndToEndTests` covers: A pushes a workout with edits, a skip and a delete, and a fresh B pulls identical
rows; last-writer-wins by `updatedAt` both ways, including a device whose clock is behind and concurrent edits;
an idempotent re-push; 524 changes pushed as 500 + 24 and pulled in pages with `hasMore`, children arriving before
their parent; a wrong token (401, outbox kept); tombstones; templates (edited, reordered, a slot removed, renamed)
and a session planned from one; dates to the millisecond in ISO 8601 with `Z`.
`SyncOutageEndToEndTests` runs with Postgres stopped (the server answers 500; the outbox is kept) and again after it
is back (the same phone, reopened, drains its outbox and a fresh device pulls the rows).

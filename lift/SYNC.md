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
      "entity": "exercise | session | sessionExercise | set",
      "rowId": "UUID",
      "op": "insert | update | delete",
      "payload": { "id": "UUID", "updatedAt": "2026-10-15T07:30:00.000Z", "deletedAt": null, "…": "…" }
    }
  ]
}
```

- At most 500 changes per request.
- `payload` is the outbox entry's JSON object as written by LiftStore (column names as keys, UUIDs as
  strings, dates as ISO 8601 with milliseconds and `Z`).
- The server applies each change in order. A change whose `idempotencyKey` was already applied is accepted
  again without effect. A change older than the stored row (by `updatedAt`) is accepted but does not
  overwrite.

Response `200`:

```json
{ "accepted": ["0A8B…"], "rejected": [{ "idempotencyKey": "…", "reason": "invalid entity" }] }
```

The iPhone removes accepted and rejected entries from its outbox (rejected ones are logged; retrying an
invalid change cannot succeed). Network errors and `5xx` keep the entries for the next attempt.

## Pull

`GET /api/lift/sync/pull?cursor=<string>&limit=<1…500>`

- `cursor` is opaque to the client; omit it for a full pull.

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

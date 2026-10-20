import Foundation
import LiftCore
import LiftStore
import LiftSync

// Seeds Lift templates (DayTemplate + slots) on Coach's sync server from a JSON file, through LiftStore's
// repositories (so each row has an outbox entry) and LiftSync's SyncEngine. The iPhone pulls them on its next sync.
//
//   swift run LiftSeed --templates templates.json --db /tmp/lift-seed.sqlite                      # dry run
//   LIFT_SYNC_TOKEN=… swift run LiftSeed --templates templates.json --db /tmp/lift-seed.sqlite \
//       --push --server https://coach.paolobernasconi.com
//
// templates.json: [{ "name", "exercises": [{ "name", "sets", "reps": [lo, hi], "weight": { "value", "unit" } | null,
//   "rest": seconds | null, "note": text | null }] }]. Exercise names match the library (LiftCore's
// ExerciseMatcher); a name with no match becomes a new library exercise. It pulls first and skips a template whose
// name is already on the server, so a second run adds nothing.

struct TemplateFile: Decodable {
    struct Slot: Decodable {
        struct W: Decodable { let value: Double; let unit: String }
        let name: String
        let sets: Int
        let reps: [Int]
        let weight: W?
        let rest: Int?
        let note: String?
    }
    let name: String
    let exercises: [Slot]
}

struct Token: TokenProvider {
    let value: String
    func token() async throws -> String? { value }
}

let args = CommandLine.arguments
func value(_ name: String) -> String? {
    guard let i = args.firstIndex(of: name), args.indices.contains(i + 1) else { return nil }
    return args[i + 1]
}
func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}
func first<Value>(_ stream: AsyncStream<Value>) async -> Value? {
    for await value in stream { return value }
    return nil
}

guard let path = value("--templates"), let dbPath = value("--db") else {
    fail("usage: LiftSeed --templates templates.json --db file.sqlite [--push --server https://…]  (token in LIFT_SYNC_TOKEN)")
}
let push = args.contains("--push")
let wanted = try JSONDecoder().decode([TemplateFile].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
let database = try LiftDatabase.onDisk(at: URL(fileURLWithPath: dbPath))
let now: @Sendable () -> Date = { Date() }
let makeID: @Sendable () -> UUID = { UUID() }
let exercises = LiveExerciseRepository(database: database, now: now, makeID: makeID)
let templates = LiveTemplateRepository(database: database, now: now, makeID: makeID)
_ = try await exercises.installLibrary()

var engine: SyncEngine?
if push {
    guard let server = value("--server").flatMap(URL.init(string:)),
        let token = ProcessInfo.processInfo.environment["LIFT_SYNC_TOKEN"], !token.isEmpty
    else { fail("--push needs --server https://… and LIFT_SYNC_TOKEN") }
    let sync = SyncEngine(
        outbox: LiveOutboxRepository(database: database),
        state: LiveSyncStateRepository(database: database, makeID: makeID),
        transport: URLSessionSyncTransport(session: .shared, baseURL: server, tokens: Token(value: token)),
        now: now,
        clock: ContinuousClock()
    )
    engine = sync
    print("pull first:", await sync.syncNow())
}

let existing = Set((await first(templates.observeTemplates()) ?? []).map { $0.name.lowercased() })
var made = 0
for template in wanted {
    if existing.contains(template.name.lowercased()) {
        print("skip (already in Lift): \(template.name)")
        continue
    }
    var library = await first(exercises.observeExercises()) ?? []
    var lines: [String] = []
    var resolved: [(TemplateFile.Slot, Exercise, Bool)] = []
    for slot in template.exercises {
        if let match = ExerciseMatcher.match(name: slot.name, in: library) {
            resolved.append((slot, match.exercise, false))
        } else if push {
            let new = try await exercises.create(name: slot.name, equipment: .other, loadMode: .total, primary: [], secondary: [])
            library.append(new)
            resolved.append((slot, new, true))
        } else {
            lines.append("    + new exercise: \(slot.name)")
            continue
        }
        let w = slot.weight.map { " @ \($0.value) \($0.unit)" } ?? ""
        lines.append("    \(slot.sets) × \(slot.reps.map(String.init).joined(separator: "–"))\(w)  \(slot.name)\(resolved.last?.2 == true ? " (new)" : "")")
    }
    print("\(push ? "template" : "would make template"): \(template.name)")
    lines.forEach { print($0) }
    guard push else { continue }
    let record = try await templates.createTemplate(name: template.name)
    for (slot, exercise, _) in resolved {
        var item = try await templates.addExercise(exercise, to: record.id)
        item.sets = slot.sets
        if let lo = slot.reps.first, let hi = slot.reps.last { item.repRange = min(lo, hi)...max(lo, hi) }
        item.weight = slot.weight.flatMap { w in WeightUnit(rawValue: w.unit).map { Weight(w.value, $0) } }
        item.restSeconds = slot.rest ?? item.restSeconds
        item.note = slot.note
        _ = try await templates.updateExercise(item)
    }
    made += 1
}

if let engine {
    print("templates made: \(made)")
    print("push:", await engine.syncNow())
}

import Foundation
import LiftCore
import LiftStore
import LiftSync

// Writes to Lift from the Mac through Lift's own repositories (every row gets an outbox entry) and sync engine, so the
// iPhone gets the rows on its next sync. It always starts from a full pull into `--db`, so use a new file each run.
//
//   swift run LiftSeed --db /tmp/lift.sqlite --templates templates.json [--replace]          # dry run
//   swift run LiftSeed --db /tmp/lift.sqlite --plan plan.json --out planned.json --push --server https://…
//
// --templates: [{ "name", "exercises": [{ "name", "sets", "reps": [lo, hi], "weight": { "value", "unit" } | null,
//   "rest": seconds | null, "note": text | null }] }]. Exercise names match the library (LiftCore's ExerciseMatcher);
//   a name with no match becomes a new library exercise ("equipment" and "load" in the slot set its kind). A template
//   whose name is already in Lift is skipped, or with --replace gets these slots in place of its own (same template id).
// --plan: [{ "key", "day": "YYYY-MM-DD", "template": name, "sessionId": uuid | null, "remove": bool }]. Without a live
//   session it plans one from the template (LiveWorkoutPlanRepository: targets from the template and progression).
//   A session with a logged set, or one that was started, is never changed. Otherwise the session moves to `day` and
//   its sets are planned again from the template (fresh progression), or it is removed with "remove".
//   --out writes every session as planned: exercises, sets, targets and anything logged.

struct TemplateFile: Decodable {
    struct Slot: Decodable {
        struct W: Decodable { let value: Double; let unit: String }
        let name: String
        let sets: Int
        let reps: [Int]
        let weight: W?
        let rest: Int?
        let note: String?
        let equipment: String?
        let load: String?
    }
    let name: String
    let exercises: [Slot]
}

struct PlanEntry: Decodable {
    let key: String
    let day: String
    let template: String?
    let sessionId: String?
    let remove: Bool?
}

struct PlannedSet: Encodable {
    let kind: String
    let reps: Int?
    let repMin: Int?
    let repMax: Int?
    let weight: Double?
    let unit: String
    let status: String
    let actualReps: Int?
    let actualWeight: Double?
}

struct PlannedExercise: Encodable {
    let name: String
    let loadMode: String
    let restSeconds: Int?
    let note: String?
    let sets: [PlannedSet]
}

struct PlannedSession: Encodable {
    let key: String
    let status: String
    let sessionId: String?
    let day: String?
    let title: String?
    let exercises: [PlannedExercise]
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
func log(_ message: String) {
    FileHandle.standardError.write(Data((message + "\n").utf8))
}
func first<Value>(_ stream: AsyncStream<Value>) async -> Value? {
    for await value in stream { return value }
    return nil
}
func localDay(_ text: String) -> LocalDay? {
    let parts = text.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return LocalDay(year: parts[0], month: parts[1], day: parts[2])
}
func loadMode(_ text: String?) -> LoadMode {
    switch text {
    case "hand": .perHand
    case "side": .perSide
    case "bw": .bodyweight(added: nil)
    default: .total
    }
}
func loadName(_ mode: LoadMode) -> String {
    switch mode {
    case .total: "total"
    case .perHand: "perHand"
    case .perSide: "perSide"
    case .bodyweight: "bodyweight"
    }
}
func dayText(_ day: LocalDay) -> String {
    String(format: "%04d-%02d-%02d", day.year, day.month, day.day)
}

guard let dbPath = value("--db") else {
    fail(
        "usage: LiftSeed --db new.sqlite [--templates t.json [--replace]] [--plan plan.json [--out out.json]] "
            + "[--push --server https://…]  (token in LIFT_SYNC_TOKEN)"
    )
}
let push = args.contains("--push")
let replace = args.contains("--replace")
let database = try LiftDatabase.onDisk(at: URL(fileURLWithPath: dbPath))
let now: @Sendable () -> Date = { Date() }
let makeID: @Sendable () -> UUID = { UUID() }
let exercises = LiveExerciseRepository(database: database, now: now, makeID: makeID)
let templates = LiveTemplateRepository(database: database, now: now, makeID: makeID)
let sessions = LiveSessionRepository(database: database, now: now, makeID: makeID)
let plans = LiveWorkoutPlanRepository(database: database, now: now, makeID: makeID)

// Pull first, so templates, the library and the history are the server's before anything is planned.
var engine: SyncEngine?
if let server = value("--server").flatMap(URL.init(string:)) {
    guard let token = ProcessInfo.processInfo.environment["LIFT_SYNC_TOKEN"], !token.isEmpty else {
        fail("--server needs LIFT_SYNC_TOKEN")
    }
    let sync = SyncEngine(
        outbox: LiveOutboxRepository(database: database),
        state: LiveSyncStateRepository(database: database, makeID: makeID),
        transport: URLSessionSyncTransport(session: .shared, baseURL: server, tokens: Token(value: token)),
        now: now,
        clock: ContinuousClock()
    )
    engine = sync
    log("pull: \(await sync.syncNow())")
} else if push {
    fail("--push needs --server https://…")
}
_ = try await exercises.installLibrary()

// MARK: - Templates

if let path = value("--templates") {
    let wanted = try JSONDecoder().decode([TemplateFile].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
    let existing = await first(templates.observeTemplates()) ?? []
    for template in wanted {
        let current = existing.first { $0.name.lowercased() == template.name.lowercased() }
        if current != nil, !replace {
            log("skip (already in Lift; --replace to change it): \(template.name)")
            continue
        }
        var library = await first(exercises.observeExercises()) ?? []
        var resolved: [(TemplateFile.Slot, Exercise)] = []
        log("\(current == nil ? "new" : "replace") template: \(template.name)")
        for slot in template.exercises {
            let exercise: Exercise
            if let match = ExerciseMatcher.match(name: slot.name, in: library) {
                exercise = match.exercise
            } else {
                let equipment = slot.equipment.flatMap(Equipment.init(rawValue:)) ?? .other
                let load = loadMode(slot.load)
                exercise = try await exercises.create(
                    name: slot.name, equipment: equipment, loadMode: load, primary: [], secondary: [])
                library.append(exercise)
                log("    + new exercise: \(slot.name) (\(equipment.rawValue), \(loadName(load)))")
            }
            resolved.append((slot, exercise))
            let w = slot.weight.map { " @ \($0.value) \($0.unit)" } ?? ""
            let reps = slot.reps.map(String.init).joined(separator: "–")
            log("    \(slot.sets) × \(reps)\(w)  \(slot.name) → \(exercise.name) [\(loadName(exercise.loadMode))]")
        }
        let id: UUID
        if let current {
            for old in current.exercises { try await templates.removeExercise(id: old.id) }
            id = current.id
        } else {
            id = try await templates.createTemplate(name: template.name).id
        }
        for (slot, exercise) in resolved {
            var item = try await templates.addExercise(exercise, to: id)
            item.sets = slot.sets
            if let lo = slot.reps.first, let hi = slot.reps.last { item.repRange = min(lo, hi)...max(lo, hi) }
            item.weight = slot.weight.flatMap { w in WeightUnit(rawValue: w.unit).map { Weight(w.value, $0) } }
            item.restSeconds = slot.rest ?? item.restSeconds
            item.note = slot.note
            _ = try await templates.updateExercise(item)
        }
    }
}

// MARK: - Sessions

func detail(_ id: UUID) async -> SessionDetail? {
    await first(sessions.observeSession(id: id)) ?? nil
}

func planned(_ key: String, _ status: String, _ detail: SessionDetail?) -> PlannedSession {
    guard let detail else { return PlannedSession(key: key, status: status, sessionId: nil, day: nil, title: nil, exercises: []) }
    let items = detail.items.map { item in
        PlannedExercise(
            name: item.exercise.displayName,
            loadMode: loadName(item.exercise.loadMode),
            restSeconds: item.exercise.restSeconds,
            note: item.exercise.note,
            sets: item.sets.map { set in
                PlannedSet(
                    kind: set.kind.rawValue,
                    reps: set.target.reps,
                    repMin: set.target.repRange?.lowerBound,
                    repMax: set.target.repRange?.upperBound,
                    weight: set.target.weight?.converted(to: set.unit).value,
                    unit: set.unit.rawValue,
                    status: set.status.rawValue,
                    actualReps: set.actualReps,
                    actualWeight: set.actualWeight?.converted(to: set.unit).value
                )
            }
        )
    }
    return PlannedSession(
        key: key,
        status: status,
        sessionId: detail.session.id.uuidString.lowercased(),
        day: dayText(detail.session.day),
        title: detail.session.title,
        exercises: items
    )
}

var results: [PlannedSession] = []
if let path = value("--plan") {
    let entries = try JSONDecoder().decode([PlanEntry].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
    let liveTemplates = await first(templates.observeTemplates()) ?? []
    for entry in entries {
        guard let day = localDay(entry.day) else { fail("bad day \(entry.day) for \(entry.key)") }
        let existing = await entry.sessionId.flatMap(UUID.init(uuidString:)).asyncMap { await detail($0) } ?? nil
        let touched = existing.map { d in
            d.session.startedAt != nil || d.session.finishedAt != nil
                || d.items.contains { $0.sets.contains { $0.status != .planned } }
        } ?? false
        if let existing, touched {
            log("\(entry.day) \(existing.session.title): started or logged, not changed")
            results.append(planned(entry.key, "logged", existing))
            continue
        }
        if entry.remove == true {
            if let existing {
                _ = try await sessions.reschedule(existing.session.id, .remove)
                log("\(entry.day) \(existing.session.title): removed")
            }
            results.append(planned(entry.key, "removed", nil))
            continue
        }
        guard let name = entry.template,
            let template = liveTemplates.first(where: { $0.name.lowercased() == name.lowercased() })
        else { fail("no Lift template named \(entry.template ?? "(none)") for \(entry.key)") }
        if let existing {
            if existing.session.day != day { _ = try await sessions.reschedule(existing.session.id, .move(to: day)) }
            _ = try await plans.changeTemplate(of: existing.session.id, to: template.id)
            results.append(planned(entry.key, "refreshed", await detail(existing.session.id)))
        } else {
            let session = try await plans.createSession(from: template.id, on: day, unit: .lb)
            results.append(planned(entry.key, "created", await detail(session.id)))
        }
        if let last = results.last {
            log("\(entry.day) \(last.title ?? ""): \(last.status)")
            for e in last.exercises {
                let sets = e.sets.map { s in
                    let reps = s.reps.map(String.init) ?? [s.repMin, s.repMax].compactMap { $0.map(String.init) }.joined(separator: "–")
                    return s.weight.map { "\(reps)@\($0.formatted())" } ?? reps
                }
                log("    \(e.name): \(sets.joined(separator: ", "))")
            }
        }
    }
}

if let out = value("--out") {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(results).write(to: URL(fileURLWithPath: out))
}

if push, let engine {
    log("push: \(await engine.syncNow())")
} else {
    log("dry run: nothing pushed (add --push)")
}

extension Optional {
    func asyncMap<T>(_ transform: (Wrapped) async throws -> T) async rethrows -> T? {
        guard let self else { return nil }
        return try await transform(self)
    }
}

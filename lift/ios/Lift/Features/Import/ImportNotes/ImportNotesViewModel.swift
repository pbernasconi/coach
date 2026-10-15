import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class ImportNotesViewModel {
    private(set) var state: ImportNotesState

    private let request: ImportRequest
    private let sessions: any SessionRepository
    private let sets: any SetRepository
    private let exercises: any ExerciseRepository
    private let pasteboard: any TextPasteboard
    private let flow: any ImportFlowPresenting
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    private var importTask: Task<Void, Never>?

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        request: ImportRequest,
        sessions: any SessionRepository,
        sets: any SetRepository,
        exercises: any ExerciseRepository,
        pasteboard: any TextPasteboard,
        flow: any ImportFlowPresenting,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.request = request
        self.sessions = sessions
        self.sets = sets
        self.exercises = exercises
        self.pasteboard = pasteboard
        self.flow = flow
        self.now = now
        self.days = DayCalendar(calendar: calendar)
        self.state = ImportNotesState(text: request.text)
    }

    /// Reads the note at once when the request asks for it (`-open import`); otherwise waits for the paste step.
    func run() async {
        guard request.readsOnOpen, state.step == .paste(.editing), startReading() else { return }
        await read()
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: ImportNotesAction) -> Task<Void, Never>? {
        switch action {
        case .textChanged(let text):
            edit(text)
        case .pasteTapped:
            paste()
        case .continueTapped:
            return startReading() ? Task { await read() } : nil
        case .sessionToggled(let id):
            toggle(id)
        case .backTapped:
            if case .review = state.step { state.step = .paste(.editing) }
        case .importTapped:
            return startImport()
        case .stopTapped:
            stop()
        case .doneTapped, .exitTapped:
            importTask?.cancel()
            flow.dismissImport()
        }
        return nil
    }

    // MARK: - Paste and read

    /// Typing clears a failure banner.
    private func edit(_ text: String) {
        state.text = text
        if case .paste(.failed) = state.step { state.step = .paste(.editing) }
    }

    private func paste() {
        guard case .paste = state.step, state.step != .paste(.reading) else { return }
        guard let text = pasteboard.text(), !Self.isBlank(text) else {
            state.step = .paste(.failed(.clipboardEmpty))
            return
        }
        state.text = text
        state.step = .paste(.editing)
    }

    /// Moves the paste step to reading before any Task starts, so a double tap reads once. False when it is
    /// already reading, or there is nothing to read (which shows the empty-text failure).
    private func startReading() -> Bool {
        guard case .paste(let phase) = state.step, phase != .reading else { return false }
        guard !Self.isBlank(state.text) else {
            state.step = .paste(.failed(.emptyText))
            return false
        }
        state.step = .paste(.reading)
        return true
    }

    /// Parses the note against the library, then marks workouts that already exist on their day.
    private func read() async {
        let text = state.text
        let library = await Self.first(exercises.observeExercises()) ?? []
        let result = NotesImporter.parse(
            text,
            reference: now(),
            calendar: days.calendar,
            library: library,
            makeID: ImportReviewBuilder.localIDs()
        )
        guard let range = ImportReviewBuilder.dayRange(of: result) else {
            state.step = .paste(.failed(.nothingParsed))
            return
        }
        let existing = await Self.first(sessions.observeSessions(from: range.lowerBound, through: range.upperBound))
        let keys = (existing ?? []).map { ImportReviewBuilder.SessionKey(day: $0.session.day, title: $0.session.title) }
        state.step = .review(ImportReviewBuilder.review(of: result, existing: keys, days: days))
    }

    // MARK: - Review and import

    private func toggle(_ id: UUID) {
        guard case .review(var review) = state.step else { return }
        review.toggle(id)
        state.step = .review(review)
    }

    private func startImport() -> Task<Void, Never>? {
        guard importTask == nil, case .review(let review) = state.step else { return nil }
        let plan = review.included.map(\.session)
        guard !plan.isEmpty else { return nil }
        state.step = .importing(ImportProgress(sessionTotal: plan.count, setTotal: review.includedSetCount))
        let task = Task { await write(plan) }
        importTask = task
        return task
    }

    private func write(_ plan: [Session]) async {
        let writer = ImportWriter(
            sessions: sessions,
            sets: sets,
            exercises: exercises,
            calendar: days.calendar
        ) { [weak self] tally in
            guard let self, case .importing(var progress) = state.step else { return }
            progress.tally = tally
            state.step = .importing(progress)
        }
        let ending = await writer.write(plan)
        state.step = .outcome(ImportOutcome(ending: ending, tally: writer.tally, sessionTotal: plan.count))
        importTask = nil
    }

    private func stop() {
        guard case .importing(var progress) = state.step, !progress.isStopping else { return }
        progress.isStopping = true
        state.step = .importing(progress)
        importTask?.cancel()
    }

    // MARK: - Helpers

    private static func isBlank(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// The stream's current value: its first emission, or nil if it finishes without one.
    private static func first<Value>(_ stream: AsyncStream<Value>) async -> Value? {
        for await value in stream {
            return value
        }
        return nil
    }
}

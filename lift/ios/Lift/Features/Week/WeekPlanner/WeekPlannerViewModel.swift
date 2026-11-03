import Foundation
import LiftSync
import Observation

/// The planning screen (lift/APP-API.md, "Weekly planning"): Coach's draft of next week, what to tell it, and Accept.
/// The coach computes everything; this sends Paolo's answers and changes and shows what comes back.
@Observable
final class WeekPlannerViewModel {
    private(set) var state = WeekPlannerState()

    @ObservationIgnored private var resource: AppResource<PlannerWeek>
    private let data: any AppDataSource
    private let clock: any Clock<Duration>
    /// The week of the load in flight ("" for the coach's default): a load for another week still starts.
    @ObservationIgnored private var loadingWeek: String?
    @ObservationIgnored private var isPolling = false
    @ObservationIgnored private var answersFilled = false

    /// How often the screen asks while Coach drafts, and for how many rounds (a draft takes 1 to 3 minutes).
    static let pollEvery = Duration.seconds(10)
    static let pollRounds = 36

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        data: any AppDataSource,
        clock: any Clock<Duration>,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.data = data
        self.clock = clock
        self.resource = AppResource(
            path: PlannerWeek.path,
            source: data,
            now: now,
            days: DayCalendar(calendar: calendar)
        )
    }

    /// Started by the Screen's `.task`; cancelled when the view goes away (SCR-4).
    func run() async {
        await load()
        await poll()
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: WeekPlannerAction) -> Task<Void, Never>? {
        switch action {
        case .stepChanged, .nextTapped, .backTapped, .weekPicked: return navigate(action)
        case .retryTapped:
            state.week.content = .loading
            return Task { await load() }
        case .refreshPulled: return Task { await load() }
        case .sessionTapped(let index): state.destination = .session(index)
        case .acceptTapped:
            guard state.isProposed else { return nil }
            if state.step == .review { return sendWrite(.acceptConfirmed) }
            state.step = .review
        case .destinationDismissed: state.destination = nil
        case .feelTapped, .hoursChanged, .liftsPicked, .hardPicked, .longDayPicked, .dayModePicked, .anythingChanged,
            .noteChanged:
            answer(action)
        default: return sendWrite(action)
        }
        return nil
    }

    /// Moves between the steps, Draft and Review closed until there is a draft; or opens another week.
    private func navigate(_ action: WeekPlannerAction) -> Task<Void, Never>? {
        if case .weekPicked(let monday) = action { return pickWeek(monday) }
        let target: WeekPlannerState.Step? =
            switch action {
            case .stepChanged(let step): step
            case .nextTapped: state.step.next
            case .backTapped: state.step.previous
            default: nil
            }
        if let target, state.isOpen(target) { state.step = target }
        return nil
    }

    /// The Last week and Shape controls, and the note box.
    private func answer(_ action: WeekPlannerAction) {
        switch action {
        case .feelTapped(let feel): state.answers.feel = state.answers.feel == feel ? nil : feel
        case .hoursChanged(let hours): state.answers.hours = hours
        case .liftsPicked(let lifts): state.answers.gym = lifts
        case .hardPicked(let hard): state.answers.hard = hard
        case .longDayPicked(let day): state.answers.longDay = day
        case .dayModePicked(let day, let mode): state.answers = state.answers.with(day, as: mode)
        case .anythingChanged(let text): state.answers.lock = text
        case .noteChanged(let text): state.note = text
        default: break
        }
    }

    /// The actions that change the draft on the coach.
    private func sendWrite(_ action: WeekPlannerAction) -> Task<Void, Never>? {
        guard let week = state.loaded else { return nil }
        let id = week.proposalId ?? ""
        switch action {
        case .draftTapped:
            state.step = .draft
            return write(.draft(week.weekStart, state.answers))
        case .noteSent:
            let note = state.note.trimmingCharacters(in: .whitespacesAndNewlines)
            guard state.isProposed, !note.isEmpty else { return nil }
            state.note = ""
            return write(.revise(id, note))
        case .quickAskTapped(let note): return state.isProposed ? write(.revise(id, note)) : nil
        case .swapTapped:
            guard let session = state.openSession else { return nil }
            return write(.revise(id, String(localized: "Swap \(session.title) for something else")))
        case .undoTapped: return write(.undo(id))
        case .acceptConfirmed: return write(.accept(id))
        default: return sendEdit(action, id: id)
        }
    }

    /// Move, length and remove for the open session.
    private func sendEdit(_ action: WeekPlannerAction, id: String) -> Task<Void, Never>? {
        guard let session = state.openSession else { return nil }
        switch action {
        case .slotPicked(let slot):
            return write(.edit(id, .init(kind: "move", index: session.index, date: slot.date, time: slot.time)))
        case .lengthChanged(let minutes):
            return write(.edit(id, .init(kind: "length", index: session.index, minutes: minutes)))
        case .removeTapped:
            return write(.edit(id, .init(kind: "remove", index: session.index)))
        default: return nil
        }
    }

    /// Sends one change; the answer is the week as it is now. A refusal says why on the screen.
    private func write(_ change: PlannerRequest) -> Task<Void, Never>? {
        guard !state.isWorking else { return nil }  // double tap guard
        state.write = .working
        // The answer is this week, not the coach's default (next week).
        var request = change
        request.weekStart = request.weekStart ?? state.loaded?.weekStart
        let data = data
        return Task {
            do {
                let body = try JSONEncoder().encode(request)
                let answer = try await data.put(PlannerWeek.path, body: body)
                await show(answer, after: request)
            } catch {
                let reason = String(describing: error)
                AppLog.sync.error("Planning \(request.action, privacy: .public) failed: \(reason, privacy: .public)")
                state.write = .failed(AppResource<PlannerWeek>.message(for: error))
            }
        }
    }

    /// The week from a write's answer (or a fresh read when the answer is not a week), then polling while Coach drafts.
    private func show(_ answer: Data, after request: PlannerRequest) async {
        if let week = await AppResource<PlannerWeek>.decode(answer) {
            state.week.content = .loaded(week)
            state.write = week.refusedText.map { .failed($0) } ?? .idle
            if request.action == "accept", week.refusedText == nil {
                state.acceptedNote = week.note ?? String(localized: "Week accepted")
                return
            }
        } else {
            state.write = .idle
            await load()
        }
        if request.op?.kind == "remove" || request.op?.kind == "move" { state.destination = nil }
        await poll()
    }

    /// Starts the controls at the open draft's answers, and on the Draft step when there is one, once.
    private func fillAnswers() {
        guard !answersFilled, let week = state.loaded else { return }
        answersFilled = true
        if let answers = week.answers {
            state.answers = answers
        } else {
            state.answers.away = week.suggested.away
        }
        if week.state == .drafting || week.state == .proposed { state.step = .draft }
    }

    /// Asks again every `pollEvery` while Coach drafts, up to `pollRounds` times.
    private func poll() async {
        guard !isPolling else { return }
        isPolling = true
        defer { isPolling = false }
        for _ in 0..<Self.pollRounds where state.isDrafting {
            do { try await clock.sleep(for: Self.pollEvery) } catch { return }
            await load()
        }
    }
}

extension WeekPlannerViewModel {
    /// One read of the shown week. A read that ends after Paolo picked another week is dropped.
    fileprivate func load() async {
        let query = resource.query
        let week = query.first?.value ?? ""
        guard loadingWeek != week else { return }
        loadingWeek = week
        defer { if loadingWeek == week { loadingWeek = nil } }
        let resource = resource
        await resource.load(current: state.week) { answer in
            if self.resource.query == query { state.week = answer }
        }
        if resource.query == query { fillAnswers() }
    }

    /// Opens another week: a fresh read, step 1, and that week's answers once it loads.
    fileprivate func pickWeek(_ monday: String) -> Task<Void, Never>? {
        guard monday != state.loaded?.weekStart, !state.isWorking else { return nil }
        resource.query = [URLQueryItem(name: "week", value: monday)]
        state = WeekPlannerState()
        answersFilled = false
        return Task {
            await load()
            await poll()
        }
    }
}

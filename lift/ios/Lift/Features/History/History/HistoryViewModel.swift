import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class HistoryViewModel {
    private(set) var state = HistoryState()

    private let sessions: any SessionRepository
    private let exercises: any ExerciseRepository
    private let router: any Navigating
    private let importFlow: any ImportFlowPresenting
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    private let volume: HistoryVolumeBuilder
    /// True when connected to the coach: a finished session opens the coach's read-only page instead of the workout.
    private let opensCoachSessions: Bool
    /// The latest sessions and library, which the Progress view is built from; `.loading` until the library is read.
    @ObservationIgnored private var details: [Session] = []
    @ObservationIgnored private var library: Loadable<[Exercise]> = .loading
    /// The week the muscle bars show; nil for this week.
    @ObservationIgnored private var selectedWeek: LocalDay?
    /// The finished sessions among the latest ones, by id.
    @ObservationIgnored private var finishedIDs: Set<UUID> = []

    /// Protocols only, no defaults, no work (SCR-3). `segment` is the view to open on (`-open progress`);
    /// `opensCoachSessions` sends finished sessions to the coach's page (`AppDataSource.isConnected`).
    init(
        sessions: any SessionRepository,
        exercises: any ExerciseRepository,
        router: any Navigating,
        importFlow: any ImportFlowPresenting,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        segment: HistorySegment,
        opensCoachSessions: Bool
    ) {
        self.sessions = sessions
        self.exercises = exercises
        self.router = router
        self.importFlow = importFlow
        self.now = now
        let days = DayCalendar(calendar: calendar)
        self.days = days
        self.volume = HistoryVolumeBuilder(days: days)
        self.opensCoachSessions = opensCoachSessions
        state.segment = segment
    }

    /// Observes the last `HistoryState.weekCount` weeks through today and the exercise library; started by the
    /// Screen's `.task` (SCR-4). A session counts as past once its day has gone by, or as soon as a set in it is
    /// logged. The library tells which muscles each exercise works, for the Progress view.
    func run() async {
        async let past: Void = observeSessions()
        async let muscles: Void = observeLibrary()
        _ = await (past, muscles)
    }

    @discardableResult
    func send(_ action: HistoryAction) -> Task<Void, Never>? {
        switch action {
        case .sessionTapped(let id):
            let isCoachPage = opensCoachSessions && finishedIDs.contains(id)
            router.open(isCoachPage ? LiftLinks.session(id.uuidString) : .workout(id))
        case .importTapped:
            importFlow.presentImport()
        case .segmentChanged(let segment):
            state.segment = segment
        case .volumeWeekSelected(let week):
            selectedWeek = week
            rebuildVolume()
        case .volumeTrendSelectionChanged(let date):
            guard let date, let week = volume.week(containing: date, today: today) else { return nil }
            selectedWeek = week
            rebuildVolume()
        case .muscleTapped(let muscle):
            state.muscleDetail = muscleDetail(muscle)
        case .muscleDetailDismissed:
            state.muscleDetail = nil
        }
        return nil
    }

    private func observeSessions() async {
        let today = today
        let first = days.weekStart(of: today).adding(days: -7 * (HistoryState.weekCount - 1))
        for await details in sessions.observeSessions(from: first, through: today) {
            let past = details.map { SessionSummary(detail: $0) }
                .filter { $0.day < today || $0.hasLoggedSets || $0.isDone }
            let weeks = group(past)
            state.weeks = weeks.isEmpty ? .empty : .loaded(weeks)
            self.details = details.map(\.domain)
            finishedIDs = Set(details.filter { $0.session.finishedAt != nil }.map(\.id))
            rebuildVolume()
        }
    }

    private func observeLibrary() async {
        for await library in exercises.observeExercises() {
            self.library = .loaded(library)
            rebuildVolume()
        }
    }

    /// The Progress view and any open muscle sheet, from the latest sessions and library.
    private func rebuildVolume() {
        guard case .loaded(let library) = library else { return }
        state.volume = volume.progress(sessions: details, library: library, selected: selectedWeek, today: today)
        if let open = state.muscleDetail { state.muscleDetail = muscleDetail(open.id) }
    }

    private func muscleDetail(_ muscle: Muscle) -> MuscleDetail? {
        guard case .loaded(let progress) = state.volume, case .loaded(let library) = library else { return nil }
        return volume.detail(for: muscle, week: progress.week.id, sessions: details, library: library, today: today)
    }

    private var today: LocalDay { days.day(of: now()) }

    /// Groups sessions (oldest first, as the repository returns them) into weeks, newest week and session first.
    private func group(_ past: [SessionSummary]) -> [HistoryWeek] {
        var weeks: [HistoryWeek] = []
        for summary in past.reversed() {
            let start = days.weekStart(of: summary.day)
            let session = HistorySession(summary: summary, dayTitle: days.shortTitle(of: summary.day))
            if weeks.last?.id == start {
                weeks[weeks.count - 1].sessions.append(session)
            } else {
                weeks.append(HistoryWeek(id: start, title: days.weekTitle(start: start), sessions: [session]))
            }
        }
        return weeks
    }
}

import Foundation
import LiftCore
import LiftStore

/// Every service the screens use, built once by `CompositionRoot` (DI-1, DI-2). Screens receive the pieces they
/// need through their ViewModel's `init`, never through `@Environment` (DI-4).
final class AppDependencies {
    let sessions: any SessionRepository
    let exercises: any ExerciseRepository
    let sets: any SetRepository
    /// The logged history of one exercise, for the exercise detail screen.
    let history: any ExerciseHistoryRepository
    let now: @Sendable () -> Date
    /// Drives countdowns such as the rest timer; tests and previews pass their own.
    let clock: any Clock<Duration>
    /// The rest countdown on the Lock Screen and in the Dynamic Island.
    let restActivity: any RestActivityController
    /// Downloads and caches the catalog's media (© Gym visual) from the pinned dataset commit.
    let mediaLoader: any ExerciseMediaLoader
    /// The bundled exercise catalog and its media.
    let catalog: any ExerciseCatalogProviding
    let calendar: Calendar
    let info: AppInfo
    /// The clipboard, for the import flow's Paste button.
    let pasteboard: any TextPasteboard
    /// The local changes waiting to be pushed; the sync coordinator watches its count.
    let outbox: any OutboxRepository
    /// Push and pull with the coach web app, or a stand-in that never syncs (demo data, or no server in this build).
    let sync: any Syncing
    /// Opens and closes Import from Notes, which the shell shows as a modal page above the tabs.
    let importFlow = ImportFlowPresenter()
    private var isPrepared = false

    init(
        sessions: any SessionRepository,
        exercises: any ExerciseRepository,
        sets: any SetRepository,
        history: any ExerciseHistoryRepository,
        now: @escaping @Sendable () -> Date,
        clock: any Clock<Duration>,
        restActivity: any RestActivityController,
        mediaLoader: any ExerciseMediaLoader,
        catalog: any ExerciseCatalogProviding,
        calendar: Calendar,
        info: AppInfo,
        pasteboard: any TextPasteboard,
        outbox: any OutboxRepository,
        sync: any Syncing
    ) {
        self.sessions = sessions
        self.exercises = exercises
        self.sets = sets
        self.history = history
        self.now = now
        self.clock = clock
        self.restActivity = restActivity
        self.mediaLoader = mediaLoader
        self.catalog = catalog
        self.calendar = calendar
        self.info = info
        self.pasteboard = pasteboard
        self.outbox = outbox
        self.sync = sync
    }

    /// Work that finishes before the tabs show: the seed exercise library on this iPhone, or the fabricated demo
    /// sessions in demo mode. Runs once; a failure is logged and the app opens with what the database holds. A rest
    /// Live Activity left over from a previous launch is ended first.
    func prepare() async {
        guard !isPrepared else { return }
        isPrepared = true
        restActivity.end()
        do {
            switch info.dataSource {
            case .device:
                _ = try await exercises.installLibrary()
            case .demo:
                let seeder = DemoSeeder(exercises: exercises, sessions: sessions, sets: sets)
                try await seeder.seed(today: LocalDay(now(), calendar: calendar))
            }
        } catch {
            AppLog.launch.error("Preparing data failed: \(String(describing: error), privacy: .private)")
        }
    }

    /// The first session from today on that still has planned sets (or else the first one), for `-open workout`.
    func upcomingSessionID() async -> UUID? {
        let today = LocalDay(now(), calendar: calendar)
        for await details in sessions.observeSessions(from: today, through: today.adding(days: 14)) {
            let open = details.first { detail in detail.items.contains { $0.sets.contains { $0.status == .planned } } }
            return (open ?? details.first)?.id
        }
        return nil
    }
}

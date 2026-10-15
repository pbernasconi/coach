import Foundation
import LiftCore
import LiftStore

/// Every service the screens use, built once by `CompositionRoot` (DI-1, DI-2). Screens receive the pieces they
/// need through their ViewModel's `init`, never through `@Environment` (DI-4).
final class AppDependencies {
    let sessions: any SessionRepository
    let exercises: any ExerciseRepository
    let sets: any SetRepository
    let now: @Sendable () -> Date
    /// Drives countdowns such as the rest timer; tests and previews pass their own.
    let clock: any Clock<Duration>
    let calendar: Calendar
    let info: AppInfo
    private var isPrepared = false

    init(
        sessions: any SessionRepository,
        exercises: any ExerciseRepository,
        sets: any SetRepository,
        now: @escaping @Sendable () -> Date,
        clock: any Clock<Duration>,
        calendar: Calendar,
        info: AppInfo
    ) {
        self.sessions = sessions
        self.exercises = exercises
        self.sets = sets
        self.now = now
        self.clock = clock
        self.calendar = calendar
        self.info = info
    }

    /// Work that finishes before the tabs show: the seed exercise library on this iPhone, or the fabricated demo
    /// sessions in demo mode. Runs once; a failure is logged and the app opens with what the database holds.
    func prepare() async {
        guard !isPrepared else { return }
        isPrepared = true
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

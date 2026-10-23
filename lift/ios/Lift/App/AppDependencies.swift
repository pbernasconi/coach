import Foundation
import LiftCore
import LiftStore

/// Every service the screens use, built once by `CompositionRoot` (DI-1, DI-2). Screens receive the pieces they
/// need through their ViewModel's `init`, never through `@Environment` (DI-4).
final class AppDependencies {
    let sessions: any SessionRepository
    let exercises: any ExerciseRepository
    let sets: any SetRepository
    /// Day templates ("Upper A") and their exercise slots.
    let templates: any TemplateRepository
    /// Sessions planned from templates, with targets from progression.
    let plans: any WorkoutPlanRepository
    /// The logged history of one exercise, for the exercise detail screen.
    let history: any ExerciseHistoryRepository
    let now: @Sendable () -> Date
    /// Drives countdowns such as the rest timer; tests and previews pass their own.
    let clock: any Clock<Duration>
    /// The workout and its rest on the Lock Screen and in the Dynamic Island; the Live Activity's buttons reach it too.
    let workoutActivity: WorkoutActivityCenter
    /// The same, as the Workout screen drives it.
    var restActivity: any RestActivityController { workoutActivity }
    /// Downloads and caches the catalog's media (© Gym visual) from the pinned dataset commit.
    let mediaLoader: any ExerciseMediaLoader
    /// The bundled exercise catalog and its media.
    let catalog: any ExerciseCatalogProviding
    let calendar: Calendar
    /// The install's facts, with the weight unit as the person prefers it now.
    var info: AppInfo {
        var info = baseInfo
        info.unit = units.unit
        return info
    }
    /// The preferred weight unit; Settings changes it, and new sessions and templates read it when they are made.
    let units: any UnitPreference
    private let baseInfo: AppInfo
    /// The gym's bars, plates and collars; the Workout screen and planned barbell loads read it.
    let gym: any GymPreference
    /// Workout settings: the rest after each set, rest alerts, the screen and the Live Activity.
    let workoutPreferences: any WorkoutPreferenceStore
    /// The clipboard, for the import flow's Paste button.
    let pasteboard: any TextPasteboard
    /// The local changes waiting to be pushed; the sync coordinator watches its count.
    let outbox: any OutboxRepository
    /// Push and pull with the coach web app, or a stand-in that never syncs (demo data, or no server in this build).
    let sync: any Syncing
    /// Saves finished workouts to Apple Health, or a stand-in that never touches Health (demo and `-fresh` data).
    let health: any WorkoutHealthRecording
    /// The coach's full weekly plan for the Week screen, or a stand-in that is always off (lift/WEEK-API.md).
    let coachPlan: any CoachPlanProviding
    /// The coach's read-only pages (Today, Training, Lift; lift/APP-API.md), or a stand-in that is not connected.
    let appData: any AppDataSource
    /// The shell's selected tab, for screens that link to another tab (`TabSwitching`), and the screen a link or a
    /// tapped notice opens (`ScreenLinkOpening`).
    let tabs: TabSwitcher
    /// What the activity list knew about the activity being opened (`ActivitySeed`).
    let activitySeeds: any ActivitySeeding = ActivitySeeds()
    /// Opens and closes Import from Notes, which the shell shows as a modal page above the tabs.
    let importFlow: ImportFlowPresenter
    /// Opens, closes and undoes `lift://templates` links, which the shell shows as a sheet above the tabs.
    let templateLinks: TemplateLinkPresenter
    /// Routes `lift://` links: Import from Notes (and notes shared through the Share extension), template links, sync
    /// links and screen links (a tapped notice's too).
    let incomingNotes: IncomingNoteRouter
    /// Push notifications (lift/PUSH.md), or nil when this data never syncs (demo, `-fresh`, practice) or the build has
    /// no server.
    let push: PushNotifications?
    /// Turns practice mode on or off (Settings, and the practice banner's Turn off).
    let practice: any PracticeModeSwitching
    /// Fills the database with the fabricated demo sessions in `prepare()`: demo data, and new practice data.
    private let seedsDemo: Bool
    private var isPrepared = false

    init(
        sessions: any SessionRepository,
        exercises: any ExerciseRepository,
        sets: any SetRepository,
        templates: any TemplateRepository,
        plans: any WorkoutPlanRepository,
        history: any ExerciseHistoryRepository,
        now: @escaping @Sendable () -> Date,
        clock: any Clock<Duration>,
        workoutActivity: WorkoutActivityCenter,
        mediaLoader: any ExerciseMediaLoader,
        catalog: any ExerciseCatalogProviding,
        calendar: Calendar,
        info: AppInfo,
        units: any UnitPreference,
        gym: any GymPreference,
        workoutPreferences: any WorkoutPreferenceStore,
        pasteboard: any TextPasteboard,
        outbox: any OutboxRepository,
        sync: any Syncing,
        health: any WorkoutHealthRecording,
        coachPlan: any CoachPlanProviding,
        appData: any AppDataSource,
        push: PushNotifications?,
        seedsDemo: Bool,
        practice: any PracticeModeSwitching
    ) {
        self.sessions = sessions
        self.exercises = exercises
        self.sets = sets
        self.templates = templates
        self.plans = plans
        self.history = history
        self.now = now
        self.clock = clock
        self.workoutActivity = workoutActivity
        self.mediaLoader = mediaLoader
        self.catalog = catalog
        self.calendar = calendar
        self.baseInfo = info
        self.units = units
        self.gym = gym
        self.workoutPreferences = workoutPreferences
        self.pasteboard = pasteboard
        self.outbox = outbox
        self.sync = sync
        self.health = health
        self.coachPlan = coachPlan
        self.appData = appData
        self.push = push
        self.seedsDemo = seedsDemo
        self.practice = practice
        let importFlow = ImportFlowPresenter()
        self.importFlow = importFlow
        let templateLinks = TemplateLinkPresenter(templates: templates, exercises: exercises)
        self.templateLinks = templateLinks
        let tabs = TabSwitcher()
        self.tabs = tabs
        incomingNotes = IncomingNoteRouter(
            inbox: AppGroupNoteInbox(bundle: .main),
            importFlow: importFlow,
            templateLinks: templateLinks,
            syncLinks: SyncEnrollmentLink(sync: sync),
            screens: tabs
        )
    }

    /// Work that finishes before the tabs show: the seed exercise library on this iPhone (also in `-fresh` and in
    /// practice data made before), or the fabricated demo sessions in demo mode and in new practice data. Runs once; a
    /// failure is logged and the app opens with what the database holds. A workout Live Activity left from a previous
    /// launch is picked up first, or ended when its workout is over.
    func prepare() async {
        guard !isPrepared else { return }
        isPrepared = true
        workoutActivity.resume()
        do {
            if seedsDemo {
                let seeder = DemoSeeder(
                    exercises: exercises,
                    sessions: sessions,
                    sets: sets,
                    templates: templates,
                    plans: plans
                )
                try await seeder.seed(today: LocalDay(now(), calendar: calendar), calendar: calendar)
            } else {
                _ = try await exercises.installLibrary()
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

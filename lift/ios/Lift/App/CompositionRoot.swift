import Foundation
import LiftCore
import LiftStore

/// The only place that reads the wall clock, makes ids, opens the database and chooses between the on-disk
/// database and demo data (CONC-5, DI-2). Everything it builds reaches screens through `AppDependencies`.
enum CompositionRoot {
    /// The result of opening the app's data.
    enum Launch {
        case ready(AppDependencies)
        case failed
    }

    /// Opens `Application Support/lift.sqlite`, `lift-practice.sqlite` in practice mode, or an in-memory database for
    /// `-demo` and `-fresh`, and wires the live repositories.
    static func launch(source: AppInfo.DataSource, practice: any PracticeModeSwitching) -> Launch {
        do {
            var isNew = false
            if source == .practice {
                isNew = try !FileManager.default.fileExists(atPath: practiceFile().path)
            }
            let database = try openDatabase(source: source)
            let seedsDemo = source == .demo || isNew  // practice data is seeded once, when its file is made
            return .ready(dependencies(database: database, source: source, seedsDemo: seedsDemo, practice: practice))
        } catch {
            AppLog.launch.fault("Opening the database failed: \(String(describing: error), privacy: .private)")
            return .failed
        }
    }

    /// Deletes the practice database, so practice mode starts over with new sample workouts.
    static func removePracticeData() {
        guard let file = try? practiceFile() else { return }
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: file.path + suffix)  // a missing file is fine
        }
    }

    private static func openDatabase(source: AppInfo.DataSource) throws -> LiftDatabase {
        switch source {
        case .demo, .fresh: try LiftDatabase.inMemory()
        case .device: try LiftDatabase.onDisk(at: supportFolder().appending(path: "lift.sqlite"))
        case .practice: try LiftDatabase.onDisk(at: practiceFile())
        }
    }

    private static func practiceFile() throws -> URL {
        try supportFolder().appending(path: "lift-practice.sqlite")
    }

    private static func supportFolder() throws -> URL {
        try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
    }

    private static func dependencies(
        database: LiftDatabase,
        source: AppInfo.DataSource,
        seedsDemo: Bool,
        practice: any PracticeModeSwitching
    ) -> AppDependencies {
        let now: @Sendable () -> Date = { Date() }
        let makeID: @Sendable () -> UUID = { UUID() }
        let sessions = LiveSessionRepository(database: database, now: now, makeID: makeID)
        let mediaLoader = makeMediaLoader()
        let gym = gym(source: source)
        let sets = LiveSetRepository(database: database, now: now, makeID: makeID)
        let sync = makeSync(database: database, isSaved: source.isSaved, now: now, makeID: makeID)
        return AppDependencies(
            sessions: sessions,
            exercises: LiveExerciseRepository(database: database, now: now, makeID: makeID),
            sets: sets,
            templates: LiveTemplateRepository(database: database, now: now, makeID: makeID),
            plans: LiveWorkoutPlanRepository(database: database, now: now, makeID: makeID, gym: { gym.setup }),
            history: sessions,
            now: now,
            clock: ContinuousClock(),
            workoutActivity: WorkoutActivityCenter(
                sessions: sessions,
                sets: sets,
                presenter: LiveWorkoutActivityPresenter(),
                gym: gym,
                calendar: appCalendar,
                now: now
            ),
            mediaLoader: mediaLoader,
            catalog: LiveExerciseCatalog(loader: mediaLoader),
            calendar: appCalendar,
            info: info(source: source),
            units: units(source: source),
            gym: gym,
            pasteboard: SystemPasteboard(),
            outbox: LiveOutboxRepository(database: database),
            sync: sync,
            health: makeHealth(sessions: sessions, isSaved: source.isSaved),
            coachPlan: makeCoachPlan(source: source, sessions: sessions, sync: sync, now: now, calendar: appCalendar),
            seedsDemo: seedsDemo,
            practice: practice
        )
    }

    /// The catalog media loader: its own URLSession (never `.shared`) and the on-disk cache in Caches/ExerciseMedia.
    private static func makeMediaLoader() -> any ExerciseMediaLoader {
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = nil  // the loader keeps its own cache on disk
        configuration.timeoutIntervalForRequest = 20
        configuration.waitsForConnectivity = false
        let cache =
            (try? MediaDiskCache.inCaches(fileManager: .default))
            ?? MediaDiskCache(directory: FileManager.default.temporaryDirectory.appending(path: "ExerciseMedia"))
        return LiveExerciseMediaLoader(
            transport: URLSessionMediaTransport(session: URLSession(configuration: configuration)),
            cache: cache
        )
    }

    /// Apple Health for data kept on this iPhone; demo and `-fresh` data never touch it.
    private static func makeHealth(sessions: LiveSessionRepository, isSaved: Bool) -> any WorkoutHealthRecording {
        guard isSaved else { return DisabledHealthRecorder() }
        return HealthRecorder(
            store: LiveHealthWorkoutStore(),
            sessions: sessions,
            settings: UserDefaultsHealthSettings.standard()
        )
    }

    /// The saved unit preference on this iPhone (the locale's until one is picked); kg in memory for demo data, which is
    /// logged in kg. Practice mode starts from the saved unit, in memory, so changing it there leaves the saved one.
    private static func units(source: AppInfo.DataSource) -> any UnitPreference {
        switch source {
        case .device: UserDefaultsUnitSettings.standard(fallback: localUnit)
        case .practice: InMemoryUnitSettings(UserDefaultsUnitSettings.standard(fallback: localUnit).unit)
        case .demo, .fresh: InMemoryUnitSettings(.kg)
        }
    }

    /// The saved bars and plates on this iPhone (the defaults until changed); the defaults in memory for demo data, and
    /// a copy of the saved ones in memory in practice mode.
    private static func gym(source: AppInfo.DataSource) -> any GymPreference {
        switch source {
        case .device: UserDefaultsGymSettings.standard()
        case .practice: InMemoryGymSettings(UserDefaultsGymSettings.standard().setup)
        case .demo, .fresh: InMemoryGymSettings(.standard)
        }
    }

    /// The app's one calendar: the person's, following their locale and time zone, with weeks starting on Monday
    /// everywhere (the strip, the month calendar, History, weekly volume, "Plan next week").
    private static var appCalendar: Calendar {
        var calendar = Calendar.autoupdatingCurrent
        calendar.locale = .autoupdatingCurrent
        calendar.timeZone = .autoupdatingCurrent
        return calendar.startingWeeksOnMonday()
    }

    private static var localUnit: WeightUnit {
        Locale.autoupdatingCurrent.measurementSystem == .us ? .lb : .kg
    }

    private static func info(source: AppInfo.DataSource) -> AppInfo {
        let bundle = Bundle.main
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        return AppInfo(
            version: version ?? "0",
            build: build ?? "0",
            unit: source == .demo || source == .fresh ? .kg : localUnit,  // replaced by the `units` preference in AppDependencies.info
            dataSource: source
        )
    }
}

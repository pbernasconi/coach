import ActivityKit
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

    /// Opens `Application Support/lift.sqlite`, or an in-memory database for `-demo` and `-fresh`, and wires the live
    /// repositories.
    static func launch(options: LaunchOptions) -> Launch {
        do {
            let source = options.dataSource
            let database = try openDatabase(isSaved: source.isSaved)
            return .ready(dependencies(database: database, source: source))
        } catch {
            AppLog.launch.fault("Opening the database failed: \(String(describing: error), privacy: .private)")
            return .failed
        }
    }

    private static func openDatabase(isSaved: Bool) throws -> LiftDatabase {
        if !isSaved {
            return try LiftDatabase.inMemory()
        }
        let folder = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return try LiftDatabase.onDisk(at: folder.appending(path: "lift.sqlite"))
    }

    private static func dependencies(database: LiftDatabase, source: AppInfo.DataSource) -> AppDependencies {
        let now: @Sendable () -> Date = { Date() }
        let makeID: @Sendable () -> UUID = { UUID() }
        let sessions = LiveSessionRepository(database: database, now: now, makeID: makeID)
        let mediaLoader = makeMediaLoader()
        return AppDependencies(
            sessions: sessions,
            exercises: LiveExerciseRepository(database: database, now: now, makeID: makeID),
            sets: LiveSetRepository(database: database, now: now, makeID: makeID),
            templates: LiveTemplateRepository(database: database, now: now, makeID: makeID),
            plans: LiveWorkoutPlanRepository(database: database, now: now, makeID: makeID),
            history: sessions,
            now: now,
            clock: ContinuousClock(),
            restActivity: restActivity(),
            mediaLoader: mediaLoader,
            catalog: LiveExerciseCatalog(loader: mediaLoader),
            calendar: .autoupdatingCurrent,
            info: info(source: source),
            pasteboard: SystemPasteboard(),
            outbox: LiveOutboxRepository(database: database),
            sync: makeSync(database: database, isSaved: source.isSaved, now: now, makeID: makeID),
            health: makeHealth(sessions: sessions, isSaved: source.isSaved)
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

    /// The live ActivityKit rest countdown, or one that does nothing when Live Activities are off for Lift.
    private static func restActivity() -> any RestActivityController {
        ActivityAuthorizationInfo().areActivitiesEnabled
            ? LiveRestActivityController(store: AppGroupRestSnapshotStore(bundle: .main))
            : DisabledRestActivityController()
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

    private static func info(source: AppInfo.DataSource) -> AppInfo {
        let bundle = Bundle.main
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        let localUnit: WeightUnit = Locale.autoupdatingCurrent.measurementSystem == .us ? .lb : .kg
        return AppInfo(
            version: version ?? "0",
            build: build ?? "0",
            unit: source.isSaved ? localUnit : .kg,  // the demo data is logged in kg
            dataSource: source
        )
    }
}

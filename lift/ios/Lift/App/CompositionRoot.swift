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

    /// Opens `Application Support/lift.sqlite`, or an in-memory database for `-demo`, and wires the live repositories.
    static func launch(options: LaunchOptions) -> Launch {
        do {
            let database = try openDatabase(isDemo: options.isDemo)
            return .ready(dependencies(database: database, isDemo: options.isDemo))
        } catch {
            AppLog.launch.fault("Opening the database failed: \(String(describing: error), privacy: .private)")
            return .failed
        }
    }

    private static func openDatabase(isDemo: Bool) throws -> LiftDatabase {
        if isDemo {
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

    private static func dependencies(database: LiftDatabase, isDemo: Bool) -> AppDependencies {
        let now: @Sendable () -> Date = { Date() }
        let makeID: @Sendable () -> UUID = { UUID() }
        let sessions = LiveSessionRepository(database: database, now: now, makeID: makeID)
        let mediaLoader = mediaLoader()
        return AppDependencies(
            sessions: sessions,
            exercises: LiveExerciseRepository(database: database, now: now, makeID: makeID),
            sets: LiveSetRepository(database: database, now: now, makeID: makeID),
            history: sessions,
            now: now,
            clock: ContinuousClock(),
            restActivity: restActivity(),
            mediaLoader: mediaLoader,
            catalog: LiveExerciseCatalog(loader: mediaLoader),
            calendar: .autoupdatingCurrent,
            info: info(isDemo: isDemo),
            pasteboard: SystemPasteboard()
        )
    }

    /// The catalog media loader: its own URLSession (never `.shared`) and the on-disk cache in Caches/ExerciseMedia.
    private static func mediaLoader() -> any ExerciseMediaLoader {
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
            ? LiveRestActivityController() : DisabledRestActivityController()
    }

    private static func info(isDemo: Bool) -> AppInfo {
        let bundle = Bundle.main
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        let localUnit: WeightUnit = Locale.autoupdatingCurrent.measurementSystem == .us ? .lb : .kg
        return AppInfo(
            version: version ?? "0",
            build: build ?? "0",
            unit: isDemo ? .kg : localUnit,  // the demo data is logged in kg
            dataSource: isDemo ? .demo : .device
        )
    }
}

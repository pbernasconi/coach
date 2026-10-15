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
        return AppDependencies(
            sessions: LiveSessionRepository(database: database, now: now, makeID: makeID),
            exercises: LiveExerciseRepository(database: database, now: now, makeID: makeID),
            sets: LiveSetRepository(database: database, now: now, makeID: makeID),
            now: now,
            clock: ContinuousClock(),
            calendar: .autoupdatingCurrent,
            info: info(isDemo: isDemo)
        )
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

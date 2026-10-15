import Foundation
import LiftCore
import Testing

@testable import Lift

/// The preferred weight unit survives a relaunch, and falls back to the locale's until one is picked.
@MainActor
@Suite struct UnitSettingsTests {
    private static let suite = "LiftTests.UnitSettings"

    private func freshDefaults() throws -> UserDefaults {
        let defaults = try #require(UserDefaults(suiteName: Self.suite))
        defaults.removePersistentDomain(forName: Self.suite)
        return defaults
    }

    @Test func untilOneIsPickedTheLocaleUnitApplies() throws {
        let defaults = try freshDefaults()
        #expect(UserDefaultsUnitSettings(defaults: defaults, fallback: .lb).unit == .lb)
        #expect(UserDefaultsUnitSettings(defaults: defaults, fallback: .kg).unit == .kg)
    }

    @Test func aPickedUnitIsKeptForTheNextLaunch() throws {
        let defaults = try freshDefaults()
        UserDefaultsUnitSettings(defaults: defaults, fallback: .kg).unit = .lb

        #expect(UserDefaultsUnitSettings(defaults: defaults, fallback: .kg).unit == .lb)
    }
}

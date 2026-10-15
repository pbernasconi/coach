import Foundation
import LiftCore
import Testing

@testable import Lift

/// The gym's bars and plates survive a relaunch, and are the made-up defaults until changed.
@MainActor
@Suite struct GymSettingsTests {
    private static let suite = "LiftTests.GymSettings"

    private func clearDefaults() throws {
        let defaults = try #require(UserDefaults(suiteName: Self.suite))
        defaults.removePersistentDomain(forName: Self.suite)
    }

    @Test func untilChangedTheDefaultsApply() throws {
        try clearDefaults()
        #expect(UserDefaultsGymSettings(suiteName: Self.suite).setup == .standard)
    }

    @Test func aChangedSetupIsKeptForTheNextLaunch() throws {
        try clearDefaults()
        var setup = GymSetup.standard
        setup.kg.bar = 15
        setup.lb.plates[0].isAvailable = true
        UserDefaultsGymSettings(suiteName: Self.suite).setup = setup

        #expect(UserDefaultsGymSettings(suiteName: Self.suite).setup == setup)
    }

    @Test func inMemorySettingsAreNeverSaved() throws {
        try clearDefaults()
        let memory = InMemoryGymSettings(.standard)
        memory.setup.kg.collar = 2.5

        #expect(memory.setup.kg.collar == 2.5)
        #expect(UserDefaultsGymSettings(suiteName: Self.suite).setup == .standard)
    }
}

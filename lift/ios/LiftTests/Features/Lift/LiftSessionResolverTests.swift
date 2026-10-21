import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// A session link opens the local workout for a session this iPhone has that is not finished, else the coach's page
/// (lift/APP-API.md, "Links").
@Suite struct LiftSessionResolverTests {
    func destination(_ id: String, store: [SessionDetail?]) async -> LiftSessionDestination {
        await LiftSessionResolver(sessions: FakeSessionDetailRepository(emissions: store)).destination(for: id)
    }

    @Test func aLocalUnfinishedSessionOpensTheWorkout() async {
        let open = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)

        let result = await destination(open.id.uuidString.lowercased(), store: [open])

        #expect(result == .workout(open.id))
    }

    @Test func aLocalFinishedSessionOpensTheCoachPage() async {
        var finished = SessionBuilder.session(id: 2, on: Fixtures.monday, done: 3, planned: 0)
        finished.session.finishedAt = ManualNow.start

        let result = await destination(finished.id.uuidString.lowercased(), store: [finished])

        #expect(result == .coach)
    }

    @Test func aSessionThisIPhoneDoesNotHaveOpensTheCoachPage() async {
        #expect(await destination(IDSequence.id(9, prefix: 0xEE).uuidString.lowercased(), store: [nil]) == .coach)
        #expect(await destination(IDSequence.id(8, prefix: 0xEE).uuidString.lowercased(), store: []) == .coach)
    }

    @Test func anIDThatIsNotAUUIDOpensTheCoachPage() async {
        #expect(await destination("latest", store: []) == .coach)
    }
}

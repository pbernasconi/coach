import Foundation
import LiftSync
import LiftTesting
import Synchronization
import Testing

@testable import Lift

/// The coach's read-only session page: decoding (contract and demo body), loading, and one test per Action (TEST-2).
/// No sleeps, no real time (TEST-3). Made-up data only (TEST-8).
@MainActor
@Suite struct LiftSessionViewModelTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()
    let sessionID = "ca4f651b-98c7-4765-83a9-07ab74435d69"

    func makeViewModel(
        _ data: FakeAppData,
        media: LiftSessionMediaLoader = LiftSessionMediaLoader(),
        local: UUID? = nil
    ) -> LiftSessionViewModel {
        LiftSessionViewModel(
            sessionID: sessionID,
            localSessionID: local,
            data: data,
            mediaLoader: media,
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    var contract: Data { Data(AppAPISamples.liftSessionContract.utf8) }

    func loaded(media: LiftSessionMediaLoader = LiftSessionMediaLoader()) async -> LiftSessionViewModel {
        let vm = makeViewModel(FakeAppData([.success(contract)]), media: media)
        await vm.run()
        return vm
    }

    // MARK: Decoding

    @Test func theContractExampleDecodes() throws {
        let detail = try JSONDecoder().decode(LiftSessionDetail.self, from: contract)
        #expect(detail.olderId == "004c7644-399d-44f4-9a61-8dea412c70c9")
        let hero = try #require(detail.hero.value)
        #expect(hero.state == "planned")
        #expect(hero.stats.count == 5)
        #expect(hero.ring.text == "0/25")
        #expect(hero.muscles.map(\.name) == ["Back", "Glutes"])
        let squat = try #require(detail.exercises.value?.items.first)
        #expect(squat.sets.first?.text == "230 lb × 5")
        #expect(squat.lastTime?.deltaText == "−25 lb vs last")
        #expect(squat.best?.text == "340 lb")
        #expect(squat.trend?.values.count == 10)
        #expect(squat.media?.image != nil)
    }

    @Test func aFailedSectionFailsAlone() throws {
        let body = """
            { "id": "a", "unit": "kg", "olderId": null, "newerId": null,
              "hero": { "ok": false }, "exercises": { "ok": true, "emptyText": "None.", "items": [] } }
            """
        let detail = try JSONDecoder().decode(LiftSessionDetail.self, from: Data(body.utf8))
        #expect(detail.hero == .failed)
        #expect(detail.exercises.value?.emptyText == "None.")
    }

    @Test func theDemoBodyDecodes() throws {
        let url = try #require(Bundle.main.url(forResource: "app-lift-sessions", withExtension: "json"))
        let detail = try JSONDecoder().decode(LiftSessionDetail.self, from: Data(contentsOf: url))
        #expect(detail.hero.value?.state == "done")
        #expect(detail.exercises.value?.items.count == 3)
        #expect(detail.exercises.value?.items.last?.sets.last?.status == "skipped")
    }

    // MARK: Loading

    @Test func runLoadsTheSessionFromItsPath() async {
        let data = FakeAppData([.success(contract)])
        let vm = makeViewModel(data)

        await vm.run()

        #expect(data.fetched == ["api/app/lift/sessions/\(sessionID)"])
        #expect(vm.state.detail.content.value?.hero.value?.title == "Heavy barbell")
        #expect(vm.state.detail.freshness?.isOffline == false)
    }

    @Test func runWithoutTheCoachShowsNotConnected() async {
        let data = FakeAppData()
        data.isConnected = false
        let vm = makeViewModel(data)

        await vm.run()

        #expect(vm.state.detail.content == .empty)
        #expect(data.fetched.isEmpty)
    }

    @Test func aSessionTheCoachCannotShowFallsBackToTheLocalCopy() async {
        let local = IDSequence.id(5, prefix: 0xEE)
        let notSynced = makeViewModel(FakeAppData([.failure(.rejected(status: 404))]), local: local)
        await notSynced.run()
        #expect(notSynced.state.localFallback == local)

        let noToken = makeViewModel(FakeAppData([.failure(.missingToken)]), local: local)
        await noToken.run()
        #expect(noToken.state.localFallback == local)

        let notOnThisPhone = makeViewModel(FakeAppData([.failure(.rejected(status: 404))]))
        await notOnThisPhone.run()
        #expect(notOnThisPhone.state.localFallback == nil)
    }

    @Test func aLoadedSessionKeepsTheCoachPage() async {
        let vm = makeViewModel(FakeAppData([.success(contract)]), local: IDSequence.id(5, prefix: 0xEE))
        await vm.run()
        #expect(vm.state.localFallback == nil)
    }

    @Test func comingBackWithinAMinuteDoesNotFetchAgain() async {
        let data = FakeAppData([.success(contract), .success(contract)])
        let vm = makeViewModel(data)
        await vm.run()
        await vm.run()
        #expect(data.fetched.count == 1)
        await vm.send(.refreshPulled)?.value
        #expect(data.fetched.count == 2)
    }

    @Test func connectTappedShowsSettings() async {
        let vm = await loaded()
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func retryTappedLoadsAgainAfterAFailure() async {
        let data = FakeAppData([.failure(.retryable(status: 500)), .success(contract)])
        let vm = makeViewModel(data)
        await vm.run()
        #expect(vm.state.detail.content.value == nil)

        await vm.send(.retryTapped)?.value

        #expect(vm.state.detail.content.value?.id == sessionID)
    }

    @Test func refreshPulledFetchesAgain() async {
        let data = FakeAppData([.success(contract)])
        let vm = makeViewModel(data)
        await vm.run()

        await vm.send(.refreshPulled)?.value

        #expect(data.fetched.count == 2)
    }

    // MARK: Links

    @Test func olderTappedReplacesThePageWithTheOlderSession() async {
        let vm = await loaded()

        vm.send(.olderTapped)

        #expect(router.opened == [.liftSession("004c7644-399d-44f4-9a61-8dea412c70c9")])
        #expect(router.backCount == 1)
    }

    @Test func newerTappedReplacesThePageWithTheNewerSession() async {
        let vm = await loaded()

        vm.send(.newerTapped)

        #expect(router.opened == [.liftSession("704c31ca-c04b-478b-802b-2f2219cad990")])
    }

    @Test func olderTappedAtTheEndDoesNothing() async {
        let vm = makeViewModel(FakeAppData())

        vm.send(.olderTapped)

        #expect(router.opened.isEmpty)
        #expect(router.backCount == 0)
    }

    @Test func lastTimeTappedOpensThatSessionLowerCased() async {
        let vm = await loaded()

        vm.send(.lastTimeTapped(sessionID: "7B20985D-D7FC-5C26-8C08-61A08EB1BD1A"))

        #expect(router.opened == [.liftSession("7b20985d-d7fc-5c26-8c08-61a08eb1bd1a")])
    }

    @Test func exerciseTappedOpensTheExercise() async {
        let vm = await loaded()

        vm.send(.exerciseTapped(exerciseKey: "id-4c494654-0000-4000-8000-000000000001"))

        #expect(router.opened == [.liftExercise("id-4c494654-0000-4000-8000-000000000001")])
    }

    // MARK: Media and steps

    @Test func mediaNeededLoadsThePictureOnce() async {
        let media = LiftSessionMediaLoader()
        let vm = await loaded(media: media)
        let squat = "543a30ee-4b76-4223-8cb7-73f5e2c35410"

        await vm.send(.mediaNeeded(exerciseID: squat))?.value
        let again = vm.send(.mediaNeeded(exerciseID: squat))

        #expect(again == nil)
        #expect(vm.state.media[squat] == .loaded(LiftSessionMediaLoader.bytes))
        #expect(media.requested.count == 1)
    }

    @Test func stepsExpandedChangedOpensAndClosesHowTo() async {
        let vm = await loaded()

        vm.send(.stepsExpandedChanged(exerciseID: "x", isExpanded: true))
        #expect(vm.state.expandedSteps == ["x"])
        vm.send(.stepsExpandedChanged(exerciseID: "x", isExpanded: false))
        #expect(vm.state.expandedSteps.isEmpty)
    }
}

/// Answers every picture with the same bytes and records each URL asked for.
nonisolated final class LiftSessionMediaLoader: ExerciseMediaLoader {
    static let bytes = Data([1, 2, 3])
    private let urls = Mutex<[URL]>([])

    var requested: [URL] { urls.withLock { $0 } }

    func data(for url: URL) async throws -> Data {
        urls.withLock { $0.append(url) }
        return Self.bytes
    }
}

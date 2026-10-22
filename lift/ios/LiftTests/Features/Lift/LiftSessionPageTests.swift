import Foundation
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The session page's results, watch card, exercise page and "How did it feel" (TEST-2). Made-up demo data (TEST-8).
@MainActor
@Suite struct LiftSessionPageTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()

    var demo: Data {
        get throws {
            let url = try #require(Bundle.main.url(forResource: "app-lift-sessions", withExtension: "json"))
            return try Data(contentsOf: url)
        }
    }

    func loaded(_ data: FakeAppData) async -> LiftSessionViewModel {
        let vm = LiftSessionViewModel(
            sessionID: "de300000-0000-4000-8000-000000000100",
            localSessionID: nil,
            data: data,
            mediaLoader: LiftSessionMediaLoader(),
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return vm
    }

    @Test func theDemoBodyHasResultsTheWatchAndFeedback() throws {
        let detail = try JSONDecoder().decode(LiftSessionDetail.self, from: demo)
        let hero = try #require(detail.hero.value)
        #expect(hero.summaryStats.map(\.label) == ["Duration", "Sets", "Avg HR", "Calories", "TSS", "Records"])
        #expect(hero.musclesText == "Quads 6 · Glutes 5.5 · Hamstrings 4 · Core 1.5")
        let squat = try #require(detail.exercises.value?.items.first?.result)
        #expect(squat.change?.tone == "up")
        #expect(squat.record)
        #expect(detail.watch?.value?.heartRate?.values.count == 120)
        #expect(detail.feedback?.rpeStep?.label == "Very hard")
        #expect(detail.feedback?.fromWatch == true)
    }

    @Test func anOlderServerShowsTheOldStatsWithoutThePlanTotals() throws {
        let contract = try JSONDecoder().decode(
            LiftSessionDetail.self,
            from: Data(AppAPISamples.liftSessionContract.utf8)
        )
        let hero = try #require(contract.hero.value)
        #expect(hero.summaryStats.map(\.label) == ["Exercises", "Sets", "Duration"])
        #expect(contract.watch == nil)
        #expect(contract.feedback == nil)
    }

    @Test func exerciseOpenedPushesItsPageAndPageClosedPopsIt() async throws {
        let vm = await loaded(FakeAppData([.success(try demo)]))

        vm.send(.exerciseOpened(exerciseID: "a"))
        vm.send(.exerciseOpened(exerciseID: "b"))
        #expect(vm.state.page == .exercise("a"))

        vm.send(.pageClosed)
        #expect(vm.state.page == nil)
    }

    @Test func aLinkFromTheExercisePageClosesItFirst() async throws {
        let vm = await loaded(FakeAppData([.success(try demo)]))
        vm.send(.exerciseOpened(exerciseID: "a"))

        vm.send(.exerciseTapped(exerciseKey: "id-x"))

        #expect(vm.state.page == nil)
        #expect(router.opened == [.liftExercise("id-x")])
    }

    @Test func watchTappedOpensTheWatchActivity() async throws {
        let vm = await loaded(FakeAppData([.success(try demo)]))

        vm.send(.watchTapped)

        #expect(router.opened == [.activity("9000000105")])
    }

    @Test func aFaceSavesAtOnceUnderTheItem() async throws {
        let data = FakeAppData([.success(try demo)])
        let vm = await loaded(data)

        await vm.send(.feedback(.changed(.feel(2))))?.value

        #expect(vm.state.shownFeedback?.feel == 2)
        #expect(vm.state.shownFeedback?.fromWatch == false)
        #expect(vm.state.feedback.save == .saved)
        let put = try #require(data.puts.first)
        #expect(put.path == "api/app/feedback")
        let body = try #require(try JSONSerialization.jsonObject(with: put.body) as? [String: Any])
        #expect(body["item"] as? String == "lift:de300000-0000-4000-8000-000000000100")
        #expect(body["feel"] as? Int == 2)
        #expect(body["rpe"] as? Int == 7)
        #expect(body["comment"] is NSNull)
    }

    @Test func aFailedSaveSaysSoAndRetrySavesAgain() async throws {
        let data = FakeAppData([.success(try demo)])
        data.putResult = .failure(.retryable(status: 500))
        let vm = await loaded(data)

        await vm.send(.feedback(.changed(.rpe(9))))?.value
        #expect(vm.state.feedback.save == .failed)
        #expect(vm.state.shownFeedback?.rpe == 9)

        data.putResult = nil
        await vm.send(.feedback(.retryTapped))?.value
        #expect(vm.state.feedback.save == .saved)
        #expect(data.puts.count == 2)
    }

    @Test func theNoteSheetOpensClosesAndSaves() async throws {
        let data = FakeAppData([.success(try demo)])
        let vm = await loaded(data)

        vm.send(.feedback(.commentTapped))
        #expect(vm.state.feedback.isCommentOpen)
        vm.send(.feedback(.commentClosed))
        #expect(!vm.state.feedback.isCommentOpen)
        #expect(data.puts.isEmpty)

        vm.send(.feedback(.commentTapped))
        await vm.send(.feedback(.commentSaved("  legs heavy \n")))?.value
        #expect(!vm.state.feedback.isCommentOpen)
        #expect(vm.state.shownFeedback?.comment == "legs heavy")
    }
}

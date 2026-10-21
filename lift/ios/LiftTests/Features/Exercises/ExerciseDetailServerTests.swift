import Foundation
import KoboPatterns
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The coach's numbers on the exercise detail screen (`/api/app/lift/exercises/{key}`): the contract decodes, the
/// merge rule (the coach's chart replaces the local one; the local one stays offline), the new Actions (TEST-2).
@MainActor
@Suite struct ExerciseDetailServerTests {
    let squatID = ExerciseLibrary.seedID(1)
    let router = RecordingNavigator()
    let body = Data(AppAPISamples.liftExerciseContract.utf8)

    func loaded(
        _ source: FakeAppData,
        exerciseID: UUID?,
        key: String,
        entries: [ExerciseHistoryEntry] = HistoryEntryBuilder.weekly(4)
    ) async -> ExerciseDetailViewModel {
        let vm = ExerciseDetailViewModel(
            exerciseID: exerciseID,
            exerciseKey: key,
            exercises: FakeExerciseRepository(emissions: [ExerciseLibrary.seed]),
            history: FakeExerciseHistoryRepository(emissions: [entries]),
            catalog: FakeExerciseCatalog(),
            data: source,
            router: router,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            unit: .kg
        )
        await vm.run()
        return vm
    }

    func loadedSquat(_ source: FakeAppData) async -> ExerciseDetailViewModel {
        await loaded(source, exerciseID: squatID, key: LiftLinks.key(forLibraryID: squatID))
    }

    @Test func theContractExampleDecodes() throws {
        let stats = try JSONDecoder().decode(LiftExerciseStats.self, from: body)
        #expect(stats.name == "Overhead triceps extension")
        #expect(stats.stats.value?.items.map(\.value) == ["24", "74", "60 lb", "76 lb"])
        #expect(stats.chart.value?.points.first?.sessionId == "d5a25b33-32e0-5bcd-bc53-5f17cb084120")
        #expect(stats.sessions.value?.items.first?.bestSetText == "45 lb x 10")
        #expect(stats.bestSets.value?.items.first?.e1rmText == "76 lb")
    }

    @Test func theDemoBodyDecodes() throws {
        let url = try #require(Bundle.main.url(forResource: "app-lift-exercises", withExtension: "json"))
        let stats = try JSONDecoder().decode(LiftExerciseStats.self, from: Data(contentsOf: url))
        #expect(stats.chart.value?.points.isEmpty == false)
        #expect(stats.bestSets.value?.items.count == 10)
    }

    @Test func theCoachsNumbersReplaceTheLocalChart() async {
        let source = FakeAppData([.success(body)])
        let vm = await loadedSquat(source)
        #expect(source.fetched == ["api/app/lift/exercises/\(LiftLinks.key(forLibraryID: squatID))"])
        #expect(vm.state.serverStats?.name == "Overhead triceps extension")
        #expect(vm.state.serverChart.count == 1)
        let day = SessionBuilder.calendar.date(from: DateComponents(year: 2026, month: 9, day: 29))
        #expect(vm.state.serverChart.first?.date == day)
    }

    @Test func theLocalChartStaysWhenNotConnected() async {
        let source = FakeAppData()
        source.isConnected = false
        let vm = await loadedSquat(source)
        #expect(vm.state.serverStats == nil)
        #expect(vm.state.server.content == .empty)
        guard case .loaded = vm.state.progress.chart else {
            Issue.record("local chart not loaded: \(vm.state.progress.chart)")
            return
        }
    }

    @Test func theLocalChartStaysWhenTheCoachChartFailed() async {
        let failedChart =
            #"{"unit":"kg","exerciseKey":"k","name":"Squat","stats":{"ok":false},"chart":{"ok":false},"#
            + #""sessions":{"ok":false},"bestSets":{"ok":false}}"#
        let vm = await loadedSquat(FakeAppData([.success(Data(failedChart.utf8))]))
        #expect(vm.state.server.content.value?.chart == .failed)
        #expect(vm.state.serverStats == nil)
    }

    @Test func aNameKeyShowsTheCoachsNumbersAlone() async {
        let source = FakeAppData([.success(body)])
        let vm = await loaded(source, exerciseID: nil, key: "name-hanging leg raise", entries: [])
        #expect(vm.state.exercise == .empty)
        #expect(vm.state.history == .empty)
        #expect(source.fetched == ["api/app/lift/exercises/name-hanging%20leg%20raise"])
        #expect(vm.state.server.content.value?.name == "Overhead triceps extension")
    }

    @Test func sessionTappedOpensTheCoachsSessionView() async {
        let vm = await loadedSquat(FakeAppData([.success(body)]))
        vm.send(.sessionTapped("D5A25B33-32E0-5BCD-BC53-5F17CB084120"))
        #expect(router.opened == [.liftSession("d5a25b33-32e0-5bcd-bc53-5f17cb084120")])
    }

    @Test func serverChartSelectionChangedKeepsTheNearestPointAfterRelease() async throws {
        let vm = await loadedSquat(FakeAppData([.success(body)]))
        let point = try #require(vm.state.serverChart.first)
        vm.send(.serverChartSelectionChanged(point.date.addingTimeInterval(3600)))
        #expect(vm.state.serverPoint == point)
        vm.send(.serverChartSelectionChanged(nil))
        #expect(vm.state.serverPoint == point)
    }

    @Test func serverSessionsExpandedChangedOpensAndClosesTheRest() async {
        let vm = await loadedSquat(FakeAppData([.success(body)]))
        vm.send(.serverSessionsExpandedChanged(true))
        #expect(vm.state.isServerSessionsExpanded)
        vm.send(.serverSessionsExpandedChanged(false))
        #expect(!vm.state.isServerSessionsExpanded)
    }

    @Test func refreshPulledFetchesAgain() async {
        let source = FakeAppData([.success(body)])
        let vm = await loadedSquat(source)
        await vm.send(.refreshPulled)?.value
        #expect(source.fetched.count == 2)
    }

    @Test func retryTappedLoadsAfterAFailure() async {
        let source = FakeAppData([.failure(.retryable(status: nil)), .success(body)])
        let vm = await loadedSquat(source)
        #expect(vm.state.server.content.phase == .failed)
        await vm.send(.retryTapped)?.value
        #expect(vm.state.serverStats != nil)
    }
}

import Core
import Testing
import TestingSupport

@testable import App

/// One test per Action case (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct ExampleViewModelTests {
    let repository = FakeExampleRepository()
    let router = RecordingRouter()
    let haptics = RecordingHaptics()
    var vm: ExampleViewModel { ExampleViewModel(repository: repository, router: router, haptics: haptics) }

    @Test func runShowsEmptyThenLoaded() async {
        let vm = self.vm
        repository.emit([])
        repository.emit(ExampleItem.samples)
        repository.finish()
        await vm.run()
        #expect(vm.state.items == .loaded(ExampleItem.samples))
    }

    @Test func nameChangedUpdatesDraft() {
        let vm = self.vm
        vm.send(.nameChanged("Squat"))
        #expect(vm.state.draftName == "Squat")
    }

    @Test func itemTappedPushesDetail() {
        let vm = self.vm
        vm.send(.itemTapped(ExampleItem.samples[0].id))
        #expect(router.calls == [.push(.exampleDetail(ExampleItem.samples[0].id))])
    }

    @Test func saveTappedCreatesOnceAndClearsDraft() async {
        let vm = self.vm
        vm.send(.nameChanged("Squat"))
        let first = vm.send(.saveTapped)
        let second = vm.send(.saveTapped)  // double tap is ignored
        #expect(second == nil)
        await first?.value
        #expect(repository.created == ["Squat"])
        #expect(vm.state.draftName.isEmpty)
        #expect(haptics.played == [.success])
    }

    @Test func saveFailureShowsKind() async {
        let vm = self.vm
        repository.createError = AppError(.offline)
        await vm.send(.saveTapped)?.value
        #expect(vm.state.save == .failed(.offline))
    }

    @Test func retryTappedResetsToLoading() {
        let vm = self.vm
        vm.send(.retryTapped)
        #expect(vm.state.items == .loading)
    }

    @Test func destinationDismissedClears() {
        let vm = self.vm
        vm.send(.destinationDismissed)
        #expect(vm.state.destination == nil)
    }
}

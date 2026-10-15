import SwiftUI

/// Builds the Import from Notes flow for one request and hands it the dependencies it needs (DI-1). The app shell
/// presents it as a modal page while `ImportFlowPresenter.request` is set.
struct ImportFlowPage: View {
    let request: ImportRequest
    let dependencies: AppDependencies

    var body: some View {
        ImportNotesScreen(
            viewModel: ImportNotesViewModel(
                request: request,
                sessions: dependencies.sessions,
                sets: dependencies.sets,
                exercises: dependencies.exercises,
                pasteboard: dependencies.pasteboard,
                flow: dependencies.importFlow,
                now: dependencies.now,
                calendar: dependencies.calendar
            )
        )
        .id(request)
    }
}

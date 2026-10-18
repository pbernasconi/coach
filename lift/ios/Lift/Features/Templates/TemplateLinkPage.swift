import KoboComponents
import SwiftUI

/// Builds the template link review for one request and hands it the dependencies it needs (DI-1).
struct TemplateLinkPage: View {
    let request: TemplateLinkRequest
    let dependencies: AppDependencies

    var body: some View {
        TemplateLinkScreen(
            viewModel: TemplateLinkViewModel(
                request: request,
                templates: dependencies.templates,
                exercises: dependencies.exercises,
                catalog: dependencies.catalog,
                flow: dependencies.templateLinks
            )
        )
        .id(request)
    }
}

extension View {
    /// The template link review as a sheet above the tabs while `TemplateLinkPresenter.request` is set, and its
    /// "Added N templates" toast with Undo, which outlives the sheet.
    func templateLinkFlow(_ dependencies: AppDependencies) -> some View {
        modifier(TemplateLinkFlowModifier(dependencies: dependencies))
    }
}

private struct TemplateLinkFlowModifier: ViewModifier {
    let dependencies: AppDependencies
    @State private var toasts = ToastCenter()

    func body(content: Content) -> some View {
        content
            .koboModalPage(item: request, style: .sheet) { request in
                TemplateLinkPage(request: request, dependencies: dependencies)
            }
            .toastHost(toasts)
            .onChange(of: dependencies.templateLinks.toast) { _, toast in show(toast) }
    }

    /// The open link; a swipe down closes it like Cancel.
    private var request: Binding<TemplateLinkRequest?> {
        let presenter = dependencies.templateLinks
        return .action(presenter.request) { if $0 == nil { presenter.cancel() } }
    }

    private func show(_ toast: TemplateLinkToast?) {
        guard let toast else { return }
        let presenter = dependencies.templateLinks
        switch toast.kind {
        case .added(let count):
            let undo = Toast.Action("Undo") { Task { await presenter.undo() } }
            toasts.show(Toast(verbatim: TemplateLinkText.added(count), action: undo))
        case .undoFailed:
            toasts.show(Toast("The templates could not be removed.", tone: .danger))
        }
    }
}

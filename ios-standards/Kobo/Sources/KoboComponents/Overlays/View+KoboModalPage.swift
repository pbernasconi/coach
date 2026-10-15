import KoboTokens
import SwiftUI

/// How a `ModalPage` is presented.
public enum ModalPageStyle: Sendable, Equatable, CaseIterable {
    /// A full-screen cover on iOS (a large sheet on macOS): a task that takes over, like a new program.
    case fullScreen
    /// A large page sheet with no grabber; on iPad and Mac it takes the page size, not a small form box.
    case sheet
}

extension View {
    /// Presents `page` (usually a `ModalPage`) while `isPresented` is true. `onDismiss` runs once it has closed.
    ///
    ///     .koboModalPage(isPresented: $creating) {
    ///         ModalPage("New program", hasChanges: draft.hasEdits, onConfirm: save) { … }
    ///     }
    public func koboModalPage<Page: View>(
        isPresented: Binding<Bool>,
        style: ModalPageStyle = .fullScreen,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder page: @escaping () -> Page
    ) -> some View {
        modifier(ModalPagePresenter(isPresented: isPresented, style: style, onDismiss: onDismiss, page: page))
    }

    /// Presents `page` for `item` while it is non-nil, with the stable identity of `itemSheet`: a swipe or Cancel
    /// sets `item` to `nil`, and `onDismiss` runs once the page has closed.
    public func koboModalPage<Item: Identifiable, Page: View>(
        item: Binding<Item?>,
        style: ModalPageStyle = .fullScreen,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder page: @escaping (Item) -> Page
    ) -> some View {
        modifier(
            ItemPresenter(
                style: style == .fullScreen ? .fullScreenCover : .sheet,
                item: item.wrappedValue,
                onDismiss: { item.wrappedValue = nil },
                onDidClose: onDismiss,
                presented: { shown in page(shown).modifier(ModalPageSheetSizing()) }
            )
        )
    }
}

private struct ModalPagePresenter<Page: View>: ViewModifier {
    @Binding var isPresented: Bool
    let style: ModalPageStyle
    let onDismiss: (() -> Void)?
    let page: () -> Page

    func body(content: Content) -> some View {
        #if os(iOS)
            if style == .fullScreen {
                content.fullScreenCover(isPresented: $isPresented, onDismiss: onDismiss, content: sized)
            } else {
                content.sheet(isPresented: $isPresented, onDismiss: onDismiss, content: sized)
            }
        #else
            content.sheet(isPresented: $isPresented, onDismiss: onDismiss, content: sized)
        #endif
    }

    private func sized() -> some View {
        page().modifier(ModalPageSheetSizing())
    }
}

/// A page sheet takes the full height, shows no grabber (Cancel closes it) and the page size on wide windows.
/// A full-screen cover ignores these settings.
private struct ModalPageSheetSizing: ViewModifier {
    func body(content: Content) -> some View {
        content
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationSizing(.page)
    }
}

#if DEBUG
    private struct ModalPagePreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var isPresented = true
        @State private var isSheet = false
        @State private var steps = 3
        @State private var name = "Spring cleaning"

        var body: some View {
            VStack(spacing: Space.lg) {
                Toggle("Present as a sheet", isOn: $isSheet)
                Button("New project") { isPresented = true }
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity)
            .background(theme.palette.canvas)
            .koboModalPage(isPresented: $isPresented, style: isSheet ? .sheet : .fullScreen) {
                ModalPage(
                    verbatim: name,
                    subtitle: "8 weeks",
                    confirmLabel: "Create",
                    hasChanges: steps != 3,
                    onConfirm: {}
                ) {
                    StepperField("Rooms per week", value: $steps, in: 1...7)
                    Text("Change the rooms, then tap Cancel: the page asks before discarding.")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
        }
    }

    #Preview("Light") { ModalPagePreview() }
    #Preview("Dark") { ModalPagePreview().preferredColorScheme(.dark) }
    #Preview("Amber") { ModalPagePreview().koboTheme(.amber) }
    #Preview("AX3") { ModalPagePreview().dynamicTypeSize(.accessibility3) }
#endif

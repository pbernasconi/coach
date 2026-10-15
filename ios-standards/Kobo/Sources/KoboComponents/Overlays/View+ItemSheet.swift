import KoboTokens
import SwiftUI

extension View {
    /// Presents a sheet while `item` is non-nil, for a screen whose state says what is open (`destination: Editor?`).
    /// The caller's item stays the source of truth: no view needs `Binding(get:set:)`.
    ///
    ///     .itemSheet(item: state.editing, onDismiss: { send(.editorDismissed) }) { item in
    ///         KoboSheet(verbatim: item.name) { … }
    ///     }
    ///
    /// - A swipe, or the sheet's own close, calls `onDismiss`. A caller that clears or swaps the item is not called
    ///   back: it already knows.
    /// - A new payload with the same `id` updates the open sheet in place; a new `id` replaces the sheet.
    /// - `onDidClose` runs once the sheet has finished closing by any path, for work that presents another modal.
    public func itemSheet<Item: Identifiable, Sheet: View>(
        item: Item?,
        onDismiss: @escaping () -> Void,
        onDidClose: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Item) -> Sheet
    ) -> some View {
        modifier(
            ItemPresenter(
                style: .sheet,
                item: item,
                onDismiss: onDismiss,
                onDidClose: onDidClose,
                presented: content
            )
        )
    }
}

/// How `ItemPresenter` shows its item.
enum ItemPresentationStyle: Equatable {
    case sheet
    /// A full-screen cover on iOS; a sheet where covers do not exist (macOS).
    case fullScreenCover
}

/// Mirrors the caller's `item` into the presentation state that `.sheet(item:)` needs (rules in
/// `ItemSheetPresentation`). A swipe tells the caller; a caller's clear or swap only changes the sheet.
struct ItemPresenter<Item: Identifiable, Presented: View>: ViewModifier {
    @State private var presentation = ItemSheetPresentation<Item>()
    let style: ItemPresentationStyle
    let item: Item?
    let onDismiss: () -> Void
    let onDidClose: (() -> Void)?
    let presented: (Item) -> Presented

    func body(content: Content) -> some View {
        let mirrored = content.onChange(of: item?.id, initial: true) { presentation.presented = item }
        #if os(iOS)
            if style == .fullScreenCover {
                mirrored.fullScreenCover(item: $presentation.presented, onDismiss: dismissed, content: page)
            } else {
                mirrored.sheet(item: $presentation.presented, onDismiss: dismissed, content: page)
            }
        #else
            mirrored.sheet(item: $presentation.presented, onDismiss: dismissed, content: page)
        #endif
    }

    private func page(_ shown: Item) -> some View {
        presented(ItemSheetPresentation.latest(shown, current: item))
            .onAppear { presentation.sheetDidAppear(shown.id) }
    }

    private func dismissed() {
        if presentation.sheetDidDismiss(current: item) { onDismiss() }
        onDidClose?()
    }
}

#if DEBUG
    private struct ItemSheetPreviewItem: Identifiable, Equatable {
        let id: Int
        var name: String
        var quantity: Int
    }

    private struct ItemSheetPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var editing: ItemSheetPreviewItem?
        @State private var log = "Nothing open"
        private let items = [
            ItemSheetPreviewItem(id: 1, name: "Lemons", quantity: 8),
            ItemSheetPreviewItem(id: 2, name: "Tomatoes", quantity: 5),
        ]

        var body: some View {
            VStack(spacing: Space.lg) {
                ForEach(items) { item in
                    Button(item.name) { editing = item }
                }
                Text(verbatim: log).foregroundStyle(theme.palette.textSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(theme.palette.canvas)
            .itemSheet(item: editing, onDismiss: { editing = nil }, onDidClose: { log = "Closed" }) { item in
                KoboSheet(verbatim: item.name, subtitle: "\(item.quantity) in the basket") {
                    Button("Add one") { editing?.quantity += 1 }
                }
            }
        }
    }

    #Preview("Light") { ItemSheetPreview() }
    #Preview("Dark") { ItemSheetPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { ItemSheetPreview().dynamicTypeSize(.accessibility3) }
#endif

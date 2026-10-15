import KoboTokens
import SwiftUI

extension View {
    /// Presents a `KoboSheet` for `item` while it is non-nil, titled from the item. The sheet keeps a stable
    /// identity: a new payload with the same `id` updates it in place (see `itemSheet`). A swipe or the close button
    /// sets `item` to `nil`; `onDismiss` runs once the sheet has finished closing.
    ///
    ///     .koboSheet(item: $editingSet, title: \.exerciseName) { set in
    ///         StepperField("Reps", value: $draftReps, in: 1...50)
    ///     }
    public func koboSheet<Item: Identifiable, Content: View, Footer: View>(
        item: Binding<Item?>,
        title: @escaping (Item) -> String,
        subtitle: @escaping (Item) -> String? = { _ in nil },
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Item) -> Content,
        @ViewBuilder footer: @escaping (Item) -> Footer
    ) -> some View {
        itemSheet(item: item.wrappedValue, onDismiss: { item.wrappedValue = nil }, onDidClose: onDismiss) { shown in
            KoboSheet(
                title: .verbatim(title(shown), subtitle: subtitle(shown)),
                detents: detents,
                grabber: grabber,
                background: background,
                hasChanges: hasChanges,
                confirm: nil,
                onClose: nil,
                content: content(shown),
                footer: footer(shown)
            )
        }
    }

    /// An item-driven Kobo sheet with no footer.
    public func koboSheet<Item: Identifiable, Content: View>(
        item: Binding<Item?>,
        title: @escaping (Item) -> String,
        subtitle: @escaping (Item) -> String? = { _ in nil },
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Item) -> Content
    ) -> some View {
        koboSheet(
            item: item,
            title: title,
            subtitle: subtitle,
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            onDismiss: onDismiss,
            content: content,
            footer: { _ in EmptyView() }
        )
    }
}

#if DEBUG
    private struct KoboSheetItemPreviewDay: Identifiable {
        let id: Int
        let name: String
    }

    private struct KoboSheetItemPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var day: KoboSheetItemPreviewDay? = KoboSheetItemPreviewDay(id: 1, name: "Monday")

        var body: some View {
            Button("Open Tuesday") { day = KoboSheetItemPreviewDay(id: 2, name: "Tuesday") }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(theme.palette.canvas)
                .koboSheet(item: $day, title: \.name, subtitle: { _ in "Lower A" }) { _ in
                    ListRow("Back squat", value: "3 × 5")
                    ListRow("Romanian deadlift", value: "3 × 8")
                }
        }
    }

    #Preview("Item, light") { KoboSheetItemPreview() }
    #Preview("Item, dark") { KoboSheetItemPreview().preferredColorScheme(.dark) }
    #Preview("Item, AX3") { KoboSheetItemPreview().dynamicTypeSize(.accessibility3) }
#endif

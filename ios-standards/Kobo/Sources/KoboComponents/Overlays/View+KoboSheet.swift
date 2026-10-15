import KoboTokens
import SwiftUI

extension View {
    /// Presents a `KoboSheet` while `isPresented` is true: a `SheetHeader`, scrolling `content`, a pinned `footer`,
    /// and the Kobo detents, grabber, background and corners. `onDismiss` runs once the sheet has finished closing.
    ///
    ///     .koboSheet(isPresented: $editing, title: "Edit set", hasChanges: draft != saved) {
    ///         StepperField("Reps", value: $draft.reps, in: 1...50)
    ///     } footer: {
    ///         Button("Save", action: save).buttonStyle(.kobo(.primary, width: .full))
    ///     }
    public func koboSheet<Content: View, Footer: View>(
        isPresented: Binding<Bool>,
        title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content,
        @ViewBuilder footer: @escaping () -> Footer
    ) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss) {
            KoboSheet(
                title: .localized(title, subtitle: subtitle),
                detents: detents,
                grabber: grabber,
                background: background,
                hasChanges: hasChanges,
                confirm: confirm,
                onClose: nil,
                content: content(),
                footer: footer()
            )
        }
    }

    /// The same sheet, with a title and subtitle shown as is.
    public func koboSheet<Content: View, Footer: View>(
        isPresented: Binding<Bool>,
        verbatim title: String,
        subtitle: String? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content,
        @ViewBuilder footer: @escaping () -> Footer
    ) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss) {
            KoboSheet(
                title: .verbatim(title, subtitle: subtitle),
                detents: detents,
                grabber: grabber,
                background: background,
                hasChanges: hasChanges,
                confirm: confirm,
                onClose: nil,
                content: content(),
                footer: footer()
            )
        }
    }

    /// A Kobo sheet with no footer.
    public func koboSheet<Content: View>(
        isPresented: Binding<Bool>,
        title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        koboSheet(
            isPresented: isPresented,
            title: title,
            subtitle: subtitle,
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            confirm: confirm,
            onDismiss: onDismiss,
            content: content,
            footer: { EmptyView() }
        )
    }

    /// A Kobo sheet with no footer, whose title and subtitle are shown as is.
    public func koboSheet<Content: View>(
        isPresented: Binding<Bool>,
        verbatim title: String,
        subtitle: String? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        koboSheet(
            isPresented: isPresented,
            verbatim: title,
            subtitle: subtitle,
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            confirm: confirm,
            onDismiss: onDismiss,
            content: content,
            footer: { EmptyView() }
        )
    }
}

#if DEBUG
    private struct KoboSheetPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var isPresented = true
        @State private var isResizable = false
        @State private var reps = 8
        private let savedReps = 8

        var body: some View {
            VStack(spacing: Space.lg) {
                Toggle("Medium and large detents", isOn: $isResizable)
                Button("Edit set") { isPresented = true }
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity)
            .background(theme.palette.canvas)
            .koboSheet(
                isPresented: $isPresented,
                title: "Edit set",
                subtitle: "Bench press · set 2",
                detents: isResizable ? [.medium, .large] : [.fitted],
                hasChanges: reps != savedReps
            ) {
                StepperField("Reps", value: $reps, in: 1...50)
                Text("Change the reps, then try to close: the sheet asks first.")
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            } footer: {
                Button("Save set") { isPresented = false }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
            }
        }
    }

    #Preview("Light") { KoboSheetPreview() }
    #Preview("Dark") { KoboSheetPreview().preferredColorScheme(.dark) }
    #Preview("Lift, solid") {
        KoboSheetPreview().koboTheme(Theme(palette: .lift, surfaceStyle: .solid))
    }
    #Preview("AX3") { KoboSheetPreview().dynamicTypeSize(.accessibility3) }
#endif

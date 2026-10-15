import KoboTokens
import SwiftUI

/// A small fitted sheet for one value: a `SheetHeader` with close and a prominent Save checkmark, and one field.
/// The field is a slot, so any input works (a text field, a stepper, a picker). Save runs `onSave` and closes;
/// with `hasChanges`, close asks "Discard changes?" first. Present it with `.inputModal`.
///
///     InputModal("Rename program", isSaveEnabled: !name.isEmpty, hasChanges: name != program.name, onSave: rename) {
///         KoboTextField("Name", text: $name).submitLabel(.done)
///     }
///
/// Focus the field from the caller (`@FocusState` with `.onAppear`), so the keyboard rises with the sheet.
public struct InputModal<Field: View>: View {
    @Environment(\.dismiss) private var dismiss
    private let title: OverlayTitle
    private let isSaveEnabled: Bool
    private let hasChanges: Bool
    private let onSave: () -> Void
    private let onCancel: (() -> Void)?
    private let field: Field

    /// - Parameters:
    ///   - isSaveEnabled: false dims Save (an empty or invalid value).
    ///   - onCancel: what close does once allowed; `nil` dismisses the sheet.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        isSaveEnabled: Bool = true,
        hasChanges: Bool = false,
        onCancel: (() -> Void)? = nil,
        onSave: @escaping () -> Void,
        @ViewBuilder field: () -> Field
    ) {
        self.init(
            title: .localized(title, subtitle: subtitle),
            isSaveEnabled: isSaveEnabled,
            hasChanges: hasChanges,
            onCancel: onCancel,
            onSave: onSave,
            field: field()
        )
    }

    /// An input modal whose title and subtitle are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        isSaveEnabled: Bool = true,
        hasChanges: Bool = false,
        onCancel: (() -> Void)? = nil,
        onSave: @escaping () -> Void,
        @ViewBuilder field: () -> Field
    ) {
        self.init(
            title: .verbatim(title, subtitle: subtitle),
            isSaveEnabled: isSaveEnabled,
            hasChanges: hasChanges,
            onCancel: onCancel,
            onSave: onSave,
            field: field()
        )
    }

    init(
        title: OverlayTitle,
        isSaveEnabled: Bool,
        hasChanges: Bool,
        onCancel: (() -> Void)?,
        onSave: @escaping () -> Void,
        field: Field
    ) {
        self.title = title
        self.isSaveEnabled = isSaveEnabled
        self.hasChanges = hasChanges
        self.onCancel = onCancel
        self.onSave = onSave
        self.field = field
    }

    public var body: some View {
        KoboSheet(
            title: title,
            detents: [.fitted],
            grabber: .hidden,
            background: .automatic,
            hasChanges: hasChanges,
            confirm: SheetHeaderAction(label: Text("Save", bundle: .module), isEnabled: isSaveEnabled, action: save),
            onClose: onCancel,
            content: field,
            footer: EmptyView()
        )
    }

    private func save() {
        onSave()
        dismiss()
    }
}

extension View {
    /// Presents an `InputModal` while `isPresented` is true.
    ///
    ///     .inputModal(isPresented: $renaming, title: "Rename program", isSaveEnabled: !name.isEmpty, onSave: rename) {
    ///         KoboTextField("Name", text: $name)
    ///     }
    public func inputModal<Field: View>(
        isPresented: Binding<Bool>,
        title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        isSaveEnabled: Bool = true,
        hasChanges: Bool = false,
        onDismiss: (() -> Void)? = nil,
        onSave: @escaping () -> Void,
        @ViewBuilder field: @escaping () -> Field
    ) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss) {
            InputModal(
                title: .localized(title, subtitle: subtitle),
                isSaveEnabled: isSaveEnabled,
                hasChanges: hasChanges,
                onCancel: nil,
                onSave: onSave,
                field: field()
            )
        }
    }

    /// Presents an `InputModal` whose title and subtitle are shown as is.
    public func inputModal<Field: View>(
        isPresented: Binding<Bool>,
        verbatim title: String,
        subtitle: String? = nil,
        isSaveEnabled: Bool = true,
        hasChanges: Bool = false,
        onDismiss: (() -> Void)? = nil,
        onSave: @escaping () -> Void,
        @ViewBuilder field: @escaping () -> Field
    ) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss) {
            InputModal(
                title: .verbatim(title, subtitle: subtitle),
                isSaveEnabled: isSaveEnabled,
                hasChanges: hasChanges,
                onCancel: nil,
                onSave: onSave,
                field: field()
            )
        }
    }
}

#if DEBUG
    private struct InputModalPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var isPresented = true
        @State private var saved = 90
        @State private var draft = 90

        var body: some View {
            Button("Rest time: \(saved) s") {
                draft = saved
                isPresented = true
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(theme.palette.canvas)
            .inputModal(
                isPresented: $isPresented,
                title: "Rest time",
                subtitle: "Between sets",
                isSaveEnabled: draft > 0,
                hasChanges: draft != saved,
                onSave: { saved = draft }
            ) {
                StepperField("Seconds", value: $draft, in: 0...600, step: 15)
            }
        }
    }

    #Preview("Light") { InputModalPreview() }
    #Preview("Dark") { InputModalPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { InputModalPreview().dynamicTypeSize(.accessibility3) }
#endif

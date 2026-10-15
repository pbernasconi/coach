import KoboTokens
import SwiftUI

/// The chrome every Kobo text input shares: a label above, a rounded box with a focus ring, and one line under it
/// for the helper text or the error. The field supplies the controls inside the box and whether it has focus.
///
/// An error that appears while the user types waits for the blur (`FieldErrorGate`); one that appears with no edit
/// (a submit, a server reply) shows at once. The label and the line are hidden from VoiceOver because the control
/// speaks them (`fieldAccessibility`); the error still announces when it appears.
struct FieldFrame<Control: View, Footer: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @State private var errorHeldBack = false
    let label: Text?
    let helper: Text?
    let error: FieldError
    let isFocused: Bool
    /// The field text, so the gate can tell an edit from a submit. `nil`: every error shows at once.
    let value: String?
    let boxAlignment: VerticalAlignment
    let control: Control
    let footer: Footer

    init(
        label: Text?,
        helper: Text?,
        error: FieldError,
        isFocused: Bool,
        value: String?,
        boxAlignment: VerticalAlignment = .center,
        @ViewBuilder control: () -> Control,
        @ViewBuilder footer: () -> Footer
    ) {
        self.label = label
        self.helper = helper
        self.error = error
        self.isFocused = isFocused
        self.value = value
        self.boxAlignment = boxAlignment
        self.control = control()
        self.footer = footer()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let label {
                label
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .padding(.bottom, Space.sm)
                    .accessibilityHidden(true)
            }
            box
            HStack(alignment: .top, spacing: Space.sm) {
                FieldLine(helper: helper, content: FieldLineContent(hasHelper: helper != nil, error: shownError))
                    .accessibilityHidden(true)
                footer
            }
        }
        .onChange(of: reading) { old, new in
            errorHeldBack = FieldErrorGate.suppressed(errorHeldBack, old: old, new: new)
        }
    }

    private var box: some View {
        HStack(alignment: boxAlignment, spacing: Space.sm) { control }
            .font(theme.font(.body))
            .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
            .tint(theme.palette.accent)
            .padding(.horizontal, Space.lg)
            .frame(maxWidth: .infinity, minHeight: Size.buttonHeight, alignment: .leading)
            .background(fill, in: shape)
            .overlay { shape.strokeBorder(border, lineWidth: borderWidth) }
            .koboAnimation(.state, value: isFocused)
            .koboAnimation(.state, value: shownError.isError)
    }

    private var reading: FieldErrorGate.Reading {
        FieldErrorGate.Reading(value: value, hasError: error.isError, focused: isFocused)
    }

    /// The error the frame draws: one held back while the user types shows on the blur.
    private var shownError: FieldError {
        FieldErrorGate.visible(hasError: error.isError, suppressed: errorHeldBack, focused: isFocused) ? error : .none
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
    }

    private var fill: Color {
        isEnabled ? theme.palette.surface : theme.palette.surfaceRaised
    }

    private var border: Color {
        if shownError.isError { return theme.palette.danger.ink }
        if isFocused { return theme.palette.accent }
        return isEnabled ? theme.palette.separator : .clear
    }

    /// The focus and error rings are thicker than the resting hairline, so focus never reads by colour alone.
    private var borderWidth: CGFloat {
        shownError.isError || isFocused ? Space.xxs : Size.hairline
    }
}

extension FieldFrame where Footer == EmptyView {
    init(
        label: Text?,
        helper: Text?,
        error: FieldError,
        isFocused: Bool,
        value: String?,
        boxAlignment: VerticalAlignment = .center,
        @ViewBuilder control: () -> Control
    ) {
        self.init(
            label: label,
            helper: helper,
            error: error,
            isFocused: isFocused,
            value: value,
            boxAlignment: boxAlignment,
            control: control,
            footer: { EmptyView() }
        )
    }
}

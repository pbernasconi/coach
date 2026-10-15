import KoboTokens
import SwiftUI

/// The toast itself: the tone glyph, the message and an optional trailing action, on Liquid Glass (or the raised
/// surface under a `.solid` theme).
///
/// The shape is a rounded rectangle of `Radius.xl`. SwiftUI clamps the corners to half the height, so a one-line toast
/// (44pt tall) draws as a true capsule, the iOS 26 shape for floating glass; a wrapped toast keeps rounded corners
/// instead of a stadium, so its lines stay clear of the curve. It hugs its message up to `ToastWidth.maxWidth`.
struct ToastCapsule: View {
    let toast: Toast
    let onDismiss: () -> Void
    let onAction: () -> Void
    var onHold: (Bool) -> Void = { _ in }
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @GestureState private var isTouched = false

    var body: some View {
        ToastWidthLimit {
            HStack(spacing: Space.md) {
                message
                if let action = toast.action {
                    Button(action: onAction) {
                        Text(verbatim: action.label)
                            .font(theme.font(.subheadline).weight(.bold))
                            .foregroundStyle(theme.palette.accentText)
                            .fixedSize()
                            .padding(.horizontal, Space.md)
                            .padding(.vertical, Space.xs)
                            .background(theme.palette.accentSoft, in: Capsule())
                            .frame(minHeight: Size.minTouch)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.leading, Space.lg)
            .padding(.trailing, toast.action == nil ? Space.lg : Space.xs)
            .frame(minHeight: Size.minTouch)
            .modifier(ToastSurface(shape: RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)))
            .simultaneousGesture(
                DragGesture(minimumDistance: 0).updating($isTouched) { _, touched, _ in touched = true }
            )
            .onChange(of: isTouched) { _, touched in onHold(touched) }
            .modifier(ToastSwipeModifier(onDismiss: onDismiss))
        }
    }

    /// The glyph and the message, read as one element with a "Dismiss" action and the toast's own action.
    private var message: some View {
        HStack(spacing: Space.sm) {
            Image(systemName: toast.resolvedSymbol)
                .foregroundStyle(theme.palette.status(toast.tone).ink)
                .accessibilityHidden(true)
            Text(verbatim: toast.message)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textPrimary)
                .lineLimit(ToastWidth.lineLimit(isAccessibilitySize: dynamicTypeSize.isAccessibilitySize))
                .fixedSize(horizontal: false, vertical: true)
        }
        // The copy takes the width first, so a short message never breaks one word per line.
        .layoutPriority(1)
        .padding(.vertical, Space.sm)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
        .accessibilityAction(named: Text("Dismiss", bundle: .module), onDismiss)
        .accessibilityActions {
            if let action = toast.action {
                Button(action: onAction) { Text(verbatim: action.label) }
            }
        }
    }
}

/// Liquid Glass under a glass theme; the raised surface under a solid one.
private struct ToastSurface<S: Shape>: ViewModifier {
    let shape: S
    @Environment(\.koboTheme) private var theme

    func body(content: Content) -> some View {
        switch theme.surfaceStyle {
        case .glass:
            content.glassEffect(.regular, in: shape)
        case .solid:
            content.background(theme.palette.surfaceRaised, in: shape)
        }
    }
}

#Preview("Capsules") {
    VStack(spacing: Space.md) {
        ToastCapsule(toast: Toast("Workout saved", tone: .success), onDismiss: {}, onAction: {})
        ToastCapsule(toast: Toast("Set deleted", action: .init("Undo") {}), onDismiss: {}, onAction: {})
        ToastCapsule(
            toast: Toast(verbatim: "Lower A moved to Thursday, and its rest timer settings came with it"),
            onDismiss: {},
            onAction: {}
        )
    }
    .padding(.horizontal, Space.gutter)
}

#Preview("Capsules, dark, solid") {
    VStack(spacing: Space.md) {
        ToastCapsule(toast: Toast("Couldn't sync. We'll retry.", tone: .danger), onDismiss: {}, onAction: {})
        ToastCapsule(toast: Toast("Set deleted", action: .init("Undo") {}), onDismiss: {}, onAction: {})
    }
    .padding()
    .koboTheme(Theme(palette: .lift, surfaceStyle: .solid))
    .preferredColorScheme(.dark)
}

#Preview("Capsule, AX3") {
    let toast = Toast(verbatim: "Set deleted from Bench Press", action: .init("Undo") {})
    ToastCapsule(toast: toast, onDismiss: {}, onAction: {})
        .padding()
        .dynamicTypeSize(.accessibility3)
}

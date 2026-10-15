import Foundation
import KoboTokens
import SwiftUI

extension View {
    /// Renders `center`'s current toast at the top of this view as a glass capsule that drops in, swipes away and is
    /// announced to VoiceOver. Attach it once, near the root of a window.
    public func toastHost(_ center: ToastCenter) -> some View {
        modifier(ToastHostModifier(center: center))
    }
}

extension Toast {
    /// A toast with a localized message, resolved from the app's bundle now.
    ///
    /// - Parameter duration: `nil` picks `defaultDuration(hasAction:)`: longer when there is an action to reach.
    nonisolated public init(
        _ message: LocalizedStringResource,
        tone: Tone = .neutral,
        symbol: String? = nil,
        action: Action? = nil,
        duration: Duration? = nil,
        id: UUID = UUID()
    ) {
        let message = String(localized: message)
        self.init(verbatim: message, tone: tone, symbol: symbol, action: action, duration: duration, id: id)
    }
}

extension Toast.Action {
    /// An action with a localized label ("Undo"), resolved from the app's bundle now.
    nonisolated public init(_ label: LocalizedStringResource, perform: @escaping @MainActor @Sendable () -> Void) {
        self.init(verbatim: String(localized: label), perform: perform)
    }
}

struct ToastHostModifier: ViewModifier {
    let center: ToastCenter
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            // A ForEach over the optional, not an `if`, so a replaced toast animates out while the new one drops in.
            ZStack(alignment: .top) {
                ForEach(center.current.map { [$0] } ?? []) { toast in
                    ToastCapsule(
                        toast: toast,
                        onDismiss: { center.dismiss(toast.id) },
                        onAction: { center.performAction(of: toast) }
                    )
                    .transition(Self.transition(reduceMotion: reduceMotion))
                }
            }
            .padding(.horizontal, Space.gutter)
            .padding(.top, Space.sm)
            .koboAnimation(.present, value: center.current?.id)
        }
        .onChange(of: center.current?.id) { _, id in
            guard id != nil, let toast = center.current else { return }
            AccessibilityNotification.Announcement(toast.announcement).post()
        }
    }

    /// Drops in from the top edge (the top-anchored twin of `Motion.rise`); a cross-fade with Reduce Motion on.
    static func transition(reduceMotion: Bool) -> AnyTransition {
        Motion.presentation(.move(edge: .top).combined(with: .opacity), reduceMotion: reduceMotion)
    }
}

/// The capsule itself: the tone glyph, the message and an optional trailing action.
struct ToastCapsule: View {
    let toast: Toast
    let onDismiss: () -> Void
    let onAction: () -> Void
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(spacing: Space.md) {
            message
            if let action = toast.action {
                Button(action: onAction) {
                    Text(verbatim: action.label)
                        .font(theme.font(.subheadline).weight(.bold))
                        .foregroundStyle(theme.palette.accentText)
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
        .modifier(ToastSwipeModifier(onDismiss: onDismiss))
    }

    private var message: some View {
        HStack(spacing: Space.sm) {
            Image(systemName: toast.resolvedSymbol)
                .foregroundStyle(theme.palette.status(toast.tone).ink)
                .accessibilityHidden(true)
            Text(verbatim: toast.message)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textPrimary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, Space.sm)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
        .accessibilityAction(named: Text("Dismiss", bundle: .module), onDismiss)
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

#Preview("Toast host") {
    @Previewable @State var center = ToastCenter()
    VStack(spacing: Space.md) {
        Button("Saved") { center.show(Toast("Workout saved", tone: .success)) }
        Button("Deleted, with Undo") {
            center.show(Toast("Set deleted", action: .init("Undo") {}))
        }
        Button("Error") { center.show(Toast("Couldn't sync. We'll retry.", tone: .danger)) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .toastHost(center)
    .onAppear { center.show(Toast("Set deleted", action: .init("Undo") {})) }
}

#Preview("Capsules, dark") {
    VStack(spacing: Space.md) {
        ToastCapsule(toast: Toast("Workout saved", tone: .success), onDismiss: {}, onAction: {})
        ToastCapsule(toast: Toast("Set deleted", action: .init("Undo") {}), onDismiss: {}, onAction: {})
    }
    .padding()
    .preferredColorScheme(.dark)
}

#Preview("Capsule, AX3") {
    let toast = Toast(verbatim: "Set deleted from Bench Press", action: .init("Undo") {})
    ToastCapsule(toast: toast, onDismiss: {}, onAction: {})
        .padding()
        .dynamicTypeSize(.accessibility3)
}

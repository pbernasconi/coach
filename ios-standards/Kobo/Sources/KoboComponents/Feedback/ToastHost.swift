import Foundation
import KoboTokens
import SwiftUI

extension View {
    /// Renders `center`'s current toast at the top of this view: a Liquid Glass capsule (a solid raised one under a
    /// `.solid` theme) that drops in, swipes away, pauses while a finger rests on it, plays its tone's haptic and is
    /// announced to VoiceOver. It hugs its message, capped so the bar buttons at either side stay uncovered. Attach it
    /// once, near the root of a window.
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
        playsFeedback: Bool = true,
        id: UUID = UUID()
    ) {
        self.init(
            verbatim: String(localized: message),
            tone: tone,
            symbol: symbol,
            action: action,
            duration: duration,
            playsFeedback: playsFeedback,
            id: id
        )
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
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            // A ForEach over the optional, not an `if`, so a replaced toast animates out while the new one drops in.
            ZStack(alignment: .top) {
                ForEach(center.current.map { [$0] } ?? []) { toast in
                    ToastCapsule(
                        toast: toast,
                        onDismiss: { center.dismiss(toast.id) },
                        onAction: { center.performAction(of: toast) },
                        onHold: { isHeld in isHeld ? center.hold(toast.id) : center.release(toast.id) }
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
        .onChange(of: voiceOverEnabled, initial: true) { _, isOn in center.isScreenReaderRunning = isOn }
        .koboFeedback(trigger: center.current) { old, new in
            guard let new, new.shouldPlayFeedback(replacing: old?.tone) else { return nil }
            return new.tone == .success ? .success : .error
        }
    }

    /// Drops in from the top edge (the top-anchored twin of `Motion.rise`); a cross-fade with Reduce Motion on.
    static func transition(reduceMotion: Bool) -> AnyTransition {
        Motion.presentation(.move(edge: .top).combined(with: .opacity), reduceMotion: reduceMotion)
    }
}

#if DEBUG
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
#endif

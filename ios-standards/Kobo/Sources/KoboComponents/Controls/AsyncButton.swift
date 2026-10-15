import KoboTokens
import SwiftUI

/// A button that runs an async, throwing action, such as a save. Taps are ignored while it runs. A spinner replaces
/// the label only if the action is still running after `Motion.Duration.spinnerDelay`, and then stays for at least
/// `Motion.Duration.spinnerHold`, so a quick answer never flickers. A success can pop a check mark; success and
/// failure each play a haptic.
///
///     AsyncButton("Save", width: .full) { try await store.save(draft) }
public struct AsyncButton<Label: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase = AsyncButtonPhase.idle
    @State private var runs = 0
    @State private var outcome: Outcome?
    private let variant: KoboButtonStyle.Variant
    private let size: KoboButtonStyle.Size
    private let width: KoboButtonStyle.Width
    private let confirmation: Confirmation
    private let successFeedback: HapticFeedback?
    private let failureFeedback: HapticFeedback?
    private let clock: any Clock<Duration>
    private let action: () async throws -> Void
    private let label: Label

    /// What a success shows before the label returns.
    public enum Confirmation: Sendable, Equatable {
        /// The label returns at once.
        case off
        /// A check mark pops in for a moment.
        case checkmark
    }

    private struct Outcome: Equatable {
        let run: Int
        let succeeded: Bool
    }

    /// - Parameter clock: Times the spinner delay and hold; tests pass a test clock.
    public init(
        _ variant: KoboButtonStyle.Variant = .primary,
        size: KoboButtonStyle.Size = .regular,
        width: KoboButtonStyle.Width = .hug,
        confirmation: Confirmation = .checkmark,
        successFeedback: HapticFeedback? = .success,
        failureFeedback: HapticFeedback? = .error,
        clock: any Clock<Duration> = ContinuousClock(),
        action: @escaping () async throws -> Void,
        @ViewBuilder label: () -> Label
    ) {
        self.variant = variant
        self.size = size
        self.width = width
        self.confirmation = confirmation
        self.successFeedback = successFeedback
        self.failureFeedback = failureFeedback
        self.clock = clock
        self.action = action
        self.label = label()
    }

    public var body: some View {
        Button(action: tap) {
            ZStack {
                label.opacity(phase == .succeeded ? 0 : 1)
                if phase == .succeeded {
                    Image(systemName: "checkmark")
                        .fontWeight(.bold)
                        .transition(Motion.pop(reduceMotion: reduceMotion))
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.kobo(variant, size: size, width: width, isLoading: phase.showsSpinner))
        .accessibilityValue(accessibilityValue)
        .koboFeedback(trigger: outcome) { _, new in
            guard let new else { return nil }
            return new.succeeded ? successFeedback : failureFeedback
        }
        .task(id: runs) { await perform() }
        .task(id: phase.timer) { await waitForTimer(phase.timer) }
    }

    private var accessibilityValue: Text {
        if phase == .succeeded { return Text("Done", bundle: .module) }
        return phase.showsSpinner ? Text("In progress", bundle: .module) : Text(verbatim: "")
    }

    private func tap() {
        guard phase.acceptsTaps else { return }
        send(.tapped)
        runs += 1
    }

    private func perform() async {
        guard runs > 0 else { return }
        let run = runs
        do {
            try await action()
            outcome = Outcome(run: run, succeeded: true)
            send(.finished(succeeded: true))
        } catch is CancellationError {
            send(.finished(succeeded: false))
        } catch {
            outcome = Outcome(run: run, succeeded: false)
            send(.finished(succeeded: false))
        }
    }

    private func waitForTimer(_ timer: AsyncButtonPhase.Timer) async {
        guard let duration = timer.duration else { return }
        guard (try? await clock.sleep(for: duration)) != nil, !Task.isCancelled else { return }
        switch timer {
        case .spinnerDelay: send(.delayElapsed)
        case .spinnerHold: send(.holdElapsed)
        case .confirmation: send(.confirmationElapsed)
        case .off: break
        }
    }

    private func send(_ event: AsyncButtonPhase.Event) {
        withKoboAnimation(.state, reduceMotion: reduceMotion) {
            phase = phase.reduce(event, confirmsSuccess: confirmation == .checkmark)
        }
    }
}

extension AsyncButton where Label == Text {
    /// A text-labelled async button.
    public init(
        _ titleKey: LocalizedStringKey,
        variant: KoboButtonStyle.Variant = .primary,
        size: KoboButtonStyle.Size = .regular,
        width: KoboButtonStyle.Width = .hug,
        confirmation: Confirmation = .checkmark,
        clock: any Clock<Duration> = ContinuousClock(),
        action: @escaping () async throws -> Void
    ) {
        self.init(
            variant,
            size: size,
            width: width,
            confirmation: confirmation,
            clock: clock,
            action: action,
            label: { Text(titleKey) }
        )
    }
}

#if DEBUG
    private struct PreviewFailure: Error {}

    private struct AsyncButtonGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(spacing: Space.md) {
                AsyncButton("Save (fast)", width: .full) {}
                AsyncButton("Save (slow)", width: .full) { try await ContinuousClock().sleep(for: .seconds(2)) }
                AsyncButton("Fails", variant: .destructive, width: .full) { throw PreviewFailure() }
                AsyncButton(.glass, size: .compact, confirmation: .off) {
                } label: {
                    Label("Sync", systemImage: "arrow.clockwise")
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Async button") { AsyncButtonGallery() }
    #Preview("Async button · dark") { AsyncButtonGallery().preferredColorScheme(.dark) }
    #Preview("Async button · AX3") { AsyncButtonGallery().dynamicTypeSize(.accessibility3) }
#endif

import KoboTokens
import SwiftUI

/// The line that says why a wait is long, for a `SlowWait` stage: nothing at first, "Still working on it…" after
/// `SlowWait.slowAfter`, and "This is taking longer than usual." after `SlowWait.verySlowAfter` (the same copy as
/// `LoadingState`). VoiceOver hears each new line. Place it under a control that is waiting; a full-screen wait is
/// `LoadingState`, which shows these lines itself.
///
///     @State private var wait = SlowWait.none
///     VStack { saveButton; SlowWaitNote(wait) }
///         .slowWait(isWaiting: isSaving, stage: $wait)
public struct SlowWaitNote: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let stage: SlowWait
    private let slowText: String
    private let verySlowText: String

    /// - Parameters:
    ///   - slow: overrides "Still working on it…" (resolve it with `String(localized:)`).
    ///   - verySlow: overrides "This is taking longer than usual." ("Keep the app open and don't submit again").
    public init(_ stage: SlowWait, slow: String? = nil, verySlow: String? = nil) {
        self.stage = stage
        self.slowText = slow ?? String(localized: "Still working on it…", bundle: .module)
        self.verySlowText =
            verySlow ?? String(localized: "This is taking longer than usual.", bundle: .module)
    }

    public var body: some View {
        ZStack {
            if let text {
                Label {
                    Text(verbatim: text)
                } icon: {
                    Image(systemName: stage == .verySlow ? "exclamationmark.circle" : "hourglass")
                        .accessibilityHidden(true)
                }
                .font(theme.font(.footnote))
                .foregroundStyle(stage == .verySlow ? theme.palette.warning.ink : theme.palette.textSecondary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .transition(Motion.fade(reduceMotion: reduceMotion))
                .id(stage)
            }
        }
        .announceOnRisingEdge(text)
    }

    private var text: String? {
        switch stage {
        case .none: nil
        case .slow: slowText
        case .verySlow: verySlowText
        }
    }
}

#if DEBUG
    private struct SlowWaitNotePreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                ForEach(Array(SlowWait.allCases.enumerated()), id: \.offset) { _, stage in
                    SlowWaitNote(stage)
                }
            }
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Slow wait note") { SlowWaitNotePreview() }
    #Preview("Slow wait note · dark, Lift") { SlowWaitNotePreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Slow wait note · AX3") { SlowWaitNotePreview().dynamicTypeSize(.accessibility3) }
#endif

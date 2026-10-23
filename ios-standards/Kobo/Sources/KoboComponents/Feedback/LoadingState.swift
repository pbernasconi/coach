import KoboTokens
import SwiftUI

/// A quiet centred spinner (in the tertiary text colour, not the accent) with an optional caption, for a wait whose
/// result has no known shape. When the shape is known, draw `Skeleton`s with `.skeletonPage()` instead. It stays
/// invisible for `Motion.Duration.loadingGrace` (`.loadingGrace()`), so a fast load shows no spinner at all.
///
/// A long wait says so: after `SlowWait.slowAfter` (2 s) a second line reads "Still working on it…", and after
/// `SlowWait.verySlowAfter` (15 s) "This is taking longer than usual.". VoiceOver hears each change. Turn it off with
/// `showsSlowWait: false` for a wait that is long by nature (an export).
///
///     LoadingState("Loading your plan")
public struct LoadingState: View {
    private let label: Text?
    private let showsSlowWait: Bool
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var wait = SlowWait.none

    /// - Parameter label: a short caption ("Loading your plan"); VoiceOver reads "Loading" without one.
    public init(_ label: LocalizedStringKey? = nil, showsSlowWait: Bool = true) {
        self.label = label.map { Text($0) }
        self.showsSlowWait = showsSlowWait
    }

    /// A caption shown as is (a name from user data); an empty one reads as no caption.
    public init(verbatim label: String, showsSlowWait: Bool = true) {
        self.label = label.isEmpty ? nil : Text(verbatim: label)
        self.showsSlowWait = showsSlowWait
    }

    public var body: some View {
        VStack(spacing: Space.md) {
            ProgressView()
                .controlSize(.large)
                .tint(theme.palette.textTertiary)
            VStack(spacing: Space.xxs) {
                if let label {
                    label.font(theme.font(.subheadline)).foregroundStyle(theme.palette.textSecondary)
                }
                if let slowCopy {
                    slowCopy
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                        .transition(Motion.fade(reduceMotion: reduceMotion))
                }
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .koboAnimation(.enter, value: wait)
        }
        .padding(Space.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? Text("Loading", bundle: .module))
        .accessibilityValue(slowCopy ?? Text(verbatim: ""))
        .accessibilityAddTraits(.updatesFrequently)
        .slowWait(isWaiting: showsSlowWait, stage: $wait)
        .loadingGrace()
        .onChange(of: wait) { _, stage in
            guard let spoken = Self.spokenSlowCopy(stage) else { return }
            AccessibilityNotification.Announcement(spoken).post()
        }
    }

    private var slowCopy: Text? {
        switch wait {
        case .none: nil
        case .slow: Text("Still working on it…", bundle: .module)
        case .verySlow: Text("This is taking longer than usual.", bundle: .module)
        }
    }

    private static func spokenSlowCopy(_ stage: SlowWait) -> String? {
        switch stage {
        case .none: nil
        case .slow: String(localized: "Still working on it…", bundle: .module)
        case .verySlow: String(localized: "This is taking longer than usual.", bundle: .module)
        }
    }
}

#if DEBUG
    #Preview("Loading") {
        VStack {
            LoadingState()
            LoadingState("Loading your plan")
        }
    }

    #Preview("Loading, dark") {
        LoadingState("Loading your plan").preferredColorScheme(.dark)
    }

    #Preview("Loading, AX3") {
        LoadingState("Loading your plan").dynamicTypeSize(.accessibility3)
    }
#endif

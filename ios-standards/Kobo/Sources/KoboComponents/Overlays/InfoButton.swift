import KoboTokens
import SwiftUI

/// The ⓘ beside a term people may not know ("Training load", "RPE"). The glyph lays out at its own small size, while
/// its 44pt target reaches into the space around it, so the line it sits on keeps its height.
///
///     HStack { Text("Training load"); InfoButton("Training load", message: "How hard the last seven days were.") }
///     InfoButton(accessibilityLabel: "About rest timers") { showsRestHelp = true }
///
/// The `title:message:` form owns its `InfoSheet`, the way a `Menu` owns its list, and VoiceOver reads it as
/// "About Training load". The `accessibilityLabel:action:` form only reports the tap.
public struct InfoButton: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var glyphSize = Size.iconSm
    @State private var isShowingSheet = false
    private let label: Text
    private let explainer: InfoButtonExplainer?
    private let action: (() -> Void)?

    /// An ⓘ that runs `action`; the label says what it explains ("About rest timers").
    public init(accessibilityLabel: LocalizedStringKey, action: @escaping () -> Void) {
        label = Text(accessibilityLabel)
        explainer = nil
        self.action = action
    }

    /// An ⓘ that opens a one-paragraph `InfoSheet` about `title`.
    public init(_ title: LocalizedStringKey, message: LocalizedStringKey, learnMore: URL? = nil) {
        let title = Text(title)
        label = Text("About \(title)", bundle: .module)
        explainer = InfoButtonExplainer(title: title, message: Text(message), learnMore: learnMore)
        action = nil
    }

    /// An ⓘ that opens an `InfoSheet` whose title and message are shown as is (they come from a server).
    public init(verbatim title: String, message: String, learnMore: URL? = nil) {
        let title = Text(verbatim: title)
        label = Text("About \(title)", bundle: .module)
        explainer = InfoButtonExplainer(title: title, message: Text(verbatim: message), learnMore: learnMore)
        action = nil
    }

    public var body: some View {
        Button(action: tap) {
            Image(systemName: "info.circle")
                .font(.system(size: glyphSize))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(width: Size.minTouch, height: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(-overhang)
        .accessibilityLabel(label)
        .sheet(isPresented: $isShowingSheet) {
            if let explainer {
                InfoSheet(title: explainer.title, learnMore: explainer.learnMore, content: explainer.message)
            }
        }
    }

    /// How far the 44pt target reaches past the glyph on each side.
    private var overhang: CGFloat { max(Size.minTouch - glyphSize, 0) / 2 }

    private func tap() {
        if let action { action() } else { isShowingSheet = true }
    }
}

private struct InfoButtonExplainer {
    let title: Text
    let message: Text
    let learnMore: URL?
}

#if DEBUG
    private struct InfoButtonPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var taps = 0

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack(spacing: Space.xs) {
                    Text("Training load").font(theme.font(.headline))
                    InfoButton(
                        "Training load",
                        message: "Training load adds up how hard each session was over the last seven days.",
                        learnMore: URL(string: "https://example.com/training-load")
                    )
                }
                HStack(spacing: Space.xs) {
                    Text("RPE").font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
                    InfoButton(accessibilityLabel: "About RPE") { taps += 1 }
                }
                Text(verbatim: "Custom taps: \(taps)").font(theme.font(.footnote))
            }
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Light") { InfoButtonPreview() }
    #Preview("Dark") { InfoButtonPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { InfoButtonPreview().dynamicTypeSize(.accessibility3) }
#endif

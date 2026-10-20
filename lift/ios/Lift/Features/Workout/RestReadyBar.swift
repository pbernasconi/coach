import KoboComponents
import KoboTokens
import SwiftUI

/// The rest bar once the rest ran out: "Rest over +0:12", counting up, over the next set ("Back squat · Set 3",
/// "5 @ 110 kg"), with Log set and a close button. Log set ticks that set, which starts its rest; tapping the set's
/// name scrolls to it. It only draws.
struct RestReadyBar: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let ready: RestReady
    let onFocus: () -> Void
    let onLog: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        layout {
            Button(action: onFocus) { summary }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityHint(Text("Scrolls to the set"))
            HStack(spacing: Space.sm) {
                Button("Log set", action: onLog)
                    .buttonStyle(.kobo(.primary, size: .compact))
                    .accessibilityLabel(Text("Log \(ready.title)"))
                IconButton("xmark", accessibilityLabel: "Close", style: .tonal, size: .small, action: onDismiss)
            }
        }
        .padding(.horizontal, Space.cardInset)
        .padding(.vertical, Space.md)
        .background { RestBarPanel(isReady: true) }
    }

    /// "Rest over +0:12" in amber, then the next set and its target.
    private var summary: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Label {
                Text("Rest over +\(ready.since, style: .timer)")
                    .monospacedDigit()
            } icon: {
                Image(systemName: "bolt.fill").accessibilityHidden(true)
            }
            .font(theme.font(.footnote).weight(.semibold))
            .foregroundStyle(theme.palette.accentText)
            Text(verbatim: ready.title)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
            Text(verbatim: ready.target)
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
        }
        .lineLimit(1)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    /// Side by side, or stacked at accessibility sizes so nothing truncates.
    private var layout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
            : AnyLayout(HStackLayout(spacing: Space.md))
    }
}

#if DEBUG
    private struct RestReadyBarPreview: View {
        let ready = RestReady(
            setID: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3)),
            title: "Back squat · Set 3",
            target: "5 @ 245 lb",
            since: .now.addingTimeInterval(-12)
        )

        var body: some View {
            ScrollView {
                VStack(spacing: Space.md) {
                    ForEach(1..<16) { index in
                        Text(verbatim: "Set \(index)    245 lb × 5")
                            .koboCard()
                    }
                }
                .pageGutter()
            }
            .background(Theme.lift.palette.canvas)
            .pinnedFooter(style: .glass) {
                RestReadyBar(ready: ready, onFocus: {}, onLog: {}, onDismiss: {})
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Light") { RestReadyBarPreview() }
    #Preview("Dark") { RestReadyBarPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { RestReadyBarPreview().dynamicTypeSize(.accessibility3) }
#endif

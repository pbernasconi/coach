import KoboTokens
import SwiftUI

/// A row in a rounded tonal card: a round glyph disc, the title and a trailing slot (a `StatusPill`, a value), on the
/// sunken fill with no border. It is one button with press feedback and reads as one VoiceOver element. A page leads
/// with a few of them (the settings that matter most) before its plain rows.
///
///     TonalCardRow("Reminders", systemImage: "bell", action: openReminders) {
///         StatusPill("On", tone: .success)
///     }
public struct TonalCardRow<Trailing: View>: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var discSize = Size.minTouch - Space.xs
    private let title: Text
    private let systemImage: String
    private let action: () -> Void
    private let trailing: Trailing

    public init(
        _ title: LocalizedStringKey,
        systemImage: String,
        action: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = Text(title)
        self.systemImage = systemImage
        self.action = action
        self.trailing = trailing()
    }

    /// A row whose title is shown as is.
    public init(
        verbatim title: String,
        systemImage: String,
        action: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = Text(verbatim: title)
        self.systemImage = systemImage
        self.action = action
        self.trailing = trailing()
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Space.md) {
                Image(systemName: systemImage)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(width: discSize, height: discSize)
                    .background(theme.palette.canvas, in: Circle())
                    .accessibilityHidden(true)
                title
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                trailing
            }
            .padding(Space.lg)
            .background(theme.palette.surfaceSunken, in: shape)
            .contentShape(shape)
        }
        .buttonStyle(.pressFeedback)
        .accessibilityElement(children: .combine)
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.lg, style: .continuous) }
}

extension TonalCardRow where Trailing == EmptyView {
    /// A row with no trailing slot.
    public init(_ title: LocalizedStringKey, systemImage: String, action: @escaping () -> Void) {
        self.init(title, systemImage: systemImage, action: action) { EmptyView() }
    }
}

#if DEBUG
    private struct TonalCardRowPreview: View {
        var body: some View {
            VStack(spacing: Space.md) {
                TonalCardRow("Reminders", systemImage: "bell", action: {}) {
                    StatusPill("On", tone: .success)
                }
                TonalCardRow("Health sync", systemImage: "heart", action: {}) {
                    StatusPill("Off", tone: .neutral)
                }
                TonalCardRow("Units", systemImage: "scalemass", action: {})
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Tonal card row") { TonalCardRowPreview() }
    #Preview("Tonal card row · dark, Amber") { TonalCardRowPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Tonal card row · AX3") { TonalCardRowPreview().dynamicTypeSize(.accessibility3) }
#endif

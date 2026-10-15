import KoboTokens
import SwiftUI

/// A settings row with a switch: a title, an optional subtitle and an optional leading symbol. The whole row is the
/// target and reads as one switch. The subtitle is never clamped, so nothing the user must read is cut off.
///
///     ToggleRow("Auto-start rest", subtitle: "Starts when you log a set", systemImage: "timer", isOn: $autoRest)
public struct ToggleRow: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var iconWidth = Size.iconLg
    private let title: LocalizedStringKey
    private let subtitle: LocalizedStringKey?
    private let systemImage: String?
    private let isOn: Binding<Bool>

    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        systemImage: String? = nil,
        isOn: Binding<Bool>
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.isOn = isOn
    }

    public var body: some View {
        Toggle(isOn: isOn) {
            HStack(spacing: Space.md) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.accentText)
                        .frame(width: iconWidth)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text(title).font(theme.font(.body))
                    if let subtitle {
                        Text(subtitle)
                            .font(theme.font(.footnote))
                            .foregroundStyle(theme.palette.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.vertical, Space.md)
            .padding(.leading, Space.lg)
        }
        .toggleStyle(.kobo)
        .padding(.trailing, Space.lg)
        .frame(minHeight: Size.rowMinHeight)
    }
}

#if DEBUG
    private struct ToggleRowGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var autoRest = true
        @State private var sounds = false

        var body: some View {
            VStack(spacing: 0) {
                ToggleRow(
                    "Auto-start rest",
                    subtitle: "Starts the timer when you log a set.",
                    systemImage: "timer",
                    isOn: $autoRest
                )
                ToggleRow("Sounds", systemImage: "speaker.wave.2", isOn: $sounds)
                ToggleRow("Plate maths", isOn: .constant(true)).disabled(true)
            }
            .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.lg))
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Toggle row") { ToggleRowGallery() }
    #Preview("Toggle row · dark") { ToggleRowGallery().preferredColorScheme(.dark) }
    #Preview("Toggle row · AX3") { ToggleRowGallery().dynamicTypeSize(.accessibility3) }
#endif

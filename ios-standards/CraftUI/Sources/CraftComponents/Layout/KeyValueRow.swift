import CraftTokens
import SwiftUI

/// A label and its value on one line (label leading, value trailing), stacked at accessibility sizes.
/// Reads as one VoiceOver element ("Total volume, 4,200 kg"). Inside a `ListSection` it draws its separator.
///
///     KeyValueRow("Total volume", value: "4,200 kg")
public struct KeyValueRow: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let key: String
    private let value: String
    private let valueTone: Tone?

    /// - Parameter valueTone: tints the value (for example `.success`); the text still carries the meaning.
    public init(_ key: String, value: String, valueTone: Tone? = nil) {
        self.key = key
        self.value = value
        self.valueTone = valueTone
    }

    public var body: some View {
        layout {
            Text(key)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(maxWidth: dynamicTypeSize.isAccessibilitySize ? nil : .infinity, alignment: .leading)
            Text(value)
                .font(theme.font(.numeric))
                .foregroundStyle(valueColor)
                .multilineTextAlignment(dynamicTypeSize.isAccessibilitySize ? .leading : .trailing)
        }
        .padding(.horizontal, Space.lg)
        .padding(.vertical, Space.rowVertical)
        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
        .accessibilityElement(children: .combine)
        .listSectionSeparator(leadingInset: Space.lg)
    }

    private var layout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.xxs))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: Space.md))
    }

    private var valueColor: Color {
        guard let valueTone else { return theme.palette.textPrimary }
        return theme.palette.status(valueTone).ink
    }
}

#if DEBUG
    private struct KeyValueRowPreview: View {
        var body: some View {
            ScrollView {
                ListSection("Summary") {
                    KeyValueRow("Duration", value: "1 h 12 min")
                    KeyValueRow("Total volume", value: "4,200 kg")
                    KeyValueRow("Change", value: "+5%", valueTone: .success)
                }
                .padding(Space.gutter)
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { KeyValueRowPreview() }
    #Preview("Dark") { KeyValueRowPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { KeyValueRowPreview().dynamicTypeSize(.accessibility3) }
#endif

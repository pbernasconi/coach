import KoboTokens
import SwiftUI

/// A label and its value on one line (label leading, value trailing), stacked at accessibility sizes.
/// Reads as one VoiceOver element ("Total distance, 1,240 km"). Inside a `ListSection` it draws its separator.
///
///     KeyValueRow("Total distance", value: "1,240 km")
public struct KeyValueRow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.listSectionStyle) private var style
    private let key: Text
    private let value: String
    private let valueTone: Tone?

    /// A localized label and a value shown as is.
    ///
    /// - Parameter valueTone: tints the value (for example `.success`); the text still carries the meaning.
    public init(_ key: LocalizedStringKey, value: String, valueTone: Tone? = nil) {
        self.key = Text(key)
        self.value = value
        self.valueTone = valueTone
    }

    /// A label and a value both shown as is (user-defined fields).
    public init(verbatim key: String, value: String, valueTone: Tone? = nil) {
        self.key = Text(verbatim: key)
        self.value = value
        self.valueTone = valueTone
    }

    public var body: some View {
        layout {
            key
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(maxWidth: dynamicTypeSize.isAccessibilitySize ? nil : .infinity, alignment: .leading)
            Text(verbatim: value)
                .font(theme.font(.numeric))
                .foregroundStyle(valueColor)
                .multilineTextAlignment(dynamicTypeSize.isAccessibilitySize ? .leading : .trailing)
        }
        .padding(.horizontal, style.rowInset)
        .padding(.vertical, Space.rowVertical)
        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
        .accessibilityElement(children: .combine)
        .listSectionSeparator(leadingInset: style.separatorInset(leadingWidth: 0))
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
                    KeyValueRow("Total distance", value: "1,240 km")
                    KeyValueRow("Change", value: "+5%", valueTone: .success)
                }
                .padding(.vertical, Space.gutter)
                .pageGutter()
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { KeyValueRowPreview() }
    #Preview("Dark") { KeyValueRowPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { KeyValueRowPreview().dynamicTypeSize(.accessibility3) }
#endif

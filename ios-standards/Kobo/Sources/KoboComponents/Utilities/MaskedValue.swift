import KoboTokens
import SwiftUI

/// A fixed mask that never holds the real value: bullets with an optional prefix and a revealed tail ("••1234",
/// "$•••"). It only draws; the font and ink come from the caller. VoiceOver reads "Hidden" (and the tail), not the
/// bullets. To let the person reveal the value, use `RevealableValue`.
///
///     MaskedValue(tail: "4242")
///     MaskedValue(prefix: "$", mask: "•••")
public struct MaskedValue: View {
    private let text: String
    private let tail: String?
    private let label: Text?

    /// - Parameters:
    ///   - prefix: drawn before the mask ("$").
    ///   - tail: the revealed trailing characters ("1234").
    ///   - mask: the bullets; two by default.
    ///   - tailSeparator: between the mask and the tail; none by default.
    ///   - accessibilityLabel: replaces the spoken "Hidden".
    public init(
        prefix: String? = nil,
        tail: String? = nil,
        mask: String = "••",
        tailSeparator: String = "",
        accessibilityLabel: LocalizedStringKey? = nil
    ) {
        self.text = MaskedValueText.text(prefix: prefix, tail: tail, mask: mask, tailSeparator: tailSeparator)
        self.tail = tail?.isEmpty == false ? tail : nil
        self.label = accessibilityLabel.map { Text($0) }
    }

    public var body: some View {
        Text(verbatim: text)
            .monospacedDigit()
            .accessibilityLabel(spokenLabel)
    }

    private var spokenLabel: Text {
        if let label { return label }
        guard let tail else { return Text("Hidden", bundle: .module) }
        return Text("Hidden, ending in \(tail)", bundle: .module)
    }
}

#if DEBUG
    private struct MaskedValuePreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                MaskedValue(tail: "4242")
                MaskedValue(prefix: "$", mask: "•••")
                MaskedValue(tail: "42", mask: "•••• ••••", tailSeparator: " ")
            }
            .font(theme.font(.title2))
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Masked value") { MaskedValuePreview() }
    #Preview("Masked value · dark, Amber") { MaskedValuePreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Masked value · AX3") { MaskedValuePreview().dynamicTypeSize(.accessibility3) }
#endif

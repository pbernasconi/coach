import KoboComponents
import KoboTokens
import SwiftUI

/// How fast fitness (CTL) changed over 7, 28, 90 and 365 days; a high or aggressive rate is marked "▲" in red.
struct TrendsRampSection: View {
    let ramp: TrendsRamp
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            ListSection {
                ForEach(ramp.rates, id: \.days) { rate in
                    KeyValueRow(verbatim: rate.label, value: text(rate), valueTone: rate.warn ? .danger : nil)
                }
            }
            if let note = ramp.note {
                Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    /// "+4.0 · +1.0/wk · Steady", with "▲" first when it warns.
    private func text(_ rate: TrendsRamp.Rate) -> String {
        let level = rate.warn ? "▲ \(rate.levelText)" : rate.levelText
        return [rate.changeText, rate.perWeekText, level].compactMap(\.self).joined(separator: " · ")
    }
}

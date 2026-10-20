import Foundation
import KoboTokens
import SwiftUI

/// The calm stand-in a chart shows when it has no data: the chart's height on a sunken surface, with "No data".
struct ChartEmpty: View {
    @Environment(\.koboTheme) private var theme
    let height: CGFloat
    let label: Text

    var body: some View {
        Text(verbatim: ChartSpeech.noData)
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(theme.palette.surfaceSunken, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(Text(verbatim: ChartSpeech.noData))
    }
}

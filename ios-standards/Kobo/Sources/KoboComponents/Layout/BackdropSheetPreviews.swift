import KoboTokens
import SwiftUI

/// A made-up trip page for the catalogue and the previews: a coloured backdrop, a sheet with rows, a title that shows
/// once the sheet is up.
public struct BackdropSheetSample: View {
    @Environment(\.koboTheme) private var theme
    @State private var detent: BackdropSheetDetent = .medium

    public init() {}

    private struct Stop: Identifiable {
        let id: Int
        var name: String { "Stop \(id)" }
    }

    private static let stops = (1...12).map(Stop.init)

    public var body: some View {
        BackdropSheet(detent: $detent) { _ in
            LinearGradient(
                colors: [theme.palette.info.soft, theme.palette.success.soft],
                startPoint: .top,
                endPoint: .bottom
            )
        } sheet: {
            VStack(alignment: .leading, spacing: Space.md) {
                Text(verbatim: "Coastal walk")
                    .font(theme.font(.title2).weight(.bold))
                    .foregroundStyle(theme.palette.textPrimary)
                ForEach(Self.stops) { stop in
                    Text(verbatim: stop.name)
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Space.gutter)
        } overlay: { state in
            Text(verbatim: "Coastal walk")
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .padding(.top, state.topInset - Space.xxl)
                .opacity(state.expansion)
        }
    }
}

#if DEBUG
    #Preview("Backdrop sheet") { BackdropSheetSample() }
    #Preview("Backdrop sheet, dark") { BackdropSheetSample().preferredColorScheme(.dark) }
    #Preview("Backdrop sheet, AX3") { BackdropSheetSample().dynamicTypeSize(.accessibility3) }
#endif

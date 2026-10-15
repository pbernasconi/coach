import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: one flat section per bundled third-party work, with its licence and source links, under the inline title
/// every pushed screen uses (SCR-2).
struct AcknowledgementsContent: View {
    let state: AcknowledgementsState
    let send: (AcknowledgementsAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                ForEach(state.items) { item in
                    AcknowledgementSection(item: item, send: send)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text("Acknowledgements"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One acknowledgement, flat on the page keyline: name, licence tag, what it is, and its links.
private struct AcknowledgementSection: View {
    @Environment(\.koboTheme) private var theme
    let item: Acknowledgement
    let send: (AcknowledgementsAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(verbatim: item.title)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            KoboTag(verbatim: item.license, tone: .neutral, style: .outline)
            Text(verbatim: item.detail)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Space.lg) {
                if let url = item.licenseURL {
                    TextLink("Licence") { send(.linkTapped(url)) }
                }
                if let url = item.sourceURL {
                    TextLink("Source") { send(.linkTapped(url)) }
                }
            }
        }
    }
}

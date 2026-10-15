import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: one card per bundled third-party work, with its licence and source links (SCR-2).
struct AcknowledgementsContent: View {
    let state: AcknowledgementsState
    let send: (AcknowledgementsAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                AppHeader("Acknowledgements")
                VStack(alignment: .leading, spacing: Space.xxl) {
                    ForEach(state.items) { item in
                        AcknowledgementCard(item: item, send: send)
                    }
                }
                .pageGutter()
                .padding(.bottom, Space.xxl)
            }
        }
        .screenCanvas()
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One acknowledgement: name, licence tag, what it is, and its links.
private struct AcknowledgementCard: View {
    @Environment(\.koboTheme) private var theme
    let item: Acknowledgement
    let send: (AcknowledgementsAction) -> Void

    var body: some View {
        CardSection(verbatim: item.title) {
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

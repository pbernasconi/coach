import KoboComponents
import KoboTokens
import SwiftUI

/// The past chats behind the top bar's clock: each titled by its first message, with how long ago it was. A tap
/// opens that chat again.
struct CoachHistoryList: View {
    @Environment(\.koboTheme) private var theme
    let history: CoachHistory
    let send: (CoachAction) -> Void

    var body: some View {
        switch history {
        case .closed, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: Size.minTouch * 3)
        case .failed(let reason):
            Text(verbatim: reason)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(maxWidth: .infinity, minHeight: Size.minTouch * 3)
        case .loaded(let threads) where threads.isEmpty:
            Text("No past chats yet.")
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(maxWidth: .infinity, minHeight: Size.minTouch * 3)
        case .loaded(let threads):
            ListSection {
                ForEach(threads) { thread in
                    ListRow(verbatim: thread.title, subtitle: subtitle(thread)) {
                        send(.threadPicked(thread.id))
                    } leading: {
                        Image(systemName: "bubble.left").foregroundStyle(theme.palette.textSecondary)
                    }
                }
            }
        }
    }

    private func subtitle(_ thread: CoachThreadSummary) -> String {
        let count = String(localized: "\(thread.messageCount) messages")
        guard let date = thread.updatedAt else { return count }
        return "\(date.formatted(.relative(presentation: .named))) · \(count)"
    }
}

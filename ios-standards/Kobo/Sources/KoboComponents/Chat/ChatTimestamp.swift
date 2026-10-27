import KoboTokens
import SwiftUI

/// A quiet, centred time line between groups of chat rows: "Today 08:01", "Yesterday 18:31", "Oct 26 at 11:33".
/// `ChatTranscript.timestamps(_:)` places them; use it on its own only outside a transcript.
///
///     ChatTimestamp(message.sentAt, now: .now)
public struct ChatTimestamp: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    @Environment(\.locale) private var locale
    @Environment(\.timeZone) private var timeZone
    private let date: Date
    private let now: Date

    /// A line for `date`, worded against `now` (today, yesterday, a weekday, a date).
    public init(_ date: Date, now: Date) {
        self.date = date
        self.now = now
    }

    public var body: some View {
        Text(verbatim: ChatTimestampLogic.label(for: date, now: now, calendar: wordingCalendar))
            .font(theme.font(.caption))
            .foregroundStyle(theme.palette.textTertiary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.top, Space.xs)
    }

    private var wordingCalendar: Calendar {
        var calendar = calendar
        calendar.locale = locale
        calendar.timeZone = timeZone
        return calendar
    }
}

#if DEBUG
    private struct ChatTimestampPreview: View {
        private let now = Date.now

        var body: some View {
            VStack(spacing: Space.xxl) {
                ChatTimestamp(now.addingTimeInterval(-10 * 60), now: now)
                ChatTimestamp(now.addingTimeInterval(-26 * 3600), now: now)
                ChatTimestamp(now.addingTimeInterval(-4 * 86400), now: now)
                ChatTimestamp(now.addingTimeInterval(-30 * 86400), now: now)
            }
            .pageColumn()
            .screenCanvas()
        }
    }

    #Preview("Timestamp") { ChatTimestampPreview() }
    #Preview("Timestamp · dark") { ChatTimestampPreview().preferredColorScheme(.dark) }
    #Preview("Timestamp · AX3") { ChatTimestampPreview().dynamicTypeSize(.accessibility3) }
#endif

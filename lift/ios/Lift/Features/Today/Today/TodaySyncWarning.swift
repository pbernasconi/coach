import KoboComponents
import LiftSync
import SwiftUI

/// The Garmin sync warning, only when there is one (no date or "synced … ago" line, as on TrainingPeaks).
struct TodaySyncWarning: View {
    let status: GarminStatus?

    var body: some View {
        if let warning = status?.warning {
            InlineNotice(verbatim: warning.text, tone: warning.level == "error" ? .danger : .warning)
        }
    }
}

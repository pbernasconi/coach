import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The web's Trends page, section by section. A section that failed on the server shows its own line; the others
/// still show.
struct TrendsPage: View {
    let trends: TrendsResponse
    let peaksWindow: String
    let send: (TrainingAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            AppSectionView("Performance", section: trends.performance) { performance in
                TrendsPerformanceSection(performance: performance)
            }
            AppSectionView("Ramp rate", section: trends.ramp) { ramp in TrendsRampSection(ramp: ramp) }
            AppSectionView("Peaks", section: trends.peaks) { peaks in
                TrendsPeaksSection(peaks: peaks, window: peaksWindow, send: send)
            }
            AppSectionView("Lift", section: trends.lift) { lift in TrendsLiftSection(lift: lift, send: send) }
        }
    }
}

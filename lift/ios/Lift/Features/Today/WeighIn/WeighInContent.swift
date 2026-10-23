import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: one day's weigh-in (SCR-2). Today's reading is the hero; under it, smaller, how it is tracking: the
/// trend and its rate, the readings against the trend line, one sentence on today against the trend, then the
/// changes, body fat and the weigh-ins either side.
struct WeighInContent: View {
    let state: WeighInState
    let send: (WeighInAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(
                state.weighIn,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { weighIn in
                WeighInSections(weighIn: weighIn, state: state, send: send)
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: state.weighIn.content.value?.dateText ?? String(localized: "Weigh-in")))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The hero, the trend card, the details, then the neighbouring days.
private struct WeighInSections: View {
    @Environment(\.koboTheme) private var theme
    let weighIn: AppWeighIn
    let state: WeighInState
    let send: (WeighInAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            WeighInHero(weighIn: weighIn, timeText: state.timeText)
            if let chart = state.chart {
                VStack(alignment: .leading, spacing: Space.md) {
                    WeighInTrendPlot(chart: chart)
                    WeighInPlotKey()
                }
                .koboCard()
            }
            if let note = weighIn.trend?.noteText {
                InlineNotice(verbatim: note)
            }
            WeighInDetails(weighIn: weighIn)
            WeighInNeighbours(neighbours: state.neighbours, send: send)
            if let source = WeighInText.source(weighIn.source) {
                Text(verbatim: source)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}

/// The changes since the last weigh-in and over 4 weeks, then body fat when the scale measured it.
private struct WeighInDetails: View {
    let weighIn: AppWeighIn

    var body: some View {
        if !weighIn.changes.isEmpty || weighIn.bodyFat != nil {
            ListSection {
                ForEach(weighIn.changes) { change in
                    KeyValueRow(verbatim: change.label, value: change.text, valueTone: change.tone.kobo)
                }
                if let bodyFat = weighIn.bodyFat {
                    KeyValueRow("Body fat", value: bodyFat.text)
                }
            }
        }
    }
}

/// The earlier and the later weigh-in, when there are any.
private struct WeighInNeighbours: View {
    let neighbours: [WeighInNeighbour]
    let send: (WeighInAction) -> Void

    var body: some View {
        if !neighbours.isEmpty {
            ListSection {
                ForEach(neighbours) { row in
                    switch row.side {
                    case .earlier:
                        ListRow("Earlier weigh-in", value: row.dayText, action: { send(.dayTapped(row.day)) })
                    case .later:
                        ListRow("Later weigh-in", value: row.dayText, action: { send(.dayTapped(row.day)) })
                    }
                }
            }
        }
    }
}

/// Plain labels for the weigh-in screen.
nonisolated enum WeighInText {
    /// "From the Renpho scale", or nil when the source is unknown.
    static func source(_ source: String?) -> String? {
        switch source {
        case "renpho": String(localized: "From the Renpho scale")
        case "garmin": String(localized: "From Garmin")
        case "apple_health": String(localized: "From Apple Health")
        case let other?: String(localized: "From \(other)")
        case nil: nil
        }
    }

    /// "Weighed at 7:12 AM", or "Weight" when the time is unknown.
    static func heroLabel(_ timeText: String?) -> String {
        timeText.map { String(localized: "Weighed at \($0)") } ?? String(localized: "Weight")
    }
}

import Foundation
import LiftSync
import Testing

@testable import Lift

/// The Training models read the contract's examples and every demo body, and a failed or absent section stays alone.
@Suite struct TrainingDecodingTests {
    private func decode<Value: Decodable>(_ type: Value.Type, _ text: String) throws -> Value {
        try JSONDecoder().decode(type, from: Data(text.utf8))
    }

    @Test func contractListDecodes() throws {
        let page = try decode(ActivityListPage.self, TrainingContractSamples.list)
        #expect(page.activities.first?.subtitle == "12.01 km · 1:07:18 · 5:36 /km · 84 TSS")
        #expect(page.activities.first?.sportStyle == .run)
        #expect(page.nextCursor == "19944258397")
    }

    @Test func contractDetailDecodesEverySection() throws {
        let detail = try decode(ActivityDetail.self, TrainingContractSamples.detail)
        #expect(detail.header?.value?.prevId == "20577277152")
        #expect(detail.power == nil, "null: the activity has no power, so the section hides")
        #expect(detail.sameRoute == nil)
        #expect(detail.coach?.value?.planned == nil)
        #expect(detail.analysis?.value?.streams.first { $0.key == "gap" }?.overlayOf == "pace")
        #expect(detail.paceBars?.value?.modes.map(\.key) == ["splits", "laps", "smoothed"])
        #expect(detail.heartRate?.value?.zones.first?.percent == 96)
        #expect(detail.segments?.value?.rows.first?.rankText == "PR")
        #expect(detail.route?.value?.coordinates.count == 2)
        let colored = try #require(detail.route?.value?.colored)
        #expect(colored.metrics.map(\.key) == ["hr"])
        #expect(colored.metric("hr")?.bins == [0, 1, 1])
    }

    /// The coloured line: one piece per run of a colour, each starting where the one before ends.
    @Test func routePiecesJoinEndToStart() {
        let metric = ActivityRouteColors.Metric(
            key: "hr", label: "Heart rate", unit: "bpm", colors: ["#000001", "#000002"], bins: [0, 0, 1, nil, 1],
            lowText: "120", highText: "170"
        )
        let colors = ActivityRouteColors(points: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], metrics: [metric])
        let pieces = colors.pieces(for: metric)
        #expect(pieces.map(\.color) == ["#000001", "#000002", nil, "#000002"])
        #expect(pieces.map { $0.coordinates.map(\.latitude) } == [[1, 2], [2, 3], [3, 4], [4, 5]])
        #expect(colors.metric(nil) == nil)
        #expect(colors.metric("hr") == metric)
    }

    @Test func contractTrendsDecode() throws {
        let trends = try decode(TrendsResponse.self, TrainingContractSamples.trends)
        let performance = try #require(trends.performance.value)
        #expect(performance.tiles.first?.delta?.tone == .down)
        #expect(performance.weeklyHours.weeks.last?.current == true)
        #expect(trends.ramp.value?.rates.last?.levelText == "Not enough data")
        let row = try #require(trends.peaks.value?.power.rows.first)
        #expect(row.cells["all"]??.best == true)
        #expect(row.cells["d28"] == .some(nil), "no effort in the window")
        #expect(trends.lift.value?.mainLifts.first?.latestText == "323 lb")
    }

    @Test func aFailedSectionFailsAlone() throws {
        let text =
            #"{"activityId":"1","header":{"ok":false},"weather":null,"overview":{"ok":true,"big":[],"small":[]}}"#
        let detail = try decode(ActivityDetail.self, text)
        #expect(detail.header == .failed)
        #expect(detail.weather == nil)
        #expect(detail.overview?.value?.big.isEmpty == true)
        let trends = try decode(TrendsResponse.self, #"{"performance":{"ok":false},"ramp":{"ok":true,"rates":[]}}"#)
        #expect(trends.performance == .failed)
        #expect(trends.peaks == .failed, "a missing section fails alone")
        #expect(trends.ramp.value?.rates.isEmpty == true)
    }

    @Test(arguments: [
        "app-activities", "app-activities-before-9000000075", "app-activities-id", "app-activities-9000000103",
        "app-activities-9000000104", "app-trends",
    ])
    func demoBodiesDecode(name: String) throws {
        let url = try #require(Bundle.main.url(forResource: name, withExtension: "json"))
        let data = try Data(contentsOf: url)
        if name == "app-trends" {
            let trends = try JSONDecoder().decode(TrendsResponse.self, from: data)
            #expect(trends.performance.value != nil && trends.peaks.value != nil && trends.lift.value != nil)
        } else if name.hasPrefix("app-activities-9") || name == "app-activities-id" {
            let detail = try JSONDecoder().decode(ActivityDetail.self, from: data)
            #expect(detail.header?.value != nil)
        } else {
            #expect(try JSONDecoder().decode(ActivityListPage.self, from: data).activities.isEmpty == false)
        }
    }

    @Test func demoRideHasPowerAndThePendingWalkSaysSo() throws {
        let ride = try #require(TrainingSamples.ride)
        #expect(ride.power?.value?.curve.count == 8)
        #expect(ride.paceHistogram == nil)
        let walk = try #require(TrainingSamples.pending)
        #expect(walk.header?.value?.fetch.pending == true)
        #expect(walk.fetchNote == "Loading details from Strava. Pull to refresh in a minute.")
        #expect(walk.coach == .failed)
    }
}

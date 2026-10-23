import XCTest

/// A planned workout and a done activity open the same workout page.
@MainActor
final class WorkoutPageUITests: XCTestCase {
    func testAPlannedWorkoutOpensTheWorkoutPage() {
        let app = XCUIApplication()
        app.launchArguments = ["-demo", "-tab", "week"]
        app.launch()
        let card = app.buttons.containing(.staticText, identifier: "Sweet spot 3 × 12").firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        card.tap()
        XCTAssertTrue(app.staticTexts["Sweet spot 3 × 12"].waitForExistence(timeout: 10))
        _ = XCTWaiter.wait(for: [XCTestExpectation(description: "settle")], timeout: 1.5)
        shot(app, "50-planned-workout")
        XCTAssertFalse(app.buttons["Open activity"].exists, "no separate activity page any more")
        app.swipeUp(velocity: .slow)
        _ = XCTWaiter.wait(for: [XCTestExpectation(description: "scroll")], timeout: 1)
        let chart = app.otherElements["Interval chart"].firstMatch
        if chart.exists {
            chart.coordinate(withNormalizedOffset: CGVector(dx: 0.45, dy: 0.5)).tap()
            _ = XCTWaiter.wait(for: [XCTestExpectation(description: "pick")], timeout: 1)
        }
        shot(app, "51-picked-bar")
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let png = app.windows.firstMatch.screenshot().pngRepresentation
        if let folder = ProcessInfo.processInfo.environment["LIFT_SHOTS"] {
            try? png.write(to: URL(fileURLWithPath: folder).appendingPathComponent("\(name).png"))
        }
    }
}

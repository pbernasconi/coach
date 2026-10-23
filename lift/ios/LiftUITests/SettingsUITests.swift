import XCTest

/// Settings in the demo data: the coach's side and the connections load, and the page scrolls to its foot.
@MainActor
final class SettingsUITests: XCTestCase {
    func testSettingsShowsConnectionsAndScrollsToTheFoot() {
        let app = XCUIApplication()
        app.launchArguments = ["-demo", "-tab", "settings"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Strava"].waitForExistence(timeout: 10))
        shot(app, "40-settings-top")
        app.swipeUp(velocity: .slow)
        _ = XCTWaiter.wait(for: [XCTestExpectation(description: "settle")], timeout: 1)
        shot(app, "41-settings-middle")
        app.swipeUp(velocity: .slow)
        _ = XCTWaiter.wait(for: [XCTestExpectation(description: "settle")], timeout: 1)
        shot(app, "42-settings-foot")
        XCTAssertTrue(app.buttons["Acknowledgements"].exists)
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let png = app.windows.firstMatch.screenshot().pngRepresentation
        if let folder = ProcessInfo.processInfo.environment["LIFT_SHOTS"] {
            try? png.write(to: URL(fileURLWithPath: folder).appendingPathComponent("\(name).png"))
        }
    }
}

import XCTest

/// Today in the demo: scrolls to the body and labs and saves screenshots.
@MainActor
final class TodayScrollUITests: XCTestCase {
    func testTodayScrollsToBodyAndLabs() {
        let app = XCUIApplication()
        app.launchArguments = ["-demo", "-tab", "today"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Workouts"].waitForExistence(timeout: 10))
        for index in 0..<4 {
            app.swipeUp(velocity: .slow)
            _ = XCTWaiter.wait(for: [XCTestExpectation(description: "scroll")], timeout: 1)
            if let folder = ProcessInfo.processInfo.environment["LIFT_SHOTS"] {
                let png = app.windows.firstMatch.screenshot().pngRepresentation
                try? png.write(to: URL(fileURLWithPath: folder).appendingPathComponent("today-\(index).png"))
            }
        }
    }
}

import XCTest

/// Live data, run by hand only (lift/ios/LiftUITests/README in the comment below): with `LIFT_LIVE_CODE`, a one-time
/// Coach sync code, it links this build to Coach and walks every tab and the workout pages with the real data, saving
/// a screenshot of each to `LIFT_SHOTS`. Skipped without the code, so a normal test pass never touches production.
///
///     TEST_RUNNER_LIFT_LIVE_CODE=<code> TEST_RUNNER_LIFT_SHOTS=<dir> xcodebuild test -scheme LiftUI \
///       -only-testing:LiftUITests/LiveEndToEndUITests LIFT_SYNC_BASE_URL=https://<coach> …
@MainActor
final class LiveEndToEndUITests: XCTestCase {
    private var app: XCUIApplication!

    func testEveryTabWithLiveData() throws {
        guard let code = ProcessInfo.processInfo.environment["LIFT_LIVE_CODE"], let sync = URL(string: "lift://sync?code=\(code)")
        else { throw XCTSkip("LIFT_LIVE_CODE not set") }
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchArguments = ["-tab", "settings", "-practice.isOn", "NO"]
        app.launch()
        open(sync)
        wait(10)
        shot("01-settings")
        scrollShot("02-settings-foot")

        tab("Today")
        wait(6)
        shot("10-today")
        scrollShot("11-today-vitals")
        scrollShot("12-today-trends")
        scrollShot("13-today-body-labs")

        tab("Week")
        wait(5)
        shot("20-week")
        if let card = firstCard(in: ["Easy run + strides", "Endurance ride", "Home calf raises"]) {
            card.tap()
            wait(6)
            shot("21-week-workout")
            scrollShot("22-week-workout-more")
            back()
        }

        tab("Training")
        wait(5)
        shot("30-training")
        let first = app.cells.firstMatch.exists ? app.cells.firstMatch : app.buttons.containing(.staticText, identifier: "Run").firstMatch
        if let run = firstCard(in: ["Lunch Run", "Morning Run"]) ?? (first.exists ? first : nil) {
            run.tap()
            wait(7)
            shot("31-activity-map")
            app.swipeUp(velocity: .slow)
            wait(2)
            shot("32-activity-up")
            scrollShot("33-activity-more")
            back()
        }

        tab("Lift")
        wait(5)
        shot("40-lift")
        scrollShot("41-lift-progress")
    }

    // MARK: Helpers

    private func open(_ url: URL) {
        app.open(url)
        let button = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Open"]
        if button.waitForExistence(timeout: 3) { button.tap() }
    }

    private func tab(_ name: String) {
        app.tabBars.buttons[name].firstMatch.tap()
    }

    private func firstCard(in titles: [String]) -> XCUIElement? {
        for title in titles {
            let element = app.buttons.containing(.staticText, identifier: title).firstMatch
            if element.waitForExistence(timeout: 2) { return element }
        }
        return nil
    }

    private func back() {
        let start = app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.5))
        start.press(forDuration: 0.01, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)))
        wait(1.5)
    }

    private func wait(_ seconds: TimeInterval) {
        _ = XCTWaiter.wait(for: [XCTestExpectation(description: "wait")], timeout: seconds)
    }

    private func scrollShot(_ name: String) {
        app.swipeUp(velocity: .slow)
        wait(1.2)
        shot(name)
    }

    private func shot(_ name: String) {
        let png = app.windows.firstMatch.screenshot().pngRepresentation
        if let folder = ProcessInfo.processInfo.environment["LIFT_SHOTS"] {
            try? png.write(to: URL(fileURLWithPath: folder).appendingPathComponent("\(name).png"))
        }
    }
}

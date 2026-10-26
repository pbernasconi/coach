import XCTest

/// Drives the activity page's map sheet with real drags, as a finger would: it rests at three heights, one drag moves
/// the sheet and then scrolls its content, a drag down from the content's top lowers it again, and the bar's chevron
/// lowers it. Each step checks where the activity's title sits and saves a screenshot (`LIFT_SHOTS` names a folder).
@MainActor
final class ActivityMapSheetUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() async throws {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchArguments = ["-demo", "-tab", "week", "-open-url", "lift://activity/9000000102"]
        app.launch()
    }

    /// The activity's name in the sheet ("Harbour loop" in the demo data).
    private var title: XCUIElement { app.staticTexts["Harbour loop"].firstMatch }

    private var height: CGFloat { app.windows.firstMatch.frame.height }

    private func point(_ x: CGFloat, _ y: CGFloat) -> XCUICoordinate {
        app.windows.firstMatch.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y))
    }

    private func pause(_ seconds: TimeInterval) {
        _ = XCTWaiter.wait(for: [XCTestExpectation(description: "pause")], timeout: seconds)
    }

    private func shot(_ name: String) {
        let png = app.windows.firstMatch.screenshot().pngRepresentation
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let folder = ProcessInfo.processInfo.environment["LIFT_SHOTS"] {
            try? png.write(to: URL(fileURLWithPath: folder).appendingPathComponent("\(name).png"))
        }
    }

    /// A finger drag from one height to another, at a steady speed (points per second), then lifted.
    private func drag(from startY: CGFloat, to endY: CGFloat, x: CGFloat = 200, speed: CGFloat = 900, hold: TimeInterval = 0) {
        point(x, startY).press(
            forDuration: 0.05,
            thenDragTo: point(x, endY),
            withVelocity: XCUIGestureVelocity(speed),
            thenHoldForDuration: hold
        )
    }

    private func titleY() -> CGFloat { title.frame.minY }

    func testSheetRestsDragsAndScrolls() {
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        pause(1.5)
        shot("01-medium")
        let medium = titleY()
        XCTAssert(medium > height * 0.4 && medium < height * 0.6, "medium: title at \(medium) of \(height)")

        // Medium → collapsed: drag the sheet down.
        drag(from: medium - 30, to: height - 40, speed: 700)
        pause(1.5)
        shot("02-collapsed")
        let collapsed = titleY()
        XCTAssert(collapsed > height * 0.85 || !title.isHittable, "collapsed: title at \(collapsed)")

        // Collapsed → medium: a short flick up moves one step.
        drag(from: height - 60, to: height - 200, speed: 1200)
        pause(1.5)
        shot("03-medium-again")
        XCTAssertEqual(titleY(), medium, accuracy: 4, "back at medium")

        // Medium → up, and on into the content in the same drag.
        drag(from: medium + 40, to: 60, speed: 500, hold: 0.3)
        pause(1.0)
        shot("04-up-scrolled")
        XCTAssert(titleY() < 140, "the title went under the bar: \(titleY())")
        XCTAssertTrue(app.navigationBars.staticTexts["Run"].exists || app.staticTexts["Run"].exists)

        // Down from scrolled content: first the content comes back to its top, then the sheet follows.
        drag(from: 250, to: 700, speed: 600, hold: 0.1)
        pause(1.5)
        shot("05-dragged-down")

        // Up again, then the chevron lowers the sheet to medium.
        drag(from: titleY() + 40, to: 150, speed: 900)
        pause(1.5)
        shot("06-up")
        app.buttons["Show map"].firstMatch.tap()
        pause(1.5)
        shot("07-chevron-lowered")
        XCTAssertEqual(titleY(), medium, accuracy: 4, "the chevron lowered it to medium")
    }

    func testMapTakesTouchesAboveTheSheet() {
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        pause(1.5)
        let medium = titleY()
        // A drag on the map pans the map; the sheet stays where it is.
        drag(from: 250, to: 150, x: 200, speed: 600)
        pause(1.0)
        shot("10-map-panned")
        XCTAssertEqual(titleY(), medium, accuracy: 4, "the sheet did not move")
    }

    func testSwipeFromTheEdgeGoesBack() {
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        pause(1.5)
        edgeSwipe()
        shot("20-swiped-back")
        // The Week tab it was pushed on.
        XCTAssertTrue(app.staticTexts["Week"].exists, "the page went back")
        XCTAssertFalse(app.buttons["Map type"].exists)
    }

    /// The same swipe on a page with the system back button: proves the gesture itself goes back.
    func testSwipeFromTheEdgeGoesBackOnAPlainPage() {
        app.terminate()
        app.launchArguments = ["-demo", "-tab", "week", "-open-url", "lift://session/de300000-0000-4000-8000-000000000100"]
        app.launch()
        let back = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        pause(1.5)
        shot("21-plain-before")
        edgeSwipe()
        shot("22-plain-after")
        XCTAssertTrue(app.staticTexts["Lift"].exists, "the plain page went back")
    }

    /// The tab bar slides away with the push and back with the pop (it is driven from the stack's root).
    func testTabBarLeavesWithThePushAndComesBackWithThePop() {
        app.terminate()
        // The made-up ride, pushed on Week at launch: an outdoor activity with its track, so it opens on its map.
        app.launchArguments = ["-demo", "-open", "ride"]
        app.launch()
        XCTAssertTrue(app.buttons["Back"].firstMatch.waitForExistence(timeout: 10))
        pause(1.5)
        shot("30-pushed")
        XCTAssertFalse(app.tabBars.firstMatch.isHittable, "no tab bar on the activity")
        app.buttons["Back"].firstMatch.tap()
        pause(1.5)
        shot("31-popped")
        XCTAssertTrue(app.tabBars.firstMatch.isHittable, "the tab bar is back on Week")
    }

    private func edgeSwipe() {
        point(1, height * 0.5).press(forDuration: 0.01, thenDragTo: point(300, height * 0.5), withVelocity: 1500, thenHoldForDuration: 0)
        pause(1.5)
    }
}

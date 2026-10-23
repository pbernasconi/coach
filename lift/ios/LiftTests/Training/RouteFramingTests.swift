import Foundation
import Testing

@testable import Lift

@Suite struct RouteFramingTests {
    @Test func theRouteFillsTheOpenPartOfTheScreen() {
        // A 400 × 200 route on a 400 × 800 screen with 100 open at the top and 300 covered at the bottom.
        let rect = RouteFraming.rect(
            route: RouteFraming.Rect(x: 10_000, y: 20_000, width: 40_000, height: 20_000),
            screen: (400, 800),
            insets: RouteFraming.Insets(top: 100, leading: 0, bottom: 300, trailing: 0)
        )
        // The width limits: 100 map points per screen point.
        #expect(rect.width == 40_000)
        #expect(rect.height == 80_000)
        // The route's middle sits at the middle of the open part (100 to 500): 300 points down.
        #expect(rect.x == 10_000)
        #expect(rect.y + 300 * 100 == 30_000)
    }

    @Test func aTinyRouteIsShownAtAUsefulSize() {
        let rect = RouteFraming.rect(
            route: RouteFraming.Rect(x: 0, y: 0, width: 0, height: 0),
            screen: (400, 800),
            insets: RouteFraming.Insets(top: 0, leading: 0, bottom: 0, trailing: 0)
        )
        #expect(rect.width == 8000)
    }
}

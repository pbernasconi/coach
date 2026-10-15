import Foundation
import Testing

@testable import KoboComponents

/// Ported from an earlier app's footer edge rule: the hairline shows only while content runs under the footer.
@Suite struct LayoutFooterEdgeTests {
    @Test(arguments: [
        // (content height, visible bottom, bottom inset, shows)
        (1_000.0, 800.0, 100.0, true),  // content runs on below the footer
        (700.0, 800.0, 100.0, false),  // content ends exactly at the footer top
        (700.4, 800.0, 100.0, false),  // rounding inside the slack
        (500.0, 800.0, 100.0, false),  // short content, nothing under the footer
        (1_000.0, 1_100.0, 100.0, false),  // scrolled to the end
        (0.0, 800.0, 100.0, false),  // not measured yet
    ])
    func hairlineShowsOnlyWhileContentIsUnderTheFooter(
        contentHeight: Double,
        visibleMaxY: Double,
        bottomInset: Double,
        expected: Bool
    ) {
        let shows = FooterEdge.showsHairline(
            contentHeight: CGFloat(contentHeight),
            visibleMaxY: CGFloat(visibleMaxY),
            bottomInset: CGFloat(bottomInset)
        )
        #expect(shows == expected)
    }
}

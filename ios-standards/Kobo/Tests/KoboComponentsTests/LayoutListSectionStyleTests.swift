import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

@Suite struct LayoutListSectionStyleTests {
    @Test func aFlatSectionInsideAPageGutterBleedsItsRowsBackOntoTheKeyline() {
        let style = ListSectionStyle.flat
        #expect(style.rowBleed(insidePageGutter: true) == Space.gutter)
        #expect(style.captionInset(insidePageGutter: true) == 0)
        // The row runs out by the gutter and pays it back: its content lands on the page keyline.
        #expect(style.rowInset - style.rowBleed(insidePageGutter: true) == 0)
    }

    @Test func aFlatSectionOutsideAGutterPaysTheGutterItself() {
        let style = ListSectionStyle.flat
        #expect(style.rowBleed(insidePageGutter: false) == 0)
        #expect(style.captionInset(insidePageGutter: false) == Space.gutter)
        #expect(style.rowInset == Space.gutter)
    }

    @Test func aGroupedSectionKeepsItsCardOnTheKeyline() {
        for inside in [true, false] {
            #expect(ListSectionStyle.grouped.rowBleed(insidePageGutter: inside) == 0)
            #expect(ListSectionStyle.grouped.captionInset(insidePageGutter: inside) == 0)
        }
        #expect(ListSectionStyle.grouped.rowInset == Space.cardInset)
    }

    @Test func separatorsStartAtTheRowText() {
        for style in ListSectionStyle.allCases {
            #expect(style.separatorInset(leadingWidth: 0) == style.rowInset)
            #expect(style.separatorInset(leadingWidth: 36) == style.rowInset + 36)
        }
    }

    @Test func aFlatCaptionLeansOnTheRowPaddingAndAGroupedOneKeepsAGap() {
        #expect(ListSectionStyle.flat.captionGap + Space.rowVertical <= Space.lg + Space.xxs)
        #expect(ListSectionStyle.grouped.captionGap == Space.sm)
        #expect(ListSectionStyle.flat.captionGap < ListSectionStyle.grouped.captionGap)
    }
}

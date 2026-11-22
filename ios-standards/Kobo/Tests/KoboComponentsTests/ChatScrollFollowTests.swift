import Testing

@testable import KoboComponents

@Suite struct ChatScrollFollowTests {
    @Test func theTranscriptFollowsOnlyWhileTheReaderIsAtTheBottom() {
        var follow = ChatScrollFollow()
        #expect(follow.followsNewContent())
        #expect(!follow.showsJumpButton)
        follow.scrolled(distanceFromBottom: 30)
        #expect(follow.followsNewContent())
        follow.scrolled(distanceFromBottom: 900, visibleHeight: 800)
        #expect(!follow.followsNewContent())
        #expect(!follow.showsJumpButton)  // about a screen up: no button
        follow.scrolled(distanceFromBottom: 1300, visibleHeight: 800)
        #expect(follow.showsJumpButton)  // more than one and a half screens up
        follow.scrolled(distanceFromBottom: 20, visibleHeight: 800)
        #expect(!follow.showsJumpButton)  // back near the bottom: gone
        follow.scrolled(distanceFromBottom: 550)
        #expect(!follow.showsJumpButton)  // a few lines up, even without a known height: no button
        follow.scrolled(distanceFromBottom: 1300, visibleHeight: 800)
        follow.resized()
        #expect(!follow.showsJumpButton)  // the keyboard moved the bottom: hidden until the next scroll
        follow.jumped()
        #expect(follow.followsNewContent())
    }

    @Test func aStreamingReplyNeverUnpinsOrShowsTheButton() {
        var follow = ChatScrollFollow()
        // The reply grows a long way below a pinned reader before the transcript catches up: still pinned, no button.
        follow.scrolled(distanceFromBottom: 1300, visibleHeight: 800, byReader: false)
        #expect(follow.followsNewContent())
        #expect(!follow.showsJumpButton)
    }

    @Test func theButtonGoesAsSoonAsTheReaderIsNoLongerFarUp() {
        var follow = ChatScrollFollow()
        follow.scrolled(distanceFromBottom: 1300, visibleHeight: 800)
        #expect(follow.showsJumpButton)
        // Moved back close to the bottom without a hand scroll (a layout change): the button must not linger.
        follow.scrolled(distanceFromBottom: 120, visibleHeight: 800, byReader: false)
        #expect(!follow.showsJumpButton)
        #expect(!follow.followsNewContent())  // still unpinned: only the bottom pins again
    }

    @Test(arguments: [
        (1000.0, 600.0, 400.0, 0.0),
        (1000.0, 500.0, 400.0, 100.0),
        (300.0, 0.0, 400.0, 0.0),
    ])
    func distanceFromBottomIsNeverNegative(content: Double, offset: Double, visible: Double, expected: Double) {
        #expect(
            ChatScrollFollow.distanceFromBottom(contentHeight: content, offsetY: offset, visibleHeight: visible)
                == expected
        )
    }

    @Test func aConversationThatFitsIsAlwaysAtTheBottom() {
        let distance = ChatScrollFollow.distanceFromBottom(
            contentHeight: 300,
            offsetY: -250,
            visibleHeight: 800,
            insetTop: 150,
            insetBottom: 100
        )
        #expect(distance == 0)
        let scrolledUp = ChatScrollFollow.distanceFromBottom(
            contentHeight: 2000,
            offsetY: 1000,
            visibleHeight: 800,
            insetTop: 150,
            insetBottom: 100
        )
        #expect(scrolledUp == 300)
    }
}

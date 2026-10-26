import Testing

@testable import KoboComponents

@Suite struct ChatLogicTests {
    @Test func theTranscriptFollowsOnlyWhileTheReaderIsAtTheBottom() {
        var follow = ChatScrollFollow()
        #expect(follow.followsNewContent())
        #expect(!follow.showsJumpButton)
        follow.scrolled(distanceFromBottom: 30)
        #expect(follow.followsNewContent())
        follow.scrolled(distanceFromBottom: 400)
        #expect(!follow.followsNewContent())
        #expect(follow.showsJumpButton)
        follow.jumped()
        #expect(follow.followsNewContent())
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

    @Test func blankDraftsCannotBeSent() {
        #expect(!ChatComposerLogic.canSend("  \n "))
        #expect(ChatComposerLogic.canSend(" hi "))
        #expect(ChatComposerLogic.message(from: "\n hi there \n") == "hi there")
    }

    @Test func theComposerButtonFollowsTheReplyState() {
        #expect(ChatComposerLogic.button(draft: "", isResponding: false, canStop: true) == .send(isEnabled: false))
        #expect(ChatComposerLogic.button(draft: "hi", isResponding: false, canStop: true) == .send(isEnabled: true))
        #expect(ChatComposerLogic.button(draft: "hi", isResponding: true, canStop: true) == .stop)
        #expect(ChatComposerLogic.button(draft: "hi", isResponding: true, canStop: false) == .waiting)
    }

    @Test func typingDotsStayInRangeAndTakeTurns() {
        for step in 0..<48 {
            let time = Double(step) * 0.05
            for dot in 0..<ChatTypingDots.count {
                let value = ChatTypingDots.opacity(dot: dot, at: time)
                #expect(value >= ChatTypingDots.dimmest - 1e-9 && value <= 1 + 1e-9)
            }
        }
        #expect(ChatTypingDots.opacity(dot: 0, at: 0) == ChatTypingDots.dimmest)
        #expect(ChatTypingDots.opacity(dot: 0, at: 0.6) > ChatTypingDots.opacity(dot: 1, at: 0.6))
    }

    @Test func replyBlocksCoverParagraphsListsHeadingsAndCode() {
        let text = """
            # Plan
            First line
            continues here.

            - one
            * two
            12. twelve
            ```
            let x = 1
            ```
            """
        #expect(
            ChatReplyBlock.parse(text) == [
                .heading("Plan"),
                .paragraph("First line continues here."),
                .listItem(marker: "•", text: "one"),
                .listItem(marker: "•", text: "two"),
                .listItem(marker: "12.", text: "twelve"),
                .code("let x = 1"),
            ]
        )
    }

    @Test func anOpenCodeFenceIsCodeToTheEnd() {
        #expect(ChatReplyBlock.parse("Look:\n```\nline 1\nline 2") == [.paragraph("Look:"), .code("line 1\nline 2")])
    }

    @Test func aNumberWithoutADotIsParagraphText() {
        #expect(ChatReplyBlock.parse("2026 was a good year") == [.paragraph("2026 was a good year")])
    }

    @Test func onlyPendingAndApplyingCardsOfferButtons() {
        #expect(ChatActionStatus.pending.showsActions)
        #expect(ChatActionStatus.applying.showsActions)
        #expect(!ChatActionStatus.applied.showsActions)
        #expect(!ChatActionStatus.superseded.isCurrent)
        #expect(ChatActionStatus.applied.isCurrent)
    }
}

import Testing

@testable import KoboComponents

@Suite struct ChatLogicTests {
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
        follow.scrolled(distanceFromBottom: 350)
        #expect(!follow.showsJumpButton)  // a few lines up, even without a known height: no button
        follow.scrolled(distanceFromBottom: 1300, visibleHeight: 800)
        follow.resized()
        #expect(!follow.showsJumpButton)  // the keyboard moved the bottom: hidden until the next scroll
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

    @Test(arguments: [
        ("Moved **Team", "Moved **Team**"),
        ("a **b** and **c", "a **b** and **c**"),
        ("Use `code", "Use `code`"),
        ("Done *", "Done "),
        ("**bold** done", "**bold** done"),
        ("```\n**x", "```\n**x"),
        ("Moved **it to `Tue", "Moved **it to `Tue`**"),
        ("Run `a **b", "Run `a **b**`"),
    ])
    func streamingTextClosesOpenMarks(text: String, expected: String) {
        #expect(ChatStreamingText.repaired(text) == expected)
    }

    @Test func theReplyIsAnnouncedOnceWhenStreamingEnds() {
        #expect(
            ChatStreamingText.announcement(wasStreaming: true, isStreaming: false, text: "Moved **it**.") == "Moved it."
        )
        #expect(ChatStreamingText.announcement(wasStreaming: true, isStreaming: true, text: "Moved") == nil)
        #expect(ChatStreamingText.announcement(wasStreaming: false, isStreaming: false, text: "Moved") == nil)
    }

    @Test func onlyPendingAndApplyingCardsOfferButtons() {
        #expect(ChatActionStatus.pending.showsActions)
        #expect(ChatActionStatus.applying.showsActions)
        #expect(!ChatActionStatus.applied.showsActions)
        #expect(!ChatActionStatus.superseded.isCurrent)
        #expect(!ChatActionStatus.undone.isCurrent)
        #expect(!ChatActionStatus.undone.showsActions)
        #expect(ChatActionStatus.applied.isCurrent)
    }

    @Test(arguments: [
        ("09:00", "09:45", "45 min"), ("09:00", "11:00", "2 h"), ("08:30", "13:00", "4 h 30"),
        ("08:00", "09:05", "1 h 05"),
    ])
    func timelineBlocksSayTheirLength(start: String, end: String, text: String) {
        #expect(DayTimelineMath.lengthText(start: start, end: end) == text)
    }

    @Test func timelineRejectsWhatIsNotAClockTime() {
        #expect(DayTimelineMath.minutes("25:00") == nil)
        #expect(DayTimelineMath.minutes("9") == nil)
        #expect(DayTimelineMath.lengthText(start: "10:00", end: "09:00") == nil)
    }

    @Test func timelineBlocksGoInTimeOrder() {
        let blocks = [
            DayTimelineBlock(id: "b", start: "13:30", end: "14:00", kind: .busy),
            DayTimelineBlock(id: "a", start: "08:00", end: "09:00", kind: .free),
            DayTimelineBlock(id: "c", start: "later", end: "?", kind: .busy),
        ]
        #expect(DayTimelineMath.ordered(blocks).map(\.id) == ["a", "b", "c"])
    }

    @Test func theSendButtonAlwaysShowsAndTheCardOpensWithADraft() {
        #expect(ChatComposerLogic.button(draft: "", isResponding: false, canStop: true) == .send(isEnabled: false))
        #expect(ChatComposerLogic.button(draft: "hi", isResponding: false, canStop: true) == .send(isEnabled: true))
        #expect(ChatComposerLogic.button(draft: "", isResponding: true, canStop: true) == .stop)
        #expect(ChatComposerLogic.button(draft: "", isResponding: true, canStop: false) == .waiting)
        #expect(ChatComposerLogic.isExpanded(draft: "", isListening: true))
        #expect(ChatComposerLogic.isExpanded(draft: "hi", isListening: false))
        #expect(!ChatComposerLogic.isExpanded(draft: "", isListening: false))
    }

    @Test func aTapStartsAndAnotherTapStopsKeepingTheWords() {
        var voice = ChatVoiceInput()
        #expect(voice.tapped() == .start)
        #expect(voice.phase == .listening)
        #expect(voice.tapped() == .stop)
        #expect(voice.phase == .idle)
    }

    @Test func aPauseStopsTapToTalkButNotHolding() {
        var voice = ChatVoiceInput()
        _ = voice.tapped()
        #expect(voice.pausedLongEnough() == .stop)
        _ = voice.holdBegan()
        #expect(voice.pausedLongEnough() == .none)
        #expect(voice.phase == .holding)
    }

    @Test func holdingTalksAndReleaseSends() {
        var voice = ChatVoiceInput()
        #expect(voice.holdBegan() == .start)
        #expect(voice.holdEnded() == .stopAndSend)
        #expect(voice.phase == .idle)
        #expect(ChatVoiceInput.message(toSend: "  ") == nil)
        #expect(ChatVoiceInput.message(toSend: " move it ") == "move it")
    }

    @Test func leavingTheAppStopsAndSendsNothing() {
        var voice = ChatVoiceInput()
        _ = voice.holdBegan()
        #expect(voice.backgrounded() == .stop)
        #expect(voice.holdEnded() == .none)
    }

    @Test func aDeniedPermissionShowsTheWayToSettingsAndATapTriesAgain() {
        var voice = ChatVoiceInput()
        _ = voice.tapped()
        voice.failed(denied: true)
        #expect(voice.phase == .unavailable)
        #expect(voice.tapped() == .start)
    }
}

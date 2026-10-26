import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

@Suite struct ChatLogicTests {
    // MARK: Markdown blocks

    @Test func linesInARowJoinAndBlankLinesSplit() {
        let blocks = ChatMarkdown.blocks("First line\nsecond line\n\nNew paragraph")
        #expect(blocks == [.paragraph("First line\nsecond line"), .paragraph("New paragraph")])
    }

    @Test func listsAndHeadingsAreTheirOwnBlocks() {
        let text = "## Plan\nHere it is:\n- Pack the bags\n* Book a table\n1. Leave at nine\n2) Arrive"
        #expect(
            ChatMarkdown.blocks(text) == [
                .heading("Plan"), .paragraph("Here it is:"), .bullet("Pack the bags"), .bullet("Book a table"),
                .numbered(1, "Leave at nine"), .numbered(2, "Arrive"),
            ]
        )
    }

    @Test func numbersAndHashesInsideTextStayText() {
        #expect(ChatMarkdown.blocks("2026 was a year") == [.paragraph("2026 was a year")])
        #expect(ChatMarkdown.blocks("#hashtag") == [.paragraph("#hashtag")])
        #expect(ChatMarkdown.blocks("-5 degrees") == [.paragraph("-5 degrees")])
        #expect(ChatMarkdown.blocks("") == [])
    }

    // MARK: Streaming

    @Test(arguments: [
        ("Plain text", "Plain text"),
        ("Move it to **Tues", "Move it to **Tues**"),
        ("Move it to **Tuesday**", "Move it to **Tuesday**"),
        ("Run `swift te", "Run `swift te`"),
        ("Say **hi", "Say **hi**"),
        ("Half a marker *", "Half a marker "),
        ("Code `a**b` done", "Code `a**b` done"),
    ])
    func openSpansCloseWhileStreaming(partial: String, shown: String) {
        #expect(ChatMarkdown.closingOpenSpans(partial) == shown)
    }

    // MARK: Composer

    @Test func composerButtonFollowsTextAndReply() {
        #expect(ChatComposerAction.current(text: "", isResponding: false) == .none)
        #expect(ChatComposerAction.current(text: "  \n ", isResponding: false) == .none)
        #expect(ChatComposerAction.current(text: "Hi", isResponding: false) == .send)
        #expect(ChatComposerAction.current(text: "Hi", isResponding: true) == .stop)
        #expect(ChatComposerAction.current(text: "", isResponding: true) == .stop)
    }

    // MARK: Scroll

    @Test func followsOnlyNearTheEnd() {
        #expect(ChatScrollMath.isAtEnd(contentHeight: 1000, visibleMaxY: 1000))
        #expect(ChatScrollMath.isAtEnd(contentHeight: 1000, visibleMaxY: 1000 - ChatScrollMath.followThreshold))
        #expect(!ChatScrollMath.isAtEnd(contentHeight: 1000, visibleMaxY: 600))
        #expect(ChatScrollMath.isAtEnd(contentHeight: 300, visibleMaxY: 800))
    }

    // MARK: Change set

    @Test func changeSetButtonsFollowThePhase() {
        #expect(ChangeSetPhase.proposed.actions(canUndo: true) == [.dismiss, .apply])
        #expect(ChangeSetPhase.applying.actions(canUndo: true) == [.dismiss, .apply])
        #expect(ChangeSetPhase.applied.actions(canUndo: true) == [.undo])
        #expect(ChangeSetPhase.applied.actions(canUndo: false) == [])
        #expect(ChangeSetPhase.dismissed.actions(canUndo: true) == [])
        #expect(ChangeSetPhase.outdated.actions(canUndo: true) == [])
    }

    @Test func changeItemsGetStableIDs() {
        let item = ChangeItem(.changed, title: "Team sync", detail: "Tue → Wed")
        #expect(item.id == ChangeItem(.changed, title: "Team sync", detail: "Tue → Wed").id)
        #expect(item.id != ChangeItem(.removed, title: "Team sync", detail: "Tue → Wed").id)
        #expect(ChangeItem(.added, title: "A", id: "x").id == "x")
    }

    // MARK: Typing dots

    @Test func dotsRiseInTurnAndRest() {
        let first = TypingDotsMotion.frame(index: 0, at: TypingDotsMotion.period / 6)
        #expect(first.rise == TypingDotsMotion.rise)
        #expect(abs(first.opacity - 1) < 0.0001)
        let resting = TypingDotsMotion.frame(index: 0, at: TypingDotsMotion.period * 0.8)
        #expect(resting.rise == 0 && resting.opacity == TypingDotsMotion.restOpacity)
        let second = TypingDotsMotion.frame(index: 1, at: TypingDotsMotion.period / 6)
        #expect(second.rise < first.rise)
    }
}

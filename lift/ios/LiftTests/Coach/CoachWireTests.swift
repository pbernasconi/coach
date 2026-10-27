import Foundation
import KoboComponents
import Testing

@testable import Lift

/// The Coach routes' JSON (lift/APP-API.md, "Coach") maps to the tab's models.
@Suite struct CoachWireTests {
    /// The contract's example message, inside a thread.
    static let thread = Data(
        """
        {
          "threadId": "t1", "ready": true, "notice": null, "suggestions": ["What's on tomorrow?"],
          "messages": [
            { "id": "m1", "role": "user", "createdAt": "2026-10-26T21:01:00.000Z", "text": "No lift today", "proposal": null },
            {
              "id": "m2", "role": "assistant", "createdAt": "2026-10-26T21:02:11.000Z",
              "text": "Tuesday is free until 13:30, so the lift goes at 09:00 and VO2 B comes out.",
              "proposal": {
                "id": "p7", "title": "Lift Tuesday, run with David today", "status": "open",
                "why": "Based on your message and Tuesday's calendar",
                "items": [
                  { "kind": "changed", "title": "Heavy barbell", "detail": "Mon 26 Oct 17:00 → Tue 27 Oct 09:00" },
                  { "kind": "removed", "title": "VO2 B", "detail": "Skip · Tue 27 Oct 09:00 · busy" },
                  { "kind": "added", "title": "Easy run with David", "detail": "Mon 26 Oct 16:00 · 45 min · Easy" },
                  { "kind": "changed", "title": "Threshold A", "detail": "60 min" }
                ],
                "warnings": ["Two hard days in a row"]
              }
            }
          ]
        }
        """.utf8
    )

    @Test func aThreadMapsToMessagesPromptsAndACard() throws {
        let thread = CoachWire.thread(try JSONDecoder().decode(CoachWire.Thread.self, from: Self.thread))
        #expect(thread.messages.map(\.id) == ["m1", "m2"])
        #expect(thread.messages[0].body == .mine("No lift today"))
        #expect(thread.prompts.map(\.title) == ["What's on tomorrow?"])
        #expect(thread.notice == nil)
        let card = try #require(thread.messages[1].proposal)
        #expect(card.status == .pending)
        #expect(card.notes == ["Two hard days in a row"])
        #expect(
            card.items == [
                ChatActionItem(
                    id: "0", change: .move, title: "Heavy barbell", detail: "Tue 27 Oct 09:00",
                    previous: "Mon 26 Oct 17:00"),
                ChatActionItem(id: "1", change: .remove, title: "VO2 B", detail: "Skip · Tue 27 Oct 09:00 · busy"),
                ChatActionItem(id: "2", change: .add, title: "Easy run with David", detail: "Mon 26 Oct 16:00 · 45 min · Easy"),
                ChatActionItem(id: "3", change: .edit, title: "Threshold A", detail: "60 min"),
            ])
    }

    @Test(arguments: [
        ("open", ChatActionStatus.pending), ("applied", .applied), ("undone", .undone), ("dismissed", .dismissed),
        ("stale", .expired), ("something new", .expired),
    ])
    func statusesMapToCardStates(wire: String, status: ChatActionStatus) {
        #expect(CoachWire.status(wire) == status)
    }

    @Test func aThreadThatCannotAnswerSaysWhy() throws {
        let body = Data(#"{ "messages": [], "ready": false, "notice": "No API key", "suggestions": [] }"#.utf8)
        let thread = CoachWire.thread(try JSONDecoder().decode(CoachWire.Thread.self, from: body))
        #expect(thread.notice == "No API key")
        #expect(thread.prompts.isEmpty)
    }
}

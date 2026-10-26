import Foundation
import KoboComponents

/// The concept's stand-in for the server coach: sample replies after a short wait, so the tab can be tried before
/// `POST /api/app/coach/messages` exists. Apply and Undo change nothing. Made-up content only.
nonisolated struct DemoCoachChat: CoachChatting {
    let clock: any Clock<Duration>

    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply {
        try await clock.sleep(for: .seconds(2))
        return Self.sample(for: text, turn: history.count)
    }

    func apply(_ proposalID: String) async throws {
        try await clock.sleep(for: .milliseconds(600))
    }

    func undo(_ proposalID: String) async throws {
        try await clock.sleep(for: .milliseconds(300))
    }

    /// The sample reply for a message: a plan change for a swap or a move, an easier day for soreness, else a note.
    static func sample(for text: String, turn: Int) -> CoachReply {
        let words = text.lowercased()
        if words.contains("lift") || words.contains("move") || words.contains("tomorrow") {
            return swapReply(turn: turn)
        }
        if words.contains("sore") || words.contains("tired") || words.contains("easy") {
            return easyDayReply(turn: turn)
        }
        if words.contains("week") {
            return CoachReply(
                text: "**4 of 7 sessions done**, 312 of 520 TSS. The long ride on Sunday is the big one left.",
                steps: [CoachChatStep(id: "t\(turn)-week", text: "Read this week's plan")]
            )
        }
        return CoachReply(
            text: "This is the concept build: Coach answers with samples. Try *\"Move today's lift to tomorrow\"*.",
            steps: []
        )
    }

    private static func swapReply(turn: Int) -> CoachReply {
        CoachReply(
            text: """
                Tomorrow's only gym window is **09:00**, so the lift goes there. That makes Tuesday a double, so I \
                dropped VO2 B: Friday's 10k test is this week's hard effort. Today becomes an easy run.
                """,
            steps: [
                CoachChatStep(id: "t\(turn)-plan", text: "Read this week's plan"),
                CoachChatStep(id: "t\(turn)-cal", text: "Checked Tuesday's calendar"),
            ],
            proposal: CoachProposal(
                id: "p\(turn)",
                title: "3 changes this week",
                items: [
                    ChatActionItem(
                        id: "lift", change: .move, title: "Heavy barbell", detail: "Tue 09:00", previous: "Mon 17:00"
                    ),
                    ChatActionItem(id: "vo2", change: .remove, title: "VO2 B", detail: "Tue · skipped (busy)"),
                    ChatActionItem(
                        id: "run", change: .add, title: "Easy Z2 run", detail: "Mon 16:00 · 45 min · HR < 145"
                    ),
                ],
                notes: ["Tuesday has events from 13:30, so the lift has no later slot."]
            )
        )
    }

    private static func easyDayReply(turn: Int) -> CoachReply {
        CoachReply(
            text: "Readiness is low too. Today's threshold ride becomes **60 min Z2**; the week stays on target.",
            steps: [
                CoachChatStep(id: "t\(turn)-ready", text: "Read today's readiness"),
                CoachChatStep(id: "t\(turn)-plan", text: "Read this week's plan"),
            ],
            proposal: CoachProposal(
                id: "p\(turn)",
                title: "1 change today",
                items: [
                    ChatActionItem(
                        id: "ride", change: .edit, title: "Threshold A", detail: "60 min Z2", previous: "75 min, 4×8 min Z4"
                    )
                ]
            )
        )
    }
}

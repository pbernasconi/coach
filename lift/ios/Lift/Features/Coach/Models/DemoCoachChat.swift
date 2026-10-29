import Foundation
import KoboComponents

/// The stand-in for the server coach in demo data, practice mode and screenshots: sample replies after a short wait.
/// Apply and Undo change nothing. Made-up content only.
nonisolated struct DemoCoachChat: CoachChatting {
    let clock: any Clock<Duration>
    /// A made-up chat to open on (`-coach`, DemoCoachThreads); nil opens an empty one.
    var scenario: String?

    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply {
        try await clock.sleep(for: .seconds(2))
        return Self.sample(for: text, turn: history.count)
    }

    func thread() async throws -> CoachThread { DemoCoachThreads.thread(scenario) }

    func threads() async throws -> [CoachThreadSummary] {
        try await clock.sleep(for: .milliseconds(300))
        return DemoCoachThreads.history
    }

    func newThread() async throws -> CoachThread { DemoCoachThreads.thread(nil) }

    func openThread(_ id: String) async throws -> CoachThread { DemoCoachThreads.thread(id) }

    func rate(_ messageID: String, _ rating: ChatFeedbackRating?) async throws {}

    func apply(_ proposalID: String) async throws -> ChatActionStatus {
        try await clock.sleep(for: .milliseconds(600))
        return .applied
    }

    func undo(_ proposalID: String) async throws -> ChatActionStatus {
        try await clock.sleep(for: .milliseconds(300))
        return .undone
    }

    func dismiss(_ proposalID: String) async throws -> ChatActionStatus { .dismissed }

    /// The sample reply for a message: cards for a question, a plan change for a swap, an easier day for soreness.
    static func sample(for text: String, turn: Int) -> CoachReply {
        let words = text.lowercased()
        if words.contains("train") || words.contains("month") { return DemoCoachThreads.breakdownReply }
        if words.contains("plan next") || words.contains("trip") { return DemoCoachThreads.questionsReply }
        if let reply = cardReply(words, turn: turn) { return reply }
        if words.contains("lift") || words.contains("swap") {
            var reply = swapReply(turn: turn)
            reply.attachments = [DemoCoachCards.day]
            return reply
        }
        if words.contains("sore") || words.contains("tired") || words.contains("easy") {
            var reply = easyDayReply(turn: turn)
            reply.attachments = [DemoCoachCards.readiness]
            return reply
        }
        return CoachReply(text: "This is the demo: Coach answers with samples. Try *\"What's on tomorrow?\"*.")
    }

    /// Replies that show cards and change nothing.
    private static func cardReply(_ words: String, turn: Int) -> CoachReply? {
        if words.contains("what's on") || words.contains("what’s on") {
            return CoachReply(
                text: "Tomorrow is **VO2 B at 09:00**. Your morning is free after the 08:00 call; travel starts at 13:30.",
                steps: [CoachChatStep(id: "t\(turn)-plan", text: "Read tomorrow's plan")],
                attachments: [DemoCoachCards.workout, DemoCoachCards.day]
            )
        }
        if words.contains("week") {
            return CoachReply(
                text: "**3 of 8 done** so far, and one easy run missed on Wednesday. Friday's 10k test is the key session.",
                steps: [CoachChatStep(id: "t\(turn)-week", text: "Read this week's plan")],
                attachments: [DemoCoachCards.week]
            )
        }
        if words.contains("deadlift") || words.contains("how do i") {
            return CoachReply(
                text: "Hinge from the hips and keep the bar close. Today is **3 × 8 at 135 lb**, the same as last time.",
                attachments: [DemoCoachCards.exercise]
            )
        }
        if words.contains("move") {
            return CoachReply(
                text: "Tomorrow has two free windows. Which one suits you?",
                quickReplies: ["Tuesday 09:00", "Wednesday 07:00"]
            )
        }
        return nil
    }

    static func swapReply(turn: Int) -> CoachReply {
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
                        id: "lift",
                        change: .move,
                        title: "Heavy barbell",
                        detail: "Tue 09:00",
                        previous: "Mon 17:00"
                    ),
                    ChatActionItem(id: "vo2", change: .remove, title: "VO2 B", detail: "Tue · skipped (busy)"),
                    ChatActionItem(
                        id: "run",
                        change: .add,
                        title: "Easy Z2 run",
                        detail: "Mon 16:00 · 45 min · HR < 145"
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
                        id: "ride",
                        change: .edit,
                        title: "Threshold A",
                        detail: "60 min Z2",
                        previous: "75 min, 4×8 min Z4"
                    )
                ]
            )
        )
    }
}

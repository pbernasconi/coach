import Foundation
import KoboComponents

/// Made-up chats for the demo coach: the one `-coach` opens on (conversation, questions, proposal), the history
/// sheet's past chats, and the replies with a breakdown or question cards. Fabricated data only.
nonisolated enum DemoCoachThreads {
    static let notice = "Demo: Coach answers with sample replies and changes nothing."
    static let firstName = "Paolo"

    /// The chat for a scenario (or a past chat's id); an empty one for anything else.
    static func thread(_ scenario: String?) -> CoachThread {
        let messages: [CoachMessage]
        switch scenario {
        case "conversation", "past-october":
            messages = exchange("How much did I train in October?", breakdownReply)
        case "questions", "past-trip":
            messages = exchange("Plan next week around my trip to the coast", questionsReply)
        case "proposal", "past-move":
            var reply = DemoCoachChat.swapReply(turn: 1)
            reply.thought = "Monday's lift clashes with the run with a friend. Tuesday 09:00 is the only free gym window."
            reply.quickReplies = ["Keep VO2 B too", "Looks good"]
            messages = exchange("No heavy lift today. Move it to tomorrow; I'll run easy with a friend.", reply)
        default:
            messages = []
        }
        return CoachThread(messages: messages, notice: messages.isEmpty ? notice : nil, firstName: firstName)
    }

    /// The history sheet's past chats, newest first.
    static let history = [
        summary("past-october", "How much did I train in October?", "2026-10-28T19:40:00Z", 2),
        summary("past-trip", "Plan next week around my trip to the coast", "2026-10-27T07:15:00Z", 4),
        summary("past-move", "No heavy lift today. Move it to tomorrow", "2026-10-26T12:05:00Z", 6),
        summary("past-sore", "I'm sore, make today easy", "2026-10-21T06:50:00Z", 2),
        summary("past-rdl", "How do I do a Romanian deadlift?", "2026-10-14T18:20:00Z", 2),
    ]

    static let breakdownReply = CoachReply(
        text: """
            **14 h 20 m** in October, about 3 h 20 m a week. Riding was half of it; strength held steady at two \
            sessions a week.
            """,
        attachments: [DemoCoachCards.breakdown],
        thought: "October's activities: 9 rides, 11 runs, 8 lifts, 2 swims. Riding is the biggest share by far."
    )

    static let questionsReply = CoachReply(
        text: "A few questions first, so the week fits the trip.",
        thought: "The trip is Thursday to Sunday. The long ride and the 10k test both fall inside it.",
        questions: [
            ChatQuestion(
                id: "days",
                title: "Which days are you away?",
                subtitle: "I'll keep those days light.",
                kind: .single(options: ["Thu–Sun", "Fri–Sun", "Sat–Sun"], allowsOther: true)
            ),
            ChatQuestion(
                id: "kit",
                title: "What can you train with there?",
                subtitle: "Pick all that apply.",
                kind: .multi(options: ["Running shoes", "Hotel gym", "Pool", "Bike"], allowsOther: true)
            ),
            ChatQuestion(id: "note", title: "Anything else to know?", kind: .text(placeholder: "Early flights, a race…")),
            ChatQuestion(
                id: "test",
                title: "Move the 10k test to Wednesday?",
                subtitle: "It falls on the first day of the trip.",
                kind: .confirm(primary: "Move it", secondary: "Keep Thursday")
            ),
        ]
    )

    private static func exchange(_ question: String, _ reply: CoachReply) -> [CoachMessage] {
        [
            CoachMessage(id: "demo-q", body: .mine(question), sentAt: CoachWire.date("2026-10-28T19:40:00Z")),
            CoachMessage(id: "demo-a", body: .coach(reply), sentAt: CoachWire.date("2026-10-28T19:40:08Z")),
        ]
    }

    private static func summary(_ id: String, _ title: String, _ date: String, _ count: Int) -> CoachThreadSummary {
        CoachThreadSummary(id: id, title: title, updatedAt: CoachWire.date(date), messageCount: count)
    }
}

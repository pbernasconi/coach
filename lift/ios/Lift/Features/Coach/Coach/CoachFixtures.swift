#if DEBUG
    import Foundation

    extension CoachState {
        static var fixtureEmpty: CoachState {
            var state = CoachState()
            state.firstName = DemoCoachThreads.firstName
            state.notice = DemoCoachThreads.notice
            return state
        }

        static var fixtureTyping: CoachState {
            var state = fixtureEmpty
            state.draft = "Can you move Thursday's run to the morning? I have a dinner that evening."
            return state
        }

        /// A user bubble, then Coach's Thought, reply, breakdown card and thumbs.
        static var fixtureConversation: CoachState { scenario("conversation") }
        static var fixtureQuestions: CoachState { scenario("questions") }
        static var fixtureProposalCard: CoachState { scenario("proposal") }

        static var fixtureHistory: CoachState {
            var state = fixtureConversation
            state.history = .loaded(DemoCoachThreads.history)
            return state
        }

        private static func scenario(_ name: String) -> CoachState {
            var state = CoachState()
            let thread = DemoCoachThreads.thread(name)
            state.messages = thread.messages
            state.firstName = thread.firstName
            return state
        }

        static var fixtureProposal: CoachState {
            var state = CoachState()
            state.messages = [
                CoachMessage(
                    id: "m0",
                    body: .mine("No heavy lift today. Move it to tomorrow; I'll run easy with a friend.")
                ),
                CoachMessage(id: "m1", body: .coach(DemoCoachChat.sample(for: "move the lift", turn: 1))),
            ]
            state.nextID = 2
            return state
        }

        static var fixtureApplied: CoachState {
            var state = fixtureProposal
            if case .coach(var reply) = state.messages[1].body {
                reply.proposal?.status = .applied
                state.messages[1].body = .coach(reply)
            }
            return state
        }

        static var fixtureWaiting: CoachState {
            var state = CoachState()
            state.messages = [CoachMessage(id: "m0", body: .mine("I'm sore, make today easy"))]
            state.nextID = 1
            state.phase = .waiting
            return state
        }

        static var fixtureThinking: CoachState {
            var state = fixtureWaiting
            state.phase = .answering(
                CoachProgress(
                    step: .thinking,
                    thinking: "Sore legs today. Today has a heavy lift, tomorrow an easy spin."
                )
            )
            return state
        }

        static var fixtureStreaming: CoachState {
            var state = fixtureWaiting
            state.phase = .answering(
                CoachProgress(
                    step: .proposing,
                    text: "Sore legs and a heavy lift don't mix. I'd move the lift to Thursday"
                )
            )
            return state
        }

        static var fixtureFailed: CoachState {
            var state = fixtureWaiting
            state.phase = .failed("Coach could not answer. Check your connection.")
            return state
        }
    }
#endif

#if DEBUG
    import Foundation

    extension CoachState {
        static var fixtureEmpty: CoachState { CoachState() }

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

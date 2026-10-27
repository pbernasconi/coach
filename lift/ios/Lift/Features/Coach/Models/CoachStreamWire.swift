import Foundation
import LiftSync

/// The coach answer stream's events (lift/APP-API.md, "Coach answer stream") and how each moves the reply along.
/// Pure, so tests feed it the contract's events without a network.
nonisolated enum CoachStreamWire {
    /// The fields any event can carry; each event uses its own.
    struct Event: Decodable, Sendable {
        let step: String?
        let text: String?
        let delta: String?
        let error: String?
    }

    /// What one server event does to the reply in progress.
    enum Outcome: Equatable, Sendable {
        /// The progress changed: show it.
        case progress(CoachProgress)
        /// The answer is done: this is the reply.
        case reply(CoachReply)
        /// The server failed, in words for the error row.
        case failed(String)
        /// Nothing to show (Paolo's stored message, or an event this build doesn't know).
        case ignored
    }

    static func apply(_ event: ServerSentEvent, to progress: inout CoachProgress) -> Outcome {
        let data = Data(event.data.utf8)
        let decoder = JSONDecoder()
        if event.event == "done" {
            guard let exchange = try? decoder.decode(CoachWire.Exchange.self, from: data),
                case .coach(let reply) = CoachWire.message(exchange.reply).body
            else { return .failed(String(localized: "Coach sent something this app cannot read.")) }
            return .reply(reply)
        }
        guard let fields = try? decoder.decode(Event.self, from: data) else { return .ignored }
        switch event.event {
        case "status":
            guard let step = fields.step.flatMap(CoachProgress.Step.init(rawValue:)) else { return .ignored }
            progress.step = step
        case "thinking":
            progress.thinking += fields.text ?? ""
        case "text":
            progress.text += fields.delta ?? ""
            progress.step = .writing
        case "error":
            return .failed(fields.error ?? String(localized: "Coach could not answer. Try again."))
        default:
            return .ignored
        }
        return .progress(progress)
    }
}

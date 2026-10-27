import Foundation

/// The rules of talking into a chat composer. A tap starts listening and another tap (or a pause) stops, leaving the
/// words in the field to edit; holding the microphone listens until release, and the release sends what was heard.
/// Pure: the caller runs the speech engine and feeds this the events.
nonisolated public struct ChatVoiceInput: Equatable, Sendable {
    /// Where listening stands.
    public enum Phase: Equatable, Sendable {
        case idle
        /// Started by a tap: words go into the field; a tap or a pause stops.
        case listening
        /// Started by holding the button: release sends.
        case holding
        /// The microphone or speech recognition is not allowed: the composer shows the way to Settings.
        case unavailable
    }

    /// What the caller does after an event.
    public enum Effect: Equatable, Sendable {
        case none
        /// Start the speech engine (asking for permission on first use).
        case start
        /// Stop it and leave the words in the field.
        case stop
        /// Stop it and send the words, when there are any.
        case stopAndSend
    }

    /// How long a pause in the words ends tap-to-talk.
    public static let silence: Duration = .seconds(2)

    public private(set) var phase: Phase = .idle

    public init() {}

    public var isListening: Bool { phase == .listening || phase == .holding }

    /// The microphone was tapped: start, or stop when listening.
    public mutating func tapped() -> Effect {
        switch phase {
        case .idle, .unavailable:
            phase = .listening
            return .start
        case .listening, .holding:
            phase = .idle
            return .stop
        }
    }

    /// The microphone was held down past a tap.
    public mutating func holdBegan() -> Effect {
        guard phase == .idle || phase == .unavailable || phase == .listening else { return .none }
        let wasListening = phase == .listening
        phase = .holding
        return wasListening ? .none : .start
    }

    /// The finger lifted after a hold: send what was heard.
    public mutating func holdEnded() -> Effect {
        guard phase == .holding else { return .none }
        phase = .idle
        return .stopAndSend
    }

    /// No new words for `silence`: tap-to-talk stops; holding keeps listening.
    public mutating func pausedLongEnough() -> Effect {
        guard phase == .listening else { return .none }
        phase = .idle
        return .stop
    }

    /// The app left the screen: stop, and send nothing.
    public mutating func backgrounded() -> Effect {
        guard isListening else { return .none }
        phase = .idle
        return .stop
    }

    /// The engine could not start (no permission, no recognizer): show the way to Settings.
    public mutating func failed(denied: Bool) {
        phase = denied ? .unavailable : .idle
    }

    /// The engine stopped by itself (it hit its limit): end listening, keep the words.
    public mutating func ended() {
        if isListening { phase = .idle }
    }

    /// What release sends: the words, trimmed; nil when nothing was heard, so an empty release sends nothing.
    public static func message(toSend transcript: String) -> String? {
        let text = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }
}

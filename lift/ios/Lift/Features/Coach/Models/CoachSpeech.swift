import Foundation

/// What the speech engine hears while it listens: the words so far (each update holds them all), or the input level.
nonisolated enum SpeechUpdate: Equatable, Sendable {
    case words(String)
    /// The microphone's input level, 0…1, for the composer's bars.
    case level(Double)
}

/// Why listening could not start.
nonisolated enum SpeechStartError: Error, Equatable, Sendable {
    /// The microphone or speech recognition is not allowed for this app: the composer links to Settings.
    case denied
    /// No on-device recognizer for this language, or the microphone is busy.
    case unavailable
}

/// Turns speech into text on the device, for the composer's microphone. `LiveSpeechTranscriber` uses the iPhone's
/// recognizer; demo data uses `DemoSpeechTranscriber`.
@MainActor
protocol SpeechTranscribing: AnyObject {
    /// Asks for the microphone and speech permissions on first use, then listens. The stream ends after `stop()`, or
    /// when the engine stops by itself.
    func start() async throws -> AsyncStream<SpeechUpdate>
    func stop()
}

/// The stand-in in demo data and screenshots: "hears" a made-up sentence, a word at a time, on the injected clock.
/// With `isDenied` it acts as an iPhone where the microphone is off.
@MainActor
final class DemoSpeechTranscriber: SpeechTranscribing {
    static let sentence = "Push today's lift to tomorrow and put an easy zone 2 run with David in its place"
    private let clock: any Clock<Duration>
    private let isDenied: Bool
    private var feeding: Task<Void, Never>?

    init(clock: any Clock<Duration>, isDenied: Bool) {
        self.clock = clock
        self.isDenied = isDenied
    }

    func start() async throws -> AsyncStream<SpeechUpdate> {
        if isDenied { throw SpeechStartError.denied }
        let (stream, continuation) = AsyncStream.makeStream(of: SpeechUpdate.self)
        let words = Self.sentence.split(separator: " ").map(String.init)
        let clock = clock
        feeding = Task {
            for count in 1...words.count {
                do { try await clock.sleep(for: .milliseconds(450)) } catch { break }
                continuation.yield(.level([0.35, 0.8, 0.55, 0.95, 0.5][count % 5]))
                continuation.yield(.words(words.prefix(count).joined(separator: " ")))
            }
        }
        continuation.onTermination = { [weak self] _ in Task { @MainActor in self?.feeding?.cancel() } }
        return stream
    }

    func stop() {
        feeding?.cancel()
        feeding = nil
    }
}

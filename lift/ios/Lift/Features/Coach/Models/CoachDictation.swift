import Foundation
import KoboComponents

/// Runs the speech engine for the composer's microphone: starts and stops it, and reports what it hears, a pause of
/// `ChatVoiceInput.silence` after the last words, and its end. Kobo's `ChatVoiceInput` holds the rules of when.
@MainActor
final class CoachDictation {
    enum Event: Equatable {
        case words(String)
        case level(Double)
        /// No new words for `ChatVoiceInput.silence`.
        case paused
        /// The engine stopped by itself.
        case ended
        case failed(denied: Bool)
    }

    private let speech: any SpeechTranscribing
    private let clock: any Clock<Duration>
    private var listening: Task<Void, Never>?
    private var silence: Task<Void, Never>?

    init(speech: any SpeechTranscribing, clock: any Clock<Duration>) {
        self.speech = speech
        self.clock = clock
    }

    /// Starts listening; `onEvent` gets each event until `stop()`.
    func start(_ onEvent: @escaping (Event) -> Void) -> Task<Void, Never> {
        stop()
        let task = Task {
            do {
                let updates = try await speech.start()
                guard !Task.isCancelled else { return speech.stop() }
                waitForPause(onEvent)
                for await update in updates {
                    guard !Task.isCancelled else { break }
                    switch update {
                    case .words(let text):
                        onEvent(.words(text))
                        waitForPause(onEvent)
                    case .level(let level): onEvent(.level(level))
                    }
                }
                if !Task.isCancelled { onEvent(.ended) }
            } catch {
                if !Task.isCancelled { onEvent(.failed(denied: error as? SpeechStartError == .denied)) }
            }
            if !Task.isCancelled { cancelPause() }
        }
        listening = task
        return task
    }

    func stop() {
        listening?.cancel()
        listening = nil
        cancelPause()
        speech.stop()
    }

    private func waitForPause(_ onEvent: @escaping (Event) -> Void) {
        silence?.cancel()
        let clock = clock
        silence = Task {
            do { try await clock.sleep(for: ChatVoiceInput.silence) } catch { return }
            onEvent(.paused)
        }
    }

    private func cancelPause() {
        silence?.cancel()
        silence = nil
    }
}

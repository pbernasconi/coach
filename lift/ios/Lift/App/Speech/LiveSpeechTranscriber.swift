import AVFAudio
import Foundation
import Speech

/// The iPhone's own recognizer, on the device only (no audio leaves it), fed by the microphone. Asks for both
/// permissions on first use.
///
/// The recognizer ends a recognition by itself: after a pause in speech (a final result, or "no speech" when nothing
/// was said) and after about a minute. The microphone keeps running through that: the words so far are kept and a new
/// recognition picks up the next ones, so listening lasts until `stop()`. The stream ends early only when the
/// microphone is taken (a call, Siri) or the recognizer keeps failing.
@MainActor
final class LiveSpeechTranscriber: SpeechTranscribing {
    /// Recognitions in a row that may fail at once (no words, under a second) before listening gives up, so a broken
    /// recognizer cannot spin. A recognition that ends empty after a quiet stretch is just silence and does not count.
    private static let quickFailuresAllowed = 3

    private let engine = AVAudioEngine()
    private let feed = RequestFeed()
    private var recognizer: SFSpeechRecognizer?
    private var task: SFSpeechRecognitionTask?
    private var continuation: AsyncStream<SpeechUpdate>.Continuation?
    private var interruption: (any NSObjectProtocol)?
    /// Counts recognitions, so a late result from an ended one is ignored.
    private var segment = 0
    /// The words of the recognitions that already ended.
    private var kept = ""
    /// The words of the current recognition so far.
    private var current = ""
    private var segmentStarted = ContinuousClock.now
    private var quickFailures = 0

    init() {}

    func start() async throws -> AsyncStream<SpeechUpdate> {
        stop()
        guard await Self.speechAllowed(), await AVAudioApplication.requestRecordPermission() else {
            throw SpeechStartError.denied
        }
        guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable, recognizer.supportsOnDeviceRecognition
        else { throw SpeechStartError.unavailable }
        let (stream, continuation) = AsyncStream.makeStream(of: SpeechUpdate.self)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let input = engine.inputNode
            input.installTap(
                onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0),
                block: Self.tap(feeding: feed, levels: continuation)
            )
            engine.prepare()
            try engine.start()
        } catch {
            engine.inputNode.removeTap(onBus: 0)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            throw SpeechStartError.unavailable
        }
        self.recognizer = recognizer
        self.continuation = continuation
        kept = ""
        current = ""
        quickFailures = 0
        interruption = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.stop() }
        }
        recognize()
        return stream
    }

    func stop() {
        guard continuation != nil || engine.isRunning else { return }
        segment += 1
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        feed.swap(nil)?.endAudio()
        task?.cancel()
        task = nil
        recognizer = nil
        if let interruption { NotificationCenter.default.removeObserver(interruption) }
        interruption = nil
        continuation?.finish()
        continuation = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Starts a recognition on the microphone's next buffers.
    private func recognize() {
        guard let recognizer else { return }
        segment += 1
        let id = segment
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.taskHint = .dictation
        feed.swap(request)?.endAudio()
        current = ""
        segmentStarted = .now
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let words = result?.bestTranscription.formattedString
            let ended = error != nil || result?.isFinal == true
            Task { @MainActor in self?.heard(words, ended: ended, in: id) }
        }
    }

    private func heard(_ words: String?, ended: Bool, in id: Int) {
        guard id == segment, let continuation else { return }
        if let words, words != current {
            current = words
            continuation.yield(.words(Self.joined(kept, current)))
        }
        guard ended else { return }
        if current.isEmpty, ContinuousClock.now - segmentStarted < .seconds(1) {
            quickFailures += 1
            guard quickFailures < Self.quickFailuresAllowed else { return stop() }
        } else {
            quickFailures = 0
            kept = Self.joined(kept, current)
        }
        recognize()
    }

    private nonisolated static func joined(_ kept: String, _ current: String) -> String {
        kept.isEmpty ? current : current.isEmpty ? kept : kept + " " + current
    }

    /// The microphone's buffers go to the current recognition, and their loudness to the bars. Runs on the audio
    /// thread, so it is made outside the main actor.
    private nonisolated static func tap(
        feeding feed: RequestFeed,
        levels: AsyncStream<SpeechUpdate>.Continuation
    ) -> AVAudioNodeTapBlock {
        { buffer, _ in
            feed.append(buffer)
            levels.yield(.level(level(of: buffer)))
        }
    }

    /// The buffer's loudness, 0…1: its RMS in decibels, from -50 dB (silence) to -10 dB (speech up close).
    private nonisolated static func level(of buffer: AVAudioPCMBuffer) -> Double {
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        let count = Int(buffer.frameLength)
        var sum: Float = 0
        for index in 0..<count { sum += samples[index] * samples[index] }
        let decibels = 20 * log10(max(sqrt(sum / Float(count)), 0.000_01))
        return Double(min(1, max(0, (decibels + 50) / 40)))
    }

    private nonisolated static func speechAllowed() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return true
        case .denied, .restricted: return false
        case .notDetermined:
            return await withCheckedContinuation { done in
                SFSpeechRecognizer.requestAuthorization { done.resume(returning: $0 == .authorized) }
            }
        @unknown default: return false
        }
    }
}

/// The recognition the microphone feeds, swapped from the main actor while the audio thread appends to it.
private nonisolated final class RequestFeed: @unchecked Sendable {
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?

    /// Puts `next` in place and hands back the one it replaced.
    func swap(_ next: SFSpeechAudioBufferRecognitionRequest?) -> SFSpeechAudioBufferRecognitionRequest? {
        lock.withLock {
            let previous = request
            request = next
            return previous
        }
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        lock.withLock { request?.append(buffer) }
    }
}

import AVFAudio
import Speech

/// The iPhone's own recognizer, on the device only (no audio leaves it), fed by the microphone. Asks for both
/// permissions on first use. iOS ends a recognition after about a minute; the stream ends then.
@MainActor
final class LiveSpeechTranscriber: SpeechTranscribing {
    private let engine = AVAudioEngine()
    private var task: SFSpeechRecognitionTask?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var continuation: AsyncStream<SpeechUpdate>.Continuation?

    init() {}

    func start() async throws -> AsyncStream<SpeechUpdate> {
        stop()
        guard await Self.speechAllowed(), await AVAudioApplication.requestRecordPermission() else {
            throw SpeechStartError.denied
        }
        guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable, recognizer.supportsOnDeviceRecognition
        else { throw SpeechStartError.unavailable }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        let (stream, continuation) = AsyncStream.makeStream(of: SpeechUpdate.self)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let input = engine.inputNode
            input.installTap(
                onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0),
                block: Self.tap(feeding: request, levels: continuation)
            )
            engine.prepare()
            try engine.start()
        } catch {
            engine.inputNode.removeTap(onBus: 0)
            throw SpeechStartError.unavailable
        }
        task = recognizer.recognitionTask(with: request, resultHandler: Self.results(to: continuation))
        self.request = request
        self.continuation = continuation
        return stream
    }

    func stop() {
        guard request != nil || engine.isRunning else { return }
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        continuation?.finish()
        continuation = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// The microphone's buffers go to the recognizer, and their loudness to the bars. Runs on the audio thread, so it
    /// is made outside the main actor.
    private nonisolated static func tap(
        feeding request: SFSpeechAudioBufferRecognitionRequest,
        levels: AsyncStream<SpeechUpdate>.Continuation
    ) -> AVAudioNodeTapBlock {
        { buffer, _ in
            request.append(buffer)
            levels.yield(.level(level(of: buffer)))
        }
    }

    /// Each result holds all the words so far; a final result or an error ends the stream.
    private nonisolated static func results(
        to continuation: AsyncStream<SpeechUpdate>.Continuation
    ) -> (SFSpeechRecognitionResult?, (any Error)?) -> Void {
        { result, error in
            if let result { continuation.yield(.words(result.bestTranscription.formattedString)) }
            if error != nil || result?.isFinal == true { continuation.finish() }
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

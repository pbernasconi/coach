import Foundation

@testable import Lift

/// A speech engine the test speaks into: `hear` sends words; it counts starts and stops, and can be denied.
@MainActor
final class FakeSpeech: SpeechTranscribing {
    var denies = false
    private(set) var starts = 0
    private(set) var stops = 0
    private var continuation: AsyncStream<SpeechUpdate>.Continuation?

    func start() async throws -> AsyncStream<SpeechUpdate> {
        if denies { throw SpeechStartError.denied }
        starts += 1
        let (stream, continuation) = AsyncStream.makeStream(of: SpeechUpdate.self)
        self.continuation = continuation
        return stream
    }

    func stop() {
        stops += 1
        continuation?.finish()
        continuation = nil
    }

    func hear(_ words: String) {
        continuation?.yield(.level(0.5))
        continuation?.yield(.words(words))
    }
}

/// Records each time the app's page in Settings was opened.
@MainActor
final class RecordingAppSettings: AppSettingsOpening {
    private(set) var opened = 0
    func openAppSettings() { opened += 1 }
}

/// A clock whose sleeps never end by themselves, so a pause never comes; a cancelled sleep throws.
nonisolated final class HeldClock: Clock {
    var now: ImmediateClock.Instant { ImmediateClock.Instant(offset: .zero) }
    var minimumResolution: Duration { .zero }

    func sleep(until _: ImmediateClock.Instant, tolerance _: Duration?) async throws {
        let (stream, continuation) = AsyncStream.makeStream(of: Void.self)
        await withTaskCancellationHandler {
            for await _ in stream {}
        } onCancel: {
            continuation.finish()
        }
        try Task.checkCancellation()
    }
}

/// Lets queued tasks run until `condition` holds (at most 1,000 turns), without real time.
@MainActor
func settle(until condition: () -> Bool) async {
    for _ in 0..<1_000 where !condition() { await Task.yield() }
}

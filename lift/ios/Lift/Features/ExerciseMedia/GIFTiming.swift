import Foundation

/// Frame timing for an animated GIF shown with `UIImage.animatedImage(with:duration:)`, which gives every frame the
/// same time: a frame that should stay longer is repeated. Delays below 20 ms are treated as 100 ms, as browsers do
/// (many GIFs say 0 and mean "default").
nonisolated enum GIFTiming {
    /// The shortest delay honoured, in seconds.
    static let minimumDelay = 0.02
    /// What a zero or too-short delay means.
    static let defaultDelay = 0.1
    /// The time slice frames are repeated on.
    static let slice = 0.02
    /// A cap on repeated frames, so a broken file cannot use unbounded memory.
    static let maxFrames = 600

    /// A delay at or above this holds a pose.
    static let holdDelay = 0.5

    /// The frames worth showing. When a GIF holds two or more poses (frames shown for `holdDelay` or longer), only the
    /// held poses play: the dataset's short frames between them are cross-fades of the two poses, which read as a
    /// ghosted double figure, not as motion. A GIF of real motion (no holds) plays every frame.
    static func keyFrames(delays: [Double]) -> [Int] {
        let holds = delays.indices.filter { delays[$0] >= holdDelay }
        return holds.count >= 2 ? holds : Array(delays.indices)
    }

    /// The frame order (indices into the GIF, some repeated) and the total duration for `delays`.
    static func sequence(delays: [Double]) -> (frames: [Int], duration: Double) {
        let honoured = delays.map { $0 < minimumDelay ? defaultDelay : $0 }
        var frames: [Int] = []
        for (index, delay) in honoured.enumerated() {
            let repeats = max(1, Int((delay / slice).rounded()))
            frames += Array(repeating: index, count: repeats)
            if frames.count >= maxFrames { break }
        }
        frames = Array(frames.prefix(maxFrames))
        return (frames, Double(frames.count) * slice)
    }
}

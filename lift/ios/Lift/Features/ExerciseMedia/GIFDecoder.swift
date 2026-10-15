import ImageIO
import UIKit

/// Decodes GIF bytes into an animated `UIImage` with ImageIO, honouring each frame's delay and skipping cross-faded
/// in-between frames (`GIFTiming`). Runs off the
/// main actor; a GIF of the dataset's size (180 × 180) decodes in a few milliseconds.
nonisolated enum GIFDecoder {
    /// The animated image, a still for a one-frame file, or nil for bytes that are not an image.
    @concurrent
    static func animatedImage(from data: Data) async -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        guard count > 1 else { return UIImage(data: data) }
        let allDelays = (0..<count).map { delay(of: source, at: $0) }
        var frames: [UIImage] = []
        var delays: [Double] = []
        for index in GIFTiming.keyFrames(delays: allDelays) {
            // ImageIO returns each GIF frame fully composited on the canvas (disposal applied), so a frame never
            // shows remnants of another.
            guard let image = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
            frames.append(UIImage(cgImage: image))
            delays.append(allDelays[index])
        }
        guard !frames.isEmpty else { return nil }
        let timing = GIFTiming.sequence(delays: delays)
        return UIImage.animatedImage(with: timing.frames.map { frames[$0] }, duration: timing.duration)
    }

    private static func delay(of source: CGImageSource, at index: Int) -> Double {
        let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
        let gif = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        let unclamped = gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double
        return unclamped ?? gif?[kCGImagePropertyGIFDelayTime] as? Double ?? 0
    }
}

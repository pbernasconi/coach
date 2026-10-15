import SwiftUI
import UIKit

/// An animated `UIImage` in a `UIImageView`. With `animates` off (Reduce Motion) it shows the first frame, still.
/// The view fills the frame SwiftUI gives it, keeping the image's aspect ratio.
struct AnimatedGIFView: UIViewRepresentable {
    let image: UIImage
    let animates: Bool
    /// "Barbell Full Squat animation".
    let accessibilityLabel: String

    func makeUIView(context _: Context) -> UIImageView {
        let view = UIImageView()
        view.contentMode = .scaleAspectFit
        view.clipsToBounds = true
        view.layer.magnificationFilter = .trilinear
        view.setContentHuggingPriority(.defaultLow, for: .horizontal)
        view.setContentHuggingPriority(.defaultLow, for: .vertical)
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        view.isAccessibilityElement = true
        view.accessibilityTraits = .image
        return view
    }

    func updateUIView(_ view: UIImageView, context _: Context) {
        let shown = animates ? image : (image.images?.first ?? image)
        if view.image !== shown {
            view.image = shown
        }
        if animates, image.images != nil {
            view.startAnimating()
        } else {
            view.stopAnimating()
        }
        view.accessibilityLabel = accessibilityLabel
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView _: UIImageView, context _: Context) -> CGSize? {
        let width = proposal.width ?? image.size.width
        let height = proposal.height ?? width
        return CGSize(width: width, height: height)
    }
}

/// Decodes GIF bytes off the main actor and shows them with `AnimatedGIFView`; a skeleton until the frames are ready.
/// Holds the first frame still when Reduce Motion is on.
struct AnimatedExerciseImage: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var decoded: DecodedGIF?
    let data: Data
    let name: String

    var body: some View {
        Group {
            if let decoded, decoded.data == data, let image = decoded.image {
                AnimatedGIFView(
                    image: image,
                    animates: !reduceMotion,
                    accessibilityLabel: String(localized: "\(name) animation")
                )
            } else if decoded?.data == data {
                MediaFailureGlyph()
            } else {
                MediaSkeleton()
            }
        }
        .task(id: data) {
            let image = await GIFDecoder.animatedImage(from: data)
            decoded = DecodedGIF(data: data, image: image)
        }
    }
}

/// The decoded frames and the bytes they came from, so new bytes never show stale frames.
private struct DecodedGIF {
    let data: Data
    let image: UIImage?
}

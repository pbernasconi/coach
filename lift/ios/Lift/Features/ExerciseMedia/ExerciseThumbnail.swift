import KoboComponents
import KoboTokens
import SwiftUI
import UIKit

/// A small rounded still of an exercise for list rows: a skeleton while it loads, a figure symbol when it cannot.
/// The 180 px still is downsampled off the main actor to the pixels the tile needs. The screen showing it carries
/// the "© Gym visual" credit (`MediaAttribution`) once, for all its thumbnails.
struct ExerciseThumbnail: View {
    @Environment(\.displayScale) private var displayScale
    @State private var decoded: DecodedThumbnail?
    let image: MediaImage
    /// The exercise name, for VoiceOver.
    let name: String
    var side: CGFloat = Size.thumbnail

    var body: some View {
        content
            .frame(width: side, height: side)
            .task(id: image.data) { await decode() }
    }

    @ViewBuilder private var content: some View {
        switch image {
        case .loading:
            MediaSkeleton()
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
        case .failed:
            Thumbnail(systemName: "figure.strengthtraining.traditional", side: side)
        case .loaded(let data):
            if let decoded, decoded.data == data, let still = decoded.image {
                Thumbnail(image: Image(uiImage: still), side: side, accessibilityLabel: "\(name)")
            } else if decoded?.data == data {
                Thumbnail(systemName: "figure.strengthtraining.traditional", side: side)
            } else {
                MediaSkeleton()
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            }
        }
    }

    private func decode() async {
        guard let data = image.data else { return }
        let pixels = side * displayScale
        let still = await UIImage(data: data)?.byPreparingThumbnail(ofSize: CGSize(width: pixels, height: pixels))
        decoded = DecodedThumbnail(data: data, image: still)
    }
}

/// A downsampled still and the bytes it came from.
private struct DecodedThumbnail {
    let data: Data
    let image: UIImage?
}

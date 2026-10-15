import KoboComponents
import KoboTokens
import SwiftUI
import UIKit

/// A small rounded still of an exercise for list rows: a skeleton while it loads, a figure symbol when it cannot.
/// The 180 px still is downsampled off the main actor to the pixels the tile needs. In light mode the still multiplies
/// onto the tile, so its white background takes the tile's colour; in dark mode the white tile is dimmed a little, as on
/// the exercise screens.
struct ExerciseThumbnail: View {
    /// The tile in compact rows.
    static let compactSide = Size.thumbnail - Space.lg
    /// How much of the white still shows in dark mode: enough to read the drawing, without glare.
    static let darkOpacity = 0.86

    @Environment(\.displayScale) private var displayScale
    @Environment(\.colorScheme) private var colorScheme
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
                // Thumbnail labels the tile itself with the exercise name.
                Thumbnail(side: side, accessibilityLabel: "\(name)") {
                    // swiftlint:disable:next accessibility_label_for_image
                    Image(uiImage: still)
                        .resizable()
                        .scaledToFill()
                        .blendMode(colorScheme == .light ? .multiply : .normal)
                }
                .opacity(colorScheme == .dark ? Self.darkOpacity : 1)
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
        let still = await UIImage(data: data)?.byPreparingThumbnail(
            ofSize: CGSize(width: pixels, height: pixels)
        )
        decoded = DecodedThumbnail(data: data, image: still)
    }
}

/// A downsampled still and the bytes it came from.
private struct DecodedThumbnail {
    let data: Data
    let image: UIImage?
}

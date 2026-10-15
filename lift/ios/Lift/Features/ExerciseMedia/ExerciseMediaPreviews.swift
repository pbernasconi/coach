#if DEBUG
    import KoboComponents
    import KoboTokens
    import SwiftUI
    import UIKit

    /// Made-up media for previews: a drawn tile, so previews never touch the network.
    enum MediaPreviewData {
        static let still: MediaImage = {
            let renderer = UIGraphicsImageRenderer(size: CGSize(width: 180, height: 180))
            let image = renderer.image { context in
                UIColor.secondarySystemFill.setFill()
                context.fill(CGRect(x: 0, y: 0, width: 180, height: 180))
                UIImage(systemName: "figure.strengthtraining.traditional")?.draw(in: CGRect(x: 40, y: 40, width: 100, height: 100))
            }
            return image.jpegData(compressionQuality: 0.8).map(MediaImage.loaded) ?? .failed
        }()
    }

    private struct MediaGallery: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack(spacing: Space.md) {
                    ExerciseThumbnail(image: .loading, name: "Loading")
                    ExerciseThumbnail(image: MediaPreviewData.still, name: "Made-up squat")
                    ExerciseThumbnail(image: .failed, name: "Missing")
                }
                ExerciseMediaHero(animation: MediaPreviewData.still, name: "Made-up squat")
                ExerciseMediaHero(animation: .failed, name: "Missing")
            }
            .pageGutter()
            .screenCanvas()
            .koboTheme(.lift)
        }
    }

    #Preview("Media") { MediaGallery() }
    #Preview("Media, dark") { MediaGallery().preferredColorScheme(.dark) }
    #Preview("Media, AX3") { MediaGallery().dynamicTypeSize(.accessibility3) }
#endif

#if DEBUG
    import KoboComponents
    import KoboTokens
    import SwiftUI

    private struct MediaGallery: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack(spacing: Space.md) {
                    ExerciseThumbnail(image: .loading, name: "Loading")
                    ExerciseThumbnail(image: MediaPreviewData.still, name: "Made-up squat")
                    ExerciseThumbnail(image: .failed, name: "Missing")
                }
                ExerciseOverview {
                    ExerciseMediaHero(animation: MediaPreviewData.still, name: "Made-up squat")
                } facts: {
                    ExerciseFact("Primary") { MuscleTags(muscles: ["Quads", "Glutes"], style: .tonal) }
                    ExerciseFact("Equipment") { KoboTag(verbatim: "Barbell", tone: .neutral) }
                }
                ExerciseOverview {
                    ExerciseMediaHero(animation: .failed, name: "Missing")
                } facts: {
                    ExerciseFact("Primary") { MuscleTags(muscles: ["Back"], style: .tonal) }
                }
                ExerciseOverview {
                    ExerciseMediaPlaceholder()
                } facts: {
                    ExerciseFact("Primary") { MuscleTags(muscles: ["Shoulders"], style: .tonal) }
                }
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

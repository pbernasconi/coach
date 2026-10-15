import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The overview at the top of the exercise detail screen: the animation (its first frame, still, under Reduce Motion)
/// or a placeholder when the exercise has no catalog media, beside its muscles and equipment.
struct ExerciseMediaView: View {
    let item: ExerciseDetailItem
    let media: ExerciseMedia?
    /// The loaded animation behind `media`.
    let animation: MediaImage

    var body: some View {
        ExerciseOverview {
            if media != nil {
                ExerciseMediaHero(animation: animation, name: item.name)
            } else {
                ExerciseMediaPlaceholder()
            }
        } facts: {
            if !item.primary.isEmpty {
                ExerciseFact("Primary") { MuscleTags(muscles: item.primary, style: .tonal) }
            }
            if !item.secondary.isEmpty {
                ExerciseFact("Secondary") { MuscleTags(muscles: item.secondary, style: .outline) }
            }
            if !item.equipment.isEmpty {
                ExerciseFact("Equipment") {
                    KoboTag(verbatim: item.equipment, tone: .neutral, systemImage: "dumbbell.fill")
                }
            }
        }
    }
}

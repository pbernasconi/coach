import SwiftUI
import WidgetKit

/// The LiftWidgets extension: the workout Live Activity and the Coach widget (fitness, form, fatigue and today).
@main
struct LiftWidgetsBundle: WidgetBundle {
    var body: some Widget {
        WorkoutActivityWidget()
        HomeWidget()
    }
}

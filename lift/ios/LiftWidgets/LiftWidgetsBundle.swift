import SwiftUI
import WidgetKit

/// The LiftWidgets extension. For now it only draws the rest countdown Live Activity.
@main
struct LiftWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RestActivityWidget()
    }
}

import ActivityKit
import SwiftUI
import WidgetKit

/// The rest countdown on the Lock Screen and in the Dynamic Island. The system counts down to `endsAt`, so the
/// timer stays right while Lift is in the background. The app starts, extends and ends it; its own +30s and Skip run App
/// Intents in the background that change the shared rest the app follows.
struct RestActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            RestLockScreenView(attributes: context.attributes, state: context.state)
                .activitySystemActionForegroundColor(WidgetColors.accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    RestExpandedLeading(attributes: context.attributes)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestCountdownText(state: context.state)
                        .font(.title.weight(.semibold))
                        .foregroundStyle(WidgetColors.accent)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    RestExpandedBottom(state: context.state)
                }
            } compactLeading: {
                RestTimerIcon()
            } compactTrailing: {
                RestCountdownText(state: context.state)
                    .foregroundStyle(WidgetColors.accent)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 48)
            } minimal: {
                RestTimerIcon()
            }
            .keylineTint(WidgetColors.accent)
        }
    }
}

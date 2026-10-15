import KoboComponents
import KoboTokens
import SwiftUI

/// The pinned footer of a flow step: the banner (capped), the disabled hint, the primary action and an optional
/// secondary one. It plays the error haptic once per failed submit and announces the reason to VoiceOver.
struct FlowStepFooter: View {
    @Environment(\.koboTheme) private var theme
    let primary: FlowStepAction
    let secondary: FlowStepAction?
    let banner: FlowStepBanner?
    let submitState: LoadableStepState?
    let footnote: Text?
    let stepHeight: CGFloat

    var body: some View {
        let primary = primary.loading(with: submitState)
        VStack(spacing: Space.sm) {
            if let banner = FlowStepBanner.failure(of: submitState) ?? banner {
                FlowFooterBanner(banner: banner, stepHeight: stepHeight)
            }
            if let hint = primary.disabledHint,
                FlowFooterLayout.showsHint(hasHint: true, isEnabled: primary.isEnabled, isLoading: primary.isLoading)
            {
                hint
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            Button(action: primary.action) { primary.title }
                .buttonStyle(.kobo(.primary, width: .full, isLoading: primary.isLoading))
                .disabled(!primary.isEnabled)
            if let secondary {
                Button(action: secondary.action) { secondary.title }
                    .buttonStyle(.kobo(.plain, width: .full, isLoading: secondary.isLoading))
                    .disabled(!secondary.isEnabled || primary.isLoading)
            }
            if let footnote {
                footnote
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
        }
        .koboFeedback(trigger: submitState?.failureCount ?? 0) { old, new in
            LoadableStepState.playsFailureFeedback(old: old, new: new) ? .error : nil
        }
        .onChange(of: submitState?.failureCount ?? 0) { old, new in
            guard LoadableStepState.playsFailureFeedback(old: old, new: new),
                let message = submitState?.failureMessage
            else { return }
            AccessibilityNotification.Announcement(message).post()
        }
    }
}

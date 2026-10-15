import KoboTokens
import SwiftUI

/// The state of one section under a title that stays: one caption sentence, an optional second one, and for a failed
/// read a quiet "Try again" `TextLink`. No art and no filled button: a local failure stays local. While `isRetrying`
/// the link becomes a spinner of the same width for at least `Motion.Duration.spinnerHold`. A failure built with
/// `announces` speaks its text to VoiceOver when it appears, and again if a retry fails.
///
///     SectionState(verbatim: "Couldn't load recent activity.", announces: true, onRetry: reload)
///     SectionState("No sessions this week", message: "Plan one from the Library tab.")
public struct SectionState: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsSpinner = false
    @State private var taps = 0
    private let title: Text
    private let message: Text?
    private let retryLabel: Text
    private let onRetry: (() -> Void)?
    private let announcement: String?
    private let isRetrying: Bool

    /// A state with localized copy (a settled empty section, a neutral access rule).
    public init(
        _ title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        retryLabel: LocalizedStringKey? = nil,
        isRetrying: Bool = false,
        onRetry: (() -> Void)? = nil
    ) {
        self.title = Text(title)
        self.message = message.map { Text($0) }
        self.retryLabel = retryLabel.map { Text($0) } ?? Text("Try again", bundle: .module)
        self.onRetry = onRetry
        self.announcement = nil
        self.isRetrying = isRetrying
    }

    /// A state whose copy is shown as is (a failure message). `announces` speaks it when it appears.
    public init(
        verbatim title: String,
        message: String? = nil,
        retryLabel: String? = nil,
        isRetrying: Bool = false,
        announces: Bool = false,
        onRetry: (() -> Void)? = nil
    ) {
        self.title = Text(verbatim: title)
        self.message = message.map { Text(verbatim: $0) }
        self.retryLabel = retryLabel.map { Text(verbatim: $0) } ?? Text("Try again", bundle: .module)
        self.onRetry = onRetry
        self.announcement = announces ? [title, message].compactMap(\.self).joined(separator: ". ") : nil
        self.isRetrying = isRetrying
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                title
                    .font(theme.font(.subheadline).weight(.medium))
                    .foregroundStyle(theme.palette.textPrimary)
                if let message {
                    message
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
            if let onRetry { retryLink(onRetry) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .announceOnRisingEdge(showsSpinner ? nil : announcement)
        .spinnerHold(isBusy: isRetrying, taps: taps, isShown: $showsSpinner)
    }

    private func retryLink(_ onRetry: @escaping () -> Void) -> some View {
        Button {
            taps += 1
            onRetry()
        } label: {
            retryLabel
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.accentText)
                .opacity(showsSpinner ? 0 : 1)
                .overlay(alignment: .leading) {
                    if showsSpinner { ProgressView().controlSize(.small).transition(.opacity) }
                }
                .frame(minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.textLink)
        .disabled(showsSpinner)
        .koboAnimation(.crossfade, value: showsSpinner)
        .accessibilityValue(showsSpinner ? Text("Loading", bundle: .module) : Text(verbatim: ""))
    }
}

#if DEBUG
    private struct SectionStatePreview: View {
        @State private var isRetrying = false

        var body: some View {
            VStack(alignment: .leading, spacing: Space.xxl) {
                SectionState(verbatim: "Couldn't load recent activity.", isRetrying: isRetrying, announces: true) {
                    isRetrying.toggle()
                }
                SectionState("No sessions this week", message: "Plan one from the Library tab.")
                SectionState("You don't have access to this shared plan")
            }
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
            .screenCanvas()
        }
    }

    #Preview("Section state") { SectionStatePreview() }
    #Preview("Section state · dark, Lift") { SectionStatePreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Section state · AX3") { SectionStatePreview().dynamicTypeSize(.accessibility3) }
#endif

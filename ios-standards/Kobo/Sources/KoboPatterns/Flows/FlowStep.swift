import KoboComponents
import KoboTokens
import SwiftUI

/// One step of a multi-step task: a step heading (title and subtitle) over scrolling content, and a pinned footer with
/// the primary action (enabled and loading states), an optional secondary action, the "why is this disabled" hint and
/// a banner. The bar shows the flow's quiet title, the ✕ with its leave confirmation (`FlowExitAction`) where the
/// step position shows it, and the back control. Put it inside the app's `NavigationStack`; push later steps.
///
///     FlowStep("Paste your notes", subtitle: "Copy a workout log and paste it here.", flowTitle: "Import notes",
///              primary: FlowStepAction("Continue", isEnabled: !text.isEmpty, disabledHint: "Paste some notes first",
///                                      action: next),
///              submitState: parse,
///              exit: FlowExitAction(hasUnsavedProgress: !text.isEmpty, action: close)) {
///         KoboTextArea("Notes", text: $text)
///     }
///
/// With `submitState` the primary action spins while it submits, a failure shows its reason as a danger banner above
/// the action, plays the error haptic once and is announced to VoiceOver. A long banner never pushes the action off the
/// screen: past 40% of the step height its text scrolls. For a step with a step indicator, use `ProgressFlowStep`.
public struct FlowStep<Content: View>: View {
    private let title: Text
    private let subtitle: Text?
    private let chrome: FlowStepChrome
    private let content: Content

    /// - Parameters:
    ///   - flowTitle: the flow's name in the bar, the same on every step; `nil` leaves the bar as the app set it.
    ///   - secondary: a quieter action under the primary one ("Skip for now").
    ///   - banner: a notice above the actions; a failed `submitState` shows its reason instead while it lasts.
    ///   - submitState: the step's submit, which drives the spinner, the failure banner and its haptic.
    ///   - exit: the ✕ that leaves the flow; `nil` for no ✕.
    ///   - onBack: draws the step's own back chevron (steps inside one screen); `nil` keeps the system back.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        flowTitle: LocalizedStringKey? = nil,
        primary: FlowStepAction,
        secondary: FlowStepAction? = nil,
        banner: FlowStepBanner? = nil,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = Text(title)
        self.subtitle = subtitle.map { Text($0) }
        self.chrome = FlowStepChrome(
            barTitle: flowTitle.map { Text($0) },
            primary: primary,
            secondary: secondary,
            banner: banner,
            submitState: submitState,
            exit: exit,
            onBack: onBack
        )
        self.content = content()
    }

    /// A step whose heading and flow title are shown as is (they name user data).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        flowTitle: String? = nil,
        primary: FlowStepAction,
        secondary: FlowStepAction? = nil,
        banner: FlowStepBanner? = nil,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = Text(verbatim: title)
        self.subtitle = subtitle.map { Text(verbatim: $0) }
        self.chrome = FlowStepChrome(
            barTitle: flowTitle.map { Text(verbatim: $0) },
            primary: primary,
            secondary: secondary,
            banner: banner,
            submitState: submitState,
            exit: exit,
            onBack: onBack
        )
        self.content = content()
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xxl) {
                FlowStepHeading(title: title, subtitle: subtitle)
                content
            }
            .padding(.horizontal, Space.gutter)
            .padding(.top, Space.lg)
            .padding(.bottom, Space.xxl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .modifier(chrome)
    }
}

#if DEBUG
    private struct FlowStepPreview: View {
        @State private var text = ""
        @State private var parse = LoadableStepState()

        var body: some View {
            NavigationStack {
                FlowStep(
                    "Paste your notes",
                    subtitle: "Copy a workout log from Notes and paste it here.",
                    flowTitle: "Import notes",
                    primary: FlowStepAction(
                        "Continue",
                        isEnabled: !text.isEmpty,
                        disabledHint: "Paste some notes first",
                        action: { parse.send(.submit) }
                    ),
                    secondary: FlowStepAction("Fail the read") { parse.send(.fail(message: "Couldn't read line 4.")) },
                    submitState: parse,
                    exit: FlowExitAction(hasUnsavedProgress: !text.isEmpty) {}
                ) {
                    Button("Paste sample") { text = "Mon 14 Oct\nBench 3x8 80kg\nRow 3x10 60kg" }
                        .buttonStyle(.kobo(.secondary))
                    Text(verbatim: text.isEmpty ? "Nothing pasted yet" : text)
                }
            }
        }
    }

    #Preview("Light") { FlowStepPreview() }
    #Preview("Dark, Lift") { FlowStepPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("AX3") { FlowStepPreview().dynamicTypeSize(.accessibility3) }
#endif

import KoboComponents
import KoboTokens
import SwiftUI

/// One step of a form that says how far along it is: the flow title in the bar, a `StepIndicator` pinned under the
/// bar ("Step 2 of 4"), scrolling content, and the same pinned footer, banner, exit and back handling as `FlowStep`.
/// One canvas runs under the bar, the indicator, the body and the footer; the footer's hairline shows only while
/// content runs under it.
///
///     ProgressFlowStep("Import notes", step: 2, of: 3, stepLabel: "Review",
///                      primary: FlowStepAction("Import", action: submit), submitState: submit,
///                      onBack: { step = 1 }) {
///         ReviewSection("Tasks") { … }
///     }
///
/// Pass `onBack` when the steps live inside one screen and the flow decides where back goes; leave it `nil` when each
/// step is pushed and the system back chevron pops it.
public struct ProgressFlowStep<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let indicator: StepIndicator
    private let chrome: FlowStepChrome
    private let content: Content

    /// - Parameters:
    ///   - title: the flow's name, shown in the bar on every step.
    ///   - stepLabel: the step's name after the count ("Step 2 of 3 · Review").
    ///   - indicatorStyle: segments, dots or one bar.
    ///   - Other parameters as `FlowStep`.
    public init(
        _ title: LocalizedStringKey,
        step current: Int,
        of total: Int?,
        stepLabel: LocalizedStringKey? = nil,
        indicatorStyle: StepIndicator.Style = .segments,
        primary: FlowStepAction,
        secondary: FlowStepAction? = nil,
        banner: FlowStepBanner? = nil,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = Text(title)
        self.indicator = StepIndicator(step: current, of: total, label: stepLabel, style: indicatorStyle)
        self.chrome = FlowStepChrome(
            barTitle: nil,
            primary: primary,
            secondary: secondary,
            banner: banner,
            submitState: submitState,
            exit: exit,
            onBack: onBack
        )
        self.content = content()
    }

    /// A step whose flow title and step label are shown as is.
    public init(
        verbatim title: String,
        step current: Int,
        of total: Int?,
        stepLabel: String? = nil,
        indicatorStyle: StepIndicator.Style = .segments,
        primary: FlowStepAction,
        secondary: FlowStepAction? = nil,
        banner: FlowStepBanner? = nil,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = Text(verbatim: title)
        let label = stepLabel.map { Text(verbatim: $0) }
        self.indicator = StepIndicator(StepProgress(current, of: total), label: label, style: indicatorStyle)
        self.chrome = FlowStepChrome(
            barTitle: nil,
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
            VStack(alignment: .leading, spacing: Space.lg) { content }
                .pageGutter()
                .padding(.vertical, Space.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            indicator
                .pageGutter()
                .padding(.vertical, Space.sm)
                .background(theme.palette.canvas)
        }
        .modifier(chrome)
        .navigationTitle(title)
        .toolbarTitleDisplayMode(.inline)
    }
}

#if DEBUG
    private struct ProgressFlowStepPreview: View {
        @State private var step = 1
        @State private var name = ""

        var body: some View {
            NavigationStack {
                ProgressFlowStep(
                    "New program",
                    step: step,
                    of: 3,
                    stepLabel: step == 1 ? "Name" : "Details",
                    primary: FlowStepAction("Continue", isEnabled: step > 1 || !name.isEmpty) {
                        step = min(step + 1, 3)
                    },
                    exit: FlowExitAction(hasUnsavedProgress: !name.isEmpty) {},
                    onBack: { step = max(step - 1, 1) }
                ) {
                    Button("Fill a name") { name = "Spring cleaning" }.buttonStyle(.kobo(.secondary))
                    Text(verbatim: name.isEmpty ? "No name yet" : name)
                }
                .environment(\.flowStepPosition, step == 1 ? .first : .laterInModal)
            }
        }
    }

    #Preview("Light") { ProgressFlowStepPreview() }
    #Preview("Dark") { ProgressFlowStepPreview().preferredColorScheme(.dark) }
    #Preview("AX3, Amber") { ProgressFlowStepPreview().koboTheme(.amber).dynamicTypeSize(.accessibility3) }
#endif

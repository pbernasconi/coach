import KoboComponents
import KoboTokens
import SwiftUI

/// A flow step whose job is one value (a weight, a duration, a count): the value's entry is the largest thing on the
/// step, right under its heading, with the rest of the step below it and the next action pinned above the keyboard.
/// The heading names the value ("Body weight"), so nothing repeats it. The body scrolls, so with the keyboard up the
/// footer stays on the keyboard and the body gives way.
///
///     ValueStep("Body weight", subtitle: "Used to estimate calories.", flowTitle: "Set up Lift",
///               next: FlowStepAction("Continue", isEnabled: weight > 0, disabledHint: "Enter your weight",
///                                    action: next)) {
///         StepperField("Body weight", value: $weight, in: 30...250, step: 0.5, unit: "kg")
///     } below: {
///         SegmentedPicker(…)
///     }
public struct ValueStep<Entry: View, Below: View>: View {
    private let step: FlowStep<ValueStepBody<Entry, Below>>

    /// - Parameters:
    ///   - title: the value's name, shown as the step heading.
    ///   - next: the step's action ("Continue"); it never commits on its own, so a review can follow.
    ///   - entry: the value's control (`StepperField`, `NumberEntry`, `DateField`).
    ///   - below: anything else on the step (a unit picker, a note).
    ///   - Other parameters as `FlowStep`.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        flowTitle: LocalizedStringKey? = nil,
        next: FlowStepAction,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder entry: () -> Entry,
        @ViewBuilder below: () -> Below
    ) {
        let body = ValueStepBody(entry: entry(), below: below())
        step = FlowStep(
            title,
            subtitle: subtitle,
            flowTitle: flowTitle,
            primary: next,
            submitState: submitState,
            exit: exit,
            onBack: onBack
        ) { body }
    }

    /// A value step whose heading and flow title are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        flowTitle: String? = nil,
        next: FlowStepAction,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder entry: () -> Entry,
        @ViewBuilder below: () -> Below
    ) {
        let body = ValueStepBody(entry: entry(), below: below())
        step = FlowStep(
            verbatim: title,
            subtitle: subtitle,
            flowTitle: flowTitle,
            primary: next,
            submitState: submitState,
            exit: exit,
            onBack: onBack
        ) { body }
    }

    public var body: some View { step }
}

extension ValueStep where Below == EmptyView {
    /// A value step with nothing under the entry.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        flowTitle: LocalizedStringKey? = nil,
        next: FlowStepAction,
        submitState: LoadableStepState? = nil,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder entry: () -> Entry
    ) {
        self.init(
            title,
            subtitle: subtitle,
            flowTitle: flowTitle,
            next: next,
            submitState: submitState,
            exit: exit,
            onBack: onBack,
            entry: entry,
            below: { EmptyView() }
        )
    }
}

/// The entry, centred and full width, over the rest of the step.
struct ValueStepBody<Entry: View, Below: View>: View {
    let entry: Entry
    let below: Below

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxl) {
            entry.frame(maxWidth: .infinity)
            below
        }
        .padding(.bottom, Space.lg)
    }
}

#if DEBUG
    private struct ValueStepPreview: View {
        @State private var weight = 72.5

        var body: some View {
            NavigationStack {
                ValueStep(
                    "Body weight",
                    subtitle: "Used to estimate the calories of a workout.",
                    flowTitle: "Set up Lift",
                    next: FlowStepAction("Continue", isEnabled: weight > 0) {},
                    exit: FlowExitAction {}
                ) {
                    StepperField("Body weight", value: $weight, in: 30...250, step: 0.5, unit: "kg")
                } below: {
                    Text("You can change it later in Settings.").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
    }

    #Preview("Light") { ValueStepPreview() }
    #Preview("Dark, Amber") { ValueStepPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("AX3") { ValueStepPreview().dynamicTypeSize(.accessibility3) }
#endif

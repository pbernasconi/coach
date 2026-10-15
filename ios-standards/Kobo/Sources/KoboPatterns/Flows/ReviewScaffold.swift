import KoboComponents
import KoboTokens
import SwiftUI

/// The review step of a flow: a heading, an optional hero summary (`ReviewSummary`), the review sections
/// (`ReviewSection` with `ReviewRow`s and `ReviewDisclosure`s), and the pinned submit with its banner slot, hint and
/// fine print (`ReviewSubmit`). Edit links in the summary, the sections and the rows jump back to earlier steps.
///
///     ReviewScaffold("Check the import", flowTitle: "Import notes",
///                    summary: ReviewSummary(verbatim: "3 workouts", caption: "Ready to import"),
///                    submit: ReviewSubmit(verbatim: "Import 3 workouts", state: importState, action: start),
///                    exit: FlowExitAction(hasUnsavedProgress: true, action: close)) {
///         ReviewSection("Mon 14 Oct", onEdit: editText) {
///             ReviewRow(verbatim: "Bench press", value: "3 × 8 · 80 kg")
///         }
///         ReviewDisclosure("Show the pasted text") { Text(verbatim: pasted) }
///     }
///
/// While the submit runs, the ✕ and the back control keep their place; pass `onEdit: nil` to edits you want locked.
public struct ReviewScaffold<Sections: View>: View {
    private let title: Text
    private let subtitle: Text?
    private let summary: ReviewSummary?
    private let chrome: FlowStepChrome
    private let sections: Sections

    /// - Parameters:
    ///   - title: the step heading ("Check the import").
    ///   - flowTitle: the flow's quiet name in the bar.
    ///   - Other parameters as `FlowStep`.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        flowTitle: LocalizedStringKey? = nil,
        summary: ReviewSummary? = nil,
        submit: ReviewSubmit,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder sections: () -> Sections
    ) {
        self.title = Text(title)
        self.subtitle = subtitle.map { Text($0) }
        self.summary = summary
        self.chrome = Self.chrome(flowTitle.map { Text($0) }, submit: submit, exit: exit, onBack: onBack)
        self.sections = sections()
    }

    /// A review whose heading and flow title are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        flowTitle: String? = nil,
        summary: ReviewSummary? = nil,
        submit: ReviewSubmit,
        exit: FlowExitAction? = nil,
        onBack: (() -> Void)? = nil,
        @ViewBuilder sections: () -> Sections
    ) {
        self.title = Text(verbatim: title)
        self.subtitle = subtitle.map { Text(verbatim: $0) }
        self.summary = summary
        self.chrome = Self.chrome(flowTitle.map { Text(verbatim: $0) }, submit: submit, exit: exit, onBack: onBack)
        self.sections = sections()
    }

    private static func chrome(
        _ barTitle: Text?,
        submit: ReviewSubmit,
        exit: FlowExitAction?,
        onBack: (() -> Void)?
    ) -> FlowStepChrome {
        FlowStepChrome(
            barTitle: barTitle,
            primary: submit.action,
            secondary: nil,
            banner: submit.visibleBanner,
            submitState: submit.state,
            exit: exit,
            onBack: onBack,
            footnote: submit.footnote
        )
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xxl) {
                FlowStepHeading(title: title, subtitle: subtitle)
                if let summary {
                    ReviewSummaryCard(summary: summary)
                }
                VStack(alignment: .leading, spacing: Space.xl) { sections }
            }
            .padding(.horizontal, Space.gutter)
            .padding(.top, Space.lg)
            .padding(.bottom, Space.xxl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .modifier(chrome)
    }
}

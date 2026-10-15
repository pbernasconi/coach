import SwiftUI

/// The submit of a review step: the button's words, whether it can submit, its `LoadableStepState` (spinner, failure
/// banner, error haptic), a hint while it is disabled, fine print under it, and a banner slot for a confirmation the
/// person should read before submitting ("2 lines will be skipped").
///
///     ReviewSubmit(verbatim: "Import 3 workouts", state: importState,
///                  footnote: "Imported workouts count toward this week's goal.",
///                  banner: FlowStepBanner(tone: .warning, title: "2 lines couldn't be read")) { start() }
public struct ReviewSubmit {
    let action: FlowStepAction
    let state: LoadableStepState
    let footnote: Text?
    let banner: FlowStepBanner?

    /// - Parameters:
    ///   - state: the submit's state machine; its failure replaces `banner` while it shows.
    ///   - footnote: fine print under the button (what submitting means).
    ///   - banner: a notice above the button; `nil` for none.
    public init(
        _ title: LocalizedStringKey,
        isEnabled: Bool = true,
        state: LoadableStepState = LoadableStepState(),
        disabledHint: LocalizedStringKey? = nil,
        footnote: LocalizedStringKey? = nil,
        banner: FlowStepBanner? = nil,
        action: @escaping () -> Void
    ) {
        self.action = FlowStepAction(title, isEnabled: isEnabled, disabledHint: disabledHint, action: action)
        self.state = state
        self.footnote = footnote.map { Text($0) }
        self.banner = banner
    }

    /// A submit whose words are shown as is ("Import 3 workouts").
    public init(
        verbatim title: String,
        isEnabled: Bool = true,
        state: LoadableStepState = LoadableStepState(),
        disabledHint: String? = nil,
        footnote: String? = nil,
        banner: FlowStepBanner? = nil,
        action: @escaping () -> Void
    ) {
        self.action = FlowStepAction(verbatim: title, isEnabled: isEnabled, disabledHint: disabledHint, action: action)
        self.state = state
        self.footnote = footnote.map { Text(verbatim: $0) }
        self.banner = banner
    }

}

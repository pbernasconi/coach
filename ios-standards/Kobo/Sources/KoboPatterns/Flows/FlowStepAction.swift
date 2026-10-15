import KoboComponents
import KoboTokens
import SwiftUI

/// A footer button of a flow step: "Continue", "Review import". While `isEnabled` is false and nothing on the screen
/// says why, `disabledHint` names what is missing as a caption above the button, so the button is never a dead end.
/// While `isLoading` the button spins in place and ignores taps.
///
///     FlowStepAction("Continue", isEnabled: !text.isEmpty, disabledHint: "Paste some notes first", action: next)
public struct FlowStepAction {
    let title: Text
    let isEnabled: Bool
    let isLoading: Bool
    let disabledHint: Text?
    let action: () -> Void

    public init(
        _ title: LocalizedStringKey,
        isEnabled: Bool = true,
        isLoading: Bool = false,
        disabledHint: LocalizedStringKey? = nil,
        action: @escaping () -> Void
    ) {
        self.init(
            title: Text(title),
            isEnabled: isEnabled,
            isLoading: isLoading,
            disabledHint: disabledHint.map { Text($0) },
            action: action
        )
    }

    /// An action whose title and hint are shown as is ("Import 14 tasks").
    public init(
        verbatim title: String,
        isEnabled: Bool = true,
        isLoading: Bool = false,
        disabledHint: String? = nil,
        action: @escaping () -> Void
    ) {
        self.init(
            title: Text(verbatim: title),
            isEnabled: isEnabled,
            isLoading: isLoading,
            disabledHint: disabledHint.map { Text(verbatim: $0) },
            action: action
        )
    }

    init(title: Text, isEnabled: Bool, isLoading: Bool, disabledHint: Text?, action: @escaping () -> Void) {
        self.title = title
        self.isEnabled = isEnabled
        self.isLoading = isLoading
        self.disabledHint = disabledHint
        self.action = action
    }

    /// The same action, spinning while `state` submits.
    func loading(with state: LoadableStepState?) -> FlowStepAction {
        FlowStepAction(
            title: title,
            isEnabled: isEnabled,
            isLoading: isLoading || state?.isLoading == true,
            disabledHint: disabledHint,
            action: action
        )
    }
}

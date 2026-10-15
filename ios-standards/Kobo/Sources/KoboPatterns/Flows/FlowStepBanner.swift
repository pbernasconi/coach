import KoboComponents
import KoboTokens
import SwiftUI

/// The notice above a flow step's primary action: why a submit failed, or something to check before going on. It
/// draws a `NoticeBanner`, so the glyph carries the tone. A step with a `LoadableStepState` gets the failure banner
/// for free; pass one only for other notices.
///
///     FlowStepBanner(tone: .warning, title: "3 lines couldn't be read", message: "They'll be skipped.")
public struct FlowStepBanner {
    enum Copy {
        case localized(LocalizedStringKey, message: LocalizedStringKey?)
        case verbatim(String, message: String?)
    }

    let tone: Tone
    let copy: Copy
    let action: NoticeBanner.Action?

    /// A banner with localized copy.
    public init(
        tone: Tone = .danger,
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        action: NoticeBanner.Action? = nil
    ) {
        self.tone = tone
        self.copy = .localized(title, message: message)
        self.action = action
    }

    /// A banner whose copy is shown as is (reviewed server copy).
    public init(tone: Tone = .danger, verbatim title: String, message: String? = nil, action: NoticeBanner.Action? = nil)
    {
        self.tone = tone
        self.copy = .verbatim(title, message: message)
        self.action = action
    }

    /// The failure banner of a submit, while it shows.
    static func failure(of state: LoadableStepState?) -> FlowStepBanner? {
        guard let message = state?.failureMessage else { return nil }
        return FlowStepBanner(tone: .danger, verbatim: message)
    }
}

/// A `FlowStepBanner` as a `NoticeBanner`.
struct FlowStepBannerView: View {
    let banner: FlowStepBanner

    var body: some View {
        switch banner.copy {
        case .localized(let title, let message):
            NoticeBanner(tone: banner.tone, title: title, message: message, action: banner.action)
        case .verbatim(let title, let message):
            NoticeBanner(tone: banner.tone, verbatim: title, message: message, action: banner.action)
        }
    }
}

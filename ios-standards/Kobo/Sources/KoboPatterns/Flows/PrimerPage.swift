import KoboComponents
import KoboTokens
import SwiftUI

/// The page before a permission prompt or a new feature: generous space, an illustration, a centred title and message,
/// up to three reasons, optional extra content (a sample notification), then the pinned primary action ("Allow",
/// "Continue") and an optional quiet secondary one ("Not now"). Show it at the moment the feature needs the
/// permission, never at launch.
///
///     PrimerPage(model: PrimerPageModel("Turn on notifications", message: "We'll tell you when rest is over.",
///                                       symbol: "bell.badge",
///                                       reasons: [.init(symbol: "timer", "Rest timer alerts")]),
///                primary: PrimerPageAction("Allow notifications", action: ask),
///                secondary: .notNow(action: skip))
///
/// The default illustration is the model's symbol on a large accent disc (`PrimerIllustration`); pass `illustration:`
/// for the app's own art (mark it decorative: the title carries the meaning). With both an illustration and `extra:`
/// content, use the full initialiser.
public struct PrimerPage<Illustration: View, Extra: View>: View {
    @Environment(\.koboTheme) private var theme
    private let model: PrimerPageModel
    private let primary: PrimerPageAction
    private let secondary: PrimerPageAction?
    private let illustration: Illustration
    private let extra: Extra

    public init(
        model: PrimerPageModel,
        primary: PrimerPageAction,
        secondary: PrimerPageAction? = nil,
        @ViewBuilder illustration: () -> Illustration,
        @ViewBuilder extra: () -> Extra
    ) {
        self.model = model
        self.primary = primary
        self.secondary = secondary
        self.illustration = illustration()
        self.extra = extra()
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: Space.xxl) {
                illustration.padding(.top, Space.xxxl)
                words
                if !model.reasons.isEmpty { reasons }
                extra
            }
            .padding(.horizontal, Space.gutter)
            .padding(.bottom, Space.xxl)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(theme.palette.canvas)
        .pinnedFooter(style: .material) { actions }
    }

    private var words: some View {
        VStack(spacing: Space.md) {
            Text(verbatim: model.title)
                .font(theme.font(.title))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Text(verbatim: model.message)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textSecondary)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, Space.sm)
    }

    /// The rows start at one edge and the block hugs its widest row, centred on the page.
    private var reasons: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            ForEach(model.reasons) { reason in
                HStack(alignment: .firstTextBaseline, spacing: Space.md) {
                    Image(systemName: reason.symbol)
                        .font(theme.font(.body).weight(.semibold))
                        .foregroundStyle(theme.palette.accentText)
                        .frame(minWidth: Size.iconLg)
                        .accessibilityHidden(true)
                    Text(verbatim: reason.text)
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.horizontal, Space.sm)
        .fixedSize(horizontal: false, vertical: true)
    }

    private var actions: some View {
        VStack(spacing: Space.xs) {
            Button(action: primary.action) { primary.title }
                .buttonStyle(.kobo(.primary, width: .full, isLoading: primary.isLoading))
                .disabled(!primary.isEnabled)
            if let secondary {
                Button(action: secondary.action) { secondary.title }
                    .buttonStyle(.kobo(.plain, width: .full, isLoading: secondary.isLoading))
                    .disabled(!secondary.isEnabled || primary.isLoading)
            }
        }
    }
}

extension PrimerPage where Illustration == PrimerIllustration, Extra == EmptyView {
    /// A primer with the default illustration and no extra content.
    public init(model: PrimerPageModel, primary: PrimerPageAction, secondary: PrimerPageAction? = nil) {
        self.init(
            model: model,
            primary: primary,
            secondary: secondary,
            illustration: { PrimerIllustration(symbol: model.symbol) },
            extra: { EmptyView() }
        )
    }
}

extension PrimerPage where Extra == EmptyView {
    /// A primer with the app's own illustration and no extra content.
    public init(
        model: PrimerPageModel,
        primary: PrimerPageAction,
        secondary: PrimerPageAction? = nil,
        @ViewBuilder illustration: () -> Illustration
    ) {
        self.init(model: model, primary: primary, secondary: secondary, illustration: illustration, extra: { EmptyView() })
    }
}

/// The default primer illustration: the model's SF Symbol on a large accent disc, or nothing without a symbol.
public struct PrimerIllustration: View {
    let symbol: String?

    /// A disc with `symbol`; `nil` draws nothing.
    public init(symbol: String?) {
        self.symbol = symbol
    }

    public var body: some View {
        if let symbol {
            EmptyStateArt(systemImage: symbol, tone: .accent, scale: .large)
        }
    }
}

#if DEBUG
    private let primerSample = PrimerPageModel(
        verbatim: "Turn on notifications",
        message: "Lift tells you when rest is over, even with the screen off.",
        symbol: "bell.badge",
        reasons: [
            .init(symbol: "timer", verbatim: "Rest timer alerts"),
            .init(symbol: "calendar", verbatim: "A nudge on training days"),
        ]
    )

    #Preview("Light") {
        PrimerPage(model: primerSample, primary: PrimerPageAction("Allow notifications") {}, secondary: .notNow {})
    }
    #Preview("Loading, dark, Lift") {
        PrimerPage(model: primerSample, primary: PrimerPageAction("Allow", isLoading: true) {}, secondary: .notNow {})
            .koboTheme(.lift)
            .preferredColorScheme(.dark)
    }
    #Preview("AX3") {
        PrimerPage(model: primerSample, primary: .continue {}).dynamicTypeSize(.accessibility3)
    }
#endif

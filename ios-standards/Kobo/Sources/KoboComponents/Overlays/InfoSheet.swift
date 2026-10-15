import KoboTokens
import SwiftUI

/// A short explainer in a fitted sheet: the term as a heading, one or a few paragraphs of body text, and an optional
/// "Learn more" link. It has no buttons: a swipe, a tap outside or the VoiceOver escape gesture closes it. Present
/// it with `.infoSheet`, or let an `InfoButton` own it.
///
///     InfoSheet("Focus score", learnMore: URL(string: "https://example.com/focus")) {
///         Text("Focus score adds up the uninterrupted time in each of the last seven days.")
///         Text("A steady rise is good. A sudden drop is a reason to clear some meetings.")
///     }
public struct InfoSheet<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    @State private var measurements = SheetMeasurements()
    private let title: Text
    private let learnMore: URL?
    private let content: Content

    /// - Parameter content: the body: `Text` paragraphs, styled as body copy and spaced apart.
    public init(_ title: LocalizedStringKey, learnMore: URL? = nil, @ViewBuilder content: () -> Content) {
        self.init(title: Text(title), learnMore: learnMore, content: content())
    }

    /// An explainer whose title is shown as is.
    public init(verbatim title: String, learnMore: URL? = nil, @ViewBuilder content: () -> Content) {
        self.init(title: Text(verbatim: title), learnMore: learnMore, content: content())
    }

    init(title: Text, learnMore: URL?, content: Content) {
        self.title = title
        self.learnMore = learnMore
        self.content = content
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.md) {
                title
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                VStack(alignment: .leading, spacing: Space.md) { content }
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let learnMore { InfoSheetLink(destination: learnMore) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Space.gutter)
            .padding(.top, Space.xxl)
            .padding(.bottom, Space.xxl)
            .overlayReportsHeight { measurements.content = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .modifier(
            SheetChrome(
                detents: [.fitted],
                fittedHeight: measurements.fittedHeight,
                grabber: .visible,
                background: .automatic,
                isDismissDisabled: false
            )
        )
    }
}

extension InfoSheet where Content == Text {
    /// An explainer with one paragraph.
    public init(_ title: LocalizedStringKey, message: LocalizedStringKey, learnMore: URL? = nil) {
        self.init(title: Text(title), learnMore: learnMore, content: Text(message))
    }

    /// An explainer with one paragraph, whose title and message are shown as is (they come from a server).
    public init(verbatim title: String, message: String, learnMore: URL? = nil) {
        self.init(title: Text(verbatim: title), learnMore: learnMore, content: Text(verbatim: message))
    }
}

/// "Learn more ↗": a real `Link` with a 44pt target, read as one element.
private struct InfoSheetLink: View {
    @Environment(\.koboTheme) private var theme
    let destination: URL

    var body: some View {
        Link(destination: destination) {
            HStack(spacing: Space.xs) {
                Text("Learn more", bundle: .module)
                Image(systemName: "arrow.up.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .accessibilityHidden(true)
            }
            .font(theme.font(.body).weight(.semibold))
            .foregroundStyle(theme.palette.accentText)
            .frame(minHeight: Size.minTouch)
            .contentShape(Rectangle())
        }
    }
}

extension View {
    /// Shows an `InfoSheet` while `isPresented` is true.
    ///
    ///     .infoSheet(isPresented: $explainsScore, title: "Focus score") {
    ///         Text("Focus score adds up the uninterrupted time in each of the last seven days.")
    ///     }
    public func infoSheet<Content: View>(
        isPresented: Binding<Bool>,
        title: LocalizedStringKey,
        learnMore: URL? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        sheet(isPresented: isPresented) {
            InfoSheet(title: Text(title), learnMore: learnMore, content: content())
        }
    }

    /// Shows an `InfoSheet` whose title is shown as is.
    public func infoSheet<Content: View>(
        isPresented: Binding<Bool>,
        verbatim title: String,
        learnMore: URL? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        sheet(isPresented: isPresented) {
            InfoSheet(title: Text(verbatim: title), learnMore: learnMore, content: content())
        }
    }
}

#if DEBUG
    private struct InfoSheetPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var isPresented = true

        var body: some View {
            Button("What is the focus score?") { isPresented = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(theme.palette.canvas)
                .infoSheet(
                    isPresented: $isPresented,
                    title: "Focus score",
                    learnMore: URL(string: "https://example.com/focus-score")
                ) {
                    Text("Focus score adds up the uninterrupted time in each of the last seven days.")
                    Text("A steady rise is good. A sudden drop is a reason to clear some meetings.")
                }
        }
    }

    #Preview("Light") { InfoSheetPreview() }
    #Preview("Dark") { InfoSheetPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { InfoSheetPreview().dynamicTypeSize(.accessibility3) }
#endif

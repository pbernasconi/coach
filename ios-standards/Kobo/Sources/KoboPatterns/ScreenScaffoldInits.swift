import KoboComponents
import KoboTokens
import SwiftUI

// `ScreenScaffold` without a toolbar, a footer or both. Each shape has a localized and a `verbatim:` initialiser.
extension ScreenScaffold where Footer == EmptyView {
    /// A screen with a localized title, toolbar buttons and no footer.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        kicker: LocalizedStringKey? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder toolbar: () -> Toolbar
    ) {
        let header = ScaffoldTexts(title, subtitle: subtitle, kicker: kicker)
        self.init(header: header, headerStyle: headerStyle, content: content(), toolbar: toolbar(), footer: EmptyView())
    }

    /// A screen with a title shown as is, toolbar buttons and no footer.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder toolbar: () -> Toolbar
    ) {
        let header = ScaffoldTexts(verbatim: title, subtitle: subtitle, kicker: kicker)
        self.init(header: header, headerStyle: headerStyle, content: content(), toolbar: toolbar(), footer: EmptyView())
    }
}

extension ScreenScaffold where Toolbar == EmptyView {
    /// A screen with a localized title, a pinned footer and no toolbar buttons.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        kicker: LocalizedStringKey? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        let header = ScaffoldTexts(title, subtitle: subtitle, kicker: kicker)
        self.init(header: header, headerStyle: headerStyle, content: content(), toolbar: EmptyView(), footer: footer())
    }

    /// A screen with a title shown as is, a pinned footer and no toolbar buttons.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        let header = ScaffoldTexts(verbatim: title, subtitle: subtitle, kicker: kicker)
        self.init(header: header, headerStyle: headerStyle, content: content(), toolbar: EmptyView(), footer: footer())
    }
}

extension ScreenScaffold where Toolbar == EmptyView, Footer == EmptyView {
    /// A screen with a localized title and only content.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        kicker: LocalizedStringKey? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content
    ) {
        let header = ScaffoldTexts(title, subtitle: subtitle, kicker: kicker)
        self.init(
            header: header,
            headerStyle: headerStyle,
            content: content(),
            toolbar: EmptyView(),
            footer: EmptyView()
        )
    }

    /// A screen with a title shown as is and only content.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content
    ) {
        let header = ScaffoldTexts(verbatim: title, subtitle: subtitle, kicker: kicker)
        self.init(
            header: header,
            headerStyle: headerStyle,
            content: content(),
            toolbar: EmptyView(),
            footer: EmptyView()
        )
    }
}

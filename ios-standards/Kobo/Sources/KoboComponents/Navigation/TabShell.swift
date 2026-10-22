import KoboTokens
import SwiftUI

/// The app's tab controller over the system `TabView`: Kobo tab definitions (title, symbol, badge), the accent text ink
/// on the selected tab (its label is text, so it never takes the paler fill accent), a selection haptic on each switch
/// the person makes in the bar (not on programmatic switches), the adaptable sidebar layout on iPad, and an optional
/// bottom accessory (a `MiniPlayerBar`) through `.tabViewBottomAccessory`. Each
/// tab owns its own `NavigationStack` inside `content`.
///
///     TabShell(tabs: tabs, selection: $router.tab, layout: .forDevice(isPad: isPad)) { tab in
///         NavigationStack(path: $router[tab]) { root(for: tab) }
///     } accessory: {
///         MiniPlayerBar(verbatim: episode.title, subtitle: elapsed, action: open) { … } trailing: { … }
///     }
public struct TabShell<Value: Hashable, Content: View, Accessory: View>: View {
    @Environment(\.koboTheme) private var theme
    @State private var userSwitches = 0
    private let tabs: [KoboTab<Value>]
    private let selection: Binding<Value>
    private let layout: TabShellLayout
    private let minimizesOnScroll: Bool
    private let content: (Value) -> Content
    private let accessory: Accessory

    /// - Parameters:
    ///   - layout: `.tabBar` on iPhone, `.sidebarAdaptable` on iPad (`TabShellLayout.forDevice(isPad:)`).
    ///   - minimizesOnScroll: lets the iOS 26 bar shrink while the content scrolls down.
    ///   - accessory: drawn above the bar in the system's glass (`.tabViewBottomAccessory`).
    public init(
        tabs: [KoboTab<Value>],
        selection: Binding<Value>,
        layout: TabShellLayout = .tabBar,
        minimizesOnScroll: Bool = false,
        @ViewBuilder content: @escaping (Value) -> Content,
        @ViewBuilder accessory: () -> Accessory
    ) {
        self.tabs = tabs
        self.selection = selection
        self.layout = layout
        self.minimizesOnScroll = minimizesOnScroll
        self.content = content
        self.accessory = accessory()
    }

    public var body: some View {
        TabView(selection: barSelection) {
            ForEach(tabs) { tab in
                Tab(value: tab.value) {
                    // The content keeps the fill accent as its tint; only the bar's labels take the text ink.
                    content(tab.value).tint(theme.palette.accent)
                } label: {
                    Label {
                        tab.title
                    } icon: {
                        Image(systemName: tab.systemImage)
                    }
                }
                .badge(CountBadgeText.label(for: tab.badge).map { Text(verbatim: $0) })
            }
        }
        .modifier(TabShellChrome(layout: layout, minimizesOnScroll: minimizesOnScroll))
        .modifier(TabShellAccessory(accessory: accessory))
        // The selected tab's label is text, so it takes the accent text ink (4.5:1 in light mode), not the fill accent.
        .tint(theme.palette.accentText)
        .koboFeedback(.selection, trigger: userSwitches)
    }

    /// Only the bar writes through this binding, so a write naming another tab is a switch the person made.
    private var barSelection: Binding<Value> {
        Binding(
            get: { selection.wrappedValue },
            set: { tab in
                if TabShellRules.isSwitch(from: selection.wrappedValue, to: tab) { userSwitches += 1 }
                selection.wrappedValue = tab
            }
        )
    }
}

extension TabShell where Accessory == EmptyView {
    /// A tab shell with no bottom accessory.
    public init(
        tabs: [KoboTab<Value>],
        selection: Binding<Value>,
        layout: TabShellLayout = .tabBar,
        minimizesOnScroll: Bool = false,
        @ViewBuilder content: @escaping (Value) -> Content
    ) {
        self.init(
            tabs: tabs,
            selection: selection,
            layout: layout,
            minimizesOnScroll: minimizesOnScroll,
            content: content,
            accessory: { EmptyView() }
        )
    }
}

/// The bar style (adaptable sidebar or tab bar) and the iOS 26 minimize behaviour.
private struct TabShellChrome: ViewModifier {
    let layout: TabShellLayout
    let minimizesOnScroll: Bool

    func body(content: Content) -> some View {
        switch layout {
        case .tabBar: content.modifier(TabBarMinimize(minimizesOnScroll: minimizesOnScroll))
        case .sidebarAdaptable:
            content.tabViewStyle(.sidebarAdaptable).modifier(TabBarMinimize(minimizesOnScroll: minimizesOnScroll))
        }
    }
}

private struct TabBarMinimize: ViewModifier {
    let minimizesOnScroll: Bool

    func body(content: Content) -> some View {
        #if os(iOS)
            content.tabBarMinimizeBehavior(minimizesOnScroll ? .onScrollDown : .never)
        #else
            content
        #endif
    }
}

/// The bottom accessory, attached only when the shell has one.
private struct TabShellAccessory<Accessory: View>: ViewModifier {
    let accessory: Accessory

    func body(content: Content) -> some View {
        #if os(iOS)
            if Accessory.self == EmptyView.self {
                content
            } else {
                content.tabViewBottomAccessory { accessory }
            }
        #else
            content
        #endif
    }
}

extension View {
    /// A page pushed over a tab's root: the tab bar hides while it shows, and comes back on the way back to the root.
    /// Detail pages get the whole screen for their content; the bar is for moving between tabs, and Back leads there.
    /// Apply it once where the app builds its pushed routes (`navigationDestination(for:)`), so every pushed page
    /// has it, never screen by screen.
    ///
    ///     .navigationDestination(for: AppRoute.self) { route in RouteScreen(route: route).detailPage() }
    @ViewBuilder
    public func detailPage() -> some View {
        #if os(iOS)
            toolbar(.hidden, for: .tabBar)
        #else
            self  // no tab bar to hide (the package's macOS test build)
        #endif
    }
}

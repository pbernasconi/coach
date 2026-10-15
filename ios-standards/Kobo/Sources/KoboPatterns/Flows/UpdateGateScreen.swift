import KoboComponents
import KoboTokens
import SwiftUI

/// The blocking "update required" screen: the installed version is below the minimum the service supports, so the app
/// shows this instead of its content, with no way to dismiss it. The update action is injected: open the App Store
/// listing (`storeURL`) or run the app's own `onUpdate`; with neither, it names the App Store instead of showing a
/// button.
///
///     UpdateGateScreen(appName: "Lift", storeURL: URL(string: "https://apps.apple.com/app/id0000000000"))
///     UpdateGateScreen("Time to update", message: "This version can't sync any more.", onUpdate: openStore)
public struct UpdateGateScreen: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.openURL) private var openURL
    /// The visible height, so a short column centres and a tall one scrolls.
    @State private var viewportHeight: CGFloat = 0
    private let title: Text
    private let message: Text
    private let symbol: String
    private let storeURL: URL?
    private let onUpdate: (() -> Void)?

    /// The library's copy, naming the app when `appName` is given.
    ///
    /// - Parameters:
    ///   - storeURL: the App Store listing the "Update now" button opens.
    ///   - onUpdate: runs instead of opening `storeURL` (the app routes the update itself).
    public init(appName: String? = nil, storeURL: URL? = nil, onUpdate: (() -> Void)? = nil) {
        self.title =
            appName.map { Text("A new version of \($0) is required", bundle: .module) }
            ?? Text("Update required", bundle: .module)
        self.message = Text("This version is no longer supported. Update the app to keep using it.", bundle: .module)
        self.symbol = "arrow.down.app"
        self.storeURL = storeURL
        self.onUpdate = onUpdate
    }

    /// The caller's own copy.
    public init(
        _ title: LocalizedStringKey,
        message: LocalizedStringKey,
        symbol: String = "arrow.down.app",
        storeURL: URL? = nil,
        onUpdate: (() -> Void)? = nil
    ) {
        self.title = Text(title)
        self.message = Text(message)
        self.symbol = symbol
        self.storeURL = storeURL
        self.onUpdate = onUpdate
    }

    /// The caller's own copy, shown as is (server copy already reviewed).
    public init(
        verbatim title: String,
        message: String,
        symbol: String = "arrow.down.app",
        storeURL: URL? = nil,
        onUpdate: (() -> Void)? = nil
    ) {
        self.title = Text(verbatim: title)
        self.message = Text(verbatim: message)
        self.symbol = symbol
        self.storeURL = storeURL
        self.onUpdate = onUpdate
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: Space.lg) {
                EmptyStateArt(systemImage: symbol, tone: .accent, scale: .large)
                title
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                message
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textSecondary)
                action.padding(.top, Space.sm)
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, Space.xxxl)
            .padding(.vertical, Space.xxl)
            .frame(maxWidth: .infinity, minHeight: viewportHeight)
        }
        .scrollBounceBehavior(.basedOnSize)
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.height
        } action: { height in
            viewportHeight = height
        }
        .background(theme.palette.canvas)
        .interactiveDismissDisabled(true)
    }

    @ViewBuilder private var action: some View {
        if onUpdate != nil || storeURL != nil {
            Button(action: update) { Text("Update now", bundle: .module) }
                .buttonStyle(.kobo(.primary, width: .full))
        } else {
            Text("Update from the App Store.", bundle: .module)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
        }
    }

    private func update() {
        if let onUpdate {
            onUpdate()
        } else if let storeURL {
            openURL(storeURL)
        }
    }
}

#if DEBUG
    #Preview("Store link") { UpdateGateScreen(appName: "Lift", storeURL: URL(string: "https://apps.apple.com")) }
    #Preview("No store link, dark") { UpdateGateScreen().preferredColorScheme(.dark) }
    #Preview("Custom copy, Lift") {
        UpdateGateScreen("Time to update", message: "This version can't sync your workouts any more.") {}
            .koboTheme(.lift)
    }
    #Preview("AX3") { UpdateGateScreen(appName: "Lift") {}.dynamicTypeSize(.accessibility3) }
#endif

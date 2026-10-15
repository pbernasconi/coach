import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Navigation section: headers, badges, the tab shell and text links.
struct NavigationDemo: View {
    let component: CatalogComponent
    @State private var tab = DemoTab.inbox
    @State private var unread = 3
    @Environment(\.koboTheme) private var theme

    var body: some View {
        switch component {
        case .appHeader:
            VStack(spacing: 0) {
                AppHeader("Today", kicker: "Thursday", profile: HeaderProfile(name: "Sample User") {}) {
                    Button("Search", systemImage: "magnifyingglass") {}
                    Button("Inbox", systemImage: "tray") {}.countBadge(unread)
                }
                AppHeader(verbatim: "Shared lists", kicker: "2 people")
            }
        case .headerButton:
            HStack(spacing: Space.md) {
                HeaderButton(.close) {}
                HeaderButton(.back) {}
                HeaderButton(systemImage: "ellipsis", accessibilityLabel: "More options") {}
            }
        case .headerProfileButton:
            VStack(alignment: .leading, spacing: Space.md) {
                HeaderProfileButton(name: "Sample User") {}
                HeaderProfileButton(name: nil) {}
            }
        case .countBadge:
            HStack(spacing: Space.xl) {
                CountBadge(count: unread)
                CountBadge(count: 120, tone: .accent)
                Button("Add one") { unread += 1 }.buttonStyle(.kobo(.secondary))
            }
        case .tabShell: tabShell
        case .textLink:
            VStack(alignment: .leading, spacing: Space.xs) {
                TextLink("Forgot your password?") {}
                TextLink(verbatim: "Resend the link (30 s)", disabledLook: .muted) {}.disabled(true)
            }
        default: EmptyView()
        }
    }

    private var tabShell: some View {
        TabShell(tabs: tabs, selection: $tab) { value in
            Text(verbatim: value.rawValue.capitalized)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(theme.palette.canvas)
        }
        .frame(height: Size.minTouch * 6)
    }

    private var tabs: [KoboTab<DemoTab>] {
        [
            KoboTab("Inbox", systemImage: "tray", value: .inbox, badge: unread),
            KoboTab("Projects", systemImage: "folder", value: .projects),
            KoboTab(verbatim: "Notes", systemImage: "note.text", value: .notes),
        ]
    }
}

/// The made-up tabs of the tab shell demo.
private enum DemoTab: String, Hashable {
    case inbox, projects, notes
}

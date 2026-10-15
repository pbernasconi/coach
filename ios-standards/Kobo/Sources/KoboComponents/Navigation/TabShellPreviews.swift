import KoboTokens
import SwiftUI

#if DEBUG
    private enum PreviewTab: Hashable {
        case today, library, inbox
    }

    private struct TabShellPreview: View {
        @State private var tab = PreviewTab.today

        private var tabs: [KoboTab<PreviewTab>] {
            [
                KoboTab("Today", systemImage: "sun.max", value: .today),
                KoboTab("Library", systemImage: "books.vertical", value: .library),
                KoboTab("Inbox", systemImage: "tray", value: .inbox, badge: 120),
            ]
        }

        var body: some View {
            TabShell(tabs: tabs, selection: $tab) { tab in
                NavigationStack {
                    Text(verbatim: "\(tab)")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .screenCanvas()
                        .navigationTitle(Text(verbatim: "\(tab)"))
                }
            } accessory: {
                MiniPlayerBar(verbatim: "Lower A", subtitle: "12:40", action: {}) {
                    Image(systemName: "dumbbell").accessibilityHidden(true)
                } trailing: {
                    Button("Pause", systemImage: "pause.fill") {}.labelStyle(.iconOnly)
                }
            }
        }
    }

    #Preview("Tab shell") { TabShellPreview() }
    #Preview("Tab shell · dark, Amber") { TabShellPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Tab shell · AX3") { TabShellPreview().dynamicTypeSize(.accessibility3) }
#endif

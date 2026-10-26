import Foundation
import Testing

@testable import Lift

/// Screen links (lift/PUSH.md, "Links"): a notice's tap and a `lift://` URL open the same screen on the same tab.
@MainActor
@Suite struct ScreenLinkTests {
    let sessionID = "ca4f651b-98c7-4765-83a9-07ab74435d69"

    func link(_ text: String) throws -> AppLink? {
        AppLink(url: try #require(URL(string: text)))
    }

    @Test func screenLinksParseAndRoundTrip() throws {
        let links: [(String, AppLink)] = [
            ("lift://session/CA4F651B-98C7-4765-83A9-07AB74435D69", .session(sessionID)),
            ("lift://activity/16234567890", .activity("16234567890")),
            ("lift://weigh-in/2026-10-22", .weighIn("2026-10-22")),
            ("lift://weigh-in/latest", .weighIn("latest")),
            ("lift://today", .today),
        ]
        for (text, expected) in links {
            let parsed = try link(text)
            #expect(parsed == expected)
            #expect(parsed?.url.flatMap(AppLink.init(url:)) == expected)
        }
    }

    @Test(arguments: [
        "lift://session/not-an-id", "lift://session", "lift://activity/12a", "lift://activity/",
        "lift://weigh-in/2026-1-22", "lift://weigh-in/yesterday", "lift://today/extra", "https://example.com/today",
    ])
    func malformedScreenLinksNameNothing(text: String) throws {
        #expect(try link(text) == nil)
    }

    @Test func eachScreenLinkOpensOnItsTab() {
        #expect(AppLink.session(sessionID).destination == ScreenDestination(tab: .lift, route: .liftSession(sessionID)))
        #expect(AppLink.activity("1").destination == ScreenDestination(tab: .week, route: .activity("1")))
        #expect(AppLink.weighIn("latest").destination == ScreenDestination(tab: .today, route: .weighIn("latest")))
        #expect(AppLink.today.destination == ScreenDestination(tab: .today, route: nil))
        #expect(AppLink.syncCode("A").destination == nil)
    }

    @Test func theRouterOpensScreenLinks() throws {
        let screens = RecordingScreenLinks()
        let router = IncomingNoteRouter(
            inbox: InMemoryNoteInbox(),
            importFlow: RecordingImportTextPresenter(),
            templateLinks: RecordingTemplateLinkFlow(),
            screens: screens
        )
        #expect(router.open(try #require(URL(string: "lift://weigh-in/2026-10-22"))))
        #expect(screens.opened == [ScreenDestination(tab: .today, route: .weighIn("2026-10-22"))])
        let withoutScreens = IncomingNoteRouter(
            inbox: InMemoryNoteInbox(),
            importFlow: RecordingImportTextPresenter(),
            templateLinks: RecordingTemplateLinkFlow()
        )
        #expect(!withoutScreens.open(try #require(URL(string: "lift://today"))))
    }

    @Test func openingADestinationSelectsItsTabAndAsksForTheRoute() {
        let tabs = TabSwitcher(selected: .settings)
        tabs.open(ScreenDestination(tab: .lift, route: .liftSession(sessionID)))
        #expect(tabs.selected == .lift)
        let first = tabs.routeRequests[.lift]
        #expect(first?.route == .liftSession(sessionID))
        tabs.open(ScreenDestination(tab: .lift, route: .liftSession(sessionID)))
        #expect(tabs.routeRequests[.lift]?.serial != first?.serial)  // the same link twice opens it twice
        tabs.open(ScreenDestination(tab: .today, route: nil))
        #expect(tabs.selected == .today)
        #expect(tabs.routeRequests[.today]?.route == nil)
        #expect(tabs.rootRequests.isEmpty)
    }
}

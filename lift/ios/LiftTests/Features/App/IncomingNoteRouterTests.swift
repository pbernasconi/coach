import Foundation
import Testing

@testable import Lift

/// `lift://import` links and notes shared through the Share extension open Import from Notes. Made-up notes only
/// (TEST-8).
@MainActor
@Suite struct IncomingNoteRouterTests {
    static let note = "Workout A - Oct 6\nGoblet squat\n- [x] 10 x 20kg"
    let flow = RecordingImportTextPresenter()
    let links = RecordingTemplateLinkFlow()

    func url(_ text: String) throws -> URL {
        try #require(URL(string: text))
    }

    @Test func anImportLinkOpensTheSharedNoteOnTheReviewStep() throws {
        let inbox = InMemoryNoteInbox(Self.note)
        let router = IncomingNoteRouter(inbox: inbox, importFlow: flow, templateLinks: links)

        #expect(router.open(try url("lift://import")))

        #expect(flow.openings == [.init(text: Self.note, readsOnOpen: true)])
        #expect(inbox.take() == nil)  // taken once
    }

    @Test func anImportLinkWithTextOpensThatText() throws {
        let router = IncomingNoteRouter(inbox: InMemoryNoteInbox(), importFlow: flow, templateLinks: links)
        let link = try #require(AppLink.importNote(text: Self.note).url)

        router.open(link)

        #expect(flow.openings == [.init(text: Self.note, readsOnOpen: true)])
    }

    @Test func anImportLinkWithNothingSharedOpensAnEmptyImport() throws {
        let router = IncomingNoteRouter(inbox: InMemoryNoteInbox(), importFlow: flow, templateLinks: links)

        router.open(try url("lift://import"))

        #expect(flow.openings == [.init(text: "", readsOnOpen: false)])
    }

    @Test func anImportLinkWithNothingSharedLeavesAnOpenImportAlone() throws {
        let router = IncomingNoteRouter(inbox: InMemoryNoteInbox(), importFlow: flow, templateLinks: links)
        flow.isShowingImport = true

        router.open(try url("lift://import"))

        #expect(flow.openings.isEmpty)
    }

    @Test func otherLinksAreNotHandled() throws {
        let router = IncomingNoteRouter(inbox: InMemoryNoteInbox(Self.note), importFlow: flow, templateLinks: links)

        #expect(!router.open(try url("https://example.com/import")))
        #expect(!router.open(try url("lift://settings")))
        #expect(flow.openings.isEmpty)
        #expect(links.payloads.isEmpty)
    }

    @Test func aTemplateLinkOpensTheReviewWithItsPayloadAndLeavesTheInboxAlone() throws {
        let inbox = InMemoryNoteInbox(Self.note)
        let router = IncomingNoteRouter(inbox: inbox, importFlow: flow, templateLinks: links)

        #expect(router.open(try url("lift://templates?d=eyJ2IjoxfQ")))
        #expect(router.open(try url("lift://templates")))

        #expect(links.payloads == ["eyJ2IjoxfQ", ""])
        #expect(flow.openings.isEmpty)
        #expect(inbox.take() == Self.note)
    }

    @Test func comingToTheFrontOpensANoteSharedMeanwhile() {
        let inbox = InMemoryNoteInbox(Self.note)
        let router = IncomingNoteRouter(inbox: inbox, importFlow: flow, templateLinks: links)

        router.checkInbox()
        router.checkInbox()

        #expect(flow.openings == [.init(text: Self.note, readsOnOpen: true)])
    }

    @Test func comingToTheFrontWithAnEmptyInboxDoesNothing() {
        IncomingNoteRouter(inbox: InMemoryNoteInbox(), importFlow: flow, templateLinks: links).checkInbox()
        IncomingNoteRouter(inbox: nil, importFlow: flow, templateLinks: links).checkInbox()

        #expect(flow.openings.isEmpty)
    }

    @Test func aSyncLinkPassesItsCodeOn() throws {
        let syncLinks = RecordingSyncEnrollmentLink()
        let router = IncomingNoteRouter(inbox: InMemoryNoteInbox(), importFlow: flow, templateLinks: links, syncLinks: syncLinks)
        let link = try #require(AppLink.syncCode("a1b2+c3/=").url)

        #expect(router.open(link))

        #expect(syncLinks.codes == ["a1b2+c3/="])  // the round trip keeps every character
        #expect(flow.openings.isEmpty)
    }

    @Test func aSyncLinkWithoutACodeIsNotALiftLink() throws {
        let syncLinks = RecordingSyncEnrollmentLink()
        let router = IncomingNoteRouter(inbox: InMemoryNoteInbox(), importFlow: flow, templateLinks: links, syncLinks: syncLinks)

        #expect(!router.open(try url("lift://sync")))
        #expect(!router.open(try url("lift://sync?code=%20")))
        #expect(!router.open(try url("lift://sync?token=a-long-reusable-token")))  // tokens never ride in links
        #expect(syncLinks.codes.isEmpty)
    }
}

/// Parsing and building `lift://` links, and the App Group inbox the Share extension writes.
@Suite struct AppLinkTests {
    @Test(
        arguments: [
            ("lift://import", AppLink.importNote(text: nil)),
            ("LIFT://Import", AppLink.importNote(text: nil)),
            ("lift:import", AppLink.importNote(text: nil)),
            (
                "lift://import?text=Day%201%0A-%20%5Bx%5D%205%20x%2060kg",
                AppLink.importNote(text: "Day 1\n- [x] 5 x 60kg")
            ),
            ("lift://import?text=", AppLink.importNote(text: nil)),
            ("lift://templates?d=eyJ2IjoxfQ", AppLink.templates(payload: "eyJ2IjoxfQ")),
            ("LIFT://Templates?d=a-b_c", AppLink.templates(payload: "a-b_c")),
            ("lift:templates?d=abc", AppLink.templates(payload: "abc")),
            ("lift://templates", AppLink.templates(payload: "")),
        ] as [(String, AppLink?)]
    )
    func parses(text: String, link: AppLink?) throws {
        #expect(AppLink(url: try #require(URL(string: text))) == link)
    }

    @Test(arguments: ["lift://", "lift://week", "liftx://import", "https://lift/import"])
    func ignores(text: String) throws {
        #expect(AppLink(url: try #require(URL(string: text))) == nil)
    }

    @Test func buildsLinksThatParseBack() throws {
        let links = [
            AppLink.importNote(text: nil), .importNote(text: "A & B = 5 x 60kg?\nnext"),
            .templates(payload: TemplateLinkSample.encoded),
        ]
        for link in links {
            #expect(AppLink(url: try #require(link.url)) == link)
        }
        #expect(AppLink.importNote(text: nil).url?.absoluteString == "lift://import")
        #expect(AppLink.templates(payload: "eyJ2IjoxfQ").url?.absoluteString == "lift://templates?d=eyJ2IjoxfQ")
    }

    @Test func theInboxHandsANoteOverOnce() {
        let inbox = AppGroupNoteInbox(suiteName: "lift.tests.inbox.\(UUID().uuidString)")
        #expect(inbox.take() == nil)
        inbox.put("first")
        inbox.put("Workout A - Oct 6")
        #expect(AppGroupNoteInbox(suiteName: inbox.suiteName).take() == "Workout A - Oct 6")
        #expect(inbox.take() == nil)
    }

    @Test func theInboxKeepsAtMostTheLimit() {
        let inbox = AppGroupNoteInbox(suiteName: "lift.tests.inbox.\(UUID().uuidString)")
        inbox.put(String(repeating: "x", count: AppGroupNoteInbox.maximumLength + 10))
        #expect(inbox.take()?.count == AppGroupNoteInbox.maximumLength)
    }
}

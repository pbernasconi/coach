import Foundation
import LiftSync
import Testing

@testable import Lift

/// Where the Lift tab's links go, and how a key becomes one path segment (lift/APP-API.md, "Links").
@Suite struct LiftLinksTests {
    @Test(
        arguments: [
            ("id-4c494654-0000-4000-8000-000000000019", "id-4c494654-0000-4000-8000-000000000019"),
            ("name-hanging leg raise", "name-hanging%20leg%20raise"),
            ("name-push/pull", "name-push%2Fpull"),
            ("name-50% row?", "name-50%25%20row%3F"),
        ] as [(String, String)]
    )
    func aKeyIsOnePathSegment(key: String, segment: String) {
        #expect(LiftLinks.pathSegment(key) == segment)
        #expect(LiftLinks.exercisePath(key) == "api/app/lift/exercises/\(segment)")
    }

    @Test func theRequestKeepsAnEncodedSlashInsideOneSegment() throws {
        let base = try #require(URL(string: "https://coach.example.com"))
        let request = AppAPIRequest.make(
            baseURL: base,
            path: LiftLinks.exercisePath("name-push/pull"),
            query: [],
            timeZone: "Europe/Zurich",
            token: "t"
        )
        let url = try #require(request.url?.absoluteString)
        #expect(url.hasPrefix("https://coach.example.com/api/app/lift/exercises/name-push%2Fpull?"))
    }

    @Test func aSessionPathUsesTheIdAsSent() {
        #expect(LiftLinks.sessionPath("latest") == "api/app/lift/sessions/latest")
        #expect(
            LiftLinks.session("CA4F651B-98C7-4765-83A9-07AB74435D69")
                == .liftSession("ca4f651b-98c7-4765-83a9-07ab74435d69")
        )
    }

    @Test func libraryKeysRoundTrip() throws {
        let id = try #require(UUID(uuidString: "4C494654-0000-4000-8000-000000000019"))
        #expect(LiftLinks.key(forLibraryID: id) == "id-4c494654-0000-4000-8000-000000000019")
        #expect(LiftLinks.libraryID(fromKey: LiftLinks.key(forLibraryID: id)) == id)
        #expect(LiftLinks.libraryID(fromKey: "name-back squat") == nil)
    }

    @Test func tipLinksOpenSessionsAndExercisesOnly() {
        #expect(LiftLinks.route(for: .session("AB")) == .liftSession("ab"))
        #expect(LiftLinks.route(for: .exercise("id-x")) == .liftExercise("id-x"))
        #expect(LiftLinks.route(for: .week) == nil)
        #expect(LiftLinks.route(for: .section("records")) == nil)
    }
}

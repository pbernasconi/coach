import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import LiftSync

/// The shared App API client side (lift/APP-API.md): the request, sections that fail alone, plain days, the cache, and
/// the Today example.
@Suite struct AppAPITests {
    @Test func requestCarriesPathQueryZoneAndToken() throws {
        let request = AppAPIRequest.make(
            baseURL: try #require(URL(string: "https://coach.test")),
            path: "api/app/lift/sessions/latest",
            query: [URLQueryItem(name: "weeks", value: "2")],
            timeZone: "America/Los_Angeles",
            token: "secret"
        )
        #expect(
            request.url?.absoluteString
                == "https://coach.test/api/app/lift/sessions/latest?weeks=2&tz=America/Los_Angeles"
        )
        #expect(request.httpMethod == "GET")
        let encoded = AppAPIRequest.make(
            baseURL: try #require(URL(string: "https://coach.test/")),
            path: "api/app/lift/exercises/name-push%2Fpull%20row",
            query: [],
            timeZone: "UTC",
            token: "secret"
        )
        #expect(
            encoded.url?.absoluteString == "https://coach.test/api/app/lift/exercises/name-push%2Fpull%20row?tz=UTC"
        )
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
        let plus = AppAPIRequest.make(
            baseURL: try #require(URL(string: "https://coach.test")),
            path: "api/app/today",
            query: [],
            timeZone: "Etc/GMT+8",
            token: "secret"
        )
        #expect(plus.url?.query == "tz=Etc/GMT%2B8", "a server reads a bare + as a space")
    }

    @Test func clientSendsNothingWithoutAToken() async throws {
        let client = URLSessionAppAPIClient(
            session: URLSession(configuration: .ephemeral),
            baseURL: try #require(URL(string: "https://coach.test")),
            tokens: StaticTokenProvider(nil),
            timeZone: { "UTC" }
        )
        await #expect(throws: SyncTransportError.missingToken) { try await client.get("api/app/today") }
    }

    /// A token store that cannot be read, as the Keychain of an unsigned simulator build.
    private struct UnreadableTokens: TokenProvider {
        func token() async throws -> String? { throw AppError(.unknown, detail: "keychain read -34018") }
    }

    @Test func aTokenThatCannotBeReadCountsAsNoToken() async throws {
        let base = try #require(URL(string: "https://coach.test"))
        let app = URLSessionAppAPIClient(
            session: URLSession(configuration: .ephemeral),
            baseURL: base,
            tokens: UnreadableTokens(),
            timeZone: { "UTC" }
        )
        await #expect(throws: SyncTransportError.missingToken) { try await app.get("api/app/today") }
        let plan = URLSessionCoachPlanClient(
            session: URLSession(configuration: .ephemeral),
            baseURL: base,
            tokens: UnreadableTokens()
        )
        await #expect(throws: SyncTransportError.missingToken) {
            try await plan.weeks(from: LocalDay(year: 2026, month: 10, day: 19), count: 2, timeZone: "UTC")
        }
        let blank = URLSessionAppAPIClient(
            session: URLSession(configuration: .ephemeral),
            baseURL: base,
            tokens: StaticTokenProvider(""),
            timeZone: { "UTC" }
        )
        await #expect(throws: SyncTransportError.missingToken) { try await blank.get("api/app/today") }
    }

    private struct Holder: Decodable, Equatable, Sendable {
        let one: AppSection<Inner>
        let two: AppSection<Inner>
        let three: AppSection<Inner>
        let four: AppSection<Inner>

        private enum Keys: String, CodingKey { case one, two, three, four }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: Keys.self)
            one = container.section(.one)
            two = container.section(.two)
            three = container.section(.three)
            four = container.section(.four)
        }
    }

    private struct Inner: Decodable, Equatable, Sendable {
        let text: String
    }

    @Test func aSectionFailsAloneWhenNotOkMissingOrMalformed() throws {
        let json = #"{"one":{"ok":true,"text":"Hi"},"two":{"ok":false},"three":{"ok":true,"text":3}}"#
        let holder = try JSONDecoder().decode(Holder.self, from: Data(json.utf8))
        #expect(holder.one == .ok(Inner(text: "Hi")))
        #expect(holder.two == .failed)
        #expect(holder.three == .failed)
        #expect(holder.four == .failed)
        #expect(holder.one.value?.text == "Hi")
    }

    @Test func plainDaysAndTonesDecode() throws {
        let days = try JSONDecoder().decode([PlainDay].self, from: Data(#"["2026-10-20"]"#.utf8))
        #expect(days == [PlainDay(LocalDay(year: 2026, month: 10, day: 20))])
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode([PlainDay].self, from: Data(#"["20/10"]"#.utf8))
        }
        let tones = try JSONDecoder().decode([AppTone].self, from: Data(#"["good","down","purple"]"#.utf8))
        #expect(tones == [.good, .down, .neutral])
    }

    @Test func fileCacheKeepsOneBodyPerPathWithItsDate() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "AppAPITests-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let cache = FileAppAPICache(directory: folder)
        #expect(cache.load("api/app/today") == nil)
        let date = Date(timeIntervalSince1970: 1_792_528_200)
        try cache.save(AppAPIKept(data: Data("a".utf8), fetchedAt: date), for: "api/app/today")
        try cache.save(AppAPIKept(data: Data("b".utf8), fetchedAt: date), for: "api/app/lift/sessions/x1")
        #expect(cache.load("api/app/today") == AppAPIKept(data: Data("a".utf8), fetchedAt: date))
        #expect(cache.load("api/app/lift/sessions/x1")?.data == Data("b".utf8))
        #expect(
            FileAppAPICache.fileName("api/app/lift/exercises/name-back squat")
                == "api_app_lift_exercises_name-back_squat.json"
        )
    }

    @Test func decodesTheTodayExample() throws {
        let today = try JSONDecoder().decode(AppToday.self, from: Data(AppAPISamples.todayContract.utf8))
        #expect(today.today == PlainDay(LocalDay(year: 2026, month: 10, day: 20)))
        #expect(today.dateText == "Tuesday, October 20")
        #expect(today.header.value?.chips.map(\.valueText) == ["56 · Moderate", "7:22", "Balanced", "53 / 42", "+10"])
        #expect(today.header.value?.chips[1].tone == .warn)
        #expect(today.stale == .ok(TodayStale(text: nil)))
        #expect(today.todayLine.value?.items.first?.liftSessionId == "ca4f651b-98c7-4765-83a9-07ab74435d69")
        let fitness = try #require(today.fitness.value)
        #expect(fitness.days.map(\.projected) == [false, true])
        #expect(fitness.zones.first?.to == nil)
        #expect(fitness.events.first?.priority == "A")
        #expect(fitness.now?.zone == "Fresh")
        #expect(today.last4Weeks.value?.tiles.map(\.key) == ["time", "run", "ride", "strength"])
        #expect(today.body.value?.weight?.changeTone == .good)
        #expect(today.body.value?.series.count == 2)
        let lift = try #require(today.lift.value)
        #expect(lift.arms?.rows.map(\.setsText) == ["5.5", "0"])
        #expect(lift.mainLifts.first?.points.count == 2)
        #expect(lift.last?.late == true)
        #expect(lift.next?.title == "Heavy barbell")
        #expect(today.goals.value?.items.first?.detail.count == 2)
    }

    @Test func todaySectionsFailAlone() throws {
        let today = try JSONDecoder().decode(AppToday.self, from: Data(AppAPISamples.todayFailedSections.utf8))
        #expect(today.header.value?.emptyText == "No Garmin data today.")
        #expect(
            [today.stale.value == nil, today.fitness.value == nil, today.goals.value == nil] == [true, true, true]
        )
    }

    @Test func pruneKeepsTheNewestBodiesOfAFamilyOnly() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "AppAPIPrune-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let cache = FileAppAPICache(directory: folder)
        for index in 0..<5 {
            let kept = AppAPIKept(
                data: Data("\(index)".utf8),
                fetchedAt: Date(timeIntervalSince1970: Double(index) * 60)
            )
            try cache.save(kept, for: "api/app/activities/\(index)")
        }
        try cache.save(AppAPIKept(data: Data("t".utf8), fetchedAt: .distantPast), for: "api/app/today")
        cache.prune(prefix: "api/app/activities/", keeping: 2)
        #expect((0..<5).map { cache.load("api/app/activities/\($0)") != nil } == [false, false, false, true, true])
        #expect(cache.load("api/app/today") != nil)
    }
}

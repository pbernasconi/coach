import Foundation
import LiftStore
import Testing

@testable import LiftSync

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

@Suite struct TransportTests {
    private let builder = SyncRequestBuilder(baseURL: URL(string: "https://coach.test")!)

    @Test func pushRequestMatchesTheContract() throws {
        let change = PushChange(
            idempotencyKey: "0A8B",
            entity: .sessionExercise,
            rowId: "R1",
            op: .delete,
            payload: ["deletedAt": .string("2026-10-15T07:30:00.000Z"), "position": .integer(2)]
        )
        let request = try builder.push(PushRequest(deviceId: "D1", changes: [change]), token: "secret")
        #expect(request.url?.absoluteString == "https://coach.test/api/lift/sync/push")
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        let body = String(bytes: try #require(request.httpBody), encoding: .utf8)
        let expected =
            #"{"changes":[{"entity":"sessionExercise","idempotencyKey":"0A8B","op":"delete","#
            + #""payload":{"deletedAt":"2026-10-15T07:30:00.000Z","position":2},"rowId":"R1"}],"deviceId":"D1"}"#
        #expect(body == expected)
    }

    @Test(arguments: [
        (String?.some("12 87"), 50, "cursor=12%2087&limit=50"), (nil, 9_000, "limit=500"), (nil, 0, "limit=1"),
    ])
    func pullRequestCarriesCursorAndClampedLimit(cursor: String?, limit: Int, query: String) {
        let request = builder.pull(cursor: cursor, limit: limit, token: "secret")
        #expect(request.url?.absoluteString == "https://coach.test/api/lift/sync/pull?\(query)")
        #expect(request.httpMethod == "GET")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
    }

    @Test(arguments: [
        (200, SyncTransportError?.none), (401, .unauthorized), (500, .retryable(status: 500)),
        (503, .retryable(status: 503)), (400, .rejected(status: 400)), (404, .rejected(status: 404)),
        (422, .rejected(status: 422)),
    ])
    func statusCodesMapToContractErrors(status: Int, expected: SyncTransportError?) {
        #expect(SyncTransportError.forStatus(status) == expected)
    }

    @Test func mapperThrowsForErrorStatusesAndBadBodies() throws {
        let unauthorized = try response(401, "{}")
        #expect(throws: SyncTransportError.unauthorized) {
            try SyncResponseMapper.decode(PushResponse.self, from: unauthorized)
        }
        let garbage = try response(200, "<html>")
        #expect(throws: SyncTransportError.invalidResponse) {
            try SyncResponseMapper.decode(PushResponse.self, from: garbage)
        }
    }

    @Test func networkErrorsAreRetryableAndCancellationStaysCancellation() {
        #expect(
            SyncResponseMapper.transportError(URLError(.notConnectedToInternet)) as? SyncTransportError
                == .retryable(status: nil)
        )
        #expect(SyncResponseMapper.transportError(URLError(.cancelled)) is CancellationError)
        #expect(SyncResponseMapper.transportError(CancellationError()) is CancellationError)
    }

    @Test func pushResponseMatchesKeysInAnyCase() throws {
        let key = UUID(uuid: (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16))
        let json =
            #"{"accepted":["\#(key.uuidString.lowercased())"],"rejected":[{"idempotencyKey":"bad","reason":"x"}]}"#
        let decoded = try SyncResponseMapper.decode(PushResponse.self, from: try response(200, json))
        #expect(decoded.acknowledgedKeys == [key])
        #expect(decoded.rejected == [.init(idempotencyKey: "bad", reason: "x")])
    }

    @Test func pullResponseDropsUnknownEntitiesAndBadIds() throws {
        let id = "EE000000-0000-4000-8000-000000000001"
        let json = """
            {"changes":[{"entity":"session","rowId":"\(id)","payload":{"id":"\(id)","title":"A","n":1.5,"ok":true}},
            {"entity":"widget","rowId":"\(id)","payload":{}},{"entity":"set","rowId":"x","payload":{}}],
            "cursor":"1287","hasMore":false}
            """
        let decoded = try SyncResponseMapper.decode(PullResponse.self, from: try response(200, json))
        #expect(decoded.cursor == "1287")
        #expect(decoded.hasMore == false)
        #expect(decoded.droppedCount == 2)
        let change = try #require(decoded.changes.first)
        #expect(change.entity == .session)
        #expect(change.payload == ["id": .string(id), "title": .string("A"), "n": .double(1.5), "ok": .bool(true)])
    }

    @Test func outboxDatesBecomeISO8601WithMilliseconds() throws {
        let object = try SyncPayload.wireObject(
            outboxPayload: #"{"updatedAt":"2026-03-02 09:00:00.250","deletedAt":null,"note":"2026-03-02 09:00:00.000"}"#
        )
        #expect(object["updatedAt"] == .string("2026-03-02T09:00:00.250Z"))
        #expect(object["deletedAt"] == .null)
        #expect(object["note"] == .string("2026-03-02 09:00:00.000"))
    }

    @Test func missingTokenThrowsBeforeSending() async throws {
        let transport = URLSessionSyncTransport(
            session: URLSession(configuration: .ephemeral),
            baseURL: URL(string: "https://coach.invalid")!,
            tokens: StaticTokenProvider("")
        )
        await #expect(throws: SyncTransportError.missingToken) { try await transport.pull(cursor: nil, limit: 10) }
    }

    private func response(_ status: Int, _ body: String) throws -> (Data, URLResponse) {
        let url = try #require(URL(string: "https://coach.test"))
        let http = try #require(HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil))
        return (Data(body.utf8), http)
    }
}

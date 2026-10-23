import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import LiftSync

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

@Suite struct PushDevicesTests {
    private let registration = PushDeviceRegistration(
        token: "ab12",
        environment: .production,
        topic: "com.example.lift",
        installId: "I1",
        appVersion: "1.0 (17)",
        deviceName: nil,
        notificationsAuthorized: true
    )

    @Test func registerRequestMatchesTheContract() throws {
        let request = try PushDeviceRequest.make(
            baseURL: URL(string: "https://coach.test")!,
            path: PushDeviceRequest.devicesPath,
            method: "POST",
            body: registration,
            token: "secret"
        )
        #expect(request.url?.absoluteString == "https://coach.test/api/app/push/devices")
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        let body = String(bytes: try #require(request.httpBody), encoding: .utf8)
        let expected =
            #"{"appVersion":"1.0 (17)","environment":"production","installId":"I1","#
            + #""notificationsAuthorized":true,"token":"ab12","topic":"com.example.lift"}"#
        #expect(body == expected)
    }

    @Test func openedRequestCarriesTheNotificationID() throws {
        let request = try PushDeviceRequest.make(
            baseURL: URL(string: "https://coach.test/")!,
            path: PushDeviceRequest.openedPath,
            method: "POST",
            body: ["notificationId": "N1"],
            token: "secret"
        )
        #expect(request.url?.absoluteString == "https://coach.test/api/app/push/opened")
        #expect(String(bytes: try #require(request.httpBody), encoding: .utf8) == #"{"notificationId":"N1"}"#)
    }

    @Test func noStoredTokenSendsNothing() async {
        let devices = URLSessionPushDevices(
            session: URLSession(configuration: .ephemeral),
            baseURL: URL(string: "https://coach.test")!,
            tokens: StaticTokenProvider(nil)
        )
        await #expect(throws: SyncTransportError.missingToken) { try await devices.register(registration) }
    }

    @Test func weighInDecodesTheContractExample() throws {
        let weighIn = try JSONDecoder().decode(AppWeighIn.self, from: Data(AppAPISamples.weighInContract.utf8))
        #expect(weighIn.date == PlainDay(LocalDay(year: 2026, month: 10, day: 22)))
        #expect(weighIn.weight.text == "83.2")
        #expect(weighIn.bodyFat?.text == "18.4 %")
        #expect(weighIn.changes.map(\.id) == ["previous", "4w"])
        #expect(weighIn.changes.first?.tone == .good)
        #expect(weighIn.series.count == 2)
        #expect(weighIn.series.last?.trendKg == 83.52)
        #expect(weighIn.trend?.text == "83.5")
        #expect(weighIn.trend?.rate?.text == "▼ 0.26 kg/wk")
        #expect(weighIn.trend?.rate?.tone == .good)
        #expect(weighIn.trend?.swingKg == 0.4)
        #expect(weighIn.olderDate == PlainDay(LocalDay(year: 2026, month: 10, day: 21)))
        #expect(weighIn.newerDate == nil)
        let first = try JSONDecoder().decode(AppWeighIn.self, from: Data(AppAPISamples.weighInFirst.utf8))
        #expect(first.bodyFat == nil)
        #expect(first.changes.isEmpty)
        #expect(first.trend?.rate == nil)
        #expect(first.trend?.noteText == nil)
        #expect(AppWeighIn.path("latest") == "api/app/weigh-ins/latest")
    }
}

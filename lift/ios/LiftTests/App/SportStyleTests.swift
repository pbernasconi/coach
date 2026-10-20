import Foundation
import Testing

@testable import Lift

/// `Sport` matches `design/sports.json`, the file the coach web app reads, so a sport has one colour and one icon
/// on every screen.
@Suite struct SportStyleTests {
    private struct Spec: Decodable {
        struct Entry: Decodable {
            let id: String
            let label: String
            let light: String
            let dark: String
            let sfSymbol: String
        }
        let sports: [Entry]
    }

    private func spec() throws -> Spec {
        // LiftTests/App/SportStyleTests.swift → the repo root is five folders up.
        let root = URL(filePath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appending(path: "design/sports.json"))
        return try JSONDecoder().decode(Spec.self, from: data)
    }

    private func hex(_ value: UInt32) -> String {
        "#" + String(format: "%06x", value)
    }

    @Test func casesAreTheSameSportsInTheSameOrder() throws {
        let ids = try spec().sports.map(\.id)
        #expect(Sport.allCases.map(\.rawValue) == ids)
    }

    @Test func labelsColoursAndSymbolsMatchTheSharedFile() throws {
        for entry in try spec().sports {
            let sport = try #require(Sport(rawValue: entry.id))
            #expect(sport.label == entry.label)
            #expect(sport.symbol == entry.sfSymbol)
            #expect(hex(sport.hex.light) == entry.light)
            #expect(hex(sport.hex.dark) == entry.dark)
        }
    }
}

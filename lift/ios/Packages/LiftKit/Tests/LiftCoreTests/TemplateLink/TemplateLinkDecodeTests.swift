import Foundation
import Testing

@testable import LiftCore

/// Reading `lift://templates?d=` payloads: encoding, versions, sizes and shape (fabricated links only).
@Suite struct TemplateLinkDecodeTests {
    typealias Fixture = TemplateLinkFixtures

    @Test func readsTemplatesWithTheirUnitsAndDefaults() throws {
        let templates = try TemplateLink.decode(Fixture.encoded)
        #expect(templates.map(\.name) == ["Test day A", "Test day B"])
        #expect(templates[0].unit == .lb)
        #expect(templates[1].unit == .kg)
        let squat = templates[0].exercises[0]
        #expect(squat.sets == 3)
        #expect(squat.repRange == 8...8)
        #expect(squat.weight == .lb(135))
        #expect(squat.restSeconds == 180)
        #expect(squat.note == "Made-up cue")
        #expect(templates[0].exercises[1].repRange == 8...10)
        #expect(templates[0].exercises[1].restSeconds == TemplateExercise.defaultRestSeconds)
        #expect(templates[1].exercises[0].load == .hand)
        #expect(templates[1].exercises[0].weight == .kg(20))
        let plank = templates[1].exercises[1]
        #expect(plank.sets == TemplateExercise.defaultSets)
        #expect(plank.repRange == TemplateExercise.defaultRepRange)
        #expect(plank.weight == nil)
    }

    @Test func acceptsPaddingAndSurroundingSpace() throws {
        let padded = Data(Fixture.json.utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
        #expect(try TemplateLink.decode(" \(padded)\n").count == 2)
    }

    @Test func encodesWhatItDecodes() throws {
        let payload = TemplateLinkPayload(
            unit: "lb",
            templates: [.init(name: "Test day", exercises: [.init(name: "Bench press", sets: 4, reps: 6, weight: 115)])]
        )
        let encoded = try TemplateLink.encode(payload)
        #expect(!encoded.contains("="))
        #expect(!encoded.contains("+"))
        #expect(!encoded.contains("/"))
        let decoded = try TemplateLink.decode(encoded)
        #expect(decoded.first?.exercises.first?.weight == .lb(115))
        #expect(decoded.first?.exercises.first?.sets == 4)
    }

    @Test(arguments: ["", "   ", "not base64!", "a", "abc$", "%7B%22v%22", "e30=e30"])
    func badBase64IsNotBase64(encoded: String) {
        #expect(Fixture.error(encoded) == .notBase64)
    }

    @Test(arguments: ["hello", "[1,2,3]", "{\"v\":\"one\"}", "{\"v\":1"])
    func badJSONIsNotJSON(text: String) {
        #expect(Fixture.error(Fixture.base64url(text)) == .notJSON)
    }

    @Test(arguments: [2, 0, -1, 99])
    func unknownVersionsAreReportedAsSuch(version: Int) {
        let encoded = Fixture.base64url(#"{"v":\#(version),"templates":[{"shape":"anything"}]}"#)
        #expect(Fixture.error(encoded) == .unsupportedVersion(version))
    }

    @Test func aMissingVersionIsAnInvalidField() {
        #expect(Fixture.error(Fixture.base64url(#"{"templates":[]}"#)) == .invalid(field: "v"))
    }

    @Test(arguments: [
        #"{"v":1,"templates":[]}"#,
        #"{"v":1,"templates":[{"name":"T","exercises":[]}]}"#,
    ])
    func emptyLinksAreEmpty(json: String) {
        #expect(Fixture.error(Fixture.base64url(json)) == .empty)
    }

    @Test func anOverlongLinkIsTooLarge() {
        let long = String(repeating: "A", count: TemplateLink.maximumEncodedLength + 4)
        #expect(Fixture.error(long) == .tooLarge)
    }

    @Test func tooMuchJSONIsTooLarge() {
        let padding = String(repeating: " ", count: TemplateLink.maximumJSONBytes)
        let encoded = Fixture.base64url(#"{"v":1,"templates":[]\#(padding)}"#)
        #expect(encoded.count <= TemplateLink.maximumEncodedLength)
        #expect(Fixture.error(encoded) == .tooLarge)
    }

    @Test func aWrongTypeNamesItsField() {
        let encoded = Fixture.exercise(#","sets":"three""#)
        #expect(Fixture.error(encoded) == .invalid(field: "templates[0].exercises[0].sets"))
    }

    @Test func aMissingNameNamesItsField() {
        let encoded = Fixture.base64url(#"{"v":1,"templates":[{"exercises":[{"name":"Plank"}]}]}"#)
        #expect(Fixture.error(encoded) == .invalid(field: "templates[0].name"))
    }

    @Test func unknownKeysAreIgnored() throws {
        let encoded = Fixture.exercise(#","tempo":"3-1-1","sets":2"#)
        #expect(try TemplateLink.decode(encoded).first?.exercises.first?.sets == 2)
    }
}

/// The made-up example in TEMPLATE-LINKS.md, as `lift/scripts/make-template-link.py` prints it, reads here too.
@Suite struct TemplateLinkScriptTests {
    static let documented =
        "eyJ2IjoxLCJ1bml0IjoibGIiLCJ0ZW1wbGF0ZXMiOlt7Im5hbWUiOiJTYW1wbGUgbG93ZXIiLCJleGVyY2lzZXMiOlt7Im5hbWUiOiJCYWNrIHNx"
        + "dWF0Iiwic2V0cyI6MywicmVwcyI6OCwicmVwTWF4IjpudWxsLCJ3ZWlnaHQiOjEzNSwicmVzdCI6MTgwLCJub3RlIjoiTWFkZS11cCBjdWUifSx7"
        + "Im5hbWUiOiJEdW1iYmVsbCBiZW5jaCBwdWxsIiwic2V0cyI6MywicmVwcyI6MTAsInJlcE1heCI6MTIsIndlaWdodCI6MzAsImxvYWQiOiJoYW5k"
        + "In1dfV19"

    @Test func theDocumentedLinkReads() throws {
        let template = try #require(try TemplateLink.decode(Self.documented).first)
        #expect(template.name == "Sample lower")
        #expect(template.unit == .lb)
        #expect(template.exercises.map(\.name) == ["Back squat", "Dumbbell bench pull"])
        #expect(template.exercises[1].repRange == 10...12)
        #expect(template.exercises[1].load == .hand)
        #expect(template.exercises[0].note == "Made-up cue")
    }
}

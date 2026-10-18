import Foundation
import Testing

@testable import LiftCore

/// The field limits of a template link (fabricated links only).
@Suite struct TemplateLinkLimitsTests {
    typealias Fixture = TemplateLinkFixtures
    static let field = "templates[0].exercises[0]"

    @Test(arguments: [
        (#","sets":0"#, "sets"),
        (#","sets":21"#, "sets"),
        (#","reps":0"#, "reps"),
        (#","reps":101"#, "reps"),
        (#","repMax":12"#, "reps"),
        (#","reps":10,"repMax":8"#, "repMax"),
        (#","reps":10,"repMax":101"#, "repMax"),
        (#","weight":-5"#, "weight"),
        (#","weight":1501"#, "weight"),
        (#","rest":-1"#, "rest"),
        (#","rest":1801"#, "rest"),
        (#","load":"both""#, "load"),
    ])
    func numbersOutsideTheirLimitsNameTheirField(fields: String, key: String) {
        #expect(Fixture.error(Fixture.exercise(fields)) == .invalid(field: "\(Self.field).\(key)"))
    }

    @Test(arguments: [
        (#","sets":20,"reps":100,"weight":1500,"rest":1800"#, true),
        (#","sets":1,"reps":1,"repMax":1,"weight":0,"rest":0"#, true),
        (#","load":"bw""#, true),
    ])
    func theLimitsThemselvesAreAllowed(fields: String, reads: Bool) {
        #expect((Fixture.error(Fixture.exercise(fields)) == nil) == reads)
    }

    @Test func aWeightNeedsAUnit() {
        #expect(Fixture.error(Fixture.exercise(#","weight":60"#, unit: "null")) == .invalid(field: "templates[0].unit"))
        #expect(Fixture.error(Fixture.exercise(#","sets":3"#, unit: "null")) == nil)
    }

    @Test func anUnknownUnitIsInvalid() {
        #expect(Fixture.error(Fixture.exercise("", unit: "\"stone\"")) == .invalid(field: "unit"))
    }

    @Test func namesAreTrimmedAndBounded() throws {
        let spaced = Fixture.base64url(#"{"v":1,"templates":[{"name":"  T  ","exercises":[{"name":" Plank "}]}]}"#)
        let template = try #require(try TemplateLink.decode(spaced).first)
        #expect(template.name == "T")
        #expect(template.exercises.first?.name == "Plank")

        let long = String(repeating: "x", count: TemplateLinkLimits.exerciseNameLength.upperBound + 1)
        #expect(
            Fixture.error(Fixture.base64url(#"{"v":1,"templates":[{"name":"T","exercises":[{"name":"\#(long)"}]}]}"#))
                == .invalid(field: "\(Self.field).name")
        )
        let blank = Fixture.base64url(#"{"v":1,"templates":[{"name":"   ","exercises":[{"name":"Plank"}]}]}"#)
        #expect(Fixture.error(blank) == .invalid(field: "templates[0].name"))
    }

    @Test func notesAreBoundedAndBlankOnesDropped() throws {
        let long = String(repeating: "n", count: TemplateLinkLimits.noteLength.upperBound + 1)
        #expect(Fixture.error(Fixture.exercise(#","note":"\#(long)""#)) == .invalid(field: "\(Self.field).note"))
        let blank = try TemplateLink.decode(Fixture.exercise(#","note":"  ""#))
        #expect(blank.first?.exercises.first?.note == nil)
    }

    @Test func tooManyTemplatesOrExercisesAreInvalid() {
        let exercise = #"{"name":"Plank"}"#
        let manyExercises = Array(repeating: exercise, count: 31).joined(separator: ",")
        let one = Fixture.base64url(#"{"v":1,"templates":[{"name":"T","exercises":[\#(manyExercises)]}]}"#)
        #expect(Fixture.error(one) == .invalid(field: "templates[0].exercises"))

        let templates = (0...20).map { #"{"name":"T\#($0)","exercises":[\#(exercise)]}"# }.joined(separator: ",")
        #expect(
            Fixture.error(Fixture.base64url(#"{"v":1,"templates":[\#(templates)]}"#)) == .invalid(field: "templates")
        )
    }

    @Test func twoTemplatesWithOneNameAreInvalid() {
        let encoded = Fixture.base64url(
            #"{"v":1,"templates":[{"name":"Day A","exercises":[{"name":"Plank"}]},{"name":"day a","exercises":[{"name":"Plank"}]}]}"#
        )
        #expect(Fixture.error(encoded) == .invalid(field: "templates[1].name"))
    }
}

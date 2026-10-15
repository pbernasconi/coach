import Foundation
import Testing

@testable import LiftCore

@Suite struct NoteHintParserTests {
    @Test(arguments: [
        ("next time bump to 190lb", 190.0 as Double?, WeightUnit.lb as WeightUnit?),
        ("go 30 next time", 30, nil),
        ("Next time 82.5kg", 82.5, .kg),
        ("did 25 today, next time 30", 30, nil),
        ("next time go heavier", nil, nil),
        ("felt good at 40", nil, nil),
    ])
    func readsNextTimeWeights(text: String, value: Double?, unit: WeightUnit?) {
        let hint = NoteHintParser.nextTimeWeight(in: text)
        #expect(hint?.value == value)
        #expect(hint?.unit == unit)
    }

    @Test(arguments: [
        ("60s between rounds", 60 as Int?),
        ("rest 90 sec", 90),
        ("2 min rest", 120),
        ("rest: 45 seconds", 45),
        ("slower descent (3 seconds)", nil),
        ("rest well", nil),
    ])
    func readsRest(text: String, seconds: Int?) {
        #expect(NoteHintParser.restSeconds(in: text) == seconds)
    }

    @Test(arguments: [
        ("warm up", SetKind.warmUp), ("drop set", .drop), ("to failure", .failure), ("DEEP SQUAT", .working),
    ])
    func readsSetKinds(note: String, kind: SetKind) {
        #expect(NoteHintParser.setKind(for: note) == kind)
        #expect(NoteHintParser.setKind(for: nil) == .working)
    }

    @Test(arguments: [("didn't do it", true), ("did not do the last one", true), ("skipped", true), ("easy", false)])
    func readsSkips(note: String, skipped: Bool) {
        #expect(NoteHintParser.isSkip(note) == skipped)
        #expect(!NoteHintParser.isSkip(nil))
    }
}

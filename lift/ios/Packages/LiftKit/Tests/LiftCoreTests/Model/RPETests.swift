import Foundation
import Testing

@testable import LiftCore

@Suite struct RPETests {
    @Test func theScaleIsSixToTenInHalfSteps() {
        #expect(RPE.scale == [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10])
    }

    @Test(arguments: [
        (6.0, true), (8.5, true), (10.0, true), (5.5, false), (10.5, false), (7.25, false), (0, false),
    ])
    func validValuesAreOnTheScale(value: Double, isValid: Bool) {
        #expect(RPE.isValid(value) == isValid)
    }

    @Test(
        arguments: [
            (nil, nil), ("", nil), ("  \n ", nil), (" paused ", "paused"),
            ("Felt heavy\nslept badly", "Felt heavy\nslept badly"),
        ] as [(String?, String?)]
    )
    func notesAreTrimmedAndEmptyIsNil(text: String?, stored: String?) {
        #expect(NoteText.normalized(text) == stored)
    }

    @Test func aLoggedSetWithoutRPEDecodesFromOlderJSON() throws {
        let json = #"{"id":"00000000-0000-0000-0000-000000000001","kind":"working","target":{},"isSkipped":false}"#
        let set = try JSONDecoder().decode(LoggedSet.self, from: Data(json.utf8))
        #expect(set.rpe == nil)
        let withRPE = LoggedSet(id: set.id, actual: SetActual(reps: 5), rpe: 8.5)
        #expect(try JSONDecoder().decode(LoggedSet.self, from: JSONEncoder().encode(withRPE)) == withRPE)
    }
}

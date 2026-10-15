import Foundation
import Testing

@testable import KoboPatterns

/// The keyboard order of a form: Next through the fields, then the form's last key.
@Suite struct FlowsFormFocusOrderTests {
    nonisolated enum Field: Hashable, Sendable {
        case name, note, line1, line2, city, zip, other
    }

    private let details = FormFocusOrder<Field>([.name, .note], last: .continue)
    private let address = FormFocusOrder<Field>([.line1, .line2, .city, .zip], last: .done)

    @Test func theFirstOfTwoMovesToTheSecond() {
        #expect(details.returnKey(for: .name) == .next)
        #expect(details.onReturn(from: .name, focus: .name) == .focus(.note))
    }

    @Test func theLastFieldRunsTheStepButton() {
        #expect(details.returnKey(for: .note) == .continue)
        #expect(details.onReturn(from: .note, focus: .note) == .submit)
    }

    @Test func aDoneLastFieldClosesTheKeyboard() {
        #expect(address.returnKey(for: .zip) == .done)
        #expect(address.onReturn(from: .zip, focus: .zip) == .dismiss)
    }

    @Test func aGoLastFieldRunsTheFormButton() {
        let signIn = FormFocusOrder<Field>([.line1, .line2], last: .go)
        #expect(signIn.returnKey(for: .line2) == .go)
        #expect(signIn.onReturn(from: .line2, focus: .line2) == .submit)
    }

    @Test func aMiddleFieldMovesToTheOneAfterIt() {
        #expect(address.returnKey(for: .line2) == .next)
        #expect(address.onReturn(from: .line2, focus: .line2) == .focus(.city))
    }

    @Test func aOneFieldFormShowsItsLastKey() {
        let nickname = FormFocusOrder<Field>([.name])
        #expect(nickname.last == .done)
        #expect(nickname.returnKey(for: .name) == .done)
        #expect(nickname.onReturn(from: .name, focus: .name) == .dismiss)
    }

    /// A field left out of the order (a hidden row) is never a stop and never submits.
    @Test func aFieldLeftOutOfTheOrderClosesTheKeyboard() {
        #expect(details.returnKey(for: .other) == .done)
        #expect(details.onReturn(from: .other, focus: .other) == .dismiss)
        #expect(details.next(after: .other) == nil)
    }

    /// A return from a field that no longer has the focus (an Enter repeated after the step moved on) does nothing.
    @Test func aStaleReturnIsIgnored() {
        #expect(details.onReturn(from: .note, focus: nil) == .ignore)
        #expect(details.onReturn(from: .name, focus: .note) == .ignore)
    }

    @Test func aRepeatedFieldIsOneStop() {
        let order = FormFocusOrder<Field>([.line1, .city, .line1], last: .done)
        #expect(order.fields == [.line1, .city])
        #expect(order.onReturn(from: .city, focus: .city) == .dismiss)
    }

    @Test func initialFocusIsTheFirstField() {
        #expect(details.initialFocus == .name)
        #expect(FormFocusOrder<Field>([], last: .done).initialFocus == nil)
    }

    @Test func previousWalksBackAndStopsAtTheFirst() {
        #expect(address.previous(before: .city) == .line2)
        #expect(address.previous(before: .line1) == nil)
        #expect(address.previous(before: .other) == nil)
    }

    @Test func everyLastKeyMapsToItsReturnKey() {
        #expect(FormLastKey.allCases.map(\.returnKey) == [.done, .continue, .go])
    }
}

import Foundation

/// What a `CodeInput` accepts and how it fills.
nonisolated public enum CodeInputMode: Hashable, Sendable, CaseIterable {
    /// A one-time code sent by message or email: digits, offered by the system's code autofill.
    case oneTimeCode
    /// A PIN: digits, secure entry, no autofill, and cells that draw dots.
    case pin
    /// Letters and digits ("K7Q2PX"), uppercased: invite and pairing codes.
    case alphanumeric
}

/// `CodeInput` normalisation and the spoken value, apart from SwiftUI.
nonisolated enum CodeInputLogic {
    /// Keeps the characters `mode` accepts, then cuts to `length`, so a formatted autofill ("123 456") keeps all six
    /// digits. Only ASCII digits and letters count; an alphanumeric code is uppercased.
    static func sanitize(_ text: String, length: Int, mode: CodeInputMode) -> String {
        let kept: [Character] =
            switch mode {
            case .oneTimeCode, .pin:
                text.filter(NumberGrouping.isDigit).map { $0 }
            case .alphanumeric:
                text.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }.map { $0 }
            }
        return String(kept.prefix(max(length, 0)))
    }

    /// One slot per cell, each with its character or `nil` when empty.
    static func slots(code: String, length: Int) -> [CodeSlot] {
        let characters = Array(code)
        return (0..<max(length, 0)).map { CodeSlot(id: $0, character: $0 < characters.count ? characters[$0] : nil) }
    }

    /// The index of the cell that shows the caret: the next empty cell, or the last cell once the code is full.
    static func activeIndex(codeCount: Int, length: Int) -> Int {
        max(0, min(codeCount, length - 1))
    }

    /// Whether VoiceOver may read the code back. A PIN only says how many characters are in, so nobody nearby hears it.
    static func speaksCode(_ mode: CodeInputMode) -> Bool { mode != .pin }
}

/// One cell of a `CodeInput`: its position and its character.
nonisolated struct CodeSlot: Identifiable, Hashable, Sendable {
    let id: Int
    let character: Character?
}

/// When `CodeInput` reports completion: once for each new complete code. The same code again (autofill firing twice)
/// does not report; a different complete code (a fresh paste over a wrong one) does.
nonisolated struct CodeCompletion: Equatable, Sendable {
    private var lastCompleted = ""

    /// The code to complete with, or `nil`.
    mutating func receive(_ code: String, length: Int) -> String? {
        guard code.count == length else {
            lastCompleted = ""
            return nil
        }
        guard code != lastCompleted else { return nil }
        lastCompleted = code
        return code
    }
}

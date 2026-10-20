import Testing

@testable import KoboComponents

/// One-time code cells: sanitizing and completion.
@Suite struct FieldsCodeInputLogicTests {
    @Test(arguments: [
        ("123456", 6, "123456"),
        ("123 456", 6, "123456"),
        ("123-456", 6, "123456"),
        ("a1b2c3", 6, "123"),
        ("12345678", 6, "123456"),
        ("1 2 3 4 5 6 7", 6, "123456"),
        ("abc", 6, ""),
        ("12 34 56", 4, "1234"),
    ])
    func sanitizeKeepsDigitsAndCutsToTheLength(text: String, length: Int, code: String) {
        #expect(CodeInputLogic.sanitize(text, length: length, mode: .oneTimeCode) == code)
        #expect(CodeInputLogic.sanitize(text, length: length, mode: .pin) == code)
    }

    @Test func fullWidthAndOtherScriptsDigitsAreNotCodeDigits() {
        #expect(CodeInputLogic.sanitize("１２３٤٥٦", length: 6, mode: .oneTimeCode).isEmpty)
    }

    @Test func alphanumericCodesKeepLettersAndUppercaseThem() {
        #expect(CodeInputLogic.sanitize("k7q-2px", length: 6, mode: .alphanumeric) == "K7Q2PX")
        #expect(CodeInputLogic.sanitize("ab cd ef gh", length: 6, mode: .alphanumeric) == "ABCDEF")
        #expect(CodeInputLogic.sanitize("é1", length: 6, mode: .alphanumeric) == "1")
    }

    @Test func theCaretSitsInTheNextEmptyCellThenTheLast() {
        #expect(CodeInputLogic.activeIndex(codeCount: 0, length: 6) == 0)
        #expect(CodeInputLogic.activeIndex(codeCount: 3, length: 6) == 3)
        #expect(CodeInputLogic.activeIndex(codeCount: 6, length: 6) == 5)
    }

    @Test func voiceOverReadsACodeBackButNeverAPin() {
        #expect(CodeInputLogic.speaksCode(.oneTimeCode))
        #expect(CodeInputLogic.speaksCode(.alphanumeric))
        #expect(!CodeInputLogic.speaksCode(.pin))
    }

    @Test func completionFiresOncePerNewCompleteCode() {
        var completion = CodeCompletion()
        #expect(completion.receive("123", length: 6) == nil)
        #expect(completion.receive("123456", length: 6) == "123456")
        #expect(completion.receive("123456", length: 6) == nil)
        #expect(completion.receive("654321", length: 6) == "654321")
        #expect(completion.receive("65432", length: 6) == nil)
        #expect(completion.receive("654321", length: 6) == "654321")
    }
}

extension FieldsCodeInputLogicTests {
    @Test func slotsHaveOneCellPerCharacterAndEmptyCellsAfter() {
        let slots = CodeInputLogic.slots(code: "12", length: 4)
        #expect(slots.map(\.id) == [0, 1, 2, 3])
        #expect(slots.map(\.character) == ["1", "2", nil, nil])
        #expect(CodeInputLogic.slots(code: "", length: 0).isEmpty)
    }
}

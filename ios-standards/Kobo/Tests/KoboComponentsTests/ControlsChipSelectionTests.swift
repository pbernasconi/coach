import Testing

@testable import KoboComponents

@Suite struct ControlsChipSelectionTests {
    @Test func singleAlwaysKeepsExactlyTheTappedValue() {
        #expect(ChipSelection.toggled("b", in: ["a"], mode: .single) == ["b"])
        #expect(ChipSelection.toggled("a", in: ["a"], mode: .single) == ["a"])
        #expect(ChipSelection.toggled("a", in: [], mode: .single) == ["a"])
    }

    @Test func singleOrNoneClearsOnASecondTap() {
        #expect(ChipSelection.toggled("a", in: ["a"], mode: .singleOrNone).isEmpty)
        #expect(ChipSelection.toggled("b", in: ["a"], mode: .singleOrNone) == ["b"])
    }

    @Test func multipleTogglesOnlyTheTappedValue() {
        #expect(ChipSelection.toggled("b", in: ["a"], mode: .multiple) == ["a", "b"])
        #expect(ChipSelection.toggled("a", in: ["a", "b"], mode: .multiple) == ["b"])
        #expect(ChipSelection.toggled("a", in: ["a"], mode: .multiple).isEmpty)
    }
}

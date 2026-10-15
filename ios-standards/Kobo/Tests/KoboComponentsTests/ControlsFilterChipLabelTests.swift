import Testing

@testable import KoboComponents

@Suite struct ControlsFilterChipLabelTests {
    @Test func nothingChosenHasNoSummary() {
        #expect(FilterChipLabel.summary([]) == nil)
    }

    @Test func oneValueIsNamed() {
        #expect(FilterChipLabel.summary(["Vegan"]) == "Vegan")
    }

    @Test func moreValuesNameTheFirstAndCountTheRest() {
        #expect(FilterChipLabel.summary(["Vegan", "Halal"]) == "Vegan +1")
        #expect(FilterChipLabel.summary(["Vegan", "Halal", "Kosher", "Raw"]) == "Vegan +3")
    }
}

import Testing

@testable import KoboComponents

@Suite struct ChatChangeSectionTests {
    private func day(_ title: String) -> ChatChangeSection {
        let row = ChatChangeRow(id: "1", title: "Upper", tag: "New", tone: .added)
        return ChatChangeSection(id: title, title: title, rows: [row])
    }

    @Test func aLoneDayThatTheSummaryNamesDropsItsHeading() {
        #expect([day("Sun 22 Nov")].headingRepeats(summary: "2 changes · Sun 22 Nov"))
    }

    @Test func headingsStayWhenTheSummaryDoesNotSayThem() {
        #expect(![day("Sun 22 Nov")].headingRepeats(summary: "2 changes"))
        #expect(![day("Sun 22 Nov")].headingRepeats(summary: nil))
        #expect(![day("Sat 21 Nov"), day("Sun 22 Nov")].headingRepeats(summary: "Sat 21 to Sun 22 Nov"))
        #expect(![day("")].headingRepeats(summary: "1 change"))
    }
}

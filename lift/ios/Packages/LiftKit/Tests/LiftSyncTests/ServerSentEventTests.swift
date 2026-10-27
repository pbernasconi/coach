import Testing

@testable import LiftSync

/// The coach answer stream's reader (lift/APP-API.md, "Coach answer stream").
@Suite struct ServerSentEventTests {
    private func events(_ lines: [String]) -> [ServerSentEvent] {
        var parser = ServerSentEventParser()
        return lines.compactMap { parser.read($0) }
    }

    @Test func eachDataLineIsOneEventNamedByTheLineBefore() {
        let read = events([
            ": padding",
            "event: status",
            #"data: {"type":"status","step":"reading"}"#,
            "",
            "event: text",
            #"data: {"type":"text","delta":"Hi"}"#,
        ])
        #expect(
            read == [
                ServerSentEvent(event: "status", data: #"{"type":"status","step":"reading"}"#),
                ServerSentEvent(event: "text", data: #"{"type":"text","delta":"Hi"}"#),
            ]
        )
    }

    @Test func blankLinesMayBeMissing() {
        let read = events(["event: a", "data: 1", "event: b", "data: 2"])
        #expect(read.map(\.event) == ["a", "b"])
    }

    @Test func aDataLineWithoutANameIsAMessage() {
        #expect(events(["data:x"]) == [ServerSentEvent(event: "message", data: "x")])
    }

    @Test func aNameDoesNotCarryPastABlankLine() {
        #expect(events(["event: a", "", "data: 1"]).map(\.event) == ["message"])
    }
}

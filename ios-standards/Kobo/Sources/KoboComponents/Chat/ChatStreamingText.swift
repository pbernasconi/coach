import Foundation

/// Rules for a reply that is still arriving: close the marks it left open so half-written Markdown never flashes, and
/// the one VoiceOver announcement when it finishes.
nonisolated enum ChatStreamingText {
    /// `text` with an unclosed `**` or backtick closed and a trailing lone `*` dropped. Code fences are left alone
    /// (`ChatReplyBlock` already renders an open fence as code).
    static func repaired(_ text: String) -> String {
        var result = text
        if result.hasSuffix("*"), !result.hasSuffix("**") { result.removeLast() }
        let outsideFences = removingFences(result)
        let boldOpen = outsideFences.components(separatedBy: "**").count.isMultiple(of: 2)
        let codeOpen = !outsideFences.filter { $0 == "`" }.count.isMultiple(of: 2)
        // Close the mark opened last first, so the marks nest: "**a `b" → "**a `b`**".
        let boldOpenedLast =
            (outsideFences.range(of: "**", options: .backwards)?.lowerBound ?? outsideFences.startIndex)
            > (outsideFences.lastIndex(of: "`") ?? outsideFences.startIndex)
        switch (boldOpen, codeOpen) {
        case (true, true): result += boldOpenedLast ? "**`" : "`**"
        case (true, false): result += "**"
        case (false, true): result += "`"
        case (false, false): break
        }
        return result
    }

    /// What VoiceOver announces: the finished reply as plain text, once, when streaming ends; nil otherwise.
    static func announcement(wasStreaming: Bool, isStreaming: Bool, text: String) -> String? {
        guard wasStreaming, !isStreaming else { return nil }
        let plain = text.replacingOccurrences(of: "**", with: "").replacingOccurrences(of: "`", with: "")
            .replacingOccurrences(of: "*", with: "").replacingOccurrences(of: "#", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return plain.isEmpty ? nil : plain
    }

    /// The text without its fenced code blocks (their content may hold any marks).
    private static func removingFences(_ text: String) -> String {
        text.components(separatedBy: "```").enumerated().filter { $0.offset.isMultiple(of: 2) }.map(\.element)
            .joined()
    }
}

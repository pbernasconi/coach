import Foundation

/// One block of a reply: the reply's text split into what `ChatReply` lays out on its own line.
nonisolated enum ChatTextBlock: Equatable, Sendable {
    /// Running text; may hold inline Markdown (bold, italic, code, links).
    case paragraph(String)
    /// A "- " or "* " list item.
    case bullet(String)
    /// A "1. " list item, with its number as written.
    case numbered(Int, String)
    /// A "#" heading line, any level.
    case heading(String)
}

/// Splits a model's Markdown reply into blocks and keeps a reply that is still arriving readable. Pure, so tests
/// check it on Linux.
nonisolated enum ChatMarkdown {
    /// The reply as blocks. Lines in a row join into one paragraph; a blank line, a list item or a heading ends it.
    static func blocks(_ text: String) -> [ChatTextBlock] {
        var blocks: [ChatTextBlock] = []
        var paragraph: [String] = []
        func flush() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: "\n"))) }
            paragraph = []
        }
        for raw in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flush()
            } else if let item = bullet(line) {
                flush()
                blocks.append(.bullet(item))
            } else if let (number, item) = numbered(line) {
                flush()
                blocks.append(.numbered(number, item))
            } else if let title = heading(line) {
                flush()
                blocks.append(.heading(title))
            } else {
                paragraph.append(line)
            }
        }
        flush()
        return blocks
    }

    /// Text that is still streaming, made safe to render: an unfinished `**` or `` ` `` span is closed for now, and a
    /// lone trailing `*` (the first half of a `**`) waits for the next delta instead of flashing on screen.
    static func closingOpenSpans(_ text: String) -> String {
        var text = text
        if text.hasSuffix("*") && !text.hasSuffix("**") { text.removeLast() }
        if count(of: "`", in: text) % 2 == 1 { text += "`" }
        if count(of: "**", in: withoutCode(text)) % 2 == 1 { text += "**" }
        return text
    }

    private static func bullet(_ line: String) -> String? {
        for marker in ["- ", "* ", "• "] where line.hasPrefix(marker) {
            return String(line.dropFirst(marker.count)).trimmingCharacters(in: .whitespaces)
        }
        return nil
    }

    private static func numbered(_ line: String) -> (Int, String)? {
        let digits = line.prefix { $0.isASCII && $0.isNumber }
        guard !digits.isEmpty, digits.count <= 3, let number = Int(digits) else { return nil }
        let rest = line.dropFirst(digits.count)
        guard let mark = rest.first, mark == "." || mark == ")", rest.dropFirst().first == " " else { return nil }
        return (number, String(rest.dropFirst(2)).trimmingCharacters(in: .whitespaces))
    }

    private static func heading(_ line: String) -> String? {
        let hashes = line.prefix { $0 == "#" }
        guard (1...6).contains(hashes.count), line.dropFirst(hashes.count).first == " " else { return nil }
        return String(line.dropFirst(hashes.count + 1)).trimmingCharacters(in: .whitespaces)
    }

    private static func count(of token: String, in text: String) -> Int {
        text.components(separatedBy: token).count - 1
    }

    /// The text with every closed code span taken out, so `**` inside code does not count.
    private static func withoutCode(_ text: String) -> String {
        text.split(separator: "`", omittingEmptySubsequences: false).enumerated()
            .filter { $0.offset.isMultiple(of: 2) }.map(\.element).joined()
    }
}

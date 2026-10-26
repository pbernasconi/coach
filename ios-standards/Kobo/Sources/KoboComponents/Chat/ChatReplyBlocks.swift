import Foundation

/// A reply split into the blocks `ChatReply` lays out: paragraphs, headings, list items and code. Inline marks (bold,
/// italics, links, inline code) stay in each block's text, for `AttributedString(markdown:)`. A small subset of
/// Markdown, enough for a model's answer, with no dependency.
nonisolated enum ChatReplyBlock: Equatable, Sendable {
    case paragraph(String)
    case heading(String)
    /// A list item; `marker` is "•" or the item's number with its dot ("2.").
    case listItem(marker: String, text: String)
    case code(String)

    /// The blocks of `markdown`, in order. An open code fence (a reply still arriving) is a code block to the end.
    static func parse(_ markdown: String) -> [ChatReplyBlock] {
        var blocks: [ChatReplyBlock] = []
        var paragraph: [String] = []
        var code: [String] = []
        var inCode = false

        func flushParagraph() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: " "))) }
            paragraph = []
        }

        for raw in markdown.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("```") {
                if inCode {
                    blocks.append(.code(code.joined(separator: "\n")))
                } else {
                    flushParagraph()
                }
                inCode.toggle()
                code = []
                continue
            }
            if inCode {
                code.append(raw)
                continue
            }
            if line.isEmpty {
                flushParagraph()
            } else if let block = lineBlock(line) {
                flushParagraph()
                blocks.append(block)
            } else {
                paragraph.append(line)
            }
        }
        flushParagraph()
        if inCode { blocks.append(.code(code.joined(separator: "\n"))) }
        return blocks
    }

    /// A heading or list line on its own, or nil for paragraph text.
    private static func lineBlock(_ line: String) -> ChatReplyBlock? {
        for prefix in ["### ", "## ", "# "] where line.hasPrefix(prefix) {
            return .heading(String(line.dropFirst(prefix.count)))
        }
        for prefix in ["- ", "* ", "• "] where line.hasPrefix(prefix) {
            return .listItem(marker: "•", text: String(line.dropFirst(prefix.count)))
        }
        let digits = line.prefix(while: \.isNumber)
        if !digits.isEmpty, digits.count <= 3, line.dropFirst(digits.count).hasPrefix(". ") {
            return .listItem(marker: "\(digits).", text: String(line.dropFirst(digits.count + 2)))
        }
        return nil
    }
}

import Foundation

/// The words and art of a `PrimerPage`: an SF Symbol for the default illustration, a title, a message and up to
/// `maxReasons` reasons. The screen owns the copy; the page only lays it out. Strings are held resolved, so the
/// model is `Equatable` and `Sendable` and can live in a screen's state.
///
///     PrimerPageModel(
///         verbatim: "Turn on notifications", message: "We'll tell you when a timer ends.",
///         symbol: "bell.badge", reasons: [.init(symbol: "timer", verbatim: "Timer alerts")])
nonisolated public struct PrimerPageModel: Equatable, Sendable {
    /// One reason row: a small accent glyph and one short sentence.
    public struct Reason: Identifiable, Equatable, Sendable {
        public let symbol: String
        public let text: String
        public var id: String { text }

        public init(symbol: String, verbatim text: String) {
            self.symbol = symbol
            self.text = text
        }
    }

    /// More reasons than this read as a terms page, not a primer; the rest are dropped.
    public static let maxReasons = 3

    public let title: String
    public let message: String
    public let symbol: String?
    public let reasons: [Reason]

    public init(verbatim title: String, message: String, symbol: String? = nil, reasons: [Reason] = []) {
        self.title = title
        self.message = message
        self.symbol = symbol
        self.reasons = Array(reasons.prefix(Self.maxReasons))
    }
}

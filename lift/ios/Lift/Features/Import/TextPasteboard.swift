import Foundation

#if canImport(UIKit)
    import UIKit
#endif

/// Reads plain text from the clipboard, so the paste step can be tested without the system pasteboard (DI-1).
protocol TextPasteboard {
    /// The clipboard's text, or nil when it holds none.
    func text() -> String?
}

/// The system clipboard. Reading it may show the system paste prompt, which is why it only happens on a tap.
struct SystemPasteboard: TextPasteboard {
    func text() -> String? {
        #if canImport(UIKit)
            UIPasteboard.general.string
        #else
            nil
        #endif
    }
}

import Foundation
import SwiftUI

#if canImport(UIKit)
    import UIKit
    import UniformTypeIdentifiers
#elseif canImport(AppKit)
    import AppKit
#endif

/// Where Kobo's copy controls write: the one seam over the system pasteboard. The default keeps a copy on this device
/// (no Universal Clipboard) and clears it after a minute, which suits codes and account numbers. Inject a recording
/// writer in previews and tests, or a plain one for content meant to travel.
///
///     ContentView().environment(\.pasteboardWriter, .system(lifetime: nil, localOnly: false))
nonisolated public struct PasteboardWriter: Sendable {
    public var write: @MainActor @Sendable (String) -> Void

    public init(write: @escaping @MainActor @Sendable (String) -> Void) {
        self.write = write
    }

    /// The system pasteboard.
    ///
    /// - Parameters:
    ///   - lifetime: how long the copy stays before the system clears it; `nil` keeps it (iOS only).
    ///   - localOnly: keeps the copy off Universal Clipboard (iOS only).
    public static func system(lifetime: Duration? = .seconds(60), localOnly: Bool = true) -> PasteboardWriter {
        PasteboardWriter { value in
            #if canImport(UIKit)
                var options: [UIPasteboard.OptionsKey: Any] = [.localOnly: localOnly]
                if let lifetime {
                    options[.expirationDate] = Date.now.addingTimeInterval(TimeInterval(lifetime.components.seconds))
                }
                UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: value]], options: options)
            #elseif canImport(AppKit)
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(value, forType: .string)
            #endif
        }
    }
}

/// How a copy is confirmed: the app's toast, or a VoiceOver announcement when no hook is installed.
nonisolated public struct CopyConfirmation: Sendable {
    public var show: @MainActor @Sendable (_ message: String) -> Void

    public init(show: @escaping @MainActor @Sendable (_ message: String) -> Void) {
        self.show = show
    }
}

extension EnvironmentValues {
    /// Where `tapToCopy`, `CopyButton` and `CopyableValue` write.
    @Entry public var pasteboardWriter: PasteboardWriter = .system()
    /// How copies below confirm; `nil` announces the confirmation to VoiceOver instead.
    @Entry public var copyConfirmation: CopyConfirmation?
}

extension View {
    /// Confirms every copy below with a success toast ("Setup key copied") in `center`. Attach it next to
    /// `.toastHost(center)`.
    public func copyConfirmationToasts(_ center: ToastCenter) -> some View {
        environment(
            \.copyConfirmation,
            CopyConfirmation { message in
                center.show(Toast(verbatim: message, tone: .success, symbol: "doc.on.doc"))
            }
        )
    }
}

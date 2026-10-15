import Foundation
import KoboTokens
import SwiftUI

#if canImport(UIKit)
    import UIKit
#endif

extension View {
    /// Mirrors whether the software keyboard shows into `isVisible`, for layouts that change while typing (hide a
    /// footer, shrink a hero). Always false off iOS and with a hardware keyboard.
    ///
    ///     content.keyboardVisible($keyboardUp)
    public func keyboardVisible(_ isVisible: Binding<Bool>) -> some View {
        #if os(iOS)
            onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                isVisible.wrappedValue = true
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                isVisible.wrappedValue = false
            }
        #else
            self
        #endif
    }
}

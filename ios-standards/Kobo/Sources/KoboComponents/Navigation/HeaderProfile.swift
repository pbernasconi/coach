import SwiftUI

/// The profile entry an `AppHeader` shows at its trailing edge: a name, an optional picture and what a tap does.
public struct HeaderProfile {
    public let name: String?
    public let image: Image?
    public let showsName: Bool
    public let action: () -> Void

    /// - Parameters:
    ///   - name: shown as is; `nil` or blank shows "Profile".
    ///   - showsName: `false` draws the avatar alone, for a header that is short on room.
    public init(name: String?, image: Image? = nil, showsName: Bool = false, action: @escaping () -> Void) {
        self.name = name
        self.image = image
        self.showsName = showsName
        self.action = action
    }
}

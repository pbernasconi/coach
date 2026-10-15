import SwiftUI

/// The widest a column of content grows on a wide window (an iPad in landscape, a Mac window). A phone is narrower than
/// every cap, so a capped view lays out on an iPhone exactly as before.
public enum ReadableWidth {
    /// A page column, gutter included. Pinned footers take the same cap, so a button lines up with the content above.
    public static let content: CGFloat = 760
    /// A form alone on a wide window (a sign-in card, a short settings sheet), gutter included.
    public static let form: CGFloat = 520
}

extension View {
    /// Caps the view at `width` and centres it in the width it is offered. A no-op on a window narrower than `width`.
    ///
    ///     ScrollView { content.pageGutter().readableWidth() }
    public func readableWidth(_ width: CGFloat = ReadableWidth.content) -> some View {
        frame(maxWidth: width).frame(maxWidth: .infinity)
    }
}

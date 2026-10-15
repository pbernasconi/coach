import SwiftUI

/// Hands its content whether an accessibility text size (AX1 and up) is active, so a row can restack at the largest
/// sizes without reading the environment itself. Draws nothing of its own.
///
///     AccessibilitySizeReader { isLarge in
///         let layout = isLarge ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())
///         layout { title; value }
///     }
public struct AccessibilitySizeReader<Content: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let content: (Bool) -> Content

    public init(@ViewBuilder content: @escaping (_ isAccessibilitySize: Bool) -> Content) {
        self.content = content
    }

    public var body: some View {
        content(dynamicTypeSize.isAccessibilitySize)
    }
}

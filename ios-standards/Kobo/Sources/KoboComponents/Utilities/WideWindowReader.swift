import SwiftUI

#if canImport(UIKit)
    import UIKit
#endif

/// Hands its content whether the window takes the wide rules (`TabletLayout.isWideWindow`): an iPad in a regular-width
/// window, or a Mac. A view that needs the answer inside its body wraps itself in this reader instead of repeating the
/// size-class check behind an `#if`.
///
///     WideWindowReader { isWide in
///         if isWide { SplitDetail() } else { StackedDetail() }
///     }
public struct WideWindowReader<Content: View>: View {
    #if os(iOS)
        @Environment(\.horizontalSizeClass) private var widthClass
    #endif
    private let content: (Bool) -> Content

    public init(@ViewBuilder content: @escaping (_ isWide: Bool) -> Content) {
        self.content = content
    }

    public var body: some View {
        content(isWide)
    }

    private var isWide: Bool {
        #if os(iOS)
            TabletLayout.isWideWindow(
                isPad: UIDevice.current.userInterfaceIdiom == .pad,
                isRegularWidth: widthClass == .regular
            )
        #else
            true
        #endif
    }
}

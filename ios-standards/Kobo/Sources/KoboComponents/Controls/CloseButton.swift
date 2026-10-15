import KoboTokens
import SwiftUI

/// The standard close control for sheets and overlays: an `IconButton` with an "xmark" and the label "Close".
///
///     CloseButton { dismiss() }
public struct CloseButton: View {
    private let style: IconButton.Style
    private let size: IconButton.Size
    private let action: () -> Void

    public init(style: IconButton.Style = .glass, size: IconButton.Size = .regular, action: @escaping () -> Void) {
        self.style = style
        self.size = size
        self.action = action
    }

    public var body: some View {
        IconButton("xmark", label: Text("Close", bundle: .module), style: style, size: size, action: action)
    }
}

#if DEBUG
    private struct CloseButtonGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            HStack(spacing: Space.md) {
                CloseButton {}
                CloseButton(style: .tonal, size: .small) {}
                CloseButton(style: .plain) {}
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Close button") { CloseButtonGallery() }
    #Preview("Close button · dark") { CloseButtonGallery().preferredColorScheme(.dark) }
    #Preview("Close button · AX3") { CloseButtonGallery().dynamicTypeSize(.accessibility3) }
#endif

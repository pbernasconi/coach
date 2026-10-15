import KoboTokens
import SwiftUI

/// The fill behind a whole screen.
public enum ScreenCanvas: Sendable, Equatable, CaseIterable {
    /// `palette.canvas`: tab pages and grouped lists.
    case canvas
    /// `palette.surface`: a plain page of flat rows, a sheet body.
    case surface
    /// `palette.surfaceSunken`: a page that sets raised cards apart.
    case sunken
}

extension View {
    /// Paints the screen behind this view with a theme fill, edge to edge under the bars.
    ///
    ///     ScrollView { … }.screenCanvas()
    public func screenCanvas(_ canvas: ScreenCanvas = .canvas) -> some View {
        modifier(ScreenCanvasModifier(canvas: canvas))
    }
}

private struct ScreenCanvasModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let canvas: ScreenCanvas

    func body(content: Content) -> some View {
        content.background {
            fill.ignoresSafeArea()
        }
    }

    private var fill: Color {
        switch canvas {
        case .canvas: theme.palette.canvas
        case .surface: theme.palette.surface
        case .sunken: theme.palette.surfaceSunken
        }
    }
}

import SwiftUI

/// The check of a successful outcome as one stroke, so it can draw itself on with `trim`: the short leg first, as a
/// hand draws a check. The points sit on a 24-unit grid (`OutcomeHeroMetrics.checkPoints`).
struct OutcomeCheck: Shape {
    func path(in rect: CGRect) -> Path {
        let grid = OutcomeHeroMetrics.checkGrid
        let unit = min(rect.width, rect.height) / grid
        let origin = CGPoint(x: rect.midX - unit * grid / 2, y: rect.midY - unit * grid / 2)
        var path = Path()
        for (index, point) in OutcomeHeroMetrics.checkPoints.enumerated() {
            let scaled = CGPoint(x: origin.x + point.x * unit, y: origin.y + point.y * unit)
            if index == 0 { path.move(to: scaled) } else { path.addLine(to: scaled) }
        }
        return path
    }
}

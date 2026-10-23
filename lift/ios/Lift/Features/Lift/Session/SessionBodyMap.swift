import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The bundled front and back drawing, read once. Nil only if the app shipped without it: the page scrolls as before.
nonisolated enum BodyMapDrawing {
    static let art: BodyMapArt? = try? BodyMapArt.bundled()
}

extension LiftSessionDetail {
    /// The shade of each muscle on the body map: a finished session that worked at least one drawn muscle; else nil.
    var bodyShades: [BodyRegion: BodyShade]? {
        guard BodyMapDrawing.art != nil, let hero = hero.value, hero.state == "done" else { return nil }
        var sets: [Muscle: Double] = [:]
        for row in hero.muscles {
            guard let muscle = Muscle(rawValue: row.muscle) else { continue }
            sets[muscle] = row.sets ?? Double(row.setsText) ?? 0
        }
        let shades = BodyMapShading.shades(sets: sets)
        return shades.values.contains { $0 > BodyShade.none } ? shades : nil
    }
}

/// The body behind the session's sheet, as the route map is behind a run's: front and back side by side, each muscle
/// shaded by the sets that worked it. When the sheet settles, the figures grow or shrink to fill the space it leaves.
struct SessionBodyBackdrop: View, Equatable {
    let shades: [BodyRegion: BodyShade]
    let musclesText: String?
    let rest: BackdropSheetRest
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown: BackdropSheetDetent = .medium

    nonisolated static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.shades == rhs.shades && lhs.rest == rhs.rest && lhs.musclesText == rhs.musclesText
    }

    var body: some View {
        ZStack(alignment: .top) {
            // The surface, not the canvas: in dark mode the canvas is the sheet's black, and the sheet's edge would vanish.
            theme.palette.surface
            if let art = BodyMapDrawing.art {
                VStack(spacing: Space.md) {
                    HStack(spacing: Space.xxl) {
                        BodyFigureCanvas(figure: art.front, shades: shades)
                        BodyFigureCanvas(figure: art.back, shades: shades)
                    }
                    .frame(height: figureHeight(art))
                    BodyShadeLegend()
                }
                .padding(.top, top)
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text("Muscles worked: \(musclesText ?? "")"))
            }
        }
        .onAppear { shown = rest.detent ?? .medium }
        .onChange(of: rest.detent) { _, detent in
            guard let detent, detent != .expanded else { return }
            withKoboAnimation(.present, reduceMotion: reduceMotion) { shown = detent }
        }
    }

    /// Below the bar.
    private var top: CGFloat { rest.topInset + Size.minTouch + Space.md }

    /// As tall as fits between the bar and the sheet (less the legend), and no wider than the screen allows.
    private func figureHeight(_ art: BodyMapArt) -> CGFloat {
        guard rest.size.height > 0 else { return 0 }
        let legend = Space.xl + Space.md
        let tall = rest.top(shown) - top - legend - Space.xl
        let aspect = CGFloat(art.front.bounds.width / art.front.bounds.height)
        let wide = (rest.size.width - Space.xxl * 3) / 2 / aspect
        return max(0, min(tall, wide))
    }
}

/// One view of the body, worked muscles in the accent. The shapes are built once; only the scale changes.
struct BodyFigureCanvas: View {
    private let box: CGRect
    private let parts: [(region: BodyRegion, path: Path)]
    let shades: [BodyRegion: BodyShade]
    @Environment(\.koboTheme) private var theme

    init(figure: BodyFigure, shades: [BodyRegion: BodyShade]) {
        let bounds = figure.bounds
        box = CGRect(x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height)
        parts = figure.parts.map { part in
            var path = Path()
            for shape in part.shapes { BodyFigureCanvas.add(shape, to: &path) }
            return (region: part.region, path: path)
        }
        self.shades = shades
    }

    var body: some View {
        let box = self.box
        let parts = self.parts
        let fills = Dictionary(uniqueKeysWithValues: BodyShade.allCases.map { ($0, color($0)) })
        let shades = self.shades
        Canvas { context, size in
            let scale = min(size.width / box.width, size.height / box.height)
            let transform = CGAffineTransform(scaleX: scale, y: scale)
                .concatenating(
                    CGAffineTransform(
                        translationX: (size.width - box.width * scale) / 2 - box.minX * scale,
                        y: (size.height - box.height * scale) / 2 - box.minY * scale
                    )
                )
            for part in parts {
                let fill = fills[shades[part.region] ?? BodyShade.none] ?? .clear
                context.fill(part.path.applying(transform), with: .color(fill))
            }
        }
        .aspectRatio(box.width / box.height, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func color(_ shade: BodyShade) -> Color {
        switch shade {
        case .none: theme.palette.surfaceSunken
        case .light: theme.palette.accent.opacity(0.42)
        case .medium: theme.palette.accent.opacity(0.7)
        case .full: theme.palette.accent
        }
    }

    private static func add(_ steps: [BodyPathStep], to path: inout Path) {
        for step in steps {
            switch step {
            case .move(let p): path.move(to: CGPoint(x: p.x, y: p.y))
            case .line(let p): path.addLine(to: CGPoint(x: p.x, y: p.y))
            case .cubic(let c1, let c2, let to):
                path.addCurve(
                    to: CGPoint(x: to.x, y: to.y),
                    control1: CGPoint(x: c1.x, y: c1.y),
                    control2: CGPoint(x: c2.x, y: c2.y)
                )
            case .quad(let c, let to):
                path.addQuadCurve(to: CGPoint(x: to.x, y: to.y), control: CGPoint(x: c.x, y: c.y))
            case .close: path.closeSubpath()
            }
        }
    }
}

/// What the shades mean, in sets.
private struct BodyShadeLegend: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        HStack(spacing: Space.lg) {
            swatch(theme.palette.accent.opacity(0.42), "Under 2")
            swatch(theme.palette.accent.opacity(0.7), "2–3.5")
            swatch(theme.palette.accent, "4+ sets")
        }
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
    }

    private func swatch(_ color: Color, _ label: LocalizedStringKey) -> some View {
        HStack(spacing: Space.xs) {
            RoundedRectangle(cornerRadius: Space.xxs, style: .continuous)
                .fill(color)
                .frame(width: Space.md, height: Space.md)
            Text(label)
        }
    }
}

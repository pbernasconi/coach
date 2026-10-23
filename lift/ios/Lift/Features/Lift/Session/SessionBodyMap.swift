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
/// With the sheet down, a tap on a muscle picks it: the rest dims and a card says its sets and the exercises that hit it.
struct SessionBodyBackdrop: View, Equatable {
    let shades: [BodyRegion: BodyShade]
    let muscles: [Muscle: BodyMuscleInfo]
    let musclesText: String?
    let rest: BackdropSheetRest
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown: BackdropSheetDetent = .medium
    @State private var selected: Muscle?

    nonisolated static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.shades == rhs.shades && lhs.rest == rhs.rest && lhs.musclesText == rhs.musclesText
            && lhs.muscles == rhs.muscles
    }

    /// Muscles can be picked only with the sheet down, where the body fills the screen.
    private var isInteractive: Bool { shown == .collapsed }

    var body: some View {
        ZStack(alignment: .top) {
            // The surface, not the canvas: in dark mode the canvas is the sheet's black, and the sheet's edge would vanish.
            theme.palette.surface
            if let art = BodyMapDrawing.art {
                VStack(spacing: Space.sm) {
                    HStack(spacing: Space.lg) {
                        figure(art.front)
                        figure(art.back)
                    }
                    .frame(height: figureHeight(art))
                    BodyShadeLegend(showsHint: isInteractive)
                        .opacity(selected == nil ? 1 : 0)
                }
                .padding(.top, top)
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text("Muscles worked: \(musclesText ?? "")"))
            }
        }
        .overlay(alignment: .top) { callout }
        .onAppear { shown = rest.detent ?? .medium }
        .onChange(of: rest.detent) { _, detent in
            guard let detent, detent != .expanded else { return }
            withKoboAnimation(.present, reduceMotion: reduceMotion) {
                shown = detent
                if detent != .collapsed { selected = nil }
            }
        }
    }

    private func figure(_ figure: BodyFigure) -> some View {
        BodyFigureCanvas(figure: figure, shades: shades, selected: selected) { region in
            guard isInteractive else { return }
            let muscle = region?.muscle
            withKoboAnimation(.fastSpatial, reduceMotion: reduceMotion) {
                selected = muscle == selected ? nil : muscle
            }
        }
    }

    /// The picked muscle's card, just above the sheet.
    @ViewBuilder private var callout: some View {
        if let selected, let info = muscles[selected] {
            BodyMuscleCallout(info: info) {
                withKoboAnimation(.fastSpatial, reduceMotion: reduceMotion) { self.selected = nil }
            }
            .padding(.horizontal, Space.lg)
            .frame(height: max(0, rest.top(shown) - Space.md), alignment: .bottom)
            .transition(Motion.crossFade(reduceMotion: reduceMotion))
        }
    }

    /// Just below the bar (the top inset already includes it).
    private var top: CGFloat { rest.topInset + Space.sm }

    /// As tall as fits between the bar and the sheet (less the legend), and no wider than the screen allows.
    private func figureHeight(_ art: BodyMapArt) -> CGFloat {
        guard rest.size.height > 0 else { return 0 }
        let legend = isInteractive ? Space.xxxl + Space.lg : Space.xl + Space.sm
        let tall = rest.top(shown) - top - legend - Space.lg
        let aspect = CGFloat(art.front.bounds.width / art.front.bounds.height)
        let wide = (rest.size.width - Space.lg * 3) / 2 / aspect
        return max(0, min(tall, wide))
    }
}

/// One view of the body, worked muscles in the accent. The shapes are built once; only the scale changes.
struct BodyFigureCanvas: View {
    private let box: CGRect
    private let parts: [(region: BodyRegion, path: Path)]
    let shades: [BodyRegion: BodyShade]
    /// The picked muscle: drawn in full, the other worked muscles dimmed.
    let selected: Muscle?
    /// A tap on the figure: the area under the finger, or nil off the muscles.
    let onTap: (BodyRegion?) -> Void
    @Environment(\.koboTheme) private var theme

    init(
        figure: BodyFigure,
        shades: [BodyRegion: BodyShade],
        selected: Muscle? = nil,
        onTap: @escaping (BodyRegion?) -> Void = { _ in }
    ) {
        let bounds = figure.bounds
        box = CGRect(x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height)
        parts = figure.parts.map { part in
            var path = Path()
            for shape in part.shapes { BodyFigureCanvas.add(shape, to: &path) }
            return (region: part.region, path: path)
        }
        self.shades = shades
        self.selected = selected
        self.onTap = onTap
    }

    var body: some View {
        let box = self.box
        let parts = self.parts
        let fills = Dictionary(parts.map { ($0.region, fill($0.region)) }) { first, _ in first }
        GeometryReader { proxy in
            Canvas { context, size in
                let transform = BodyFigureCanvas.fit(box, in: size)
                for part in parts {
                    context.fill(part.path.applying(transform), with: .color(fills[part.region] ?? .clear))
                }
            }
            .contentShape(Rectangle())
            .gesture(
                SpatialTapGesture().onEnded { tap in
                    onTap(BodyFigureCanvas.region(at: tap.location, in: proxy.size, box: box, parts: parts))
                }
            )
        }
        .aspectRatio(box.width / box.height, contentMode: .fit)
        .accessibilityHidden(true)
    }

    /// Scales the drawing to fit `size`, centred.
    private static func fit(_ box: CGRect, in size: CGSize) -> CGAffineTransform {
        let scale = min(size.width / box.width, size.height / box.height)
        return CGAffineTransform(scaleX: scale, y: scale)
            .concatenating(
                CGAffineTransform(
                    translationX: (size.width - box.width * scale) / 2 - box.minX * scale,
                    y: (size.height - box.height * scale) / 2 - box.minY * scale
                )
            )
    }

    /// The muscle area under a point, topmost first; nil off the muscles.
    private static func region(
        at point: CGPoint,
        in size: CGSize,
        box: CGRect,
        parts: [(region: BodyRegion, path: Path)]
    ) -> BodyRegion? {
        let drawn = point.applying(fit(box, in: size).inverted())
        return parts.last { $0.region != .outline && $0.path.contains(drawn) }?.region
    }

    /// An area's colour: its shade, dimmed when another muscle is picked; the picked muscle stands out even unworked.
    private func fill(_ region: BodyRegion) -> Color {
        let shade = shades[region] ?? BodyShade.none
        guard let selected, region != .outline else { return color(shade) }
        if region.muscle == selected {
            return shade == BodyShade.none ? theme.palette.textTertiary : theme.palette.accent
        }
        return shade == BodyShade.none ? color(shade) : color(shade).opacity(0.35)
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

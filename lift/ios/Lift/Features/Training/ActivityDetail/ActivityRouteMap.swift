import KoboComponents
import KoboTokens
import MapKit
import SwiftUI

/// The map types under the layers button.
nonisolated enum ActivityMapType: String, CaseIterable, Sendable, Identifiable {
    case standard, satellite, hybrid

    var id: String { rawValue }

    var label: LocalizedStringResource {
        switch self {
        case .standard: "Standard"
        case .satellite: "Satellite"
        case .hybrid: "Hybrid"
        }
    }

    var symbol: String {
        switch self {
        case .standard: "map"
        case .satellite: "globe.americas"
        case .hybrid: "square.2.layers.3d"
        }
    }
}

/// The route on a map that fills the screen behind the sheet, as Strava shows it: the line in the sport's colour on a
/// white edge, a green start and a checkered finish. When the sheet is let go, the camera glides to fit the route into
/// the part of the screen the sheet will leave open, so the two move together. It pans and zooms.
struct ActivityRouteMap: View, Equatable {
    let route: ActivityRoute
    let color: Color
    let rest: BackdropSheetRest
    let type: ActivityMapType
    let isThreeD: Bool
    /// The metric the line is coloured by; nil draws it in `color`.
    var metric: ActivityRouteColors.Metric?
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var camera: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $camera, interactionModes: .all) {
            if let metric, let colored = route.colored {
                MapPolyline(coordinates: Self.coordinates(colored.points))
                    .stroke(theme.palette.surface, style: Self.casing)
                ForEach(colored.pieces(for: metric)) { piece in
                    MapPolyline(coordinates: piece.coordinates.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) })
                        .stroke(piece.color.flatMap { Color(routeHex: $0) } ?? color, style: Self.line)
                }
            } else {
                MapPolyline(coordinates: points)
                    .stroke(theme.palette.surface, style: Self.casing)
                MapPolyline(coordinates: points)
                    .stroke(color, style: Self.line)
            }
            if let first = points.first {
                Annotation("Start", coordinate: first) { RouteMapStart() }
                    .annotationTitles(.hidden)
            }
            if let last = points.last, points.count > 1 {
                Annotation("Finish", coordinate: last) { RouteMapFinish() }
                    .annotationTitles(.hidden)
            }
        }
        .mapStyle(mapStyle)
        .mapControlVisibility(.hidden)
        .accessibilityLabel(Text("Route map"))
        .onAppear { frame(for: rest.detent ?? .medium, animated: false) }
        // The route came with the page, while the sheet still covers the map: frame it at once, so the drop shows it
        // in place.
        .onChange(of: route) { _, _ in frame(for: .medium, animated: false) }
        .onChange(of: rest.detent) { _, detent in
            if let detent, detent != .expanded { frame(for: detent, animated: true) }
        }
        .onChange(of: isThreeD) { _, _ in frame(for: rest.detent ?? .medium, animated: true) }
    }

    nonisolated static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.route == rhs.route && lhs.rest == rhs.rest && lhs.type == rhs.type && lhs.isThreeD == rhs.isThreeD
            && lhs.color == rhs.color && lhs.metric == rhs.metric
    }

    /// The white edge under the line, and the line.
    private static let casing = StrokeStyle(lineWidth: Space.sm, lineCap: .round, lineJoin: .round)
    private static let line = StrokeStyle(lineWidth: Space.xs + 1, lineCap: .round, lineJoin: .round)

    private var points: [CLLocationCoordinate2D] {
        route.coordinates.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    private static func coordinates(_ pairs: [[Double]]) -> [CLLocationCoordinate2D] {
        pairs.compactMap { $0.count == 2 ? CLLocationCoordinate2D(latitude: $0[0], longitude: $0[1]) : nil }
    }

    private var mapStyle: MapStyle {
        let elevation: MapStyle.Elevation = isThreeD ? .realistic : .flat
        return switch type {
        case .standard: .standard(elevation: elevation, pointsOfInterest: .excludingAll)
        case .satellite: .imagery(elevation: elevation)
        case .hybrid: .hybrid(elevation: elevation, pointsOfInterest: .excludingAll)
        }
    }

    /// Fits the route between the bar and the sheet at `detent`; tilted when 3D is on. The map's
    /// buttons take the right edge.
    private func frame(for detent: BackdropSheetDetent, animated: Bool) {
        guard let route = routeRect, rest.size.height > 0 else { return }
        let insets = RouteFraming.Insets(
            top: Double(rest.topInset + Space.xl),
            leading: Double(Space.xxl),
            bottom: Double(rest.size.height - rest.top(detent) + Space.xxl),
            trailing: Double(Space.xxl + Size.minTouch)
        )
        let fit = RouteFraming.rect(
            route: route,
            screen: (Double(rest.size.width), Double(rest.size.height)),
            insets: insets
        )
        let rect = MKMapRect(x: fit.x, y: fit.y, width: fit.width, height: fit.height)
        let position: MapCameraPosition = isThreeD ? .camera(tilted(rect)) : .rect(rect)
        guard animated else {
            camera = position
            return
        }
        withKoboAnimation(.present, reduceMotion: reduceMotion) { camera = position }
    }

    /// A 3D view of the same area: the camera tilted 60°, a little closer.
    private func tilted(_ rect: MKMapRect) -> MapCamera {
        let center = MKMapPoint(x: rect.midX, y: rect.midY).coordinate
        let meters = rect.size.height * MKMetersPerMapPointAtLatitude(center.latitude)
        return MapCamera(centerCoordinate: center, distance: meters * 0.9, heading: 0, pitch: 60)
    }

    private var routeRect: RouteFraming.Rect? {
        guard !points.isEmpty else { return nil }
        let mapPoints = points.map(MKMapPoint.init)
        let xs = mapPoints.map(\.x)
        let ys = mapPoints.map(\.y)
        guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else { return nil }
        return RouteFraming.Rect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }
}

/// The start: a green dot on a white ring.
private struct RouteMapStart: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Circle()
            .fill(theme.palette.success.ink)
            .frame(width: Space.md + Space.xxs, height: Space.md + Space.xxs)
            .overlay { Circle().strokeBorder(theme.palette.surface, lineWidth: Space.xxs) }
            .accessibilityHidden(true)
    }
}

/// The finish: a checkered flag on a white disc.
private struct RouteMapFinish: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Image(systemName: "flag.pattern.checkered")
            .font(theme.font(.caption).weight(.bold))
            .foregroundStyle(theme.palette.textPrimary)
            .frame(width: Space.lg + Space.xxs, height: Space.lg + Space.xxs)
            .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Space.xs, style: .continuous))
            .accessibilityHidden(true)
    }
}

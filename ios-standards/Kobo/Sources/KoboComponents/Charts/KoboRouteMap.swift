import Foundation
import KoboTokens
import MapKit
import SwiftUI

/// A route drawn on a muted map, fitted to its track with a start dot and an end dot. It is a still picture by
/// default (no pan or zoom, so it never steals a page's scroll); `onExpand` adds a glass button to open a larger,
/// `.interactive` map. Invalid points (0,0 fixes, out of range) are skipped and long tracks are thinned. VoiceOver reads
/// the label.
///
///     KoboRouteMap(coordinates: track, accessibilityLabel: "Route") { showFullMap = true }
///     KoboRouteMap(points: pairs, interaction: .interactive, height: .tall, accessibilityLabel: "Route")
public struct KoboRouteMap: View {
    /// Whether the map responds to touch.
    public enum Interaction: Sendable {
        /// A still picture.
        case fixed
        /// Pan, zoom and rotate.
        case interactive
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var dot = Space.md
    private let points: [GeoPoint]
    private let interaction: Interaction
    private let height: ChartHeight
    private let color: Color?
    private var label: Text
    private let onExpand: (() -> Void)?

    /// - Parameters:
    ///   - color: the route line; the theme's accent when `nil`.
    ///   - onExpand: shows an expand button that calls this; no button when `nil`.
    public init(
        coordinates: [CLLocationCoordinate2D],
        interaction: Interaction = .fixed,
        height: ChartHeight = .regular,
        color: Color? = nil,
        accessibilityLabel: LocalizedStringKey,
        onExpand: (() -> Void)? = nil
    ) {
        let points = coordinates.map { GeoPoint(latitude: $0.latitude, longitude: $0.longitude) }
        self.points = RouteMath.thinned(RouteMath.valid(points))
        self.interaction = interaction
        self.height = height
        self.color = color
        self.label = Text(accessibilityLabel)
        self.onExpand = onExpand
    }

    /// A route from latitude and longitude pairs in degrees.
    public init(
        points: [(latitude: Double, longitude: Double)],
        interaction: Interaction = .fixed,
        height: ChartHeight = .regular,
        color: Color? = nil,
        accessibilityLabel: LocalizedStringKey,
        onExpand: (() -> Void)? = nil
    ) {
        self.init(
            coordinates: points.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) },
            interaction: interaction,
            height: height,
            color: color,
            accessibilityLabel: accessibilityLabel,
            onExpand: onExpand
        )
    }

    /// A route whose accessibility label is shown as is (it names user data: "Route of River loop").
    public init(
        coordinates: [CLLocationCoordinate2D],
        interaction: Interaction = .fixed,
        height: ChartHeight = .regular,
        color: Color? = nil,
        verbatimAccessibilityLabel: String,
        onExpand: (() -> Void)? = nil
    ) {
        self.init(
            coordinates: coordinates,
            interaction: interaction,
            height: height,
            color: color,
            accessibilityLabel: "",
            onExpand: onExpand
        )
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        if let bounds = RouteMath.bounds(points) {
            map(bounds)
                .frame(height: height.points)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    if let onExpand {
                        IconButton(
                            "arrow.up.left.and.arrow.down.right",
                            label: Text("Expand map", bundle: .module),
                            style: .glass,
                            size: .small,
                            action: onExpand
                        )
                        .padding(Space.xs)
                    }
                }
        } else {
            ChartEmpty(height: height.points, label: label)
        }
    }

    private func map(_ bounds: GeoBounds) -> some View {
        let coordinates = points.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: bounds.center.latitude, longitude: bounds.center.longitude),
            span: MKCoordinateSpan(latitudeDelta: bounds.latitudeSpan, longitudeDelta: bounds.longitudeSpan)
        )
        return Map(initialPosition: .region(region), interactionModes: interaction == .fixed ? [] : .all) {
            MapPolyline(coordinates: coordinates)
                .stroke(
                    color ?? theme.palette.accent,
                    style: StrokeStyle(lineWidth: Space.xs, lineCap: .round, lineJoin: .round)
                )
            if let first = coordinates.first {
                Annotation("", coordinate: first) { endpoint(theme.palette.success.ink) }
            }
            if let last = coordinates.last, coordinates.count > 1 {
                Annotation("", coordinate: last) { endpoint(theme.palette.danger.ink) }
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
        .id(bounds)
        .accessibilityElement(children: interaction == .fixed ? .ignore : .contain)
        .accessibilityLabel(label)
    }

    private func endpoint(_ fill: Color) -> some View {
        Circle()
            .fill(fill)
            .frame(width: dot, height: dot)
            .overlay { Circle().strokeBorder(theme.palette.canvas, lineWidth: Space.xxs) }
            .accessibilityHidden(true)
    }
}

private struct KoboRouteMapPreview: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.lg) {
            KoboRouteMap(points: loop, accessibilityLabel: "Route") {}
            KoboRouteMap(points: [], accessibilityLabel: "No route")
        }
        .padding()
        .background(theme.palette.canvas)
    }

    /// A made-up loop around a park.
    private var loop: [(latitude: Double, longitude: Double)] {
        (0...60).map { step in
            let angle = Double(step) / 60 * 2 * .pi
            return (47.37 + 0.012 * sin(angle) + 0.002 * sin(angle * 5), 8.54 + 0.02 * cos(angle))
        }
    }
}

#if DEBUG
    #Preview("Route map") { KoboRouteMapPreview() }
    #Preview("Route map, dark") { KoboRouteMapPreview().preferredColorScheme(.dark) }
    #Preview("Route map, AX3") { KoboRouteMapPreview().dynamicTypeSize(.accessibility3) }
#endif

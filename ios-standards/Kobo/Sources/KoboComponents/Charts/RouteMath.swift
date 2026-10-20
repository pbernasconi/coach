import Foundation

/// A latitude and longitude in degrees, as plain numbers, so route maths stays testable without MapKit.
nonisolated struct GeoPoint: Equatable, Sendable {
    let latitude: Double
    let longitude: Double
}

/// The box around a route, in degrees.
nonisolated struct GeoBounds: Hashable, Sendable {
    let minLatitude: Double
    let maxLatitude: Double
    let minLongitude: Double
    let maxLongitude: Double

    var center: GeoPoint {
        GeoPoint(latitude: (minLatitude + maxLatitude) / 2, longitude: (minLongitude + maxLongitude) / 2)
    }

    var latitudeSpan: Double { min(maxLatitude - minLatitude, 180) }
    /// At most 360: a route that crosses the antimeridian shows the whole world rather than an invalid region.
    var longitudeSpan: Double { min(maxLongitude - minLongitude, 360) }
}

/// Pure route maths: which points are valid, the box that fits them, and thinning long tracks.
nonisolated enum RouteMath {
    /// The smallest span shown, in degrees (about 100 m), so a single point or a short loop is not zoomed to the street.
    static let minimumSpan = 0.001

    /// The points with real coordinates (finite, in range, and not the 0,0 a missing fix often reports).
    static func valid(_ points: [GeoPoint]) -> [GeoPoint] {
        points.filter { point in
            point.latitude.isFinite && point.longitude.isFinite && abs(point.latitude) <= 90
                && abs(point.longitude) <= 180 && !(point.latitude == 0 && point.longitude == 0)
        }
    }

    /// The box around `points`, grown by `padding` of its span on each side and to at least `minimumSpan`; `nil` for
    /// no points.
    static func bounds(_ points: [GeoPoint], padding: Double = 0.12) -> GeoBounds? {
        let lats = points.map(\.latitude)
        let lngs = points.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLng = lngs.min(), let maxLng = lngs.max() else {
            return nil
        }
        let latPad = max((maxLat - minLat) * padding, (minimumSpan - (maxLat - minLat)) / 2, 0)
        let lngPad = max((maxLng - minLng) * padding, (minimumSpan - (maxLng - minLng)) / 2, 0)
        return GeoBounds(
            minLatitude: max(minLat - latPad, -90),
            maxLatitude: min(maxLat + latPad, 90),
            minLongitude: minLng - lngPad,
            maxLongitude: maxLng + lngPad
        )
    }

    /// At most `maxPoints` points picked evenly, always keeping the first and the last, so a long track draws fast.
    static func thinned(_ points: [GeoPoint], maxPoints: Int = 500) -> [GeoPoint] {
        ChartMath.thinned(points, to: maxPoints)
    }
}

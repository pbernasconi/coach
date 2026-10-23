import Foundation

/// The maths for the activity map behind the sheet: the camera that fits the route into the part of the screen the
/// sheet and the bar leave open. Map points are MapKit's flat projection (x east, y south).
nonisolated enum RouteFraming {
    /// A rectangle in map points or screen points.
    struct Rect: Equatable, Sendable {
        var x: Double
        var y: Double
        var width: Double
        var height: Double
    }

    /// Space kept clear around the route, in screen points.
    struct Insets: Equatable, Sendable {
        var top: Double
        var leading: Double
        var bottom: Double
        var trailing: Double
    }

    /// The map rect for the whole screen (`screen`) that puts `route` centred in the open part of it, as large as fits.
    /// A route with no size (one point) is shown about 1 km across.
    static func rect(route: Rect, screen: (width: Double, height: Double), insets: Insets) -> Rect {
        let openWidth = max(screen.width - insets.leading - insets.trailing, 1)
        let openHeight = max(screen.height - insets.top - insets.bottom, 1)
        let minimum = 8000.0
        let scale = max(max(route.width, minimum) / openWidth, max(route.height, minimum) / openHeight)
        let midX = route.x + route.width / 2
        let midY = route.y + route.height / 2
        return Rect(
            x: midX - (insets.leading + openWidth / 2) * scale,
            y: midY - (insets.top + openHeight / 2) * scale,
            width: screen.width * scale,
            height: screen.height * scale
        )
    }
}

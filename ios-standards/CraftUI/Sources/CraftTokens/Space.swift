import CoreGraphics

/// The spacing scale. Every padding, gap and margin in CraftUI comes from here; feature code
/// never uses a literal number for spacing. Values follow a 4pt grid.
public enum Space {
    public static let xxs: CGFloat = 2
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 12
    public static let lg: CGFloat = 16
    public static let xl: CGFloat = 20
    public static let xxl: CGFloat = 24
    public static let xxxl: CGFloat = 32
    /// Horizontal screen gutter.
    public static let gutter: CGFloat = 16
    /// Vertical padding of a list row; with `Size.rowMinHeight` it gives a 52pt row.
    public static let rowVertical: CGFloat = 14
}

/// Corner radii. Nested shapes use `Radius.concentric(outer:inset:)` so inner corners stay
/// concentric with outer ones (the iOS 26 rule for glass).
public enum Radius {
    public static let xs: CGFloat = 6
    public static let sm: CGFloat = 10
    public static let md: CGFloat = 14
    public static let lg: CGFloat = 20
    public static let xl: CGFloat = 28
    public static let sheet: CGFloat = 38
    public static let pill: CGFloat = 999

    /// The radius an inner shape needs to stay concentric with its container.
    public static func concentric(outer: CGFloat, inset: CGFloat) -> CGFloat { max(outer - inset, 0) }
}

/// Fixed sizes for controls and touch targets.
public enum Size {
    /// The minimum touch target (Apple HIG).
    public static let minTouch: CGFloat = 44
    public static let rowMinHeight: CGFloat = 52
    public static let buttonHeight: CGFloat = 50
    public static let buttonHeightCompact: CGFloat = 36
    public static let iconSm: CGFloat = 16
    public static let iconMd: CGFloat = 20
    public static let iconLg: CGFloat = 24
    public static let thumbnail: CGFloat = 56
    public static let hairline: CGFloat = 0.5
}

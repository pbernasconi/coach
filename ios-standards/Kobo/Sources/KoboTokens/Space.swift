import Foundation  // CGFloat; Foundation keeps the token maths testable on Linux

/// The spacing scale. Every padding, gap and margin in Kobo comes from here; feature code
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
    /// The one page margin (the keyline): titles, section headers, row content, footers, buttons and card edges all
    /// start here. Flat rows pay it themselves; everything else sits inside `.pageGutter()`.
    public static let gutter: CGFloat = 16
    /// The inner padding of a card (`.koboCard()`, a grouped `ListSection`): one inset for every card's content.
    public static let cardInset: CGFloat = 16
    /// Vertical padding of a list row; with `Size.rowMinHeight` it gives a 52pt row.
    public static let rowVertical: CGFloat = 14
    /// The gap between two sections of a page (one `ListSection`, `DetailSection` or card to the next). Every page
    /// uses it, so sections sit the same distance apart on every screen.
    public static let section: CGFloat = 24
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
    /// The height of the search pill: one touch target. The filter chips under it (`buttonHeightCompact`) are one step
    /// smaller on the same surface, so a search field and its filter row read as one family.
    public static let searchHeight: CGFloat = 44
    public static let iconSm: CGFloat = 16
    public static let iconMd: CGFloat = 20
    public static let iconLg: CGFloat = 24
    public static let thumbnail: CGFloat = 56
    public static let hairline: CGFloat = 0.5
    /// The handle at the top of a sheet that is dragged (Apple's own sheets).
    public static let grabberWidth: CGFloat = 36
    public static let grabberHeight: CGFloat = 5
}

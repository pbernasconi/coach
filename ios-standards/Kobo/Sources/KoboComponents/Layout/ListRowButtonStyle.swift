import KoboTokens
import SwiftUI

/// The pressed look of a tappable `ListRow`. Inside a `ListSection` the whole row fills: edge to edge in
/// `surfaceSunken` in a flat section (the row runs to the screen edges and reads on the canvas), with `surfaceRaised`
/// clipped by the card's corners in a grouped one. Outside a section (a lone row in a sheet), the fill is a rounded
/// rectangle inset `Space.xs`, in `surfaceSunken`. The fill comes in on `Motion.instant` and goes out on
/// `Motion.exit`, and a quick tap shows the whole fill once (`PressFillSchedule`).
/// Ported from an earlier app's `ListRowPressLook` and `PressFillSchedule`.
struct ListRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        ListRowPressBody(label: configuration.label, isPressed: configuration.isPressed)
    }
}

private struct ListRowPressBody<Label: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.koboInListSection) private var inSection
    @Environment(\.listSectionStyle) private var style
    let label: Label
    let isPressed: Bool

    var body: some View {
        label
            .foregroundStyle(theme.palette.textPrimary)
            .pressFill(isPressed, in: shape, color: fill, layer: .under)
    }

    private var shape: AnyShape {
        guard !inSection else { return AnyShape(Rectangle()) }
        return AnyShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).inset(by: Space.xs))
    }

    private var fill: Color {
        inSection && style == .grouped ? theme.palette.surfaceRaised : theme.palette.surfaceSunken
    }
}

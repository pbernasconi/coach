import KoboComponents
import KoboTokens
import MapKit
import SwiftUI

/// An outdoor activity as Strava shows it: the route on a map that fills the screen, under a sheet with the page.
/// The sheet drops from the top to show the map, rests at three heights, and once fully up its content scrolls under a
/// solid bar titled with the sport; there the back button turns into a chevron down that lowers the sheet. With the
/// sheet down the map shows its layers and 3D buttons.
struct ActivityMapPage: View {
    let route: ActivityRoute
    let header: ActivityHeader
    let detail: ActivityDetail
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void
    @State private var detent: BackdropSheetDetent = .medium
    @State private var mapType: ActivityMapType = .standard
    @State private var isThreeD = false

    var body: some View {
        BackdropSheet(detent: $detent, revealFrom: .expanded) { rest in
            ActivityRouteMap(
                route: route,
                color: header.sportStyle.color,
                rest: rest,
                type: mapType,
                isThreeD: isThreeD
            )
            .equatable()
        } sheet: {
            ActivitySections(detail: detail, feedback: state.shownFeedback, save: state.feedback.save, send: send)
                .pageColumn()
                .padding(.top, Space.xs)
                .padding(.bottom, Space.xxl)
        } overlay: { sheet in
            ActivityMapOverlay(
                sheet: sheet,
                title: header.typeText,
                mapType: $mapType,
                isThreeD: $isThreeD,
                onLower: { detent = .medium }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .keepsSwipeBack()
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
    }
}

/// What sits over the map and the sheet: the bar's solid background once the sheet is up, the bar's back button and
/// title, and the layers and 3D buttons while the sheet is down.
private struct ActivityMapOverlay: View {
    let sheet: BackdropSheetState
    let title: String
    @Binding var mapType: ActivityMapType
    @Binding var isThreeD: Bool
    let onLower: () -> Void
    @Environment(\.koboTheme) private var theme
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How far the bar has turned solid: 0 until the sheet's top is near the bar, 1 when it is under it.
    private var barProgress: Double {
        BackdropSheetMath.unit(Double(sheet.sheetTop), from: Double(sheet.topInset + 96), to: Double(sheet.topInset))
    }

    /// The map's own buttons show once the sheet is most of the way down.
    private var showsMapButtons: Bool { sheet.collapse > 0.55 }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            barBackground
            mapButtons
                .koboAnimation(.fastSpatial, value: showsMapButtons)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { backButton }
            ToolbarItem(placement: .principal) {
                Text(verbatim: title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .opacity(barProgress)
                    .accessibilityHidden(barProgress < 0.5)
            }
        }
    }

    private var barBackground: some View {
        theme.palette.canvas
            .frame(height: sheet.topInset)
            .overlay(alignment: .bottom) {
                theme.palette.separator.frame(height: Size.hairline)
            }
            .opacity(BackdropSheetMath.unit(Double(sheet.sheetTop), from: Double(sheet.topInset + Space.xxl), to: Double(sheet.topInset)))
            .frame(maxWidth: .infinity, alignment: .top)
            .allowsHitTesting(false)
    }

    /// Back while the map shows; a chevron down that lowers the sheet once it is up. The chevron turns as it changes.
    private var backButton: some View {
        let isUp = barProgress > 0.5
        return Button {
            if isUp { onLower() } else { dismiss() }
        } label: {
            Image(systemName: "chevron.left")
                .rotationEffect(.degrees(-90 * barProgress))
        }
        .accessibilityLabel(isUp ? Text("Show map") : Text("Back"))
        .tint(theme.palette.textPrimary)
    }

    /// Layers and 3D in one glass pill under the bar's "…", as Apple Maps stacks its map controls.
    @ViewBuilder private var mapButtons: some View {
        if showsMapButtons {
            VStack(spacing: 0) {
                Menu {
                    Picker(selection: $mapType) {
                        ForEach(ActivityMapType.allCases, id: \.self) { type in
                            Label { Text(type.label) } icon: { Image(systemName: type.symbol) }
                        }
                    } label: {
                        Text("Map type")
                    }
                } label: {
                    Image(systemName: "square.3.layers.3d")
                        .font(theme.font(.subheadline).weight(.semibold))
                        .frame(width: Self.control, height: Self.control)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text("Map type"))
                theme.palette.separator
                    .frame(width: Self.control - Space.md, height: Size.hairline * 2)
                Button {
                    isThreeD.toggle()
                } label: {
                    Text("3D")
                        .font(theme.font(.footnote).weight(.bold))
                        .foregroundStyle(isThreeD ? theme.palette.accentText : theme.palette.textPrimary)
                        .frame(width: Self.control, height: Self.control)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text("3D"))
                .accessibilityAddTraits(isThreeD ? .isSelected : [])
            }
            .buttonStyle(.plain)
            .foregroundStyle(theme.palette.textPrimary)
            .glassEffect(.regular.interactive(), in: Capsule())
            .padding(.top, sheet.topInset + Space.xxs)
            // In line with the bar's "…": the bar keeps its buttons 20 points from the edge.
            .padding(.trailing, Space.xl)
            .transition(Motion.pop(reduceMotion: reduceMotion))
        }
    }

    /// One map control: the same 44 points as the bar's buttons, so the pill lines up under "…".
    private static let control: CGFloat = Size.minTouch
}

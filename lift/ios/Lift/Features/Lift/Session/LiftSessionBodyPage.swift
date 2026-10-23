import KoboComponents
import KoboPatterns
import KoboTokens
import LiftCore
import SwiftUI

/// A finished lift as a run shows its route: the body map fills the screen under a sheet with the page. The sheet drops
/// from the top to show the body once the page has loaded, and rests at three heights; fully up, its content scrolls
/// under a solid bar titled with the session, where Back turns into a chevron down that lowers the sheet.
struct LiftSessionBodyPage: View {
    let shades: [BodyRegion: BodyShade]
    let detail: LiftSessionDetail
    let state: LiftSessionState
    let send: (LiftSessionAction) -> Void
    @State private var detent: BackdropSheetDetent = .medium

    var body: some View {
        // The sheet stops halfway down, so the body gets the top half of the screen.
        BackdropSheet(detent: $detent, mediumFraction: 0.5, revealFrom: .expanded) { rest in
            SessionBodyBackdrop(
                shades: shades,
                muscles: detail.bodyMuscles,
                musclesText: detail.hero.value?.musclesText,
                rest: rest
            )
            .equatable()
        } sheet: {
            LiftSessionSections(detail: detail, state: state, send: send)
                .pageColumn()
                .padding(.top, Space.xs)
                .padding(.bottom, Space.xxl)
        } overlay: { sheet in
            SessionBodyOverlay(sheet: sheet, title: detail.hero.value?.title ?? "") { detent = .medium }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .keepsSwipeBack()
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
    }
}

/// Over the body and the sheet: the bar's solid background once the sheet is up, Back, and the title.
private struct SessionBodyOverlay: View {
    let sheet: BackdropSheetState
    let title: String
    let onLower: () -> Void
    @Environment(\.koboTheme) private var theme
    @Environment(\.dismiss) private var dismiss

    /// How far the bar has turned solid: 0 until the sheet's top is near the bar, 1 when it is under it.
    private var barProgress: Double {
        BackdropSheetMath.unit(Double(sheet.sheetTop), from: Double(sheet.topInset + 96), to: Double(sheet.topInset))
    }

    var body: some View {
        ZStack(alignment: .top) { barBackground }
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
            .opacity(
                BackdropSheetMath.unit(
                    Double(sheet.sheetTop),
                    from: Double(sheet.topInset + Space.xxl),
                    to: Double(sheet.topInset)
                )
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .allowsHitTesting(false)
    }

    /// Back while the body shows; a chevron down that lowers the sheet once it is up. The chevron turns as it changes.
    private var backButton: some View {
        let isUp = barProgress > 0.5
        return Button {
            if isUp { onLower() } else { dismiss() }
        } label: {
            Image(systemName: "chevron.left")
                .rotationEffect(.degrees(-90 * barProgress))
        }
        .accessibilityLabel(isUp ? Text("Show muscles") : Text("Back"))
        .tint(theme.palette.textPrimary)
    }
}

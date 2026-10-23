import KoboTokens
import SwiftUI

/// A page whose content is a sheet over a backdrop that fills the screen (a map, a photo), as in Maps and Strava. The
/// sheet rests at three heights. One drag moves the sheet and, once it is fully up, scrolls its content; a drag down
/// from the content's top brings the sheet back down. A release settles with a quick spring that keeps the finger's
/// speed. The backdrop shows, and takes touches, only above the sheet. `overlay` draws controls over both and gets the
/// sheet's position every frame; `backdrop` gets it only when the sheet is let go or rests, so a map can move its
/// camera in step with the settle. Set `detent` to move the sheet; the sheet writes it back when it comes to rest.
///
///     BackdropSheet(detent: $detent) { rest in
///         RouteMap(route, rest: rest)
///     } sheet: {
///         Details()
///     } overlay: { state in
///         Text("Title").opacity(state.expansion)
///     }
public struct BackdropSheet<Backdrop: View, Sheet: View, Overlay: View>: View {
    @Binding private var detent: BackdropSheetDetent
    private let revealFrom: BackdropSheetDetent?
    private let backdrop: (BackdropSheetRest) -> Backdrop
    private let sheet: Sheet
    private let overlay: (BackdropSheetState) -> Overlay
    @State private var model: BackdropSheetModel

    /// - Parameters:
    ///   - mediumFraction: the medium sheet's top, as a fraction of the screen's height.
    ///   - peek: how much of the collapsed sheet shows above the screen's bottom edge.
    ///   - revealFrom: where the sheet first shows; it then glides to `detent` (a sheet that drops to show the backdrop).
    public init(
        detent: Binding<BackdropSheetDetent>,
        mediumFraction: Double = 0.42,
        peek: CGFloat = 104,
        revealFrom: BackdropSheetDetent? = nil,
        @ViewBuilder backdrop: @escaping (BackdropSheetRest) -> Backdrop,
        @ViewBuilder sheet: () -> Sheet,
        @ViewBuilder overlay: @escaping (BackdropSheetState) -> Overlay
    ) {
        _detent = detent
        self.revealFrom = revealFrom
        self.backdrop = backdrop
        self.sheet = sheet()
        self.overlay = overlay
        let model = BackdropSheetModel()
        model.mediumFraction = mediumFraction
        model.peek = peek
        _model = State(initialValue: model)
    }

    public var body: some View {
        GeometryReader { proxy in
            let frame = BackdropSheetFrame(
                size: CGSize(
                    width: proxy.size.width + proxy.safeAreaInsets.leading + proxy.safeAreaInsets.trailing,
                    height: proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom
                ),
                topInset: proxy.safeAreaInsets.top,
                bottomInset: proxy.safeAreaInsets.bottom
            )
            ZStack(alignment: .top) {
                scroller(frame)
                BackdropClip(model: model) { backdrop(model.rest) }
                BackdropOverlay(model: model, overlay: overlay)
            }
            .frame(width: frame.size.width, height: frame.size.height, alignment: .top)
            .ignoresSafeArea()
            .onChange(of: frame, initial: true) { _, new in model.frame = new }
        }
    }

    @ViewBuilder private func scroller(_ frame: BackdropSheetFrame) -> some View {
        #if os(iOS)
            BackdropSheetScroller(model: model, detent: $detent, revealFrom: revealFrom, frame: frame, sheet: sheet)
        #else
            ScrollView {
                BackdropSheetHost(
                    model: model,
                    theme: .system,
                    calendar: .current,
                    locale: .current,
                    timeZone: .current,
                    content: sheet
                )
            }
        #endif
    }
}

/// The backdrop, shown only above the sheet: the clip follows the sheet every frame, the backdrop itself is not redrawn.
private struct BackdropClip<Content: View>: View {
    /// How dark the sheet's shadow is at its edge, as a share of the scrim: just enough to set the sheet apart from the map.
    private static var shadow: Double { 0.3 }

    @Environment(\.koboTheme) private var theme
    let model: BackdropSheetModel
    @ViewBuilder let content: Content

    var body: some View {
        let top = model.state.sheetTop
        content
            .frame(width: model.frame.size.width, height: model.frame.size.height)
            .frame(height: max(0, top + Radius.lg), alignment: .top)
            // The sheet's shadow, on the backdrop just above the sheet's edge (the backdrop is drawn over the sheet).
            .overlay(alignment: .bottom) {
                VStack(spacing: 0) {
                    LinearGradient(
                        colors: [theme.palette.scrim.opacity(0), theme.palette.scrim.opacity(Self.shadow)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: Space.md)
                    // Beside the sheet's round corners.
                    theme.palette.scrim.opacity(Self.shadow).frame(height: Radius.lg)
                }
                .allowsHitTesting(false)
            }
            .clipShape(AboveSheetShape(sheetTop: top, radius: Radius.lg))
            .contentShape(AboveSheetShape(sheetTop: top, radius: Radius.lg))
            .opacity(model.isPlaced ? 1 : 0)
    }
}

/// The caller's controls, given the sheet's position every frame. They are not built before the sheet is placed, so
/// their first frame already matches it (no transition out of a state the sheet was never in).
private struct BackdropOverlay<Overlay: View>: View {
    let model: BackdropSheetModel
    let overlay: (BackdropSheetState) -> Overlay

    var body: some View {
        if model.isPlaced {
            overlay(model.state)
                .frame(width: model.frame.size.width, height: model.frame.size.height, alignment: .top)
        }
    }
}

/// The hosted sheet: the canvas with round top corners and a grabber, filling the scroll view's sheet area. It gets
/// the page's theme, calendar and locale by hand, as a hosting controller does not inherit SwiftUI's environment.
struct BackdropSheetHost<Content: View>: View {
    let model: BackdropSheetModel
    let theme: Theme
    let calendar: Calendar
    let locale: Locale
    let timeZone: TimeZone
    let content: Content

    var body: some View {
        BackdropSheetBody(model: model) { content }
            .environment(\.koboTheme, theme)
            .environment(\.calendar, calendar)
            .environment(\.locale, locale)
            .environment(\.timeZone, timeZone)
    }
}

private struct BackdropSheetBody<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    let model: BackdropSheetModel
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            BackdropSheetGrabber(model: model)
            content
        }
        .padding(.bottom, model.frame.bottomInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: Radius.lg, topTrailingRadius: Radius.lg, style: .continuous)
                .fill(theme.palette.canvas)
                .shadow(color: theme.palette.scrim.opacity(0.35), radius: Space.sm, y: -Size.hairline * 2)
        }
    }
}

/// The handle; for VoiceOver, one adjustable element that raises or lowers the sheet.
private struct BackdropSheetGrabber: View {
    @Environment(\.koboTheme) private var theme
    let model: BackdropSheetModel

    var body: some View {
        Capsule()
            .fill(theme.palette.textTertiary.opacity(0.5))
            .frame(width: Size.grabberWidth, height: Size.grabberHeight)
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xs)
            .frame(maxWidth: .infinity)
            .accessibilityElement()
            .accessibilityLabel(Text("Sheet", bundle: .module))
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: model.step(1)
                case .decrement: model.step(-1)
                @unknown default: break
                }
            }
    }
}

/// The screen above the sheet: a rectangle down to the sheet's top, with the sheet's round corners cut in.
private nonisolated struct AboveSheetShape: Shape {
    var sheetTop: CGFloat
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let top = max(sheetTop, 0)
        var path = Path()
        path.move(to: .zero)
        path.addLine(to: CGPoint(x: rect.maxX, y: 0))
        path.addLine(to: CGPoint(x: rect.maxX, y: top + radius))
        path.addArc(
            tangent1End: CGPoint(x: rect.maxX, y: top),
            tangent2End: CGPoint(x: rect.maxX - radius, y: top),
            radius: radius
        )
        path.addLine(to: CGPoint(x: radius, y: top))
        path.addArc(tangent1End: CGPoint(x: 0, y: top), tangent2End: CGPoint(x: 0, y: top + radius), radius: radius)
        path.closeSubpath()
        return path
    }
}

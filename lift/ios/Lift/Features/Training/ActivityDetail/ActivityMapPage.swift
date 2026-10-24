import KoboComponents
import KoboTokens
import MapKit
import SwiftUI

/// An outdoor activity as Strava shows it: the route on a map that fills the screen, under a sheet with the page. It
/// opens in this layout from the first frame (the list said the activity is outdoors): the sheet covers the screen with
/// the name and a skeleton, and drops to show the map once the page has loaded. It rests at three heights; fully up,
/// its content scrolls under a solid bar titled with the sport, where the back button turns into a chevron down that
/// lowers the sheet. With the sheet down the map shows its layers and 3D buttons.
struct ActivityMapPage: View {
    /// The route; nil until the page has loaded.
    let route: ActivityRoute?
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void
    @State private var detent: BackdropSheetDetent
    @State private var mapType: ActivityMapType = .standard
    @State private var isThreeD = false
    /// The metric the route is coloured by (`route.colored`); nil is the sport's colour.
    @State private var metricKey: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Shown already loaded (a kept copy): the sheet drops as the page appears, not when the server answers.
    private let opensLoaded: Bool
    /// The page's content in place of the skeleton. On a first open it waits until the sheet has dropped, so the drop
    /// runs with the light skeleton and the content (charts and all) fades in after it.
    @State private var showsContent: Bool

    init(route: ActivityRoute?, state: ActivityDetailState, send: @escaping (ActivityDetailAction) -> Void) {
        self.route = route
        self.state = state
        self.send = send
        let isLoaded = state.detail.content.value != nil
        opensLoaded = isLoaded
        _detent = State(initialValue: isLoaded ? .medium : .expanded)
        _showsContent = State(initialValue: isLoaded)
    }

    private var header: ActivityHeader? { state.detail.content.value?.header?.value }
    private var isLoaded: Bool { state.detail.content.value != nil }
    /// Nothing will drop: a failure or "not connected" shows in the sheet at once.
    private var isSettledWithout: Bool {
        switch state.detail.content {
        case .loading, .loaded: false
        case .empty, .failed: true
        }
    }

    var body: some View {
        BackdropSheet(detent: $detent, revealFrom: opensLoaded ? .expanded : nil) { rest in
            ActivityRouteMap(
                route: route ?? ActivityRoute(points: []),
                color: (header?.sportStyle ?? state.seed?.sport ?? .other).color,
                rest: rest,
                type: mapType,
                isThreeD: isThreeD,
                metric: route?.colored?.metric(metricKey)
            )
            .equatable()
        } sheet: {
            // The sheet is hosted by UIKit, so the crossfade is set here, on the value, not by the caller's transaction.
            ZStack(alignment: .top) {
                if showsContent || isSettledWithout {
                    content
                        .transition(Motion.crossFade(reduceMotion: reduceMotion))
                } else {
                    ActivityDetailSkeleton(seed: state.seed)
                        .pageColumn()
                        .padding(.top, Space.xs)
                        .transition(Motion.crossFade(reduceMotion: reduceMotion))
                }
            }
            .koboAnimation(.crossfade, value: showsContent || isSettledWithout)
        } overlay: { sheet in
            ActivityMapOverlay(
                sheet: sheet,
                title: header?.typeText ?? state.seed?.typeText ?? "",
                isLoaded: showsContent,
                mapType: $mapType,
                isThreeD: $isThreeD,
                metrics: route?.colored?.metrics ?? [],
                metricKey: $metricKey,
                onLower: { detent = .medium }
            )
            .onChange(of: sheet.resting) { _, resting in
                // The sheet has come to rest after the drop (or wherever a finger left it): now the content.
                if isLoaded, resting != nil { showsContent = true }
            }
        }
        // The page has loaded: drop the sheet to show the map; if a finger already moved it, show the content now.
        .onChange(of: isLoaded) { _, loaded in
            guard loaded else { return }
            if detent == .expanded { detent = .medium } else { showsContent = true }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .keepsSwipeBack()
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
    }

    private var content: some View {
            AppResourcePage(
                state.detail,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { detail in
                ActivitySections(
                    detail: detail,
                    plan: state.plan,
                    feedback: state.shownFeedback,
                    save: state.feedback.save,
                    send: send
                )
            } placeholder: {
                ActivityDetailSkeleton(seed: state.seed)
            }
            .pageColumn()
            .padding(.top, Space.xs)
            .padding(.bottom, Space.xxl)
    }
}

/// What sits over the map and the sheet: the bar's solid background once the sheet is up, the bar's back button and
/// title, and the layers and 3D buttons while the sheet is down.
private struct ActivityMapOverlay: View {
    let sheet: BackdropSheetState
    let title: String
    /// Until the page has loaded, the sheet covers the map: the bar keeps Back and shows no title.
    let isLoaded: Bool
    @Binding var mapType: ActivityMapType
    @Binding var isThreeD: Bool
    let metrics: [ActivityRouteColors.Metric]
    @Binding var metricKey: String?
    let onLower: () -> Void
    @Environment(\.koboTheme) private var theme
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How far the bar has turned solid: 0 until the sheet's top is near the bar, 1 when it is under it.
    private var barProgress: Double {
        guard isLoaded else { return 0 }
        return BackdropSheetMath.unit(Double(sheet.sheetTop), from: Double(sheet.topInset + 96), to: Double(sheet.topInset))
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

    /// Layers, colour and 3D in one glass pill under the bar's "…", and the colour's scale on the left.
    @ViewBuilder private var mapButtons: some View {
        if showsMapButtons {
            ActivityMapControls(mapType: $mapType, isThreeD: $isThreeD, metrics: metrics, metricKey: $metricKey)
                .padding(.top, sheet.topInset + Space.xxs)
                // In line with the bar's "…": the bar keeps its buttons 20 points from the edge.
                .padding(.trailing, Space.xl)
                .transition(Motion.pop(reduceMotion: reduceMotion))
            if let metric = metrics.first(where: { $0.key == metricKey }) {
                ActivityRouteLegend(metric: metric)
                    .padding(.top, sheet.topInset + Space.xxs)
                    .padding(.leading, Space.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(Motion.pop(reduceMotion: reduceMotion))
            }
        }
    }
}

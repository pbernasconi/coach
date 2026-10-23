import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The check-in right after a workout finishes: "How hard was it?" on a 1–10 dial, then "How did it feel?" with five
/// faces, then Save. Skip closes it at any step; the summary's "How it felt" row opens it again.
struct WorkoutCheckInSheet: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let checkIn: WorkoutCheckIn
    let send: (WorkoutCheckInAction) -> Void

    var body: some View {
        VStack(spacing: Space.lg) {
            topBar
            Group {
                switch checkIn.step {
                case .effort:
                    EffortStep(feedback: checkIn.feedback) { send(.effortChanged($0)) }
                        .transition(.push(from: .leading))
                case .feel:
                    FeelStep(feedback: checkIn.feedback) { send(.feelTapped($0)) }
                        .transition(.push(from: .trailing))
                }
            }
            .frame(maxHeight: .infinity)
            primary
        }
        .padding(.horizontal, Space.gutter)
        .padding(.top, Space.md)
        .padding(.bottom, Space.sm)
        .background(alignment: .bottom) {
            // A warm glow rising from the bottom, as the Live Activity's resting tint.
            LinearGradient(colors: [theme.palette.accentSoft, .clear], startPoint: .bottom, endPoint: .center)
                .ignoresSafeArea()
                .accessibilityHidden(true)
        }
        .animation(Motion.defaultSpatial.animation(reduceMotion: reduceMotion), value: checkIn.step)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(theme.palette.surface)
    }

    private var topBar: some View {
        HStack {
            if checkIn.step == .feel {
                Button("Back", systemImage: "chevron.left") { send(.backTapped) }
                    .labelStyle(.titleAndIcon)
            }
            Spacer(minLength: Space.sm)
            Text("\(stepNumber) of 2")
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textTertiary)
            Spacer(minLength: Space.sm)
            Button("Skip") { send(.skipTapped) }
        }
        .font(theme.font(.body))
        .foregroundStyle(theme.palette.accentText)
        .frame(minHeight: Size.minTouch)
    }

    private var stepNumber: Int { checkIn.step == .effort ? 1 : 2 }

    @ViewBuilder private var primary: some View {
        switch checkIn.step {
        case .effort:
            Button("Next") { send(.nextTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        case .feel:
            Button("Save") { send(.saveTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
                .disabled(!checkIn.canSave)
        }
    }
}

/// "How hard was it?": the dial, and under it the effort's word and what it feels like.
private struct EffortStep: View {
    @Environment(\.koboTheme) private var theme
    let feedback: WorkoutFeedback
    let onChange: (Int) -> Void

    var body: some View {
        VStack(spacing: Space.xl) {
            Text("How hard was it?")
                .font(theme.font(.title2).weight(.bold))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            EffortDial(value: feedback.rpe, onChange: onChange)
            VStack(spacing: Space.xs) {
                if let step = feedback.rpeStep {
                    Text(verbatim: step.label)
                        .font(theme.font(.title2).weight(.bold))
                        .foregroundStyle(EffortTone.color(step.value, theme: theme))
                    Text(verbatim: step.detail)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .multilineTextAlignment(.center)
                } else {
                    Text("Drag round the dial")
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(minHeight: EffortDialMetrics.captionHeight, alignment: .top)
            .contentTransition(.opacity)
        }
    }
}

/// "How did it feel?": five large faces in a row, the picked one bigger with its word under the row.
private struct FeelStep: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var faceSize = EffortDialMetrics.face
    let feedback: WorkoutFeedback
    let onTap: (Int) -> Void

    var body: some View {
        VStack(spacing: Space.xl) {
            Text("How did it feel?")
                .font(theme.font(.title2).weight(.bold))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 0) {
                ForEach(Array(SummaryFaces.faces.enumerated()), id: \.offset) { index, face in
                    let value = index + 1
                    let isOn = feedback.feel == value
                    Button {
                        onTap(value)
                    } label: {
                        Text(verbatim: face)
                            .font(.system(size: faceSize))
                            .saturation(isOn || feedback.feel == nil ? 1 : 0)
                            .opacity(isOn || feedback.feel == nil ? 1 : 0.4)
                            .scaleEffect(isOn ? 1.3 : 1)
                            .frame(maxWidth: .infinity, minHeight: faceSize * 1.6)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressFeedback)
                    .accessibilityLabel(Text(verbatim: label(value)))
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
            .animation(Motion.fastSpatial.animation(reduceMotion: reduceMotion), value: feedback.feel)
            .koboFeedback(.selection, trigger: feedback.feel)
            Text(verbatim: feedback.feelLabel ?? String(localized: "Tap a face"))
                .font(theme.font(feedback.feel == nil ? .subheadline : .title2).weight(feedback.feel == nil ? .regular : .bold))
                .foregroundStyle(feedback.feel == nil ? theme.palette.textSecondary : theme.palette.textPrimary)
                .frame(minHeight: EffortDialMetrics.captionHeight, alignment: .top)
                .contentTransition(.opacity)
            if let step = feedback.rpeStep {
                Text("Effort \(step.value) · \(step.label)")
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textTertiary)
            }
        }
    }

    private func label(_ value: Int) -> String {
        feedback.feelLabels.indices.contains(value - 1) ? feedback.feelLabels[value - 1] : String(value)
    }
}

/// The effort dial: a 270° arc open at the bottom, a dot for each step, the arc filled up to the effort in calm blue
/// to red, a knob you drag round it, and the number large in the middle. A tap on the arc jumps there; VoiceOver
/// adjusts it up and down.
struct EffortDial: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize = EffortDialMetrics.number
    let value: Int?
    let onChange: (Int) -> Void

    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            let radius = side / 2 - EffortDialMetrics.line / 2  // the stroke's centre line
            let center = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)
            ZStack {
                arc(to: 1)
                    .stroke(theme.palette.surfaceSunken, style: stroke)
                if let value {
                    arc(to: EffortDialMath.fraction(value))
                        .stroke(gradient, style: stroke)
                }
                ForEach(1...10, id: \.self) { step in
                    Circle()
                        .fill(isFilled(step) ? theme.palette.surface.opacity(0.9) : theme.palette.textTertiary.opacity(0.5))
                        .frame(width: EffortDialMetrics.tick, height: EffortDialMetrics.tick)
                        .position(EffortDialMath.point(step, center: center, radius: radius))
                }
                if let value {
                    Circle()
                        .fill(theme.palette.surface)
                        .overlay { Circle().strokeBorder(EffortTone.color(value, theme: theme), lineWidth: EffortDialMetrics.knobRing) }
                        .shadow(color: theme.palette.scrim, radius: Space.xs, y: Space.xxs)
                        .frame(width: EffortDialMetrics.knob, height: EffortDialMetrics.knob)
                        .position(EffortDialMath.point(value, center: center, radius: radius))
                }
                VStack(spacing: 0) {
                    Text(verbatim: value.map(String.init) ?? "–")
                        .font(.system(size: numberSize, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(value.map { EffortTone.color($0, theme: theme) } ?? theme.palette.textTertiary)
                        .contentTransition(.numericText(value: Double(value ?? 0)))
                    Text("of 10")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textTertiary)
                }
                .position(center)
                HStack {
                    Text(verbatim: "1")
                    Spacer()
                    Text(verbatim: "10")
                }
                .font(theme.font(.footnote).weight(.semibold).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
                .frame(width: radius * 1.1)
                .position(x: center.x, y: center.y + radius * 0.78)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        let next = EffortDialMath.value(at: drag.location, center: center, last: value)
                        if next != value { onChange(next) }
                    }
            )
        }
        .frame(width: EffortDialMetrics.side, height: EffortDialMetrics.side)
        .koboFeedback(.selection, trigger: value)
        .animation(Motion.fastSpatial.animation(reduceMotion: reduceMotion), value: value)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Effort"))
        .accessibilityValue(value.map { Text("\($0) of 10") } ?? Text("Not set"))
        .accessibilityAdjustableAction { direction in
            let now = value ?? 0
            switch direction {
            case .increment: if now < 10 { onChange(now + 1) }
            case .decrement: if now > 1 { onChange(now - 1) }
            @unknown default: break
            }
        }
    }

    private var stroke: StrokeStyle {
        StrokeStyle(lineWidth: EffortDialMetrics.line, lineCap: .round)
    }

    private var gradient: AngularGradient {
        AngularGradient(
            colors: [theme.palette.info.ink, theme.palette.success.ink, theme.palette.warning.ink, theme.palette.accent, theme.palette.danger.ink],
            center: .center,
            startAngle: .degrees(EffortDialMath.start),
            endAngle: .degrees(EffortDialMath.start + EffortDialMath.sweep)
        )
    }

    /// The arc from the bottom left, `fraction` of the way round to the bottom right.
    private func arc(to fraction: Double) -> some Shape {
        Circle()
            .inset(by: EffortDialMetrics.line / 2)
            .trim(from: 0, to: EffortDialMath.sweep / 360 * fraction)
            .rotation(.degrees(EffortDialMath.start))
    }

    private func isFilled(_ step: Int) -> Bool {
        guard let value else { return false }
        return step <= value
    }
}

/// The dial's sizes (layout constants, not colours).
nonisolated enum EffortDialMetrics {
    static let side: CGFloat = 260
    static let line: CGFloat = 22
    static let tick: CGFloat = 6
    static let knob: CGFloat = 34
    static let knobRing: CGFloat = 5
    static let number: CGFloat = 84
    static let face: CGFloat = 44
    /// Room for the word and its line, so the page never jumps.
    static let captionHeight: CGFloat = 56
}

/// The dial's geometry: 1 at the bottom left (135°), 10 at the bottom right, clockwise over 270°.
nonisolated enum EffortDialMath {
    static let start: Double = 135
    static let sweep: Double = 270

    /// 0 for 1, 1 for 10.
    static func fraction(_ value: Int) -> Double {
        Double(min(max(value, 1), 10) - 1) / 9
    }

    static func point(_ value: Int, center: CGPoint, radius: CGFloat) -> CGPoint {
        let angle = (start + sweep * fraction(value)) * .pi / 180
        return CGPoint(x: center.x + radius * cos(angle), y: center.y + radius * sin(angle))
    }

    /// The step nearest a touch. In the gap at the bottom it holds the nearer end, so a drag past 10 stays on 10.
    static func value(at location: CGPoint, center: CGPoint, last: Int?) -> Int {
        let degrees = atan2(location.y - center.y, location.x - center.x) * 180 / .pi
        var along = (degrees - start).truncatingRemainder(dividingBy: 360)
        if along < 0 { along += 360 }
        if along > sweep {
            // The gap: below the middle, keep to the side the touch is on.
            along = location.x < center.x ? 0 : sweep
        }
        return Int((along / sweep * 9).rounded()) + 1
    }
}

/// The effort's colour, as the "How did it feel" card's meter: 1–3 easy, 4–5 moderate, 6–7 hard, 8–10 very hard.
nonisolated enum EffortTone {
    @MainActor static func color(_ value: Int, theme: Theme) -> Color {
        switch value {
        case ...3: theme.palette.info.ink
        case 4...5: theme.palette.success.ink
        case 6...7: theme.palette.warning.ink
        default: theme.palette.danger.ink
        }
    }
}

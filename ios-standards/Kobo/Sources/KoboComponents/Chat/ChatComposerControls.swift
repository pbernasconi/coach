import KoboTokens
import SwiftUI

/// Talking into a `ChatComposer`: where listening stands, the input level (0…1) for the bars, and what a tap, a hold
/// and its release do. `onOpenSettings` adds the "turn it on in Settings" row while the phase is `.unavailable`.
public struct ChatVoice {
    public var phase: ChatVoiceInput.Phase
    public var level: Double
    public var onTap: () -> Void
    public var onHoldBegan: () -> Void
    public var onHoldEnded: () -> Void
    public var onOpenSettings: (() -> Void)?

    public init(
        phase: ChatVoiceInput.Phase,
        level: Double = 0,
        onTap: @escaping () -> Void,
        onHoldBegan: @escaping () -> Void,
        onHoldEnded: @escaping () -> Void,
        onOpenSettings: (() -> Void)? = nil
    ) {
        self.phase = phase
        self.level = level
        self.onTap = onTap
        self.onHoldBegan = onHoldBegan
        self.onHoldEnded = onHoldEnded
        self.onOpenSettings = onOpenSettings
    }
}

/// A round button of the composer: a solid circle (the accent for a send that can go, grey for an idle send or a
/// stop), or a bare glyph (the + and the microphone at rest). Never glass. The visible circle is 40 pt; the target
/// stays at least 44 pt.
struct ChatRoundButton: View {
    enum Look { case accent, quiet, dimmed, bare, muted }

    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var circle = Size.buttonHeightCompact + Space.xs
    let systemImage: String
    let label: Text
    let look: Look
    let action: () -> Void

    var body: some View {
        Button(action: action) { ChatRoundGlyph(systemImage: systemImage, look: look, circle: circle) }
            .buttonStyle(.plain)
            .pressFeedback()
            .disabled(look == .dimmed || look == .muted)
            .accessibilityLabel(label)
            .transition(Motion.pop(reduceMotion: reduceMotion))
    }
}

/// The circle and its glyph, shared by the buttons and the microphone.
struct ChatRoundGlyph: View {
    @Environment(\.koboTheme) private var theme
    let systemImage: String
    let look: ChatRoundButton.Look
    let circle: CGFloat

    var body: some View {
        Image(systemName: systemImage)
            .accessibilityHidden(true)  // the button around it carries the label
            .font(glyphFont)
            .foregroundStyle(ink)
            .frame(width: circle, height: circle)
            .background(fill, in: Circle())
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
            .contentShape(Rectangle())
    }

    /// The bare glyphs are light and large; the filled circles' glyphs regular (quiet) or semibold.
    private var glyphFont: Font {
        if look == .bare { return theme.font(.title2).weight(.light) }
        return theme.font(.body).weight(look == .quiet ? .regular : .semibold)
    }

    private var ink: Color {
        switch look {
        case .accent: theme.palette.onAccent
        case .quiet: theme.palette.textPrimary
        case .dimmed: theme.palette.textTertiary
        case .bare: theme.palette.textSecondary
        case .muted: theme.palette.accentText.opacity(0.55)
        }
    }

    private var fill: Color {
        switch look {
        case .accent: theme.palette.accent
        case .quiet: theme.palette.surfaceRaised
        case .dimmed: theme.palette.surfaceSunken
        case .bare: .clear
        case .muted: theme.palette.accentSoft
        }
    }
}

/// The microphone: a tap starts or stops listening; a press held past a tap starts holding. While it listens the
/// circle turns to the accent with a stop glyph. The release of a hold is tracked by `ChatComposer`, which stays put
/// while this button moves from the capsule into the card.
struct ChatMicButton: View {
    @ScaledMetric(relativeTo: .body) private var circle = Size.buttonHeightCompact + Space.xs
    let phase: ChatVoiceInput.Phase
    /// In the open card's toolbar: a filled round button; in the capsule: a bare glyph.
    var isFilled = false
    let onTap: () -> Void
    let onHoldBegan: () -> Void

    private var isListening: Bool { phase == .listening || phase == .holding }

    var body: some View {
        Button(action: onTap) {
            ChatRoundGlyph(
                systemImage: isListening ? "stop.fill" : "mic",
                look: isListening ? .accent : (isFilled ? .quiet : .bare),
                circle: circle
            )
        }
        .buttonStyle(.plain)
        .simultaneousGesture(LongPressGesture(minimumDuration: 0.35).onEnded { _ in onHoldBegan() })
        .koboFeedback(isListening ? .toggleOn : .toggleOff, trigger: isListening)
        .accessibilityLabel(isListening ? Text("Stop listening", bundle: .module) : Text("Dictate", bundle: .module))
        .accessibilityHint(Text("Hold to talk, release to send", bundle: .module))
    }
}

/// Five bars that follow the input level, then what the microphone is doing. With Reduce Motion the bars stand still.
struct ChatVoiceLevel: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var height = Space.lg
    let phase: ChatVoiceInput.Phase
    let level: Double

    var body: some View {
        HStack(spacing: Space.sm) {
            HStack(alignment: .center, spacing: Space.xxs) {
                ForEach(Array([0.5, 0.8, 1, 0.75, 0.45].enumerated()), id: \.offset) { _, weight in
                    Capsule()
                        .fill(theme.palette.accent)
                        .frame(width: Space.xs - 1, height: max(Space.xs, height * min(1, level * 1.6) * weight))
                }
            }
            .frame(height: height)
            .koboAnimation(.instant, value: level)
            .accessibilityHidden(true)
            (phase == .holding ? Text("Release to send", bundle: .module) : Text("Listening…", bundle: .module))
                .font(theme.font(.footnote).weight(.medium))
                .foregroundStyle(theme.palette.textSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Why the microphone does nothing, and the way to fix it.
struct ChatVoiceDeniedRow: View {
    @Environment(\.koboTheme) private var theme
    let openSettings: () -> Void

    var body: some View {
        Button(action: openSettings) {
            HStack(spacing: Space.xs) {
                Image(systemName: "mic.slash").accessibilityHidden(true)
                Text("Microphone is off for this app. Turn it on in Settings", bundle: .module)
                    .fixedSize(horizontal: false, vertical: true)
                Image(systemName: "chevron.right").font(theme.font(.caption)).accessibilityHidden(true)
            }
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

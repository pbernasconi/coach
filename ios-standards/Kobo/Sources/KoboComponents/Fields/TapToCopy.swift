import KoboTokens
import SwiftUI

extension View {
    /// Makes this view copy `value` on a tap: the value dims for a moment, a small check appears after it, the success
    /// haptic plays and the copy is confirmed (the app's toast via `copyConfirmationToasts`, else a VoiceOver
    /// announcement). VoiceOver also gets a named "Copy …" action. A `nil` value (a masked number the user may not
    /// copy) changes nothing. Writes go through `\.pasteboardWriter`.
    ///
    ///     Text(code).tapToCopy(code, what: "setup key", showsGlyph: true)
    ///
    /// - Parameters:
    ///   - what: names the value ("routing number") for the confirmation and the VoiceOver action.
    ///   - showsGlyph: puts a small copy glyph after the value, so a bare value shows that it copies.
    public func tapToCopy(_ value: String?, what: LocalizedStringResource? = nil, showsGlyph: Bool = false) -> some View {
        modifier(TapToCopyModifier(value: value, what: what.map { String(localized: $0) }, showsGlyph: showsGlyph))
    }
}

/// The copy wording: "Copy setup key", "Setup key copied", or "Copy" and "Copied" with no name.
enum CopySpeech {
    static func actionName(what: String?) -> Text {
        guard let what, !what.isEmpty else { return Text("Copy", bundle: .module) }
        return Text("Copy \(what)", bundle: .module)
    }

    static func confirmation(what: String?) -> String {
        guard let what, !what.isEmpty else { return String(localized: "Copied", bundle: .module) }
        return String(localized: "\(CopyRules.capitalizedFirst(what)) copied", bundle: .module)
    }
}

struct TapToCopyModifier: ViewModifier {
    @Environment(\.pasteboardWriter) private var writer
    @Environment(\.copyConfirmation) private var confirmation
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var copies = 0
    @State private var isDimmed = false
    @State private var showsCheck = false
    let value: String?
    let what: String?
    let showsGlyph: Bool
    var clock: any Clock<Duration> = ContinuousClock()

    func body(content: Content) -> some View {
        if let value {
            Button {
                copy(value)
            } label: {
                TapToCopyLabel(showsGlyph: showsGlyph, showsCheck: showsCheck) { content }
            }
            .buttonStyle(.plain)
            .opacity(isDimmed ? CopyRules.dimmedOpacity : 1)
            .accessibilityAction(named: CopySpeech.actionName(what: what)) { copy(value) }
            .koboFeedback(copies == 0 ? nil : .success, trigger: copies)
            .task(id: copies) { await hideCheck(after: copies) }
        } else {
            content
        }
    }

    private func copy(_ value: String) {
        writer.write(value)
        copies += 1
        let message = CopySpeech.confirmation(what: what)
        if let confirmation {
            confirmation.show(message)
        } else {
            AccessibilityNotification.Announcement(message).post()
        }
        withKoboAnimation(.snappy, reduceMotion: reduceMotion) { showsCheck = true }
        guard !reduceMotion else { return }
        withAnimation(Motion.instant.animation) {
            isDimmed = true
        } completion: {
            withAnimation(Motion.exit.animation) { isDimmed = false }
        }
    }

    /// Each copy restarts the hold, so a second tap keeps the check up.
    private func hideCheck(after copy: Int) async {
        guard copy > 0 else { return }
        do {
            try await clock.sleep(for: CopyRules.checkHold)
        } catch {
            return
        }
        withKoboAnimation(.exit, reduceMotion: reduceMotion) { showsCheck = false }
    }
}

/// The value, and after it the copy glyph or, for a moment after a copy, the success check. The check never moves
/// the value: with no glyph it lies just after the value.
private struct TapToCopyLabel<Value: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var glyphSize = Size.iconSm
    let showsGlyph: Bool
    let showsCheck: Bool
    @ViewBuilder let value: Value

    var body: some View {
        if showsGlyph {
            HStack(spacing: Space.xs) {
                value
                ZStack {
                    if showsCheck {
                        check
                    } else {
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: glyphSize))
                            .foregroundStyle(theme.palette.textSecondary)
                            .transition(Motion.crossFade(reduceMotion: reduceMotion))
                    }
                }
                .accessibilityHidden(true)
            }
        } else {
            value.overlay(alignment: .trailing) {
                if showsCheck {
                    check
                        .offset(x: glyphSize + Space.sm)
                        .accessibilityHidden(true)
                }
            }
        }
    }

    private var check: some View {
        Image(systemName: "checkmark.circle.fill")
            .font(.system(size: glyphSize))
            .foregroundStyle(theme.palette.success.ink)
            .transition(Motion.pop(reduceMotion: reduceMotion))
    }
}

#if DEBUG
    #Preview("Tap to copy") {
        VStack(alignment: .leading, spacing: Space.lg) {
            Text(verbatim: "JBSWY3DPEHPK3PXP").font(.body.monospaced()).tapToCopy("JBSWY3DPEHPK3PXP", what: "setup key", showsGlyph: true)
            Text(verbatim: "121144269").tapToCopy("121144269", what: "member number")
        }
        .padding(Space.gutter)
    }
#endif

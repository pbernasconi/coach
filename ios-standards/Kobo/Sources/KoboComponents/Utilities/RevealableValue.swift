import KoboTokens
import SwiftUI

/// A sensitive value (a code, a key, a card number) that shows as a `MaskedValue` until the person taps the eye, then
/// shows the real text marked `privacySensitive`, so it hides in the app switcher and on a locked widget. The eye is a
/// real button with "Show" or "Hide"; the reveal cross-fades on `Motion.crossfade`.
///
///     @State private var isRevealed = false
///     RevealableValue(verbatim: apiKey, isRevealed: $isRevealed, visibleTail: 4)
public struct RevealableValue: View {
    @Environment(\.koboTheme) private var theme
    private let value: String
    private let isRevealed: Binding<Bool>
    private let visibleTail: Int
    private let mask: String

    /// - Parameters:
    ///   - visibleTail: how many trailing characters stay visible while masked; 0 hides them all.
    ///   - mask: the bullets drawn while masked.
    public init(verbatim value: String, isRevealed: Binding<Bool>, visibleTail: Int = 0, mask: String = "••••") {
        self.value = value
        self.isRevealed = isRevealed
        self.visibleTail = visibleTail
        self.mask = mask
    }

    public var body: some View {
        HStack(spacing: Space.xs) {
            ZStack(alignment: .leading) {
                if isRevealed.wrappedValue {
                    Text(verbatim: value)
                        .monospacedDigit()
                        .privacySensitive()
                        .textSelection(.enabled)
                        .transition(.opacity)
                } else {
                    MaskedValue(tail: tail, mask: mask).transition(.opacity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                isRevealed.wrappedValue.toggle()
            } label: {
                Image(systemName: isRevealed.wrappedValue ? "eye.slash" : "eye")
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.accentText)
                    .frame(width: Size.minTouch, height: Size.minTouch)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isRevealed.wrappedValue ? Text("Hide", bundle: .module) : Text("Show", bundle: .module))
        }
        .koboAnimation(.crossfade, value: isRevealed.wrappedValue)
    }

    private var tail: String? {
        visibleTail > 0 ? MaskedValueText.tail(of: value, count: visibleTail) : nil
    }
}

#if DEBUG
    private struct RevealableValuePreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var first = false
        @State private var second = true

        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                RevealableValue(verbatim: "sk-live-8f3a91c2", isRevealed: $first, visibleTail: 4)
                RevealableValue(verbatim: "482913", isRevealed: $second)
            }
            .font(theme.font(.body))
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Revealable value") { RevealableValuePreview() }
    #Preview("Revealable value · dark, Amber") {
        RevealableValuePreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Revealable value · AX3") { RevealableValuePreview().dynamicTypeSize(.accessibility3) }
#endif

import KoboTokens
import SwiftUI

/// One option of a question card: an outlined capsule, or, picked, a grey fill with a check before the label.
struct ChatChoiceChip: View {
    @Environment(\.koboTheme) private var theme
    let title: String
    var systemImage: String?
    let isPicked: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Space.xs) {
                if isPicked {
                    Image(systemName: "checkmark").font(theme.font(.caption).weight(.bold)).accessibilityHidden(true)
                } else if let systemImage {
                    Image(systemName: systemImage).font(theme.font(.caption)).accessibilityHidden(true)
                }
                Text(verbatim: title).fixedSize(horizontal: false, vertical: true)
            }
            .font(theme.font(.subheadline))
            .foregroundStyle(theme.palette.textPrimary)
            .padding(.horizontal, Space.md + Space.xxs)
            .padding(.vertical, Space.sm)
            .frame(minHeight: Size.buttonHeightCompact)
            .background(isPicked ? theme.palette.surfaceRaised : .clear, in: Capsule())
            .overlay { Capsule().strokeBorder(isPicked ? .clear : theme.palette.separator, lineWidth: Size.hairline * 2) }
            .frame(minHeight: Size.minTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .pressFeedback()
        .accessibilityAddTraits(isPicked ? .isSelected : [])
    }
}

/// A grey capsule with a text field and a clear button, then the round arrow that submits it (grey while empty).
struct ChatQuestionField: View {
    @Environment(\.koboTheme) private var theme
    @FocusState private var isFocused: Bool
    @Binding var text: String
    let placeholder: String
    var focusesAtOnce = false
    let onSubmit: () -> Void

    var body: some View {
        HStack(spacing: Space.xs) {
            HStack(spacing: Space.xs) {
                TextField(text: $text, prompt: Text(verbatim: placeholder).foregroundStyle(theme.palette.textTertiary)) {
                    Text(verbatim: placeholder)
                }
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textPrimary)
                .tint(theme.palette.accent)
                .focused($isFocused)
                .submitLabel(.send)
                .onSubmit { if ChatQuestionLogic.typed(text) != nil { onSubmit() } }
                if !text.isEmpty {
                    Button {
                        text = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(theme.palette.textTertiary)
                            .frame(minWidth: Size.minTouch - Space.md, minHeight: Size.minTouch - Space.md)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("Clear", bundle: .module))
                }
            }
            .padding(.leading, Space.md + Space.xxs)
            .padding(.trailing, Space.xs)
            .frame(minHeight: Size.minTouch)
            .background(theme.palette.surfaceRaised, in: Capsule())
            ChatSubmitArrow(isEnabled: ChatQuestionLogic.typed(text) != nil, action: onSubmit)
        }
        .onAppear { if focusesAtOnce { isFocused = true } }
    }
}

/// The round arrow that submits an answer: the accent once there is one, grey until then.
struct ChatSubmitArrow: View {
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        ChatRoundButton(
            systemImage: "arrow.up",
            label: Text("Send answer", bundle: .module),
            look: isEnabled ? .accent : .dimmed,
            action: action
        )
    }
}

/// "‹ 1 of 5 ›": where the reader is among several questions, with small round arrows to move between them.
struct ChatQuestionPager: View {
    @Environment(\.koboTheme) private var theme
    let index: Int
    let count: Int
    let onMove: (Int) -> Void

    var body: some View {
        HStack(spacing: Space.xxs) {
            arrow("chevron.left", label: Text("Previous question", bundle: .module), to: index - 1)
            Text("\(index + 1) of \(count)", bundle: .module)
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
            arrow("chevron.right", label: Text("Next question", bundle: .module), to: index + 1)
        }
        .accessibilityElement(children: .contain)
    }

    private func arrow(_ systemImage: String, label: Text, to target: Int) -> some View {
        let isEnabled = (0..<count).contains(target)
        return Button {
            onMove(target)
        } label: {
            Image(systemName: systemImage)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(isEnabled ? theme.palette.textSecondary : theme.palette.textTertiary)
                .frame(width: Size.iconLg, height: Size.iconLg)
                .background(theme.palette.surfaceRaised, in: Circle())
                .frame(minWidth: Size.minTouch - Space.sm, minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(label)
    }
}

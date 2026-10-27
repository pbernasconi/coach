import KoboTokens
import SwiftUI

/// The message field at the bottom of a chat: a capsule that grows to six lines, with one round button inside it at
/// the trailing edge that sends, or stops a reply in progress. The button hides while the draft is blank. Return adds a
/// line; the button sends. Under a glass theme the capsule is Liquid Glass, for a bar over the transcript; place it
/// with `.safeAreaBar(edge: .bottom)`. The keyboard's microphone dictates into it.
///
///     ChatComposer(text: $draft, prompt: "Message", isResponding: isWaiting, onSend: send, onStop: stop)
public struct ChatComposer: View {
    @Environment(\.koboTheme) private var theme
    private let text: Binding<String>
    private let prompt: Text
    private let isResponding: Bool
    private let onSend: () -> Void
    private let onStop: (() -> Void)?
    private var focus: FocusState<Bool>.Binding?

    /// A composer. `onStop` adds the stop button while `isResponding`; without it the send button waits, disabled.
    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil
    ) {
        self.init(text: text, prompt: Text(prompt), isResponding: isResponding, onSend: onSend, onStop: onStop)
    }

    /// A composer whose placeholder is runtime text ("Message Alex").
    public init(
        text: Binding<String>,
        verbatimPrompt: String,
        isResponding: Bool = false,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)? = nil
    ) {
        self.init(
            text: text,
            prompt: Text(verbatim: verbatimPrompt),
            isResponding: isResponding,
            onSend: onSend,
            onStop: onStop
        )
    }

    private init(
        text: Binding<String>,
        prompt: Text,
        isResponding: Bool,
        onSend: @escaping () -> Void,
        onStop: (() -> Void)?
    ) {
        self.text = text
        self.prompt = prompt
        self.isResponding = isResponding
        self.onSend = onSend
        self.onStop = onStop
    }

    /// Links the field to a screen's focus state (a quick prompt can fill it and raise the keyboard).
    public func focused(by binding: FocusState<Bool>.Binding) -> ChatComposer {
        var composer = self
        composer.focus = binding
        return composer
    }

    public var body: some View {
        ChatComposerField(text: text, prompt: prompt, focus: focus, button: button) {
            switch button {
            case .send(isEnabled: true):
                ChatComposerButton(systemImage: "arrow.up", label: Text("Send", bundle: .module), action: onSend)
            case .stop:
                ChatComposerButton(systemImage: "stop.fill", label: Text("Stop", bundle: .module)) { onStop?() }
            case .send(isEnabled: false), .waiting:
                EmptyView()
            }
        }
        .padding(.horizontal, Space.gutter)
        .padding(.vertical, Space.sm)
    }

    private var button: ChatComposerLogic.Button {
        ChatComposerLogic.button(draft: text.wrappedValue, isResponding: isResponding, canStop: onStop != nil)
    }
}

/// The round send or stop button inside the field: a solid accent circle, never glass (it sits on the field's glass).
/// The circle is 44 pt, the same as the target.
private struct ChatComposerButton: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var circle = Size.minTouch
    let systemImage: String
    let label: Text
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(theme.font(.subheadline).weight(.bold))
                .foregroundStyle(theme.palette.onAccent)
                .frame(width: circle, height: circle)
                .background(theme.palette.accent, in: Circle())
                .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .pressFeedback()
        .accessibilityLabel(label)
        .transition(Motion.pop(reduceMotion: reduceMotion))
    }
}

/// The growing field: a rounded glass shape under a glass theme, else the surface with a hairline.
private struct ChatComposerField<Trailing: View>: View {
    @Environment(\.koboTheme) private var theme
    @FocusState private var isFocused: Bool
    let text: Binding<String>
    let prompt: Text
    let focus: FocusState<Bool>.Binding?
    let button: ChatComposerLogic.Button
    @ViewBuilder let trailing: () -> Trailing

    /// Room for the button inside the field while it shows.
    private var showsButton: Bool {
        switch button {
        case .send(isEnabled: true), .stop: true
        case .send(isEnabled: false), .waiting: false
        }
    }

    var body: some View {
        TextField(text: text, prompt: prompt.foregroundStyle(theme.palette.textTertiary), axis: .vertical) { prompt }
            .labelsHidden()
            .lineLimit(1...6)
            .focused($isFocused)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textPrimary)
            .tint(theme.palette.accent)
            .padding(.leading, Space.lg)
            .padding(.trailing, showsButton ? Size.minTouch + Space.sm : Space.lg)
            .padding(.vertical, Space.md - Space.xxs)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch + Space.xs, alignment: .leading)
            .overlay(alignment: .bottomTrailing) { trailing().padding(Space.xxs) }
            .koboAnimation(.defaultEffects, value: showsButton)
            .modifier(ChatComposerSurface())
            .onChange(of: focus?.wrappedValue) { _, wanted in
                if let wanted, wanted != isFocused { isFocused = wanted }
            }
            .onChange(of: isFocused) { _, now in
                if let focus, focus.wrappedValue != now { focus.wrappedValue = now }
            }
    }
}

private struct ChatComposerSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.lg + Space.xxs)
        if theme.surfaceStyle == .glass {
            content.glassEffect(.regular.interactive(), in: shape)
        } else {
            content
                .background(theme.palette.surface, in: shape)
                .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
        }
    }
}

#if DEBUG
    private struct ChatComposerPreview: View {
        @State private var empty = ""
        @State private var draft = "Can we move the review to tomorrow morning?"

        var body: some View {
            VStack(spacing: Space.lg) {
                Spacer()
                ChatComposer(text: $empty, prompt: "Message", onSend: {})
                ChatComposer(text: $draft, prompt: "Message", onSend: {})
                ChatComposer(text: $empty, prompt: "Message", isResponding: true, onSend: {}, onStop: {})
            }
            .screenCanvas()
        }
    }

    #Preview("Composer") { ChatComposerPreview() }
    #Preview("Composer · dark, solid") {
        ChatComposerPreview().koboTheme(Theme(palette: .amber, surfaceStyle: .solid)).preferredColorScheme(.dark)
    }
    #Preview("Composer · AX3") { ChatComposerPreview().dynamicTypeSize(.accessibility3) }
#endif

import KoboTokens
import SwiftUI

/// The row above a number or decimal pad, which has no Return key: optional previous and next field arrows and a
/// Done button. Attach it to a field with `.keyboardAccessoryBar(onPrevious:onNext:onDone:)`, which puts it in the
/// system keyboard toolbar (iOS), or place the view itself above a custom keypad.
///
///     KoboTextField("Reps", text: $reps).keyboardType(.numberPad)
///         .keyboardAccessoryBar(onNext: { focus = .weight }, onDone: { focus = nil })
public struct KeyboardAccessoryBar: View {
    private let onPrevious: (() -> Void)?
    private let onNext: (() -> Void)?
    private let onDone: () -> Void

    /// - Parameters:
    ///   - onPrevious: moves focus to the previous field; `nil` hides both arrows unless `onNext` is set.
    ///   - onNext: moves focus to the next field; an arrow with no action shows disabled.
    ///   - onDone: ends editing.
    public init(onPrevious: (() -> Void)? = nil, onNext: (() -> Void)? = nil, onDone: @escaping () -> Void) {
        self.onPrevious = onPrevious
        self.onNext = onNext
        self.onDone = onDone
    }

    public var body: some View {
        HStack(spacing: Space.xs) {
            KeyboardArrowButtons(onPrevious: onPrevious, onNext: onNext)
            Spacer(minLength: Space.sm)
            KeyboardDoneButton(action: onDone)
        }
        .padding(.horizontal, Space.sm)
        .frame(maxWidth: .infinity, minHeight: Size.minTouch)
    }
}

/// The previous and next arrows of the bar, shared by the view and the keyboard toolbar. Hidden when neither has an
/// action; an arrow with no action shows disabled.
struct KeyboardArrowButtons: View {
    @Environment(\.koboTheme) private var theme
    let onPrevious: (() -> Void)?
    let onNext: (() -> Void)?

    var body: some View {
        if onPrevious != nil || onNext != nil {
            HStack(spacing: Space.xs) {
                arrow("chevron.up", label: Text("Previous field", bundle: .module), action: onPrevious)
                arrow("chevron.down", label: Text("Next field", bundle: .module), action: onNext)
            }
        }
    }

    private func arrow(_ systemImage: String, label: Text, action: (() -> Void)?) -> some View {
        Button {
            action?()
        } label: {
            Image(systemName: systemImage)
                .font(theme.font(.body).weight(.semibold))
                .foregroundStyle(action == nil ? theme.palette.textTertiary : theme.palette.accentText)
                .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .accessibilityLabel(label)
    }
}

/// The Done button of the bar.
struct KeyboardDoneButton: View {
    @Environment(\.koboTheme) private var theme
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("Done", bundle: .module)
                .font(theme.font(.body).weight(.semibold))
                .foregroundStyle(theme.palette.accentText)
                .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

extension View {
    /// Puts a `KeyboardAccessoryBar` above the keyboard while this field (or a field inside it) has focus. Use it on
    /// number, decimal and phone pads, which have no Return key. Off iOS it does nothing.
    public func keyboardAccessoryBar(
        onPrevious: (() -> Void)? = nil,
        onNext: (() -> Void)? = nil,
        onDone: @escaping () -> Void
    ) -> some View {
        #if os(iOS)
            toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    KeyboardArrowButtons(onPrevious: onPrevious, onNext: onNext)
                    Spacer()
                    KeyboardDoneButton(action: onDone)
                }
            }
        #else
            self
        #endif
    }
}

#if DEBUG
    private struct KeyboardAccessoryBarGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(spacing: Space.lg) {
                KeyboardAccessoryBar(onDone: {})
                KeyboardAccessoryBar(onPrevious: {}, onNext: {}, onDone: {})
                KeyboardAccessoryBar(onNext: {}, onDone: {})
            }
            .background(theme.palette.surfaceRaised)
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Keyboard accessory bar") { KeyboardAccessoryBarGallery() }
    #Preview("Keyboard accessory bar · dark") { KeyboardAccessoryBarGallery().preferredColorScheme(.dark) }
    #Preview("Keyboard accessory bar · AX3") { KeyboardAccessoryBarGallery().dynamicTypeSize(.accessibility3) }
#endif

import KoboTokens
import SwiftUI

/// A control for the system navigation bar or toolbar: a close ✕, a back chevron, or one action glyph. It draws no
/// fill of its own, because iOS 26 already draws a glass circle around each toolbar item; a filled circle inside it
/// would be glass inside glass. Close answers the Escape key on a hardware keyboard. While `isLoading` the glyph
/// becomes a spinner in the same place and taps are ignored. A header drawn in the content uses `IconButton(.glass)`.
///
///     .toolbar {
///         ToolbarItem(placement: .cancellationAction) { HeaderButton(.close) { dismiss() } }
///         ToolbarItem { HeaderButton(systemImage: "ellipsis", accessibilityLabel: "More options", action: more) }
///     }
public struct HeaderButton: View {
    /// The standard controls, with their own glyph and label.
    public enum Kind: Sendable, Equatable, CaseIterable {
        /// ✕: leaves a sheet or a flow. Answers Escape.
        case close
        /// ‹: one step back, for a screen that hides the system back button.
        case back
    }

    @Environment(\.koboTheme) private var theme
    @State private var taps = 0
    private let systemImage: String
    private let label: Text
    private let shortcut: KeyboardShortcut?
    private let isLoading: Bool
    private let playsHaptics: Bool
    private let action: () -> Void

    /// A close or back control with the library's own glyph and label.
    public init(_ kind: Kind, isLoading: Bool = false, playsHaptics: Bool = true, action: @escaping () -> Void) {
        switch kind {
        case .close:
            self.systemImage = "xmark"
            self.label = Text("Close", bundle: .module)
            self.shortcut = .cancelAction
        case .back:
            self.systemImage = "chevron.backward"
            self.label = Text("Back", bundle: .module)
            self.shortcut = nil
        }
        self.isLoading = isLoading
        self.playsHaptics = playsHaptics
        self.action = action
    }

    /// One action glyph. The label is required: VoiceOver has nothing else to read.
    public init(
        systemImage: String,
        accessibilityLabel: LocalizedStringKey,
        isLoading: Bool = false,
        playsHaptics: Bool = true,
        action: @escaping () -> Void
    ) {
        self.systemImage = systemImage
        self.label = Text(accessibilityLabel)
        self.shortcut = nil
        self.isLoading = isLoading
        self.playsHaptics = playsHaptics
        self.action = action
    }

    public var body: some View {
        Button {
            guard !isLoading else { return }
            taps += 1
            action()
        } label: {
            ZStack {
                Image(systemName: systemImage)
                    .font(theme.font(.body).weight(.semibold))
                    .opacity(isLoading ? 0 : 1)
                if isLoading { ProgressView().controlSize(.small) }
            }
            .foregroundStyle(theme.palette.textPrimary)
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
            .contentShape(Rectangle())
            .accessibilityHidden(true)
        }
        .disabled(isLoading)
        .keyboardShortcut(shortcut)
        .koboFeedback(playsHaptics ? .tap : nil, trigger: taps)
        .accessibilityLabel(label)
        .accessibilityValue(isLoading ? Text("In progress", bundle: .module) : Text(verbatim: ""))
    }
}

#if DEBUG
    private struct HeaderButtonPreview: View {
        var body: some View {
            NavigationStack {
                Text("Content")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .screenCanvas()
                    .navigationTitle("Header controls")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { HeaderButton(.close) {} }
                        ToolbarItem(placement: .primaryAction) {
                            HeaderButton(systemImage: "ellipsis", accessibilityLabel: "More options") {}
                        }
                    }
            }
        }
    }

    #Preview("Header button") { HeaderButtonPreview() }
    #Preview("Header button · dark, Lift") { HeaderButtonPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Header button · AX3") { HeaderButtonPreview().dynamicTypeSize(.accessibility3) }
#endif

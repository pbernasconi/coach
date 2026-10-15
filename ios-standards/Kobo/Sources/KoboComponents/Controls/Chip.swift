import KoboTokens
import SwiftUI

/// A selectable capsule: a filter, a preset, a choice. The selected chip takes the solid tone fill and the selected
/// accessibility trait, so selection never rests on hue alone. Group chips with `ChipGroup`.
///
/// An active filter chip can carry a clear control: pass `onClear` and the selected chip shows a trailing ✕ with its
/// own 44pt target. VoiceOver gets one element with a "Clear …" action instead of a second button.
///
///     Chip("Barbell", systemImage: "dumbbell", isSelected: filter == .barbell) { filter = .barbell }
///     Chip(verbatim: tag.name, isSelected: true, onClear: { remove(tag) }) { edit(tag) }
public struct Chip: View {
    private let title: Text
    private let systemImage: String?
    private let tone: Tone
    private let isSelected: Bool
    private let onClear: (() -> Void)?
    private let action: () -> Void

    /// A chip with a localized title.
    public init(
        _ titleKey: LocalizedStringKey,
        systemImage: String? = nil,
        tone: Tone = .accent,
        isSelected: Bool,
        onClear: (() -> Void)? = nil,
        action: @escaping () -> Void
    ) {
        self.init(
            title: Text(titleKey),
            systemImage: systemImage,
            tone: tone,
            isSelected: isSelected,
            onClear: onClear,
            action: action
        )
    }

    /// A chip whose title is shown as is (user data, numbers).
    public init(
        verbatim title: String,
        systemImage: String? = nil,
        tone: Tone = .accent,
        isSelected: Bool,
        onClear: (() -> Void)? = nil,
        action: @escaping () -> Void
    ) {
        self.init(
            title: Text(verbatim: title),
            systemImage: systemImage,
            tone: tone,
            isSelected: isSelected,
            onClear: onClear,
            action: action
        )
    }

    init(
        title: Text,
        systemImage: String?,
        tone: Tone,
        isSelected: Bool,
        onClear: (() -> Void)? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.systemImage = systemImage
        self.tone = tone
        self.isSelected = isSelected
        self.onClear = onClear
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Space.xs) {
                if let systemImage {
                    Image(systemName: systemImage).imageScale(.small).accessibilityHidden(true)
                }
                title.lineLimit(1)
                if showsClear {
                    Image(systemName: "xmark").imageScale(.small).fontWeight(.bold).accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(ChipStyle(tone: tone, isSelected: isSelected))
        .overlay(alignment: .trailing) { clearTarget }
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .accessibilityActions {
            if let onClear, showsClear {
                Button(action: onClear) { Text("Clear \(title)", bundle: .module) }
            }
        }
    }

    private var showsClear: Bool { isSelected && onClear != nil }

    /// The ✕ draws inside the chip; this clear target sits over it, 44pt square, so it is easy to hit.
    @ViewBuilder private var clearTarget: some View {
        if let onClear, showsClear {
            Button(action: onClear) {
                Color.clear
                    .frame(width: Size.minTouch, height: Size.minTouch)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHidden(true)
        }
    }
}

/// The capsule look shared by `Chip` and `QuickPickRow`: idle is the raised neutral fill, selected is the solid tone
/// fill. The capsule keeps its compact height and is padded to a 44pt target.
struct ChipStyle: ButtonStyle {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    private let tone: Tone
    private let isSelected: Bool
    private let fillsWidth: Bool

    init(tone: Tone, isSelected: Bool, fillsWidth: Bool = false) {
        self.tone = tone
        self.isSelected = isSelected
        self.fillsWidth = fillsWidth
    }

    func makeBody(configuration: Configuration) -> some View {
        let colors = Self.colors(tone: tone, isSelected: isSelected, isEnabled: isEnabled, palette: theme.palette)
        configuration.label
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(colors.ink)
            .padding(.horizontal, Space.md)
            .padding(.vertical, Space.xs)
            .frame(maxWidth: fillsWidth ? .infinity : nil, minHeight: Size.buttonHeightCompact)
            .background {
                ZStack {
                    Capsule().fill(colors.soft)
                    Capsule().fill(theme.palette.pressVeil(configuration.isPressed))
                }
            }
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? PressMetrics.scale : 1)
            .koboAnimation(.instant, value: configuration.isPressed)
            .koboAnimation(.state, value: isSelected)
            .padding(.vertical, max(Size.minTouch - Size.buttonHeightCompact, 0) / 2)
            .contentShape(Rectangle())
    }

    /// The fill (`soft`) and the label ink (`ink`) of one chip state.
    static func colors(tone: Tone, isSelected: Bool, isEnabled: Bool, palette: Palette) -> StatusColors {
        guard isEnabled else { return StatusColors(ink: palette.textTertiary, soft: palette.surfaceRaised) }
        guard isSelected else { return StatusColors(ink: palette.textPrimary, soft: palette.surfaceRaised) }
        if tone == .accent { return StatusColors(ink: palette.onAccent, soft: palette.accent) }
        return StatusColors(ink: palette.surface, soft: palette.status(tone).ink)
    }
}

#if DEBUG
    private struct ChipGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var selected = true

        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                HStack(spacing: Space.sm) {
                    Chip("Barbell", systemImage: "dumbbell", isSelected: selected) { selected.toggle() }
                    Chip("Machine", isSelected: !selected) { selected.toggle() }
                }
                HStack(spacing: Space.sm) {
                    Chip("Done", systemImage: "checkmark", tone: .success, isSelected: true) {}
                    Chip("Skipped", tone: .danger, isSelected: true) {}
                    Chip("Off", isSelected: false) {}.disabled(true)
                }
                HStack(spacing: Space.sm) {
                    Chip(verbatim: "Leg day", systemImage: "tag", isSelected: true, onClear: {}) {}
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Chip") { ChipGallery() }
    #Preview("Chip · dark, Amber") { ChipGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Chip · AX3") { ChipGallery().dynamicTypeSize(.accessibility3) }
#endif

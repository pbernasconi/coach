import KoboTokens
import SwiftUI

/// Picks the app's appearance (system, light or dark) and, optionally, one of the app's themes, each shown as a small
/// phone preview with a radio disc under its name. A pick applies at once, with no Save, and plays the selection
/// haptic. Each preview is one target with the selected trait, so the choice never rests on colour alone. At
/// accessibility sizes the previews stack as rows. The themes are the caller's: pass any list of named `Theme`s.
///
///     ThemePicker(appearance: $appearance)
///     ThemePicker(appearance: $appearance, themes: [ThemeChoice("lift", title: "Lift", theme: .lift),
///                                                  ThemeChoice("system", title: "Classic", theme: .system)],
///                 selection: $themeID)
public struct ThemePicker<ID: Hashable & Sendable>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let appearance: Binding<AppearanceMode>
    private let themes: [ThemeChoice<ID>]
    private let selection: Binding<ID>?
    private let feedback: HapticFeedback?

    /// An appearance picker and a theme picker over the caller's themes.
    public init(
        appearance: Binding<AppearanceMode>,
        themes: [ThemeChoice<ID>],
        selection: Binding<ID>,
        feedback: HapticFeedback? = .selection
    ) {
        self.appearance = appearance
        self.themes = themes
        self.selection = selection
        self.feedback = feedback
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xl) {
            options(Text("Appearance", bundle: .module), AppearanceMode.allCases) { mode in
                tile(
                    mode.title,
                    preview: AppearancePreview(theme: theme, mode: mode),
                    isSelected: appearance.wrappedValue == mode
                ) {
                    appearance.wrappedValue = mode
                }
            }
            if let selection, !themes.isEmpty {
                options(Text("Theme", bundle: .module), themes) { choice in
                    let preview = AppearancePreview(theme: choice.theme, mode: appearance.wrappedValue)
                    tile(choice.title, preview: preview, isSelected: selection.wrappedValue == choice.id) {
                        selection.wrappedValue = choice.id
                    }
                }
            }
        }
        .koboFeedback(feedback, trigger: appearance.wrappedValue)
        .koboFeedback(feedback, trigger: selection?.wrappedValue)
    }

    /// A titled row of tiles: side by side (scrolling sideways when there are many), stacked at accessibility sizes.
    private func options<Item: Identifiable, Tile: View>(
        _ title: Text,
        _ items: [Item],
        @ViewBuilder tile: @escaping (Item) -> Tile
    ) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            title
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .textCase(.uppercase)
                .accessibilityAddTraits(.isHeader)
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: Space.sm) { ForEach(items) { tile($0) } }
            } else {
                ScrollView(.horizontal) {
                    HStack(alignment: .top, spacing: Space.md) { ForEach(items) { tile($0) } }
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
    }

    private func tile(_ title: Text, preview: AppearancePreview, isSelected: Bool, action: @escaping () -> Void)
        -> some View
    {
        Button(action: action) {
            ThemePickerTile(
                title: title,
                preview: preview,
                isSelected: isSelected,
                stacks: dynamicTypeSize.isAccessibilitySize
            )
        }
        .buttonStyle(PressFeedbackStyle(.scale))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

extension ThemePicker where ID == Never {
    /// An appearance picker only: system, light or dark.
    public init(appearance: Binding<AppearanceMode>, feedback: HapticFeedback? = .selection) {
        self.appearance = appearance
        themes = []
        selection = nil
        self.feedback = feedback
    }
}

/// One choice: the preview with an accent ring when selected, the name, and the radio disc. Stacked tiles put the
/// preview, name and disc in a row.
private struct ThemePickerTile: View {
    @Environment(\.koboTheme) private var theme
    let title: Text
    let preview: AppearancePreview
    let isSelected: Bool
    let stacks: Bool

    var body: some View {
        let layout = stacks ? AnyLayout(HStackLayout(spacing: Space.md)) : AnyLayout(VStackLayout(spacing: Space.sm))
        layout {
            preview
                .padding(Space.xxs)
                .overlay {
                    RoundedRectangle(
                        cornerRadius: Radius.concentric(outer: Radius.md, inset: -Space.xxs),
                        style: .continuous
                    )
                    .strokeBorder(isSelected ? theme.palette.accent : .clear, lineWidth: Space.xxs)
                }
            title
                .font(theme.font(.subheadline).weight(isSelected ? .semibold : .regular))
                .foregroundStyle(theme.palette.textPrimary)
                .multilineTextAlignment(stacks ? .leading : .center)
                .frame(maxWidth: stacks ? .infinity : nil, alignment: .leading)
            RadioDisc(isSelected: isSelected)
        }
        .contentShape(Rectangle())
        .koboAnimation(.state, value: isSelected)
    }
}

#if DEBUG
    private struct ThemePickerGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var appearance = AppearanceMode.system
        @State private var brand = "lift"
        private let themes = [
            ThemeChoice("lift", title: "Lift", theme: .lift),
            ThemeChoice("classic", title: "Classic", theme: .system),
            ThemeChoice("flat", title: "Flat", theme: Theme(palette: .lift, surfaceStyle: .solid)),
        ]

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xxl) {
                    ThemePicker(appearance: $appearance, themes: themes, selection: $brand)
                    ThemePicker(appearance: $appearance)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Theme picker") { ThemePickerGallery() }
    #Preview("Theme picker · dark, Lift") { ThemePickerGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Theme picker · AX3") { ThemePickerGallery().dynamicTypeSize(.accessibility3) }
#endif

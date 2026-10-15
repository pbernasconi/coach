import KoboTokens
import SwiftUI

/// A large selectable card: an optional symbol or illustration, a title, a description that explains the choice, and a
/// radio disc (one choice) or a checkbox (several) in the corner. Selected, the card takes the accent tint, a thicker
/// accent rim and a checked mark, so the choice never rests on colour alone; VoiceOver reads the title, the description
/// and the selected trait. At accessibility sizes the illustration moves above the text. `ChoiceCardGroup` lays out a
/// set of them over one binding.
///
///     ChoiceCard("Strength", description: "Heavy sets of 3 to 6", systemImage: "scalemass", isSelected: goal == .strength) {
///         goal = .strength
///     }
///     ChoiceCard(verbatim: plan.name, isSelected: picked, mode: .multiple, action: toggle) { PlanArt(plan) }
public struct ChoiceCard<Illustration: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .title2) private var symbolWidth = Size.iconLg + Space.sm
    private let title: Text
    private let description: Text?
    private let systemImage: String?
    private let isSelected: Bool
    private let mode: SelectionMode
    private let action: () -> Void
    private let illustration: Illustration

    /// A card with localized copy and an illustration slot. `mode: .multiple` draws a checkbox instead of a disc.
    public init(
        _ title: LocalizedStringKey,
        description: LocalizedStringKey? = nil,
        isSelected: Bool,
        mode: SelectionMode = .single,
        action: @escaping () -> Void,
        @ViewBuilder illustration: () -> Illustration
    ) {
        let description = description.map { Text($0) }
        self.init(Text(title), description, nil, isSelected, mode, action, illustration())
    }

    /// A card whose copy is shown as is, with an illustration slot.
    public init(
        verbatim title: String,
        description: String? = nil,
        isSelected: Bool,
        mode: SelectionMode = .single,
        action: @escaping () -> Void,
        @ViewBuilder illustration: () -> Illustration
    ) {
        let description = description.map { Text(verbatim: $0) }
        self.init(Text(verbatim: title), description, nil, isSelected, mode, action, illustration())
    }

    /// The one place every initialiser lands; `ChoiceCardGroup` passes ready-made texts.
    init(
        _ title: Text,
        _ description: Text?,
        _ systemImage: String?,
        _ isSelected: Bool,
        _ mode: SelectionMode,
        _ action: @escaping () -> Void,
        _ illustration: Illustration
    ) {
        self.title = title
        self.description = description
        self.systemImage = systemImage
        self.isSelected = isSelected
        self.mode = mode
        self.action = action
        self.illustration = illustration
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
        Button(action: action) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: Space.md) {
                        HStack(alignment: .top) {
                            media
                            Spacer(minLength: Space.md)
                            mark
                        }
                        texts
                    }
                } else {
                    HStack(alignment: .top, spacing: Space.md) {
                        media
                        texts
                        mark
                    }
                }
            }
            .padding(Space.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: shape)
            .overlay { shape.strokeBorder(rim, lineWidth: isSelected ? Space.xxs : Size.hairline) }
            .koboAnimation(.state, value: isSelected)
        }
        .buttonStyle(PressFeedbackStyle(.scale, in: shape))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder private var media: some View {
        if Illustration.self != EmptyView.self {
            illustration.accessibilityHidden(true)
        } else if let systemImage {
            Image(systemName: systemImage)
                .font(theme.font(.title2))
                .foregroundStyle(isEnabled ? theme.palette.accentText : theme.palette.textTertiary)
                .frame(width: symbolWidth, alignment: .leading)
                .accessibilityHidden(true)
        }
    }

    private var texts: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            title
                .font(theme.font(.headline))
                .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
            if let description {
                description
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var mark: some View {
        if mode == .multiple {
            CheckboxBox(state: CheckboxState(isSelected))
        } else {
            RadioDisc(isSelected: isSelected)
        }
    }

    private var fill: Color {
        guard isEnabled else { return theme.palette.surfaceRaised }
        return isSelected ? theme.palette.accentSoft : theme.palette.surface
    }

    private var rim: Color {
        guard isEnabled else { return .clear }
        return isSelected ? theme.palette.accent : theme.palette.separator
    }
}

extension ChoiceCard where Illustration == EmptyView {
    /// A card with localized copy and an optional SF Symbol.
    public init(
        _ title: LocalizedStringKey,
        description: LocalizedStringKey? = nil,
        systemImage: String? = nil,
        isSelected: Bool,
        mode: SelectionMode = .single,
        action: @escaping () -> Void
    ) {
        let description = description.map { Text($0) }
        self.init(Text(title), description, systemImage, isSelected, mode, action, EmptyView())
    }

    /// A card whose copy is shown as is, with an optional SF Symbol.
    public init(
        verbatim title: String,
        description: String? = nil,
        systemImage: String? = nil,
        isSelected: Bool,
        mode: SelectionMode = .single,
        action: @escaping () -> Void
    ) {
        let description = description.map { Text(verbatim: $0) }
        self.init(Text(verbatim: title), description, systemImage, isSelected, mode, action, EmptyView())
    }
}

#if DEBUG
    private struct ChoiceCardGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var goal = "strength"
        @State private var addCardio = true

        var body: some View {
            ScrollView {
                VStack(spacing: Space.md) {
                    ChoiceCard("Strength", description: "Heavy sets of 3 to 6 reps", systemImage: "scalemass", isSelected: goal == "strength") {
                        goal = "strength"
                    }
                    ChoiceCard("Muscle", description: "Moderate sets of 8 to 12 reps", systemImage: "figure.arms.open", isSelected: goal == "muscle") {
                        goal = "muscle"
                    }
                    ChoiceCard("Add a cardio finisher", description: "Ten minutes after each session", isSelected: addCardio, mode: .multiple) {
                        addCardio.toggle()
                    }
                    ChoiceCard(verbatim: "Powerlifting meet prep", description: "Ask your coach to unlock", isSelected: false) {}
                        .disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Choice card") { ChoiceCardGallery() }
    #Preview("Choice card · dark, Lift") { ChoiceCardGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Choice card · AX3") { ChoiceCardGallery().dynamicTypeSize(.accessibility3) }
#endif

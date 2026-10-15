import KoboTokens
import SwiftUI

/// A list row for one choice of several: the radio disc, an optional symbol, the title, an optional subtitle that
/// explains the choice ("Quieter, but slower") and an optional trailing view (a "New" tag). The whole row is
/// one target that speaks its title with the selected trait. It is a `ListRow` underneath, so it draws its separator
/// and press fill inside a `ListSection`. A tap calls `action`; `RadioGroup` wires a group of them to one binding.
///
///     RadioRow("90 seconds", subtitle: "Oolong", isSelected: timer == 90) { timer = 90 }
///     RadioRow(verbatim: template.name, isSelected: chosen == template.id, action: { chosen = template.id }) {
///         KoboTag("New", tone: .info)
///     }
public struct RadioRow<Trailing: View>: View {
    @State private var taps = 0
    private let title: Text
    private let subtitle: Text?
    private let systemImage: String?
    private let isSelected: Bool
    private let action: () -> Void
    private let trailing: Trailing

    /// A row with a localized title and subtitle and a trailing slot.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        systemImage: String? = nil,
        isSelected: Bool,
        action: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing
    ) {
        let subtitle = subtitle.map { Text($0) }
        self.init(Text(title), subtitle, systemImage, isSelected, action, trailing())
    }

    /// A row whose title and subtitle are shown as is, with a trailing slot.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        isSelected: Bool,
        action: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing
    ) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(Text(verbatim: title), subtitle, systemImage, isSelected, action, trailing())
    }

    /// The one place every initialiser lands; `RadioGroup` and `SelectSheet` pass ready-made texts.
    init(
        _ title: Text,
        _ subtitle: Text?,
        _ systemImage: String?,
        _ isSelected: Bool,
        _ action: @escaping () -> Void,
        _ trailing: Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.isSelected = isSelected
        self.action = action
        self.trailing = trailing
    }

    public var body: some View {
        ListRow(title: title, subtitle: subtitle, value: nil, action: tap, leading: leading, trailing: trailingSlot)
            .accessibilityAddTraits(isSelected ? .isSelected : [])
            .koboFeedback(.selection, trigger: taps)
    }

    private var leading: some View {
        HStack(spacing: Space.md) {
            RadioDisc(isSelected: isSelected)
            if let systemImage {
                Image(systemName: systemImage).accessibilityHidden(true)
            }
        }
    }

    /// Never `EmptyView`, so `ListRow` draws no chevron: a choice row does not navigate.
    private var trailingSlot: some View {
        Group { trailing }
    }

    /// Only a tap that changes the choice plays the selection haptic.
    private func tap() {
        if !isSelected { taps += 1 }
        action()
    }
}

extension RadioRow where Trailing == EmptyView {
    /// A row with a localized title and subtitle.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        systemImage: String? = nil,
        isSelected: Bool,
        action: @escaping () -> Void
    ) {
        self.init(title, subtitle: subtitle, systemImage: systemImage, isSelected: isSelected, action: action) {
            EmptyView()
        }
    }

    /// A row whose title and subtitle are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        isSelected: Bool,
        action: @escaping () -> Void
    ) {
        self.init(verbatim: title, subtitle: subtitle, systemImage: systemImage, isSelected: isSelected, action: action)
        {
            EmptyView()
        }
    }
}

#if DEBUG
    private struct RadioRowGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var day = "focus"

        var body: some View {
            ScrollView {
                ListSection("Today's plan") {
                    RadioRow("Focus", subtitle: "Deep work, no meetings", isSelected: day == "focus") { day = "focus" }
                    RadioRow("Meetings", subtitle: "Calls and reviews", isSelected: day == "meetings", action: { day = "meetings" }) {
                        KoboTag("New", tone: .info)
                    }
                    RadioRow(verbatim: "Errands", systemImage: "cart", isSelected: day == "errands") { day = "errands" }
                    RadioRow("Day off", subtitle: "Not available in a holiday week", isSelected: false) {}
                        .disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Radio row") { RadioRowGallery() }
    #Preview("Radio row · dark, Amber") { RadioRowGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Radio row · AX3") { RadioRowGallery().dynamicTypeSize(.accessibility3) }
#endif

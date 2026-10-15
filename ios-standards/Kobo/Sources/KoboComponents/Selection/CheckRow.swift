import KoboTokens
import SwiftUI

/// A list row with a checkbox: an optional leading slot (an icon, a thumbnail), the title, an optional subtitle and the
/// box on the trailing edge. The whole row is the target and reads as one checkbox ("Wi-Fi, Fibre, Checked"),
/// and a tap plays one toggle haptic. It is a `ListRow` underneath, so it draws its separator and press fill inside a
/// `ListSection` and works at AX3 the same way.
///
///     CheckRow("Wi-Fi", subtitle: "Fibre", isOn: $hasWiFi) { Image(systemName: "wifi") }
///     CheckRow("All amenities", state: $allAmenities)
///     CheckRow(verbatim: item.name, isOn: $item.isPacked)
public struct CheckRow<Leading: View>: View {
    @State private var taps = 0
    @State private var tappedOn = false
    private let title: Text
    private let subtitle: Text?
    private let state: Binding<CheckboxState>
    private let leading: Leading

    /// A row with a localized title and subtitle and a leading slot.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        isOn: Binding<Bool>,
        @ViewBuilder leading: () -> Leading
    ) {
        let subtitle = subtitle.map { Text($0) }
        self.init(title: Text(title), subtitle: subtitle, state: KoboCheckbox.state(isOn), leading: leading())
    }

    /// A row whose title and subtitle are shown as is, with a leading slot.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        isOn: Binding<Bool>,
        @ViewBuilder leading: () -> Leading
    ) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(title: Text(verbatim: title), subtitle: subtitle, state: KoboCheckbox.state(isOn), leading: leading())
    }

    /// The one place every initialiser lands; `SelectSheet` passes a highlighted title.
    init(title: Text, subtitle: Text?, state: Binding<CheckboxState>, leading: Leading) {
        self.title = title
        self.subtitle = subtitle
        self.state = state
        self.leading = leading
    }

    public var body: some View {
        ListRow(
            title: title,
            subtitle: subtitle,
            value: nil,
            action: tap,
            leading: leading,
            trailing: CheckboxBox(state: state.wrappedValue)
        )
        .accessibilityValue(CheckboxSpeech.value(state.wrappedValue))
        .accessibilityAddTraits(CheckboxSpeech.traits(state.wrappedValue))
        .koboFeedback(trigger: taps) { [tappedOn] _, _ in HapticFeedback.toggle(tappedOn) }
    }

    private func tap() {
        let next = state.wrappedValue.toggled
        tappedOn = next.isOn
        taps += 1
        state.wrappedValue = next
    }
}

extension CheckRow where Leading == EmptyView {
    /// A row with a localized title and subtitle.
    public init(_ title: LocalizedStringKey, subtitle: LocalizedStringKey? = nil, isOn: Binding<Bool>) {
        self.init(title, subtitle: subtitle, isOn: isOn) { EmptyView() }
    }

    /// A row whose title and subtitle are shown as is.
    public init(verbatim title: String, subtitle: String? = nil, isOn: Binding<Bool>) {
        self.init(verbatim: title, subtitle: subtitle, isOn: isOn) { EmptyView() }
    }

    /// A three-state row with a localized title: a parent over other rows ("All amenities"). A tap on a mixed row
    /// turns it on.
    public init(_ title: LocalizedStringKey, subtitle: LocalizedStringKey? = nil, state: Binding<CheckboxState>) {
        self.init(title: Text(title), subtitle: subtitle.map { Text($0) }, state: state, leading: EmptyView())
    }

    /// A three-state row whose title and subtitle are shown as is.
    public init(verbatim title: String, subtitle: String? = nil, state: Binding<CheckboxState>) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(title: Text(verbatim: title), subtitle: subtitle, state: state, leading: EmptyView())
    }
}

#if DEBUG
    private struct CheckRowGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var owned: Set<String> = ["wifi", "desk"]

        var body: some View {
            ScrollView {
                ListSection("Must-haves", footer: "We only suggest stays that have them.") {
                    CheckRow("All amenities", state: allOwned)
                    ForEach(SelectionSamples.amenities) { option in
                        CheckRow(
                            title: option.title,
                            subtitle: option.subtitle,
                            state: binding(option.value),
                            leading: Image(systemName: option.systemImage ?? "circle").accessibilityHidden(true)
                        )
                    }
                    CheckRow("Sauna", subtitle: "Ask your host", isOn: .constant(false)).disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }

        private var allOwned: Binding<CheckboxState> {
            let all = SelectionSamples.amenities.map(\.value)
            return Binding(
                get: { CheckboxState(children: all.map { owned.contains($0) }) },
                set: { owned = $0.isOn ? Set(all) : [] }
            )
        }

        private func binding(_ value: String) -> Binding<CheckboxState> {
            Binding(
                get: { CheckboxState(owned.contains(value)) },
                set: { state in
                    if state.isOn { owned.insert(value) } else { owned.remove(value) }
                }
            )
        }
    }

    #Preview("Check row") { CheckRowGallery() }
    #Preview("Check row · dark, Amber") { CheckRowGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Check row · AX3") { CheckRowGallery().dynamicTypeSize(.accessibility3) }
#endif

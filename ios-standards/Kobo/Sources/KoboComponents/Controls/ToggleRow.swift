import KoboTokens
import SwiftUI

/// A settings row with a switch: a title, an optional subtitle and an optional leading symbol. The whole row is the
/// target and reads as one switch (the subtitle is its hint), and a tap plays one toggle haptic. The subtitle is never
/// clamped, so nothing the user must read is cut off; at accessibility sizes the switch moves up to the title line
/// and the subtitle takes the full width. Inside a `ListSection` it draws its separator.
///
/// For a value that saves somewhere slow, pass `interaction: .saving` while the save runs: the knob moves at the tap,
/// a small spinner takes the switch's place only if the save outlasts `Motion.Duration.spinnerDelay`, and the row
/// takes no taps. `.waiting` keeps a row's ink but ignores taps while another row saves.
///
///     ToggleRow("Auto-start timer", subtitle: "Starts when you open a task", systemImage: "timer", isOn: $autoStart)
///     ToggleRow(verbatim: device.name, isOn: $device.isPaired, interaction: isSaving ? .saving : .enabled)
public struct ToggleRow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.listSectionStyle) private var style
    @ScaledMetric(relativeTo: .body) private var iconWidth = Size.iconLg
    @State private var pendingTap = ToggleRowPendingTap()
    @State private var slowSave = false
    @State private var taps = 0
    @State private var tappedValue = false
    private let title: Text
    private let subtitle: Text?
    private let systemImage: String?
    private let isOn: Binding<Bool>
    private let interaction: ToggleRowInteraction
    /// Times the spinner delay; a ContinuousClock outside tests.
    private let clock: any Clock<Duration> = ContinuousClock()

    /// A row with a localized title and subtitle.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        systemImage: String? = nil,
        isOn: Binding<Bool>,
        interaction: ToggleRowInteraction = .enabled
    ) {
        let subtitle = subtitle.map { Text($0) }
        self.init(Text(title), subtitle, systemImage: systemImage, isOn: isOn, interaction: interaction)
    }

    /// A row whose title and subtitle are shown as is (a device name, user data).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        isOn: Binding<Bool>,
        interaction: ToggleRowInteraction = .enabled
    ) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(Text(verbatim: title), subtitle, systemImage: systemImage, isOn: isOn, interaction: interaction)
    }

    private init(
        _ title: Text,
        _ subtitle: Text?,
        systemImage: String?,
        isOn: Binding<Bool>,
        interaction: ToggleRowInteraction
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.isOn = isOn
        self.interaction = interaction
    }

    public var body: some View {
        Button(action: tap) { row }
            .buttonStyle(PressFeedbackStyle(.highlight))
            .allowsHitTesting(interaction.acceptsTaps)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(title)
            .accessibilityHint(subtitle ?? Text(verbatim: ""))
            .accessibilityValue(displayed ? Text("On", bundle: .module) : Text("Off", bundle: .module))
            .accessibilityRespondsToUserInteraction(interaction.acceptsTaps)
            .accessibilityAddTraits(KoboToggleStyle.toggleTrait)
            .koboFeedback(trigger: taps) { [tappedValue] _, _ in HapticFeedback.toggle(tappedValue) }
            .onChange(of: interaction) { _, new in if new != .saving { pendingTap.end() } }
            .onChange(of: isOn.wrappedValue) { pendingTap.end() }
            .task(id: interaction == .saving) { await waitForSlowSave() }
            .listSectionSeparator(leadingInset: separatorInset)
    }

    private var displayed: Bool { pendingTap.displayed(isOn: isOn.wrappedValue, interaction: interaction) }
    private var separatorInset: CGFloat {
        style.separatorInset(leadingWidth: systemImage == nil ? 0 : iconWidth + Space.md)
    }

    @ViewBuilder private var row: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    HStack(alignment: .top, spacing: Space.md) {
                        icon
                        titleText.frame(maxWidth: .infinity, alignment: .leading)
                        switchSlot
                    }
                    subtitleText
                }
            } else {
                HStack(spacing: Space.md) {
                    icon
                    VStack(alignment: .leading, spacing: Space.xxs) {
                        titleText
                        subtitleText
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    switchSlot
                }
            }
        }
        .padding(.vertical, Space.md)
        .padding(.horizontal, style.rowInset)
        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
        .contentShape(Rectangle())
    }

    @ViewBuilder private var icon: some View {
        if let systemImage {
            Image(systemName: systemImage)
                .font(theme.font(.body))
                .foregroundStyle(isEnabled ? theme.palette.accentText : theme.palette.textTertiary)
                .frame(width: iconWidth)
                .accessibilityHidden(true)
        }
    }

    private var titleText: some View {
        title
            .font(theme.font(.body))
            .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
    }

    @ViewBuilder private var subtitleText: some View {
        if let subtitle {
            subtitle
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The switch keeps its frame while the spinner shows, so the row never changes height.
    private var switchSlot: some View {
        let spinner = interaction == .saving && slowSave
        return SwitchTrack(isOn: displayed)
            .opacity(spinner ? 0 : 1)
            .overlay {
                if spinner { ProgressView().controlSize(.small).accessibilityHidden(true) }
            }
            .koboAnimation(.state, value: spinner)
    }

    private func tap() {
        guard interaction.acceptsTaps else { return }
        let next = !isOn.wrappedValue
        pendingTap.tap(from: isOn.wrappedValue)
        tappedValue = next
        taps += 1
        isOn.wrappedValue = next
    }

    private func waitForSlowSave() async {
        slowSave = false
        guard interaction == .saving else { return }
        guard (try? await clock.sleep(for: .seconds(Motion.Duration.spinnerDelay))) != nil else { return }
        slowSave = true
    }
}

#if DEBUG
    private struct ToggleRowGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var autoStart = true
        @State private var sounds = false
        @State private var paired = true

        var body: some View {
            ListSection("Settings") {
                ToggleRow(
                    "Auto-start timer",
                    subtitle: "Starts the timer when you open a task.",
                    systemImage: "timer",
                    isOn: $autoStart
                )
                ToggleRow("Sounds", systemImage: "speaker.wave.2", isOn: $sounds)
                ToggleRow(verbatim: "Kitchen speaker", subtitle: "Saving…", isOn: $paired, interaction: .saving)
                ToggleRow("Smart suggestions", isOn: .constant(true)).disabled(true)
            }
            .padding(.vertical, Space.gutter)
            .pageGutter()
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Toggle row") { ToggleRowGallery() }
    #Preview("Toggle row · dark, Amber") { ToggleRowGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Toggle row · AX3") { ToggleRowGallery().dynamicTypeSize(.accessibility3) }
#endif

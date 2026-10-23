import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Dumb view (SCR-2), short and in order of use: the coach's side and every connection (from the server), this
/// iPhone's sync and Apple Health, training settings, practice mode, and the version at the foot.
struct SettingsContent: View {
    let state: SettingsState
    let send: (SettingsAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                SettingsCoachSections(remote: state.remote, send: send)
                SettingsPhoneSection(section: state.sync, health: state.health, send: send)
                ListSection("Training", footer: "Past workouts keep the unit they were logged in.") {
                    SegmentedPicker(
                        "Weight unit",
                        selection: .action(state.unit) { send(.unitSelected($0)) },
                        options: [
                            ChoiceOption(WeightUnit.kg, title: "kg"),
                            ChoiceOption(WeightUnit.lb, title: "lb"),
                        ]
                    )
                    .padding(.vertical, Space.sm)
                    .pageGutter()
                    ListRow(verbatim: String(localized: "Plates and bars"), action: { send(.platesTapped) }) {
                        SettingsIcon(symbol: "scalemass.fill", tone: .accent)
                    }
                }
                SettingsPracticeSection(section: state.practice, send: send)
                SettingsFooter(version: state.version, dataSource: state.dataSource, send: send)
            }
            .pageColumn()
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Settings") }
        .koboSheet(
            item: Binding<TokenEditor?>.action(state.tokenEditor) { if $0 == nil { send(.tokenEditorDismissed) } },
            title: { _ in String(localized: "Sync token") },
            hasChanges: !(state.tokenEditor?.draft.isEmpty ?? true)
        ) { editor in
            TokenEditorField(editor: editor, send: send)
        } footer: { editor in
            TokenEditorButtons(editor: editor, send: send)
        }
    }
}

/// The foot of the page: the version and where the data lives in one small line, and the acknowledgements.
private struct SettingsFooter: View {
    @Environment(\.koboTheme) private var theme
    let version: String
    let dataSource: AppInfo.DataSource
    let send: (SettingsAction) -> Void

    var body: some View {
        VStack(spacing: Space.xs) {
            Text(verbatim: "Coach \(version) · \(stored)")
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textTertiary)
            Button("Acknowledgements") { send(.acknowledgementsTapped) }
                .buttonStyle(.kobo(.plain, size: .compact))
        }
        .frame(maxWidth: .infinity)
    }

    private var stored: String {
        switch dataSource {
        case .device: String(localized: "On this iPhone")
        case .demo: String(localized: "Demo data, not saved")
        case .fresh: String(localized: "Not saved")
        case .practice: String(localized: "Practice data")
        }
    }
}

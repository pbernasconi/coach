import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Dumb view: units, where the data lives, sync, and the app version (SCR-2).
struct SettingsContent: View {
    let state: SettingsState
    let send: (SettingsAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xxl) {
                ListSection("Units") {
                    SegmentedPicker(
                        "Weight unit",
                        selection: .action(state.unit) { send(.unitSelected($0)) },
                        options: [
                            ChoiceOption(WeightUnit.kg, title: "Kilograms (kg)"),
                            ChoiceOption(WeightUnit.lb, title: "Pounds (lb)"),
                        ]
                    )
                    .padding(.vertical, Space.sm)
                    .pageGutter()
                }
                dataSection
                SettingsSyncSection(section: state.sync, send: send)
                ListSection("About") {
                    ListRow("Version", value: state.version)
                    ListRow("Acknowledgements", action: { send(.acknowledgementsTapped) })
                }
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

    @ViewBuilder
    private var dataSection: some View {
        switch state.dataSource {
        case .device:
            ListSection("Data") {
                ListRow("Stored", value: String(localized: "On this iPhone"))
            }
        case .demo:
            ListSection("Data", footer: "Demo data is made up and is not saved.") {
                ListRow("Stored", value: String(localized: "Demo data"))
            }
        }
    }
}

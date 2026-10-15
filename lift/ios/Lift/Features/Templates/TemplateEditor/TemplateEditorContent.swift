import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the name field, the slots in order with "Add exercise" as the list's last row, and the slot editor
/// sheet (SCR-2).
struct TemplateEditorContent: View {
    let state: TemplateEditorState
    let send: (TemplateEditorAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                switch state.template {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(
                        symbol: "list.bullet.rectangle",
                        title: "Template not found",
                        message: "It may have been removed."
                    )
                case .failed:
                    ErrorState(title: "The template could not be loaded")
                case .loaded(let overview):
                    KoboTextField(
                        verbatim: String(localized: "Name"),
                        text: .action(state.name) { send(.nameChanged($0)) },
                        prompt: String(localized: "Upper A")
                    )
                    .submitLabel(.done)
                    .onSubmit { send(.nameCommitted) }
                    TemplateSlotList(overview: overview, send: send)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .scrollDismissesKeyboard(.interactively)
        .screenCanvas()
        .navigationTitle(Text(verbatim: state.name))
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { send(.nameCommitted) }
        .koboSheet(
            item: Binding<SlotEditor?>.action(state.editor) { if $0 == nil { send(.editorDismissed) } },
            title: \.title,
            subtitle: \.subtitle,
            detents: [.large],
            hasChanges: state.editor?.hasChanges ?? false
        ) { editor in
            SlotEditorFields(editor: editor, send: send)
        } footer: { _ in
            Button("Done") { send(.editorDoneTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
    }
}

/// The slots as flat rows, numbered in workout order, then "Add exercise".
private struct TemplateSlotList: View {
    let overview: TemplateOverview
    let send: (TemplateEditorAction) -> Void

    var body: some View {
        ListSection {
            ForEach(overview.slots) { slot in
                ListRow(verbatim: slot.name, subtitle: slot.detail, action: { send(.slotTapped(slot.id)) }) {
                    SlotNumber(number: slot.number)
                }
            }
            ListRow(
                "Add exercise",
                subtitle: "From your exercises or the catalog",
                action: {
                    send(.addExerciseTapped)
                }
            ) {
                Thumbnail(systemName: "plus", tone: .accent, side: ExerciseThumbnail.compactSide)
            }
        } header: {
            Text(verbatim: overview.slots.isEmpty ? String(localized: "No exercises yet") : overview.size)
        }
        .listRowDensity(.compact)
    }
}

/// The slot's place in the workout on a tile the size of the exercise thumbnails, so every row's text starts on one
/// keyline. Decorative: the row's order already says it.
private struct SlotNumber: View {
    @Environment(\.koboTheme) private var theme
    let number: Int

    var body: some View {
        Thumbnail(tone: .neutral, side: ExerciseThumbnail.compactSide) {
            Text(verbatim: "\(number)")
                .font(theme.font(.headline).monospacedDigit())
        }
        .accessibilityHidden(true)
    }
}

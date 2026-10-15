import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Quick actions section.
struct QuickActionsDemo: View {
    let component: CatalogComponent
    @State private var steps = QuickActionsDemo.initialSteps
    @State private var showsSuggestion = true

    var body: some View {
        switch component {
        case .actionChipRow:
            ActionChipRow([
                ActionChip(symbol: "pencil", label: "Rename") {},
                ActionChip(symbol: "plus.square.on.square", label: "Duplicate") {},
                ActionChip(symbol: "square.and.arrow.up", label: "Share", isLoading: true) {},
                ActionChip(symbol: "trash", label: "Delete", look: .destructive) {},
            ])
        case .actionCircle:
            HStack(alignment: .top, spacing: 0) {
                ActionCircle("New task", systemImage: "plus", style: .solid) {}
                ActionCircle("Scan", systemImage: "doc.viewfinder") {}
                ActionCircle(verbatim: "Share", systemImage: "square.and.arrow.up", isLoading: true) {}
            }
        case .setupChecklistCard:
            SetupChecklistCard("Finish setting up", steps: steps, onHide: { steps = Self.initialSteps }) { id in
                steps = steps.map { step in
                    step.id == id
                        ? SetupChecklistStep(id: step.id, title: step.title, caption: step.caption, isDone: true) : step
                }
            }
        case .suggestionCard:
            if showsSuggestion {
                SuggestionCard(
                    "Plan your week",
                    message: "Pick three tasks for each day and get a reminder the evening before.",
                    systemImage: "calendar",
                    actionTitle: "Plan now",
                    onAction: {},
                    onDismiss: { showsSuggestion = false }
                )
            } else {
                Button("Show the suggestion again") { showsSuggestion = true }
            }
        case .summaryStrip:
            SummaryStrip([
                SummaryStrip.Item("Open", value: "12"),
                SummaryStrip.Item("Due today", value: "3"),
                SummaryStrip.Item(verbatim: "Done this week", value: "18"),
            ])
        case .tonalCardRow:
            VStack(spacing: Space.md) {
                TonalCardRow("Reminders", systemImage: "bell", action: {}) { StatusPill("On", tone: .success) }
                TonalCardRow("Calendar sync", systemImage: "calendar", action: {})
            }
        default: EmptyView()
        }
    }

    private static let initialSteps = [
        SetupChecklistStep(
            id: "list",
            title: "Create your first list",
            caption: "Group tasks by project.",
            isDone: true
        ),
        SetupChecklistStep(id: "task", title: "Add a task", caption: "Give it a due date.", isDone: false),
        SetupChecklistStep(id: "notify", title: "Turn on reminders", isDone: false),
    ]
}

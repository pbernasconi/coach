import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Selection section: checkboxes, radios, choice cards and accordions. The select fields, menus,
/// range slider and theme picker live in `SelectionFieldsDemo`.
struct SelectionDemo: View {
    let component: CatalogComponent
    @State private var subtasks = [true, false, true]
    @State private var notify = true
    @State private var shared = false
    @State private var sort = "due"
    @State private var priority = "medium"
    @State private var layout = "list"
    @State private var extras: Set<String> = ["reminders"]
    @State private var openSection: String? = "today"

    var body: some View {
        switch component {
        case .checkbox:
            VStack(alignment: .leading, spacing: Space.xs) {
                KoboCheckbox("All subtasks", state: allSubtasks)
                KoboCheckbox(verbatim: "Buy paint samples", isOn: $subtasks[0])
                KoboCheckbox(verbatim: "Tape the edges", isOn: $subtasks[1])
                KoboCheckbox(isOn: $subtasks[2], accessibilityLabel: "Clear the shelf")
            }
        case .radio:
            VStack(alignment: .leading, spacing: 0) {
                KoboRadio("Due date", isSelected: sort == "due") { sort = "due" }
                KoboRadio("Title", isSelected: sort == "title") { sort = "title" }
                KoboRadio(verbatim: "Recently added", isSelected: false) {}.disabled(true)
            }
        case .checkRow:
            ListSection("Notifications") {
                CheckRow("Email me a summary", subtitle: "Every Monday morning", isOn: $notify)
                CheckRow("All subtasks", state: allSubtasks)
                CheckRow(verbatim: "Share with the household", isOn: $shared) {
                    Image(systemName: "person.2").accessibilityHidden(true)
                }
            }
        case .radioRow:
            ListSection("Sort by") {
                RadioRow("Due date", subtitle: "Soonest first", isSelected: sort == "due") { sort = "due" }
                RadioRow(verbatim: "Title", systemImage: "textformat", isSelected: sort == "title") { sort = "title" }
            }
        case .radioGroup:
            ListSection("Priority") {
                RadioGroup("Priority", options: CatalogSamples.priorities, selection: $priority)
            }
        case .choiceCard: choiceCards
        case .choiceCardGroup:
            VStack(alignment: .leading, spacing: Space.xl) {
                ChoiceCardGroup("Priority", options: CatalogSamples.priorities, selection: $priority)
                ChoiceCardGroup(verbatim: "Extras", options: extraOptions, selection: $extras)
            }
        case .accordionGroup:
            AccordionGroup(sections, expanded: $openSection, title: \.name, subtitle: { $0.detail }) { section in
                Text(verbatim: section.items.joined(separator: "\n"))
            }
        default: SelectionFieldsDemo(component: component)
        }
    }

    private var choiceCards: some View {
        VStack(spacing: Space.md) {
            ChoiceCard(
                "List",
                description: "Tasks in one column",
                systemImage: "list.bullet",
                isSelected: layout == "list"
            ) {
                layout = "list"
            }
            ChoiceCard("Board", description: "Columns by status", isSelected: layout == "board") { layout = "board" }
            ChoiceCard(
                verbatim: "Show completed tasks",
                description: "Greyed out at the bottom",
                isSelected: extras.contains("completed"),
                mode: .multiple
            ) {
                if extras.contains("completed") { extras.remove("completed") } else { extras.insert("completed") }
            }
        }
    }

    private var allSubtasks: Binding<CheckboxState> {
        Binding(
            get: { CheckboxState(children: subtasks) },
            set: { state in subtasks = subtasks.map { _ in state.isOn } }
        )
    }

    private var extraOptions: [SelectOption<String>] {
        [
            SelectOption("reminders", title: "Reminders", subtitle: "Before each due date"),
            SelectOption("completed", title: "Completed tasks", subtitle: "Keep them visible"),
        ]
    }

    private var sections: [DemoSection] {
        [
            DemoSection(
                id: "today",
                name: "Today",
                detail: "3 tasks",
                items: ["Water the plants", "Reply to the landlord"]
            ),
            DemoSection(id: "later", name: "Later", detail: "2 tasks", items: ["Plan the weekend trip"]),
        ]
    }
}

/// A titled group of sample items for accordion demos.
struct DemoSection: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let detail: String
    let items: [String]
}

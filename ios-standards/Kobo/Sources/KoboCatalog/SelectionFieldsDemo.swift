import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Selection section's fields: menus, select fields and sheets, the range slider and the theme
/// picker.
struct SelectionFieldsDemo: View {
    let component: CatalogComponent
    @State private var reminder = 15
    @State private var view = "list"
    @State private var project: String?
    @State private var priority = "medium"
    @State private var tags: Set<String> = ["home", "garden"]
    @State private var choosingProject = false
    @State private var budget = 20.0...80.0
    @State private var appearance = AppearanceMode.system
    @State private var brand = "default"

    var body: some View {
        switch component {
        case .menuRow:
            ListSection("Task defaults") {
                MenuRow("Reminder", subtitle: "For new tasks", selection: $reminder, options: CatalogSamples.reminders)
                {
                    Image(systemName: "bell").accessibilityHidden(true)
                }
                MenuRow(verbatim: "Default view", selection: $view, options: CatalogSamples.views)
            }
        case .menuSelectField:
            FieldGroup {
                MenuSelectField(
                    "Reminder",
                    selection: $reminder,
                    options: CatalogSamples.reminders,
                    helper: "For new tasks"
                )
                MenuSelectField(verbatim: "Default view", selection: $view, options: CatalogSamples.views)
            }
        case .selectField:
            FieldGroup {
                SelectField(
                    "Project",
                    selection: $project,
                    options: CatalogSamples.projects,
                    placeholder: "Choose a project",
                    error: project == nil ? .message("Pick a project for this task") : .none
                )
                SelectField(verbatim: "Priority", selection: $priority, options: CatalogSamples.priorities)
            }
        case .multiSelectField:
            MultiSelectField(
                "Projects",
                selection: $tags,
                options: CatalogSamples.projects,
                placeholder: "None yet",
                helper: "Tasks from these projects show on Today"
            )
        case .selectSheet: selectSheet
        case .rangeSlider:
            VStack(spacing: Space.xl) {
                RangeSlider("Budget", range: $budget, in: 0...200, step: 5) { "$\(RangeSlider.defaultFormat($0))" }
                RangeSlider(verbatim: "Locked range", range: .constant(10...40), in: 0...100).disabled(true)
            }
        case .themePicker:
            ThemePicker(appearance: $appearance, themes: themes, selection: $brand)
        default: EmptyView()
        }
    }

    private var selectSheet: some View {
        Button("Project: \(project ?? "none")") { choosingProject = true }
            .buttonStyle(.kobo(.secondary))
            .koboSheet(isPresented: $choosingProject, title: "Project", detents: [.large]) {
                SelectSheet(options: CatalogSamples.projects, selection: $project, searchPrompt: "Search projects")
            }
    }

    private var themes: [ThemeChoice<String>] {
        [
            ThemeChoice("default", title: "Default", theme: .system),
            ThemeChoice("amber", title: "Amber", theme: .amber),
            ThemeChoice("flat", verbatim: "Flat", theme: Theme(palette: .amber, surfaceStyle: .solid)),
        ]
    }
}

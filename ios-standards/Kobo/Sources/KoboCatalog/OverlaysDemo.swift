import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Overlays section. Each demo is a button that presents the overlay.
struct OverlaysDemo: View {
    let component: CatalogComponent
    @State private var opened: CatalogPlace?
    @State private var renaming: CatalogPlace?
    @State private var creating = false
    @State private var explaining: DemoTopic?
    @State private var name = "Weekend trip"
    @State private var savedName = "Weekend trip"
    @Environment(\.koboTheme) private var theme

    var body: some View {
        switch component {
        case .sheet:
            Button("Open place details") { opened = CatalogSamples.places.first }
                .buttonStyle(.kobo(.secondary))
                .itemSheet(item: opened, onDismiss: { opened = nil }) { place in
                    KoboSheet(verbatim: place.name, subtitle: place.detail) {
                        Text("Saved places show on the map and in search.")
                    } footer: {
                        Button("Done") { opened = nil }.buttonStyle(.kobo(.primary, width: .full))
                    }
                }
        case .modalPage: modalPage
        case .inputModal:
            Button("Rename: \(savedName)") { renaming = CatalogSamples.places.first }
                .buttonStyle(.kobo(.secondary))
                .itemSheet(item: renaming, onDismiss: { renaming = nil }) { _ in
                    InputModal(
                        "Rename project",
                        isSaveEnabled: !name.isEmpty,
                        hasChanges: name != savedName,
                        onSave: { savedName = name }
                    ) {
                        KoboTextField("Name", text: $name)
                    }
                }
        case .infoButton:
            HStack(spacing: Space.xs) {
                Text("Focus time").font(theme.font(.headline))
                InfoButton("Focus time", message: "Focus time adds up the minutes you spent on tasks marked as deep work.")
            }
        case .infoSheet:
            Button("What is a project?") { explaining = DemoTopic(id: "projects") }
                .buttonStyle(.kobo(.secondary))
                .itemSheet(item: explaining, onDismiss: { explaining = nil }) { _ in
                    InfoSheet("Projects", learnMore: URL(string: "https://example.com/projects")) {
                        Text("A project groups related tasks, notes and files.")
                        Text("Archive a project when it's done; nothing is deleted.")
                    }
                }
        default: EmptyView()
        }
    }

    private var modalPage: some View {
        Button("New project") { creating = true }
            .buttonStyle(.kobo(.secondary))
            .koboModalPage(isPresented: $creating, style: .sheet) {
                ModalPage("New project", subtitle: "Shared with nobody yet", confirmLabel: "Create", onConfirm: {}) {
                    KoboTextField("Name", text: $name)
                    Text("Projects group related tasks and notes.")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
    }
}

/// A made-up help topic, presented as an item sheet.
private struct DemoTopic: Identifiable, Equatable {
    let id: String
}

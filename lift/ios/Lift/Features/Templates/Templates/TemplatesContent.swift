import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the Templates segment of the Lift tab. Each template is a section, its name and size over every exercise
/// with its sets, reps, load and rest, so a template reads without opening it; a row or the pencil opens the editor,
/// and "…" its options (SCR-2).
struct TemplatesContent: View {
    let state: TemplatesState
    let send: (TemplatesAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                switch state.templates {
                case .loading:
                    ListLoadingSkeleton(rows: 6)
                case .empty:
                    EmptyState(
                        symbol: "list.bullet.rectangle",
                        title: "No templates",
                        message: "A template is a workout you repeat, such as Upper A. Plan days on Week from it."
                    ) {
                        Button("New template") { send(.newTemplateTapped) }
                            .buttonStyle(.kobo(.primary))
                    }
                case .failed:
                    ErrorState(title: "Templates could not be loaded")
                case .loaded(let items):
                    ForEach(items) { item in
                        TemplateSection(item: item, send: send)
                    }
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader {
            AppHeader("Templates") {
                Button("New template", systemImage: "plus") { send(.newTemplateTapped) }
            }
        }
        .templateOptions(target: state.options, send: send)
    }
}

/// One template: its header, then its exercises numbered in workout order. Every row opens the editor.
private struct TemplateSection: View {
    let item: TemplateItem
    let send: (TemplatesAction) -> Void

    var body: some View {
        ListSection {
            if item.slots.isEmpty {
                ListRow(
                    "Add exercises",
                    subtitle: "From your exercises or the catalog",
                    action: { send(.templateTapped(item.id)) }
                ) {
                    Thumbnail(systemName: "plus", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            } else {
                ForEach(item.slots) { slot in
                    ListRow(verbatim: slot.name, subtitle: slot.detail, action: { send(.templateTapped(item.id)) }) {
                        SlotNumber(number: slot.number)
                    }
                }
            }
        } header: {
            TemplateHeader(item: item, send: send)
        }
        .listRowDensity(.compact)
    }
}

/// The template's name and size, with Edit and "…" buttons. The buttons sit beside the text, never inside a row's
/// own button, so the buttons never nest.
private struct TemplateHeader: View {
    @Environment(\.koboTheme) private var theme
    let item: TemplateItem
    let send: (TemplatesAction) -> Void

    var body: some View {
        HStack(alignment: .center, spacing: Space.sm) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: item.name)
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                Text(verbatim: item.size)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            IconButton(
                "pencil",
                verbatimAccessibilityLabel: String(localized: "Edit \(item.name)"),
                style: .glass,
                size: .small
            ) { send(.templateTapped(item.id)) }
            IconButton(
                "ellipsis",
                verbatimAccessibilityLabel: String(localized: "Options for \(item.name)"),
                style: .glass,
                size: .small
            ) { send(.optionsTapped(item.id)) }
        }
    }
}

extension View {
    /// The options for a template: Edit, and Remove, which applies at once with Undo in a toast (product rule).
    fileprivate func templateOptions(target: TemplateItem?, send: @escaping (TemplatesAction) -> Void) -> some View {
        modifier(TemplateOptions(target: target, send: send))
    }
}

/// Keeps the last target while the sheet slides away, so its title does not empty out during the dismissal; that copy
/// is presentation state only.
private struct TemplateOptions: ViewModifier {
    let target: TemplateItem?
    let send: (TemplatesAction) -> Void
    @State private var shown: TemplateItem?

    func body(content: Content) -> some View {
        content
            .onChange(of: target, initial: true) { _, new in
                if let new { shown = new }
            }
            .koboActionSheet(
                isPresented: .action(target != nil) { if !$0 { send(.optionsDismissed) } },
                verbatim: shown?.name ?? "",
                message: shown?.size
            ) {
                if let id = shown?.id {
                    ActionSheetItem("Edit", systemImage: "pencil") { send(.templateTapped(id)) }
                    ActionSheetItem("Remove", systemImage: "trash", role: .destructive) { send(.removeTapped(id)) }
                }
            }
    }
}

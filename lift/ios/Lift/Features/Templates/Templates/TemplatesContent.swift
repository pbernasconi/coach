import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: "New template", then the templates as flat rows, each with a "…" button for its options (SCR-2).
struct TemplatesContent: View {
    let state: TemplatesState
    let send: (TemplatesAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                switch state.templates {
                case .loading:
                    ListLoadingSkeleton(rows: 4, showsLeading: false)
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
                    NewTemplateRow(send: send)
                    ListSection("Your templates") {
                        ForEach(items) { item in
                            TemplateRow(item: item, send: send)
                        }
                    }
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text("Templates"))
        .navigationBarTitleDisplayMode(.inline)
        .templateOptions(target: state.options, send: send)
    }
}

/// "New template" as a tiled row, like "All exercises" on the Exercises tab.
private struct NewTemplateRow: View {
    let send: (TemplatesAction) -> Void

    var body: some View {
        ListSection {
            ListRow("New template", subtitle: "Name it, then add exercises", action: { send(.newTemplateTapped) }) {
                Thumbnail(systemName: "plus", tone: .accent, side: ExerciseThumbnail.compactSide)
            }
        }
        .listRowDensity(.compact)
    }
}

/// One template: its name, size and exercises, and a "…" button over the row's reserved trailing slot, outside the
/// row's own button so the buttons never nest.
private struct TemplateRow: View {
    let item: TemplateItem
    let send: (TemplatesAction) -> Void

    var body: some View {
        ListRow(
            verbatim: item.name,
            subtitle: "\(item.size)\n\(item.exercises)",
            action: { send(.templateTapped(item.id)) },
            leading: { Thumbnail(systemName: "list.bullet", tone: .neutral, side: ExerciseThumbnail.compactSide) },
            trailing: { Color.clear.frame(width: Size.minTouch) }
        )
        .overlay(alignment: .trailing) {
            IconButton(
                "ellipsis",
                verbatimAccessibilityLabel: String(localized: "Options for \(item.name)"),
                style: .glass,
                size: .small
            ) { send(.optionsTapped(item.id)) }
            .frame(width: Size.minTouch)
            .padding(.trailing, Space.gutter)
        }
    }
}

extension View {
    /// The options for a template: Remove, which applies at once with Undo in a toast (product rule).
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

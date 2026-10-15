import KoboTokens
import SwiftUI

/// Several `Collapsible` sections where at most one is open: opening one closes the open one in the same motion
/// (`Motion.enter` in, the faster `Motion.exit` out; at once with Reduce Motion). `.exactlyOne` keeps the open section
/// open on a second tap. Each header reads as a button with an "Expanded" or "Collapsed" value, and hairlines divide
/// the sections. The caller owns which one is open, so a screen can open one from code.
///
///     AccordionGroup(days, expanded: $openDay, title: \.name, subtitle: { $0.summary }) { day in
///         ForEach(day.exercises) { Text(verbatim: $0.name) }
///     }
public struct AccordionGroup<Data: RandomAccessCollection, Content: View>: View
where Data.Element: Identifiable {
    private let data: Data
    private let expanded: Binding<Data.Element.ID?>
    private let mode: AccordionMode
    private let title: (Data.Element) -> String
    private let subtitle: ((Data.Element) -> String?)?
    private let content: (Data.Element) -> Content

    /// - Parameters:
    ///   - expanded: the open section's id, or `nil` when all are closed.
    ///   - title: each section's header, shown as is (user data such as a day name).
    ///   - subtitle: an optional second line under each header.
    public init(
        _ data: Data,
        expanded: Binding<Data.Element.ID?>,
        mode: AccordionMode = .atMostOne,
        title: @escaping (Data.Element) -> String,
        subtitle: ((Data.Element) -> String?)? = nil,
        @ViewBuilder content: @escaping (Data.Element) -> Content
    ) {
        self.data = data
        self.expanded = expanded
        self.mode = mode
        self.title = title
        self.subtitle = subtitle
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(data) { element in
                if element.id != data.first?.id {
                    Separator()
                }
                Collapsible(verbatim: title(element), subtitle: subtitle?(element), isExpanded: isExpanded(element.id))
                {
                    content(element)
                }
                .padding(.vertical, Space.sm)
            }
        }
    }

    /// One section's open flag over the shared open id.
    private func isExpanded(_ id: Data.Element.ID) -> Binding<Bool> {
        Binding(
            get: { expanded.wrappedValue == id },
            set: { isOpen in
                expanded.wrappedValue = AccordionExpansion.setting(
                    id,
                    isExpanded: isOpen,
                    expanded: expanded.wrappedValue,
                    mode: mode
                )
            }
        )
    }
}

#if DEBUG
    private struct AccordionDay: Identifiable {
        let id: String
        let name: String
        let summary: String
        let exercises: [String]
    }

    private struct AccordionGroupGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var openDay: String? = "push"
        @State private var openSetting: String? = "rest"
        private let days = [
            AccordionDay(
                id: "push",
                name: "Push",
                summary: "5 exercises · 55 min",
                exercises: ["Bench press", "Overhead press", "Dips"]
            ),
            AccordionDay(
                id: "pull",
                name: "Pull",
                summary: "4 exercises · 45 min",
                exercises: ["Deadlift", "Pull-up", "Row"]
            ),
            AccordionDay(
                id: "legs",
                name: "Legs",
                summary: "4 exercises · 60 min",
                exercises: ["Back squat", "Romanian deadlift"]
            ),
        ]
        private let settings = [
            AccordionDay(id: "rest", name: "Rest timer", summary: "", exercises: ["Auto-start after a set"]),
            AccordionDay(id: "units", name: "Units", summary: "", exercises: ["Kilograms"]),
        ]

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    AccordionGroup(days, expanded: $openDay, title: \.name, subtitle: { $0.summary }) { day in
                        Text(verbatim: day.exercises.joined(separator: "\n"))
                            .font(theme.font(.body))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                    .koboCard()
                    AccordionGroup(settings, expanded: $openSetting, mode: .exactlyOne, title: \.name) { setting in
                        Text(verbatim: setting.exercises.joined(separator: ", ")).font(theme.font(.body))
                    }
                    .koboCard()
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Accordion group") { AccordionGroupGallery() }
    #Preview("Accordion group · dark, Lift") { AccordionGroupGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Accordion group · AX3") { AccordionGroupGallery().dynamicTypeSize(.accessibility3) }
#endif

import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// A browsable gallery of every Kobo component, for a debug menu or a catalog app target.
///
///     #if DEBUG
///     CatalogGallery(themes: [("Amber", .amber), ("System", .system)])
///     #endif
///
/// The toolbar switches theme, colour scheme and text size, so each component can be checked in light,
/// dark and AX3 without leaving the app.
public struct CatalogGallery: View {
    private let themes: [CatalogTheme]
    @State private var query = ""
    @State private var themeIndex = 0
    @State private var appearance = CatalogAppearance.system
    @State private var largeText = false

    public init(
        themes: [(name: String, theme: Theme)] = [("System", .system), ("Amber", .amber), ("Coach", .coach)]
    ) {
        self.themes = themes.enumerated().map {
            CatalogTheme(id: $0.offset, name: $0.element.name, theme: $0.element.theme)
        }
    }

    public var body: some View {
        NavigationStack {
            List {
                ForEach(CatalogIndex.groups(matching: query)) { group in
                    Section(group.section.rawValue) {
                        ForEach(group.components) { component in
                            NavigationLink(value: component) {
                                VStack(alignment: .leading, spacing: Space.xxs) {
                                    Text(component.title).font(.headline)
                                    Text(component.summary).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Kobo")
            .searchable(text: $query, prompt: "Search components")
            .navigationDestination(for: CatalogComponent.self) { CatalogDetail(component: $0) }
            .toolbar { ToolbarItem(placement: .primaryAction) { settingsMenu } }
        }
        .koboTheme(currentTheme)
        .preferredColorScheme(appearance.colorScheme)
        .dynamicTypeSize(largeText ? .accessibility3 : .large)
    }

    private var currentTheme: Theme {
        themes.indices.contains(themeIndex) ? themes[themeIndex].theme : .system
    }

    private var settingsMenu: some View {
        Menu {
            Picker("Theme", selection: $themeIndex) {
                ForEach(themes) { Text($0.name).tag($0.id) }
            }
            Picker("Appearance", selection: $appearance) {
                ForEach(CatalogAppearance.allCases) { Text($0.title).tag($0) }
            }
            Toggle("Accessibility text (AX3)", isOn: $largeText)
        } label: {
            Label("Display options", systemImage: "slider.horizontal.3")
        }
    }
}

struct CatalogTheme: Identifiable {
    let id: Int
    let name: String
    let theme: Theme
}

enum CatalogAppearance: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

#if DEBUG
    #Preview("Gallery") { CatalogGallery() }
    #Preview("Gallery · dark") { CatalogGallery().preferredColorScheme(.dark) }
    #Preview("Gallery · AX3") { CatalogGallery().dynamicTypeSize(.accessibility3) }
#endif

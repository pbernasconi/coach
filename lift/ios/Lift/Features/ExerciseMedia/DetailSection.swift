import KoboComponents
import KoboTokens
import SwiftUI

/// A titled part of an exercise detail page, flat on the canvas: its heading and its content start on the page
/// keyline, with no card of its own. An optional accessory (a link) sits at the end of the heading line; at
/// accessibility sizes it moves under the heading.
struct DetailSection<Content: View, Accessory: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let title: LocalizedStringKey
    private let content: Content
    private let accessory: Accessory

    init(
        _ title: LocalizedStringKey,
        @ViewBuilder content: () -> Content,
        @ViewBuilder accessory: () -> Accessory
    ) {
        self.title = title
        self.content = content()
        self.accessory = accessory()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: Space.xs) {
                    heading
                    accessory
                }
            } else {
                HStack(alignment: .center, spacing: Space.md) {
                    heading.frame(maxWidth: .infinity, alignment: .leading)
                    accessory
                }
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var heading: some View {
        Text(title)
            .font(theme.font(.headline))
            .foregroundStyle(theme.palette.textPrimary)
            .accessibilityAddTraits(.isHeader)
    }
}

extension DetailSection where Accessory == EmptyView {
    /// A section with a heading and no accessory.
    init(_ title: LocalizedStringKey, @ViewBuilder content: () -> Content) {
        self.init(title, content: content, accessory: { EmptyView() })
    }
}

#if DEBUG
    private struct DetailSectionPreview: View {
        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xl) {
                    ExerciseTitle(name: "Back squat")
                    DetailSection("Steps") {
                        CatalogSteps(steps: ["Stand tall under the bar.", "Sit down and back.", "Drive up."])
                    }
                    DetailSection("How to") {
                        BodyText("Brace before each rep and keep the bar over the middle of the foot.")
                    } accessory: {
                        Button("Videos", systemImage: "play.rectangle.fill") {}
                            .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
                    }
                }
                .pageColumn()
            }
            .screenCanvas()
            .koboTheme(.lift)
        }
    }

    #Preview("Light") { DetailSectionPreview() }
    #Preview("Dark") { DetailSectionPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { DetailSectionPreview().dynamicTypeSize(.accessibility3) }
#endif

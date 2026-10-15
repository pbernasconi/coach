#if DEBUG
    import KoboTokens
    import SwiftUI

    /// Debug sizes for preview helpers.
    public enum PreviewMatrix {
        /// The width of one rendering: an iPhone in portrait.
        public static let width: CGFloat = 390
    }

    /// Renders every fixture of a screen's state, stacked and labelled, each in light, dark and AX3.
    /// For `#Preview`s of any screen's `Content`.
    ///
    ///     #Preview("All states") {
    ///         StateGallery([("Default", .default), ("Loading", .loading), ("Error", .error)]) { state in
    ///             WorkoutsContent(state: state, send: { _ in })
    ///         }
    ///     }
    public struct StateGallery<Fixture, Content: View>: View {
        @Environment(\.koboTheme) private var theme
        private let fixtures: [GalleryFixture<Fixture>]
        private let content: (Fixture) -> Content

        public init(_ fixtures: [(String, Fixture)], @ViewBuilder content: @escaping (Fixture) -> Content) {
            self.fixtures = fixtures.enumerated().map { index, fixture in
                GalleryFixture(id: index, name: fixture.0, value: fixture.1)
            }
            self.content = content
        }

        public var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xxl) {
                    ForEach(fixtures) { fixture in
                        VStack(alignment: .leading, spacing: Space.sm) {
                            Text(fixture.name)
                                .font(theme.font(.title2))
                                .foregroundStyle(theme.palette.textPrimary)
                                .accessibilityAddTraits(.isHeader)
                            content(fixture.value).previewMatrix()
                        }
                    }
                }
                .padding(Space.gutter)
            }
        }
    }

    private struct GalleryFixture<Value>: Identifiable {
        let id: Int
        let name: String
        let value: Value
    }

    extension View {
        /// Renders this view three times side by side, in light, dark and at `.accessibility3`, for `#Preview`s.
        public func previewMatrix(width: CGFloat = PreviewMatrix.width) -> some View {
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: Space.lg) {
                    PreviewMatrixCell(caption: "Light", width: width) { self }
                        .environment(\.colorScheme, .light)
                    PreviewMatrixCell(caption: "Dark", width: width) { self }
                        .environment(\.colorScheme, .dark)
                    PreviewMatrixCell(caption: "AX3", width: width) { self }
                        .environment(\.dynamicTypeSize, .accessibility3)
                }
                .padding(Space.sm)
            }
        }
    }

    private struct PreviewMatrixCell<Content: View>: View {
        @Environment(\.koboTheme) private var theme
        let caption: String
        let width: CGFloat
        @ViewBuilder let content: Content

        var body: some View {
            VStack(alignment: .leading, spacing: Space.xs) {
                Text(caption)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                content
                    .frame(width: width, alignment: .top)
                    .background(theme.palette.canvas)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            }
            .padding(Space.sm)
            .background(theme.palette.canvas)
        }
    }

    private struct StateGallerySample: View {
        let itemCount: Int

        var body: some View {
            Text(itemCount > 0 ? "\(itemCount) items" : "Nothing here")
                .font(.body)
                .padding(Space.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    #Preview("Gallery") {
        StateGallery([("Empty", 0), ("Some", 3), ("Many", 120)]) { count in
            StateGallerySample(itemCount: count)
        }
    }

    #Preview("Matrix") {
        StateGallerySample(itemCount: 3).previewMatrix()
    }
#endif

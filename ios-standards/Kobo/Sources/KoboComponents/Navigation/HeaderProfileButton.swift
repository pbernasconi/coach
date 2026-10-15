import KoboTokens
import SwiftUI

/// The profile entry of an `AppHeader`: a 44 pt glass capsule with the person's `Avatar` and name, which opens their
/// profile or settings. A long name truncates at the tail and shows whole in the Large Content Viewer. With no name
/// (not loaded yet, or blank) it says "Profile". Its text stops growing at AX2, like the system bars.
///
///     HeaderProfileButton(name: user.displayName, image: user.photo) { openProfile() }
public struct HeaderProfileButton: View {
    @Environment(\.koboTheme) private var theme
    private let name: String?
    private let image: Image?
    private let showsName: Bool
    private let action: () -> Void

    /// - Parameters:
    ///   - name: shown as is, trimmed; `nil` or blank shows "Profile".
    ///   - image: a loaded picture for the avatar.
    ///   - showsName: `false` draws the avatar alone in a glass circle.
    public init(name: String?, image: Image? = nil, showsName: Bool = true, action: @escaping () -> Void) {
        self.name = HeaderProfileTitle.title(name: name)
        self.image = image
        self.showsName = showsName
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Space.sm) {
                Avatar(name: name ?? "", image: image, diameter: .small)
                    .accessibilityHidden(true)
                if showsName {
                    title
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textPrimary)
                        .lineLimit(1)
                        .padding(.trailing, Space.md)
                }
            }
            .padding(Space.xs + Space.xxs)
            .frame(minHeight: Size.minTouch)
            .headerGlass(in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.pressFeedback)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .accessibilityLabel(name.map { Text(verbatim: $0) } ?? Text("Profile", bundle: .module))
        .accessibilityHint(Text("Opens your profile", bundle: .module))
        .accessibilityShowsLargeContentViewer()
    }

    private var title: Text {
        name.map { Text(verbatim: $0) } ?? Text("Profile", bundle: .module)
    }
}

#if DEBUG
    private struct HeaderProfileButtonPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                HeaderProfileButton(name: "Mira Castellan") {}
                HeaderProfileButton(name: "Alexandria Montgomery-Whitfield") {}
                HeaderProfileButton(name: nil) {}
                HeaderProfileButton(name: "Mira Castellan", showsName: false) {}
            }
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
            .screenCanvas()
        }
    }

    #Preview("Header profile button") { HeaderProfileButtonPreview() }
    #Preview("Header profile button · dark, Amber") {
        HeaderProfileButtonPreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Header profile button · AX3") { HeaderProfileButtonPreview().dynamicTypeSize(.accessibility3) }
#endif

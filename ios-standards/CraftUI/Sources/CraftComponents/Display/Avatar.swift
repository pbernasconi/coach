import CraftTokens
import Foundation
import SwiftUI

/// A person's picture: their initials on a tone picked from the name, with an image over them when there is one.
/// VoiceOver reads the name.
///
///     Avatar(name: "Ada Lovelace", diameter: .large)
public struct Avatar: View {
    /// The fixed sizes an avatar comes in.
    public enum Diameter: Sendable, CaseIterable {
        case small, medium, large, extraLarge

        public var points: CGFloat {
            switch self {
            case .small: Size.iconLg + Space.sm
            case .medium: Size.minTouch
            case .large: Size.thumbnail
            case .extraLarge: Size.thumbnail + Space.xxl
            }
        }
    }

    private let name: String
    private let image: Image?
    private let diameter: Diameter
    private let tone: Tone?
    @Environment(\.craftTheme) private var theme

    /// - Parameters:
    ///   - image: a loaded picture, drawn over the initials and cropped to the circle.
    ///   - tone: overrides the tone picked from the name.
    public init(name: String, image: Image? = nil, diameter: Diameter = .medium, tone: Tone? = nil) {
        self.name = name
        self.image = image
        self.diameter = diameter
        self.tone = tone
    }

    public var body: some View {
        let side = diameter.points
        let colors = theme.palette.status(tone ?? Monogram.tone(for: name))
        let initials = Monogram.initials(from: name)
        ZStack {
            Circle().fill(colors.soft)
            Group {
                if initials.isEmpty {
                    Image(systemName: "person.fill")
                } else {
                    Text(verbatim: initials)
                }
            }
            // The disc has a fixed size, so the initials scale with it rather than with Dynamic Type.
            .font(.system(size: side * 0.4, weight: .semibold, design: theme.typography.design))
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .foregroundStyle(colors.ink)
            if let image {
                image.resizable().scaledToFill()
            }
        }
        .frame(width: side, height: side)
        .clipShape(Circle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityName)
        .accessibilityAddTraits(.isImage)
    }

    private var accessibilityName: Text {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? Text("Person", bundle: .module) : Text(verbatim: trimmed)
    }
}

private struct AvatarPreviews: View {
    var body: some View {
        VStack(spacing: Space.lg) {
            HStack(spacing: Space.md) {
                ForEach(Avatar.Diameter.allCases, id: \.points) { diameter in
                    Avatar(name: "Ada Lovelace", diameter: diameter)
                }
            }
            HStack(spacing: Space.md) {
                Avatar(name: "Grace Hopper")
                Avatar(name: "Alan Turing")
                Avatar(name: "Katherine Johnson")
                Avatar(name: "", tone: .neutral)
                // swiftlint:disable:next accessibility_label_for_image
                Avatar(name: "Photo", image: Image(systemName: "photo.fill"), tone: .info)  // Avatar labels it by name
            }
        }
        .padding()
    }
}

#Preview("Avatar") { AvatarPreviews() }
#Preview("Avatar, dark") { AvatarPreviews().preferredColorScheme(.dark) }
#Preview("Avatar, AX3") { AvatarPreviews().dynamicTypeSize(.accessibility3) }

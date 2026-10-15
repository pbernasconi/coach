import Foundation
import KoboTokens
import SwiftUI

/// A person's picture: their initials on a tone picked from the name, with an image over them when there is one (a
/// loaded `Image`, or a URL that loads in place; a failed load leaves the initials). VoiceOver reads the name, or
/// "Person".
///
///     Avatar(name: "Maya Chen", diameter: .large)
///     Avatar(name: member.name, imageURL: member.photoURL)
///
/// Rule 9 exception (CONVENTIONS.md): the disc has a fixed `Diameter`, so the initials take a size computed from the
/// disc (maths inside a shape), not a Dynamic Type role; they would overflow the circle otherwise. The name stays
/// readable at any text size through VoiceOver and the surrounding row's own text.
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
    private let imageURL: URL?
    private let diameter: Diameter
    private let tone: Tone?
    @Environment(\.koboTheme) private var theme

    /// - Parameters:
    ///   - image: a loaded picture, drawn over the initials and cropped to the circle.
    ///   - tone: overrides the tone picked from the name.
    public init(name: String, image: Image? = nil, diameter: Diameter = .medium, tone: Tone? = nil) {
        self.name = name
        self.image = image
        self.imageURL = nil
        self.diameter = diameter
        self.tone = tone
    }

    /// An avatar whose picture loads from `imageURL`; the initials show until it arrives, and stay if it fails.
    public init(name: String, imageURL: URL?, diameter: Diameter = .medium, tone: Tone? = nil) {
        self.name = name
        self.image = nil
        self.imageURL = imageURL
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
                    Image(systemName: "person.fill").accessibilityHidden(true)  // the avatar reads "Person"
                } else {
                    Text(verbatim: initials)
                }
            }
            // The disc has a fixed size, so the initials scale with it rather than with Dynamic Type (rule 9
            // exception, see above), with a side inset that keeps wide letters ("MW") inside the circle.
            .font(.system(size: side * Self.initialsRatio, weight: .semibold, design: theme.typography.design))
            .lineLimit(1)
            .minimumScaleFactor(Self.initialsMinimumScale)
            .padding(.horizontal, side * Self.initialsInsetRatio)
            .foregroundStyle(colors.ink)
            if let image {
                image.resizable().scaledToFill()
            } else if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    if case .success(let loaded) = phase {
                        loaded.resizable().scaledToFill().accessibilityHidden(true)  // the avatar reads the name
                    }
                }
            }
        }
        .frame(width: side, height: side)
        .clipShape(Circle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityName)
        .accessibilityAddTraits(.isImage)
    }

    /// The initials' size as a share of the disc.
    static let initialsRatio: CGFloat = 0.4
    /// How far long initials may shrink to stay inside the disc.
    static let initialsMinimumScale: CGFloat = 0.5
    /// The side inset of the initials, as a share of the disc, so the letters never touch the curve.
    static let initialsInsetRatio: CGFloat = 0.12

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
                    Avatar(name: "Maya Chen", diameter: diameter)
                }
            }
            HStack(spacing: Space.md) {
                Avatar(name: "Omar Haddad")
                Avatar(name: "Sam & Alex Park")
                Avatar(name: "Élodie Dubois")
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

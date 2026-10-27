import KoboTokens
import SwiftUI

/// A source tile in `ChatAttachSheet`'s row: the camera, or the whole library when no recent photos show.
struct ChatAttachSourceTile: View {
    enum Kind { case camera, library }

    @Environment(\.koboTheme) private var theme
    let kind: Kind
    let side: CGFloat
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Space.sm) {
                Image(systemName: kind == .camera ? "camera" : "photo.on.rectangle")
                    .font(theme.font(.title2))
                    .accessibilityHidden(true)
                label.font(theme.font(.subheadline).weight(.medium))
            }
            .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
            .frame(width: side, height: side)
            .background(
                theme.palette.surfaceSunken,
                in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .pressFeedback()
        .disabled(!isEnabled)
    }

    private var label: Text {
        kind == .camera ? Text("Camera", bundle: .module) : Text("Photos", bundle: .module)
    }
}

/// A recent photo in `ChatAttachSheet`: the picture filling a rounded square, and a check in its corner once picked.
struct ChatAttachPhotoTile: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var check = Space.xxl
    let tile: ChatPhotoTile
    let number: Int
    let side: CGFloat
    let isSelected: Bool
    let action: () -> Void

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.lg, style: .continuous) }

    var body: some View {
        Button(action: action) {
            picture
                .frame(width: side, height: side)
                .clipShape(shape)
                .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
                .overlay(alignment: .topTrailing) {
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(theme.font(.caption).weight(.bold))
                            .foregroundStyle(theme.palette.onAccent)
                            .frame(width: check, height: check)
                            .background(theme.palette.accent, in: Circle())
                            .overlay { Circle().strokeBorder(theme.palette.canvas, lineWidth: Size.hairline * 3) }
                            .padding(Space.sm)
                            .transition(Motion.pop(reduceMotion: reduceMotion))
                    }
                }
                .contentShape(shape)
        }
        .buttonStyle(.plain)
        .pressFeedback()
        .koboAnimation(.instant, value: isSelected)
        .accessibilityLabel(Text("Photo \(number)", bundle: .module))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var picture: some View {
        if let image = tile.image {
            image.resizable().scaledToFill()
        } else {
            theme.palette.surfaceSunken
        }
    }
}

/// "Add files": one row on the surface, a page glyph and the words.
struct ChatAttachFilesRow: View {
    @Environment(\.koboTheme) private var theme
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Space.md) {
                Image(systemName: "arrow.up.doc")
                    .font(theme.font(.title3))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityHidden(true)
                Text("Add files", bundle: .module)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Space.cardInset)
            .frame(minHeight: Size.rowMinHeight)
            .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .pressFeedback()
    }
}

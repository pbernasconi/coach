import KoboTokens
import SwiftUI

/// Photos and files in a row of rounded tiles that scrolls sideways: above the field in a composer (small, each with a
/// remove button and its upload state), or above a sent message (larger, trailing, read-only). A photo shows the
/// picture `preview` gives (a quiet placeholder until it has one); a file shows a page glyph and its name.
///
///     ChatAttachmentStrip(items, preview: { thumbnails[$0.id] }, onRemove: { remove($0) }, onRetry: { upload($0) })
///     ChatAttachmentStrip(message.files, size: .regular, alignment: .trailing, preview: { images[$0.id] })
public struct ChatAttachmentStrip: View {
    /// The tile size: compact in a composer, regular under a message.
    public enum Size: Equatable, Sendable {
        case compact
        case regular

        var side: CGFloat {
            switch self {
            case .compact: KoboTokens.Size.thumbnail + Space.sm
            case .regular: KoboTokens.Size.thumbnail * 2
            }
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1
    private let items: [ChatAttachment]
    private let size: Size
    private let alignment: HorizontalAlignment
    private let preview: (ChatAttachment) -> Image?
    private let onRemove: ((ChatAttachment) -> Void)?
    private let onRetry: ((ChatAttachment) -> Void)?
    private let onOpen: ((ChatAttachment) -> Void)?

    /// A strip. `onRemove` adds the remove button, `onRetry` makes a failed tile retry, `onOpen` opens a tile.
    public init(
        _ items: [ChatAttachment],
        size: Size = .compact,
        alignment: HorizontalAlignment = .leading,
        preview: @escaping (ChatAttachment) -> Image?,
        onRemove: ((ChatAttachment) -> Void)? = nil,
        onRetry: ((ChatAttachment) -> Void)? = nil,
        onOpen: ((ChatAttachment) -> Void)? = nil
    ) {
        self.items = items
        self.size = size
        self.alignment = alignment
        self.preview = preview
        self.onRemove = onRemove
        self.onRetry = onRetry
        self.onOpen = onOpen
    }

    public var body: some View {
        let anchor: UnitPoint = alignment == .trailing ? .trailing : .leading
        ScrollView(.horizontal) {
            HStack(spacing: Space.sm) {
                ForEach(items) { item in
                    ChatAttachmentTile(
                        item: item,
                        side: size.side * min(scale, 1.5),
                        image: preview(item),
                        onRemove: Self.bind(onRemove, to: item),
                        onRetry: Self.bind(onRetry, to: item),
                        onOpen: Self.bind(onOpen, to: item)
                    )
                    .transition(Motion.pop(reduceMotion: reduceMotion))
                }
            }
            .koboAnimation(.present, value: items.map(\.id))
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .defaultScrollAnchor(anchor, for: .alignment)
        .defaultScrollAnchor(anchor, for: .initialOffset)
    }

    private static func bind(_ action: ((ChatAttachment) -> Void)?, to item: ChatAttachment) -> (() -> Void)? {
        guard let action else { return nil }
        return { action(item) }
    }
}

/// One tile: the picture or the file, its upload state, and the remove button in its corner.
private struct ChatAttachmentTile: View {
    @Environment(\.koboTheme) private var theme
    let item: ChatAttachment
    let side: CGFloat
    let image: Image?
    let onRemove: (() -> Void)?
    let onRetry: (() -> Void)?
    let onOpen: (() -> Void)?

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.md, style: .continuous) }

    /// What a tap does: retry a failed upload, else open the tile; nothing when neither is offered.
    private var tap: (() -> Void)? { item.state == .failed ? onRetry : onOpen }

    var body: some View {
        Group {
            if let tap {
                Button(action: tap) { tile }.buttonStyle(.plain).pressFeedback()
            } else {
                tile
            }
        }
        .overlay(alignment: .topTrailing) {
            if let onRemove { ChatAttachmentRemoveButton(name: item.name, action: onRemove) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
        .accessibilityActions {
            if let onRemove { Button(action: onRemove) { Text("Remove", bundle: .module) } }
        }
    }

    private var tile: some View {
        face
            .frame(width: side, height: side)
            .clipShape(shape)
            .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
            .overlay { state }
    }

    @ViewBuilder
    private var face: some View {
        switch item.kind {
        case .image:
            if let image {
                image.resizable().scaledToFill().accessibilityHidden(true)
            } else {
                theme.palette.surfaceSunken
                    .overlay {
                        Image(systemName: "photo").foregroundStyle(theme.palette.textTertiary).accessibilityHidden(true)
                    }
            }
        case .file:
            VStack(spacing: Space.xs) {
                Image(systemName: "doc.text")
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityHidden(true)
                Text(verbatim: item.name)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
            }
            .padding(Space.xs)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(theme.palette.surfaceSunken)
        }
    }

    @ViewBuilder
    private var state: some View {
        switch item.state {
        case .ready: EmptyView()
        case .uploading:
            ZStack {
                theme.palette.scrim
                ProgressView().tint(theme.palette.canvas)
            }
            .clipShape(shape)
        case .failed:
            ZStack {
                theme.palette.scrim
                Image(systemName: "arrow.clockwise")
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.canvas)
                    .accessibilityHidden(true)
            }
            .clipShape(shape)
        }
    }

    private var label: Text {
        switch item.state {
        case .ready: Text(verbatim: item.name)
        case .uploading: Text(verbatim: "\(item.name), \(String(localized: "Uploading", bundle: .module))")
        case .failed:
            Text(verbatim: "\(item.name), \(String(localized: "Upload failed. Tap to try again", bundle: .module))")
        }
    }
}

/// The small round remove button in a tile's corner: a dark disc with a cross, in a 44 pt target.
private struct ChatAttachmentRemoveButton: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var disc = Space.xxl
    let name: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(theme.font(.caption).weight(.bold))
                .foregroundStyle(theme.palette.canvas)
                .frame(width: disc, height: disc)
                .background(theme.palette.textPrimary.opacity(0.8), in: Circle())
                .padding(Space.xs)
                .frame(width: Size.minTouch, height: Size.minTouch, alignment: .topTrailing)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: "\(String(localized: "Remove", bundle: .module)) \(name)"))
    }
}

#if DEBUG
    private struct ChatAttachmentStripPreview: View {
        @State private var items = [
            ChatAttachment(id: "a", kind: .image, name: "Photo", state: .ready),
            ChatAttachment(id: "b", kind: .image, name: "Photo", state: .uploading),
            ChatAttachment(id: "c", kind: .file, name: "Trip notes.pdf", state: .ready),
            ChatAttachment(id: "d", kind: .image, name: "Photo", state: .failed),
        ]

        var body: some View {
            VStack(alignment: .leading, spacing: Space.xl) {
                ChatAttachmentStrip(
                    items,
                    preview: { _ in nil },
                    onRemove: { item in items.removeAll { $0.id == item.id } }
                )
                ChatAttachmentStrip(Array(items.prefix(2)), size: .regular, alignment: .trailing, preview: { _ in nil })
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Attachment strip") { ChatAttachmentStripPreview() }
    #Preview("Attachment strip · dark") { ChatAttachmentStripPreview().preferredColorScheme(.dark) }
    #Preview("Attachment strip · AX3") { ChatAttachmentStripPreview().dynamicTypeSize(.accessibility3) }
#endif

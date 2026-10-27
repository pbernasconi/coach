import KoboTokens
import SwiftUI

/// A recent photo in `ChatAttachSheet`: its id, and its picture once it has loaded.
public struct ChatPhotoTile: Identifiable {
    public let id: String
    public var image: Image?

    public init(id: String, image: Image? = nil) {
        self.id = id
        self.image = image
    }
}

/// What the + of a chat composer opens: a close button, the title and a Photos button that opens the whole library;
/// then a row with the camera and the most recent photos (tap to pick several, in order); then "Add files"; and,
/// once photos are picked, "Attach N photos" pinned at the bottom. Without recent photos (no access yet) the row
/// offers the library instead. Usually shown by `.chatAttachPicker`, which loads the photos and runs the pickers.
///
///     ChatAttachSheet("Add to message", recents: tiles, selection: $picked, onClose: close, onCamera: camera,
///         onLibrary: library, onFiles: files, onAttach: attach)
public struct ChatAttachSheet: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var tileSide = Size.thumbnail * 2
    private let title: Text
    private let recents: [ChatPhotoTile]
    private let selection: Binding<[String]>
    private let limit: Int
    private let isBusy: Bool
    private let canUseCamera: Bool
    private let onClose: () -> Void
    private let onCamera: () -> Void
    private let onLibrary: () -> Void
    private let onFiles: (() -> Void)?
    private let onAttach: () -> Void

    /// A sheet with a localized title. `onFiles` adds the "Add files" row; `limit` caps the photos picked at once.
    public init(
        _ title: LocalizedStringKey,
        recents: [ChatPhotoTile],
        selection: Binding<[String]>,
        limit: Int = 6,
        isBusy: Bool = false,
        canUseCamera: Bool = true,
        onClose: @escaping () -> Void,
        onCamera: @escaping () -> Void,
        onLibrary: @escaping () -> Void,
        onFiles: (() -> Void)? = nil,
        onAttach: @escaping () -> Void
    ) {
        self.init(
            title: Text(title),
            recents,
            selection,
            limit,
            isBusy,
            canUseCamera,
            onClose,
            onCamera,
            onLibrary,
            onFiles,
            onAttach
        )
    }

    /// A sheet whose title is runtime text.
    public init(
        verbatim title: String,
        recents: [ChatPhotoTile],
        selection: Binding<[String]>,
        limit: Int = 6,
        isBusy: Bool = false,
        canUseCamera: Bool = true,
        onClose: @escaping () -> Void,
        onCamera: @escaping () -> Void,
        onLibrary: @escaping () -> Void,
        onFiles: (() -> Void)? = nil,
        onAttach: @escaping () -> Void
    ) {
        self.init(
            title: Text(verbatim: title),
            recents,
            selection,
            limit,
            isBusy,
            canUseCamera,
            onClose,
            onCamera,
            onLibrary,
            onFiles,
            onAttach
        )
    }

    init(
        title: Text,
        _ recents: [ChatPhotoTile],
        _ selection: Binding<[String]>,
        _ limit: Int,
        _ isBusy: Bool,
        _ canUseCamera: Bool,
        _ onClose: @escaping () -> Void,
        _ onCamera: @escaping () -> Void,
        _ onLibrary: @escaping () -> Void,
        _ onFiles: (() -> Void)?,
        _ onAttach: @escaping () -> Void
    ) {
        self.title = title
        self.recents = recents
        self.selection = selection
        self.limit = limit
        self.isBusy = isBusy
        self.canUseCamera = canUseCamera
        self.onClose = onClose
        self.onCamera = onCamera
        self.onLibrary = onLibrary
        self.onFiles = onFiles
        self.onAttach = onAttach
    }

    public var body: some View {
        VStack(spacing: Space.lg) {
            header
            ScrollView(.horizontal) {
                HStack(spacing: Space.sm) {
                    ChatAttachSourceTile(kind: .camera, side: tileSide, isEnabled: canUseCamera, action: onCamera)
                    if recents.isEmpty {
                        ChatAttachSourceTile(kind: .library, side: tileSide, isEnabled: true, action: onLibrary)
                    }
                    ForEach(Array(recents.enumerated()), id: \.element.id) { index, tile in
                        ChatAttachPhotoTile(
                            tile: tile,
                            number: index + 1,
                            side: tileSide,
                            isSelected: selection.wrappedValue.contains(tile.id)
                        ) {
                            selection.wrappedValue = ChatAttachmentLogic.toggled(
                                tile.id,
                                in: selection.wrappedValue,
                                limit: limit
                            )
                        }
                    }
                }
                .padding(.horizontal, Space.gutter)
            }
            .scrollIndicators(.hidden)
            if let onFiles { ChatAttachFilesRow(action: onFiles).padding(.horizontal, Space.gutter) }
            if !selection.wrappedValue.isEmpty {
                attachButton
                    .padding(.horizontal, Space.gutter)
                    .transition(Motion.rise(reduceMotion: reduceMotion))
            }
        }
        .padding(.top, Space.lg)
        .padding(.bottom, Space.sm)
        .koboAnimation(.present, value: selection.wrappedValue.isEmpty)
        .koboFeedback(.selection, trigger: selection.wrappedValue)
    }

    private var header: some View {
        ZStack {
            title
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            HStack {
                CloseButton(action: onClose)
                Spacer()
                Button(action: onLibrary) {
                    Text("Photos", bundle: .module)
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.textSecondary)
                        .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint(Text("Opens all your photos", bundle: .module))
            }
        }
        .padding(.horizontal, Space.gutter)
    }

    private var attachButton: some View {
        let count = selection.wrappedValue.count
        return Button(action: onAttach) {
            count == 1 ? Text("Attach 1 photo", bundle: .module) : Text("Attach \(count) photos", bundle: .module)
        }
        .buttonStyle(.kobo(.primary, width: .full, isLoading: isBusy))
        .disabled(isBusy)
    }
}

#if DEBUG
    private struct ChatAttachSheetPreview: View {
        @State private var picked = ["2"]
        let tiles: [ChatPhotoTile]

        var body: some View {
            ChatAttachSheet(
                "Add to message",
                recents: tiles,
                selection: $picked,
                onClose: {},
                onCamera: {},
                onLibrary: {},
                onFiles: {},
                onAttach: {}
            )
            .screenCanvas()
        }
    }

    #Preview("Attach sheet") { ChatAttachSheetPreview(tiles: (1...6).map { ChatPhotoTile(id: "\($0)") }) }
    #Preview("Attach sheet · no photos, dark") { ChatAttachSheetPreview(tiles: []).preferredColorScheme(.dark) }
    #Preview("Attach sheet · AX3") {
        ChatAttachSheetPreview(tiles: (1...6).map { ChatPhotoTile(id: "\($0)") }).dynamicTypeSize(.accessibility3)
    }
#endif

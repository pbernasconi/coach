#if os(iOS)
    import KoboTokens
    import PhotosUI
    import SwiftUI
    import UniformTypeIdentifiers

    extension View {
        /// Presents the attach sheet (`ChatAttachSheet`) and runs everything behind it: the recent photos (PhotoKit,
        /// asking for access once), the camera, the whole library (`PhotosPicker`) and files (`fileImporter`). It hands
        /// back what was picked, ready to upload (photos shrunk to JPEG, `ChatPickedFile`), and closes. The app needs
        /// `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`.
        ///
        ///     .chatAttachPicker(isPresented: $adding, limit: 6 - attached.count) { files in upload(files) }
        public func chatAttachPicker(
            isPresented: Binding<Bool>,
            title: LocalizedStringKey? = nil,
            limit: Int = 6,
            fileTypes: [UTType] = [.pdf, .plainText, .commaSeparatedText, .json, .image],
            onPick: @escaping ([ChatPickedFile]) -> Void
        ) -> some View {
            sheet(isPresented: isPresented) {
                ChatAttachPicker(
                    title: title.map { Text($0) } ?? Text("Add to message", bundle: .module),
                    limit: max(1, limit),
                    fileTypes: fileTypes,
                    onPick: { files in
                        isPresented.wrappedValue = false
                        onPick(files)
                    },
                    onClose: { isPresented.wrappedValue = false }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
        }
    }

    /// The attach sheet with its pickers and the recent photos.
    private struct ChatAttachPicker: View {
        @ScaledMetric(relativeTo: .body) private var tileSide = Size.thumbnail * 2
        let title: Text
        let limit: Int
        let fileTypes: [UTType]
        let onPick: ([ChatPickedFile]) -> Void
        let onClose: () -> Void
        @State private var recents = ChatRecentPhotos()
        @State private var selection: [String] = []
        @State private var isBusy = false
        @State private var showsCamera = false
        @State private var showsLibrary = false
        @State private var showsFiles = false
        @State private var libraryItems: [PhotosPickerItem] = []

        var body: some View {
            ChatAttachSheet(
                title: title,
                recents.tiles,
                $selection,
                limit,
                isBusy,
                ChatCameraPicker.isAvailable,
                onClose,
                { showsCamera = true },
                { showsLibrary = true },
                { showsFiles = true },
                attachSelection
            )
            .task { await recents.load(limit: 24, side: tileSide * 2) }
            .photosPicker(
                isPresented: $showsLibrary,
                selection: $libraryItems,
                maxSelectionCount: limit,
                selectionBehavior: .ordered,
                matching: .images
            )
            .onChange(of: libraryItems) { _, items in
                guard !items.isEmpty else { return }
                libraryItems = []
                finish { await ChatPickedFiles.fromLibrary(items) }
            }
            .fileImporter(isPresented: $showsFiles, allowedContentTypes: fileTypes, allowsMultipleSelection: true) {
                guard case .success(let urls) = $0, !urls.isEmpty else { return }
                finish { await ChatPickedFiles.fromFiles(urls) }
            }
            .fullScreenCover(isPresented: $showsCamera) {
                ChatCameraPicker { data in
                    showsCamera = false
                    if let data { finish { await ChatPickedFiles.fromCamera(data) } }
                }
                .ignoresSafeArea()
            }
        }

        private func attachSelection() {
            let ids = selection
            finish { await ChatPickedFiles.fromRecents(ids) }
        }

        /// Prepares the picked items (the Attach button spins meanwhile), then hands them back.
        private func finish(_ work: @escaping @Sendable () async -> [ChatPickedFile]) {
            guard !isBusy else { return }
            isBusy = true
            Task {
                let files = await work()
                isBusy = false
                if !files.isEmpty { onPick(Array(files.prefix(limit))) }
            }
        }
    }

    /// The recent photos for the sheet's row, loaded once it shows.
    @Observable
    private final class ChatRecentPhotos {
        private(set) var tiles: [ChatPhotoTile] = []

        func load(limit: Int, side: CGFloat) async {
            guard tiles.isEmpty, await ChatPhotoLibrary.authorize() else { return }
            let ids = await ChatPhotoLibrary.recentIDs(limit: limit)
            tiles = ids.map { ChatPhotoTile(id: $0) }
            await withTaskGroup(of: (String, Data?).self) { group in
                for id in ids { group.addTask { (id, await ChatPhotoLibrary.thumbnail(id, side: side)) } }
                for await (id, data) in group {
                    guard let data, let image = UIImage(data: data),
                        let index = tiles.firstIndex(where: { $0.id == id })
                    else { continue }
                    tiles[index].image = Image(uiImage: image)
                }
            }
        }
    }

    /// The system camera, for one photo. Hands back its JPEG, or nil when cancelled.
    private struct ChatCameraPicker: UIViewControllerRepresentable {
        static var isAvailable: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

        let onDone: (Data?) -> Void

        func makeUIViewController(context: Context) -> UIImagePickerController {
            let picker = UIImagePickerController()
            picker.sourceType = Self.isAvailable ? .camera : .photoLibrary
            picker.delegate = context.coordinator
            return picker
        }

        func updateUIViewController(_: UIImagePickerController, context _: Context) {}

        func makeCoordinator() -> Coordinator { Coordinator(onDone: onDone) }

        final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
            let onDone: (Data?) -> Void

            init(onDone: @escaping (Data?) -> Void) { self.onDone = onDone }

            func imagePickerController(
                _: UIImagePickerController,
                didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
            ) {
                onDone((info[.originalImage] as? UIImage)?.jpegData(compressionQuality: 0.9))
            }

            func imagePickerControllerDidCancel(_: UIImagePickerController) { onDone(nil) }
        }
    }
#endif

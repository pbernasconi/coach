#if canImport(ImageIO) && canImport(Photos) && canImport(UIKit)
    import Foundation
    import ImageIO
    import Photos
    import PhotosUI
    import UIKit
    import UniformTypeIdentifiers

    /// Turns what the attach pickers hand over (recent photos, library items, camera shots, files) into
    /// `ChatPickedFile`s ready to upload: photos shrunk to `ChatImageFit.maxSide` as JPEG (HEIC included) with a small
    /// preview; PDFs and text as they are, up to `maxFileBytes`. Runs off the main actor.
    nonisolated enum ChatPickedFiles {
        /// Files larger than this are left out (the usual server limit is about 4 MB).
        static let maxFileBytes = 4 * 1024 * 1024

        @concurrent static func fromRecents(_ ids: [String]) async -> [ChatPickedFile] {
            var files: [ChatPickedFile] = []
            for id in ids {
                guard let original = await ChatPhotoLibrary.original(id) else { continue }
                if let file = shrink(original, name: String(localized: "Photo", bundle: .module)) { files.append(file) }
            }
            return files
        }

        @concurrent static func fromLibrary(_ items: [PhotosPickerItem]) async -> [ChatPickedFile] {
            var files: [ChatPickedFile] = []
            for item in items {
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                if let file = shrink(data, name: String(localized: "Photo", bundle: .module)) { files.append(file) }
            }
            return files
        }

        @concurrent static func fromCamera(_ data: Data) async -> [ChatPickedFile] {
            shrink(data, name: String(localized: "Photo", bundle: .module)).map { [$0] } ?? []
        }

        @concurrent static func fromFiles(_ urls: [URL]) async -> [ChatPickedFile] {
            urls.compactMap { url in
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { return nil }
                let type = UTType(filenameExtension: url.pathExtension)
                if type?.conforms(to: .image) == true { return shrink(data, name: url.lastPathComponent) }
                guard data.count <= maxFileBytes else { return nil }
                return ChatPickedFile(
                    id: UUID().uuidString,
                    kind: .file,
                    name: url.lastPathComponent,
                    contentType: mimeType(type),
                    data: data
                )
            }
        }

        static func mimeType(_ type: UTType?) -> String {
            guard let type else { return "application/octet-stream" }
            if type.conforms(to: .pdf) { return "application/pdf" }
            if type.conforms(to: .commaSeparatedText) { return "text/csv" }
            if type.conforms(to: .json) { return "application/json" }
            if type.conforms(to: .plainText) { return "text/plain" }
            return type.preferredMIMEType ?? "application/octet-stream"
        }

        /// A photo shrunk to `ChatImageFit.maxSide` on its long side, turned upright, as JPEG, with a small preview.
        static func shrink(_ data: Data, name: String) -> ChatPickedFile? {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                let image = thumbnail(source, side: ChatImageFit.maxSide),
                let jpeg = jpeg(image, quality: 0.8)
            else { return nil }
            let preview = thumbnail(source, side: ChatImageFit.previewSide).flatMap { jpeg($0, quality: 0.7) }
            return ChatPickedFile(
                id: UUID().uuidString,
                kind: .image,
                name: name,
                contentType: "image/jpeg",
                data: jpeg,
                pixelWidth: image.width,
                pixelHeight: image.height,
                preview: preview
            )
        }

        static func thumbnail(_ source: CGImageSource, side: Int) -> CGImage? {
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true,
                kCGImageSourceThumbnailMaxPixelSize: side,
            ]
            return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        }

        static func jpeg(_ image: CGImage, quality: Double) -> Data? {
            let out = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil)
            else { return nil }
            CGImageDestinationAddImage(
                destination,
                image,
                [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
            )
            return CGImageDestinationFinalize(destination) ? out as Data : nil
        }
    }

    /// Image data shrunk for a tile: a sent photo's bytes from the server, read again as a small JPEG.
    nonisolated public enum ChatImageData {
        /// A JPEG at most `maxSide` pixels on its long side, upright; nil when `data` is not an image. Off the main actor.
        @concurrent public static func thumbnail(_ data: Data, maxSide: Int = ChatImageFit.previewSide * 2) async
            -> Data?
        {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                let image = ChatPickedFiles.thumbnail(source, side: maxSide)
            else { return nil }
            return ChatPickedFiles.jpeg(image, quality: 0.8)
        }
    }

    /// The photo library, read through PhotoKit: access, the newest photos, a thumbnail, and a photo's original data.
    /// Asks for access on first use (the app needs `NSPhotoLibraryUsageDescription`).
    nonisolated enum ChatPhotoLibrary {
        /// Whether the recent photos can be shown (full or limited access), asking once.
        static func authorize() async -> Bool {
            switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
            case .authorized, .limited: return true
            case .notDetermined:
                let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
                return status == .authorized || status == .limited
            default: return false
            }
        }

        /// The newest photos' ids, newest first.
        @concurrent static func recentIDs(limit: Int) async -> [String] {
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.fetchLimit = limit
            let result = PHAsset.fetchAssets(with: .image, options: options)
            return (0..<result.count).map { result.object(at: $0).localIdentifier }
        }

        /// A square-ish thumbnail of `side` points, as JPEG.
        @concurrent static func thumbnail(_ id: String, side: CGFloat) async -> Data? {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                return nil
            }
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat  // one answer, never a blurry one first
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = true
            let size = CGSize(width: side, height: side)
            return await withCheckedContinuation { continuation in
                PHImageManager.default().requestImage(
                    for: asset,
                    targetSize: size,
                    contentMode: .aspectFill,
                    options: options
                ) { image, _ in
                    continuation.resume(returning: image?.jpegData(compressionQuality: 0.8))
                }
            }
        }

        /// The photo's data as stored (HEIC or JPEG), fetched from iCloud when needed.
        @concurrent static func original(_ id: String) async -> Data? {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                return nil
            }
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.isNetworkAccessAllowed = true
            options.version = .current
            return await withCheckedContinuation { continuation in
                PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
                    continuation.resume(returning: data)
                }
            }
        }
    }
#endif

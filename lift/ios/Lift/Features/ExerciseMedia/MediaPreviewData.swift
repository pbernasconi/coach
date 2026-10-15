#if DEBUG
    import Foundation

    /// Made-up media for fixtures and previews: a drawn 60 × 60 figure (not dataset media), so nothing touches the
    /// network and no © Gym visual file is ever in the repository.
    nonisolated enum MediaPreviewData {
        private static let png =
            "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAIAAAC1nk4lAAAAaUlEQVR42u3YwQ2AMBADwdTp7umEBkDklzOarWBe"
            + "zinrKmxBQ0NDQ0PPR+ep0ei8NxSdr8ahsxc0NDT0H9CVO936IrbeHmVXnvWA7kDnXNDQ0CYPGhoaGhoaGhq69t8D"
            + "GhoaGhoaGnqjG5ixejjY/L0CAAAAAElFTkSuQmCC"

        static let still: MediaImage = Data(base64Encoded: png).map(MediaImage.loaded) ?? .failed
    }
#endif

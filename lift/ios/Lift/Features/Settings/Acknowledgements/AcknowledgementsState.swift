/// Everything the Acknowledgements screen renders.
nonisolated struct AcknowledgementsState: Equatable, Sendable {
    var items: [Acknowledgement]
    /// The latest page to open.
    var link: LinkRequest?
}

import Observation

@Observable
final class AcknowledgementsViewModel {
    private(set) var state: AcknowledgementsState
    @ObservationIgnored private var serial = 0

    /// Values only, no defaults, no work (SCR-3).
    init(items: [Acknowledgement]) {
        state = AcknowledgementsState(items: items)
    }

    /// Nothing to observe: the list is fixed. Kept so the Screen follows the pattern (SCR-4).
    func run() async {}

    @discardableResult
    func send(_ action: AcknowledgementsAction) -> Task<Void, Never>? {
        switch action {
        case .linkTapped(let url):
            serial += 1
            state.link = LinkRequest(serial: serial, url: url)
        }
        return nil
    }
}

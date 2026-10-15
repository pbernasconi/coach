/// Every user intent, named for what happened (SCR-1).
enum ExampleAction: Equatable, Sendable {
    case retryTapped
    case nameChanged(String)
    case saveTapped
    case itemTapped(ExampleItem.ID)
    case destinationDismissed
}

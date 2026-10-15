import SwiftUI

public extension Binding {
    /// A control binding over a state field for the State + send pattern: it reads `value` and hands every edit to
    /// `set`, so a dumb view never writes into a ViewModel directly.
    ///
    ///     TextField("Name", text: .action(state.name) { send(.nameChanged($0)) })
    static func action(_ value: Value, _ set: @escaping (Value) -> Void) -> Binding<Value> {
        Binding(get: { value }, set: { set($0) })
    }
}

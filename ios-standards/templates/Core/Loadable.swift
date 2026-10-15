/// Remote or async content: exactly one of these at a time (SCR-6).
public enum Loadable<Value: Equatable & Sendable>: Equatable, Sendable {
    case loading
    case empty
    case loaded(Value)
    case failed(AppError.Kind)
}

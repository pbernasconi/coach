import Foundation
import Synchronization

/// Deterministic ids for tests: `…-000000000001`, `…-000000000002`, … in call order.
public final class IDSequence: Sendable {
    private let counter = Mutex<UInt64>(0)
    private let prefix: UInt8

    public init(prefix: UInt8 = 0xEE) {
        self.prefix = prefix
    }

    public func next() -> UUID {
        let number = counter.withLock { value in
            value += 1
            return value
        }
        return Self.id(number, prefix: prefix)
    }

    /// The id the sequence hands out at position `number` (1-based).
    public static func id(_ number: UInt64, prefix: UInt8 = 0xEE) -> UUID {
        let bytes = withUnsafeBytes(of: number.bigEndian) { Array($0) }
        return UUID(
            uuid: (
                prefix, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0,
                bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]
            )
        )
    }
}

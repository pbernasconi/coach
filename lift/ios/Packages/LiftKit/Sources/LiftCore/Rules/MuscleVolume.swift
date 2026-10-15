import Foundation

/// Weekly hard sets for one muscle.
public struct MuscleVolume: Hashable, Sendable {
    public let muscle: Muscle
    public let hardSets: Double
    public let status: VolumeStatus

    public init(muscle: Muscle, hardSets: Double, status: VolumeStatus) {
        self.muscle = muscle
        self.hardSets = hardSets
        self.status = status
    }
}

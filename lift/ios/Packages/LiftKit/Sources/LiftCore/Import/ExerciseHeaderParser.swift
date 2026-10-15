import Foundation

/// Reads exercise headers: a plain name (`Single arm db row`), a prescription
/// (`3x225lbx5reps x squat lift`, `3x 53*2lbs x 6reps x Bulgarian split squats`, `3x … x … lunges`),
/// a rep count (`8 pull-ups`) and an equipment suffix (`Romain deadlift - barbell`).
enum ExerciseHeaderParser {
    /// Nil when the text has no letters to name an exercise.
    static func parse(_ text: String) -> ExerciseHeader? {
        let (body, equipment) = splitEquipment(text)
        guard var header = prescription(body) ?? leadingReps(body) ?? plain(body) else { return nil }
        header.equipment = equipment
        return header
    }

    private static func splitEquipment(_ text: String) -> (String, Equipment?) {
        let pattern = /(?<name>.+?)\s*[-–—]\s*(?<word>[A-Za-z ]+)/
        guard let match = text.wholeMatch(of: pattern),
            let equipment = EquipmentWord.equipment(for: String(match.output.word))
        else { return (text, nil) }
        return (String(match.output.name), equipment)
    }

    private static func plain(_ text: String) -> ExerciseHeader? {
        guard hasName(text), !(text.first?.isNumber ?? false) else { return nil }
        return ExerciseHeader(name: text)
    }

    private static func leadingReps(_ text: String) -> ExerciseHeader? {
        let pattern = /(?<low>\d{1,3})(?:\s*-\s*(?<high>\d{1,3}))?\s+(?<name>[^\d\sxX×@].*)/
        guard let match = text.wholeMatch(of: pattern), hasName(String(match.output.name)),
            let low = Int(match.output.low)
        else { return nil }
        var header = ExerciseHeader(name: String(match.output.name))
        apply(low: low, high: match.output.high.flatMap { Int($0) }, to: &header)
        return header
    }

    private static func prescription(_ text: String) -> ExerciseHeader? {
        guard let match = text.wholeMatch(of: /(?<sets>\d{1,2})\s*[x×]\s*(?<rest>.+)/),
            let sets = Int(match.output.sets)
        else { return nil }
        var header = ExerciseHeader(name: "", plannedSets: sets)
        var rest = String(match.output.rest)
        let weight = readWeight(&rest, into: &header)
        if !readReps(&rest, into: &header), weight.bare, let value = header.weightValue, value == value.rounded() {
            header.weightValue = nil
            apply(low: Int(value), high: nil, to: &header)
        }
        guard hasName(rest) else { return nil }
        header.name = rest
        return header
    }

    /// Consumes `225lb x`, `53*2lbs x` or `… x`. Reports whether a bare number (no unit) was read.
    private static func readWeight(_ rest: inout String, into header: inout ExerciseHeader) -> (read: Bool, bare: Bool)
    {
        let pattern =
            /(?:(?<placeholder>…|\.{2,})|(?<value>\d+(?:\.\d+)?)\s*(?<times>\*\s*2)?\s*(?<unit>kgs?|lbs?)?)\s*[x×]\s*(?<rest>.+)/
        guard let match = rest.wholeMatch(of: pattern.ignoresCase()) else { return (false, false) }
        header.weightValue = match.output.value.flatMap { Double($0) }
        header.unit = match.output.unit.flatMap { NoteHintParser.unit(String($0)) }
        header.perHand = match.output.times != nil
        rest = String(match.output.rest)
        let bare = match.output.placeholder == nil && match.output.unit == nil && match.output.times == nil
        return (true, bare)
    }

    /// Consumes `5reps x`, `8-10 reps`, or `…` followed by the name.
    private static func readReps(_ rest: inout String, into header: inout ExerciseHeader) -> Bool {
        let pattern =
            /(?:(?<placeholder>…|\.{2,})|(?<low>\d{1,3})(?:\s*-\s*(?<high>\d{1,3}))?\s*(?:reps?)?)(?:\s*[x×]\s+|\s+)(?<rest>.+)/
        guard let match = rest.wholeMatch(of: pattern.ignoresCase()) else { return false }
        if let low = match.output.low.flatMap({ Int($0) }) {
            apply(low: low, high: match.output.high.flatMap { Int($0) }, to: &header)
        }
        rest = String(match.output.rest)
        return true
    }

    private static func apply(low: Int, high: Int?, to header: inout ExerciseHeader) {
        if let high, high > low {
            header.repRange = low...high
        } else {
            header.reps = low
        }
    }

    private static func hasName(_ text: String) -> Bool {
        text.contains(where: \.isLetter)
    }
}

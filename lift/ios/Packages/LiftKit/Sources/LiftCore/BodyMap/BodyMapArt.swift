import Foundation

/// One step of a body outline, in the drawing's own units (absolute coordinates).
public enum BodyPathStep: Equatable, Sendable {
    case move(BodyPoint)
    case line(BodyPoint)
    case cubic(BodyPoint, BodyPoint, to: BodyPoint)
    case quad(BodyPoint, to: BodyPoint)
    case close
}

public struct BodyPoint: Equatable, Sendable {
    public var x: Double
    public var y: Double

    public init(_ x: Double, _ y: Double) {
        self.x = x
        self.y = y
    }
}

/// A rectangle in the drawing's units.
public struct BodyRect: Equatable, Sendable, Decodable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

/// The shapes of one drawn area: a muscle (both sides of the body) or the rest of the figure.
public struct BodyPart: Equatable, Sendable {
    public var region: BodyRegion
    public var shapes: [[BodyPathStep]]

    public init(region: BodyRegion, shapes: [[BodyPathStep]]) {
        self.region = region
        self.shapes = shapes
    }
}

/// One view of the body, front or back.
public struct BodyFigure: Equatable, Sendable {
    public var bounds: BodyRect
    public var parts: [BodyPart]

    public init(bounds: BodyRect, parts: [BodyPart]) {
        self.bounds = bounds
        self.parts = parts
    }
}

/// The front and back drawing behind a finished lift (`Resources/body-map.json`, see lift/ios/BodyMap).
public struct BodyMapArt: Equatable, Sendable {
    public var front: BodyFigure
    public var back: BodyFigure

    public init(front: BodyFigure, back: BodyFigure) {
        self.front = front
        self.back = back
    }

    public init(json data: Data) throws {
        let file: BodyMapFile
        do {
            file = try JSONDecoder().decode(BodyMapFile.self, from: data)
        } catch {
            throw AppError(.decoding, detail: "body map")
        }
        self.init(front: try file.front.figure(), back: try file.back.figure())
    }

    /// The drawing bundled with LiftCore.
    public static func bundled() throws -> BodyMapArt {
        guard let url = Bundle.module.url(forResource: "body-map", withExtension: "json") else {
            throw AppError(.notFound, detail: "body-map.json")
        }
        return try BodyMapArt(json: Data(contentsOf: url))
    }
}

/// Reads the drawing's path text: absolute `M`, `L`, `C`, `Q` and `Z`, a letter before every segment.
public enum BodyPathParser {
    public static func parse(_ text: String) throws -> [BodyPathStep] {
        let tokens = text.split(separator: " ")
        var steps: [BodyPathStep] = []
        var index = 0
        func numbers(_ count: Int) throws -> [Double] {
            guard index + count <= tokens.count else { throw AppError(.decoding, detail: "body path") }
            let values = tokens[index..<(index + count)].compactMap { Double($0) }
            guard values.count == count else { throw AppError(.decoding, detail: "body path") }
            index += count
            return values
        }
        while index < tokens.count {
            let command = tokens[index]
            index += 1
            switch command {
            case "M":
                let v = try numbers(2)
                steps.append(.move(BodyPoint(v[0], v[1])))
            case "L":
                let v = try numbers(2)
                steps.append(.line(BodyPoint(v[0], v[1])))
            case "C":
                let v = try numbers(6)
                steps.append(.cubic(BodyPoint(v[0], v[1]), BodyPoint(v[2], v[3]), to: BodyPoint(v[4], v[5])))
            case "Q":
                let v = try numbers(4)
                steps.append(.quad(BodyPoint(v[0], v[1]), to: BodyPoint(v[2], v[3])))
            case "Z":
                steps.append(.close)
            default:
                throw AppError(.decoding, detail: "body path command \(command)")
            }
        }
        return steps
    }
}

/// The file layout of `body-map.json`.
private struct BodyMapFile: Decodable {
    struct Figure: Decodable {
        let bounds: BodyRect
        let parts: [Part]

        func figure() throws -> BodyFigure {
            BodyFigure(
                bounds: bounds,
                parts: try parts.map { part in
                    BodyPart(
                        region: BodyRegion(rawValue: part.region) ?? .outline,
                        shapes: try part.paths.map(BodyPathParser.parse)
                    )
                }
            )
        }
    }

    struct Part: Decodable {
        let region: String
        let paths: [String]
    }

    let front: Figure
    let back: Figure
}

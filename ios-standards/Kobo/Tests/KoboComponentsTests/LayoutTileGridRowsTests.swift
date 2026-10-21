import Testing

@testable import KoboComponents

@Suite struct LayoutTileGridRowsTests {
    @Test(arguments: [
        (5, 2, [0..<2, 2..<4, 4..<5]),
        (4, 2, [0..<2, 2..<4]),
        (3, 1, [0..<1, 1..<2, 2..<3]),
        (2, 3, [0..<2]),
        (0, 2, []),
        (2, 0, [0..<1, 1..<2]),
    ])
    func rows(count: Int, columns: Int, expected: [Range<Int>]) {
        #expect(TileGridRows.rows(count: count, columns: columns) == expected)
    }
}

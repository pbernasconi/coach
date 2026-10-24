import KoboComponents
import KoboTokens
import SwiftUI

/// The map's own controls, stacked in one glass pill as Apple Maps stacks them: the map type, the colour the route
/// is drawn by (heart rate, pace, elevation, …), and 3D. The colour button shows only when the route has metrics.
struct ActivityMapControls: View {
    @Binding var mapType: ActivityMapType
    @Binding var isThreeD: Bool
    let metrics: [ActivityRouteColors.Metric]
    @Binding var metricKey: String?
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            Menu {
                Picker(selection: $mapType) {
                    ForEach(ActivityMapType.allCases) { type in
                        Label { Text(type.label) } icon: { Image(systemName: type.symbol) }
                            .tag(type)
                    }
                } label: {
                    Text("Map type")
                }
            } label: {
                Image(systemName: "square.3.layers.3d")
                    .font(theme.font(.subheadline).weight(.semibold))
                    .frame(width: Self.control, height: Self.control)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(Text("Map type"))
            if !metrics.isEmpty {
                divider
                colorMenu
            }
            divider
            Button {
                isThreeD.toggle()
            } label: {
                Text("3D")
                    .font(theme.font(.footnote).weight(.bold))
                    .foregroundStyle(isThreeD ? theme.palette.accentText : theme.palette.textPrimary)
                    .frame(width: Self.control, height: Self.control)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(Text("3D"))
            .accessibilityAddTraits(isThreeD ? .isSelected : [])
        }
        .buttonStyle(.plain)
        .foregroundStyle(theme.palette.textPrimary)
        .glassEffect(.regular.interactive(), in: Capsule())
    }

    /// Colour the route by a metric, or by the sport (the first choice).
    private var colorMenu: some View {
        Menu {
            Picker(selection: $metricKey) {
                Label { Text("Sport color") } icon: { Image(systemName: "paintpalette") }
                    .tag(String?.none)
                ForEach(metrics) { metric in
                    Label { Text(verbatim: metric.label) } icon: { Image(systemName: metric.symbol) }
                        .tag(Optional(metric.key))
                }
            } label: {
                Text("Color route by")
            }
        } label: {
            Image(systemName: metricKey == nil ? "paintpalette" : "paintpalette.fill")
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(metricKey == nil ? theme.palette.textPrimary : theme.palette.accentText)
                .frame(width: Self.control, height: Self.control)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("Color route by"))
        .accessibilityValue(Text(verbatim: metrics.first { $0.key == metricKey }?.label ?? "Sport"))
    }

    private var divider: some View {
        theme.palette.separator
            .frame(width: Self.control - Space.md, height: Size.hairline * 2)
    }

    /// One map control: the same 44 points as the bar's buttons, so the pill lines up under "…".
    private static let control: CGFloat = Size.minTouch
}

/// The colour's scale over the map: its name, then the colours low to high between the two ends' values.
struct ActivityRouteLegend: View {
    let metric: ActivityRouteColors.Metric
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: metric.unit.isEmpty || metric.unit == "%" ? metric.label : "\(metric.label) · \(metric.unit)")
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.textPrimary)
            HStack(spacing: Space.xs) {
                Text(verbatim: lowText)
                HStack(spacing: 0) {
                    ForEach(Array(metric.colors.enumerated()), id: \.offset) { _, hex in
                        (Color(routeHex: hex) ?? theme.palette.separator)
                    }
                }
                .frame(width: Self.barWidth, height: Space.xs)
                .clipShape(Capsule())
                Text(verbatim: highText)
            }
            .font(theme.font(.caption).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
        }
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.xs)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Space.md, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(metric.label), \(lowText) to \(highText) \(metric.unit)"))
    }

    private var lowText: String { metric.unit == "%" ? "\(metric.lowText)%" : metric.lowText }
    private var highText: String { metric.unit == "%" ? "\(metric.highText)%" : metric.highText }

    private static let barWidth: CGFloat = 88
}

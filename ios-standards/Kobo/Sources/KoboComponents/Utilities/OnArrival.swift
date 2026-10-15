import KoboTokens
import SwiftUI

#if canImport(UIKit)
    import UIKit
#endif

extension View {
    /// Runs `action` once the view has arrived: after the push or the present that shows it has ended, or at once when
    /// it appears on a page that already shows. A pop back runs it again (unless `frequency` is `.once`); a sheet that
    /// closes over the page does not. Use it for work that must not run while the page still moves: focusing a field
    /// (the keyboard rises after the slide) or the first cross-fade of loaded content. Off iOS it runs on appear.
    ///
    ///     TextField(…).focused($focus).onArrival { focus = true }
    public func onArrival(_ frequency: ArrivalFrequency = .everyArrival, perform action: @escaping () -> Void)
        -> some View
    {
        modifier(ArrivalModifier(frequency: frequency, action: action))
    }

    /// Holds `onArrival` inside this view while `held` is true: for a presentation that moves its page by itself, with
    /// no UIKit transition (a custom card that rises on its own spring).
    public func arrivalHeld(_ held: Bool) -> some View {
        environment(\.isArrivalHeld, held)
    }
}

extension EnvironmentValues {
    /// True while a presentation with no UIKit transition still moves the page. `onArrival` waits until it turns false.
    @Entry var isArrivalHeld = false
}

/// The gate and the latest action, shared by the SwiftUI modifier and the UIKit child controller.
private final class ArrivalSignal {
    var gate: ArrivalGate
    var action: () -> Void = {}

    init(frequency: ArrivalFrequency) {
        gate = ArrivalGate(frequency: frequency)
    }
}

private struct ArrivalModifier: ViewModifier {
    @Environment(\.isArrivalHeld) private var isHeld
    @State private var signal: ArrivalSignal
    let action: () -> Void

    init(frequency: ArrivalFrequency, action: @escaping () -> Void) {
        _signal = State(initialValue: ArrivalSignal(frequency: frequency))
        self.action = action
    }

    func body(content: Content) -> some View {
        content
            .background {
                #if os(iOS)
                    ArrivalObserver(signal: signal, action: action)
                        .frame(width: 0, height: 0)
                        .accessibilityHidden(true)
                #endif
            }
            .onAppear {
                signal.action = action
                #if !os(iOS)
                    _ = signal.gate.pageAppeared()
                #endif
                if signal.gate.viewAppeared(held: isHeld) { action() }
            }
            .onDisappear { signal.gate.viewDisappeared() }
            .onChange(of: isHeld) { _, held in
                if signal.gate.holdChanged(held) { action() }
            }
    }
}

#if os(iOS)
    /// A zero-size child controller: UIKit forwards the appearance of the page's controller to it, and `viewDidAppear`
    /// arrives when the transition that shows the page has ended.
    private struct ArrivalObserver: UIViewControllerRepresentable {
        let signal: ArrivalSignal
        let action: () -> Void

        func makeUIViewController(context _: Context) -> ArrivalController {
            let controller = ArrivalController()
            controller.signal = signal
            return controller
        }

        func updateUIViewController(_: ArrivalController, context _: Context) {
            signal.action = action
        }
    }

    private final class ArrivalController: UIViewController {
        var signal: ArrivalSignal?

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard let signal, signal.gate.pageAppeared() else { return }
            signal.action()
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)
            signal?.gate.pageWillDisappear()
        }
    }
#endif

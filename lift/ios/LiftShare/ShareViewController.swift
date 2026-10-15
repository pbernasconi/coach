import SwiftUI
import UIKit

/// The Share extension's entry point (`NSExtensionPrincipalClass` in `project.yml`): shows `ShareNoteView` for the items
/// shared from Apple Notes.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let model = ShareNoteModel(
            items: extensionContext?.inputItems ?? [],
            inbox: AppGroupNoteInbox(bundle: .main),
            context: extensionContext
        )
        let host = UIHostingController(rootView: ShareNoteView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }
}

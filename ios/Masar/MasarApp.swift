import SwiftUI

@main
struct MasarApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(app)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, MDate.arLocale)
                .tint(MTheme.saffron)
                .task { await app.bootstrap() }
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        ZStack {
            MTheme.paper.ignoresSafeArea()
            if !app.checkedSession {
                ProgressView()
            } else if app.me == nil {
                LoginView()
            } else {
                RootView()
            }
        }
        .overlay(alignment: .bottom) {
            if let toast = app.toast {
                ToastView(message: toast)
                    .padding(.bottom, 108)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
    }
}

// وجهات التنقل
enum Route: Hashable {
    case task(Int)
    case project(Int)
}

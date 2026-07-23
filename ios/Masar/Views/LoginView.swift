import SwiftUI

struct LoginView: View {
    @EnvironmentObject var app: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ZStack {
            MTheme.paper.ignoresSafeArea()

            // خلفية هادئة: دائرتان زعفرانية/زرقاء باهتتان
            Circle()
                .fill(MTheme.saffron.opacity(0.08))
                .frame(width: 200, height: 200)
                .offset(x: 120, y: -220)
            Circle()
                .fill(MTheme.review.opacity(0.08))
                .frame(width: 180, height: 180)
                .offset(x: -130, y: 200)

            VStack(spacing: 0) {
                MasarLogoView(size: 44)
                    .padding(.bottom, 14)

                Text("من الفكرة إلى النشر… على سطرٍ واحد.")
                    .font(MFont.display(14, 600))
                    .foregroundStyle(MTheme.ink2)
                    .padding(.bottom, 10)

                SariLine(progress: 0.38)
                    .frame(width: 150)
                    .padding(.bottom, 34)

                VStack(alignment: .leading, spacing: 6) {
                    Text("البريد الإلكتروني")
                        .font(MFont.text(13, .bold))
                    TextField("", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .environment(\.layoutDirection, .leftToRight)
                        .font(MFont.latin(15))
                        .fieldStyle()

                    Text("كلمة المرور")
                        .font(MFont.text(13, .bold))
                        .padding(.top, 8)
                    SecureField("", text: $password)
                        .environment(\.layoutDirection, .leftToRight)
                        .fieldStyle()

                    if let error {
                        Text(error)
                            .font(MFont.text(12, .semibold))
                            .foregroundStyle(MTheme.danger)
                            .padding(.top, 6)
                    }

                    Button {
                        submit()
                    } label: {
                        Text(busy ? "جارٍ الدخول…" : "دخول")
                            .font(MFont.text(15, .bold))
                            .foregroundStyle(Color(hex: "#F7F3EB"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(Color(hex: "#1E2735")))
                            .opacity(busy ? 0.7 : 1)
                    }
                    .disabled(busy)
                    .padding(.top, 14)
                }
                .padding(22)
                .surfaceCard(radius: MTheme.rSheet)
                .padding(.horizontal, 28)
            }
        }
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        busy = true
        error = nil
        Task {
            do {
                try await app.login(email: email, password: password)
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }
}

extension View {
    func fieldStyle() -> some View {
        padding(12)
            .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(MTheme.surface))
            .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.line, lineWidth: 1))
    }
}

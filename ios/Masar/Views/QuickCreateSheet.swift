import SwiftUI

struct QuickCreateSheet: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var sectionId: Int?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Capsule()
                .fill(MTheme.line)
                .frame(width: 36, height: 4)
                .frame(maxWidth: .infinity)
                .padding(.top, 10)

            HStack(spacing: 6) {
                Text("مهمة جديدة").font(MFont.text(14, .bold)).foregroundStyle(MTheme.ink)
                Text("(تُسند إليك)").font(MFont.text(11, .semibold)).foregroundStyle(MTheme.muted)
            }

            TextField("اكتب اسم المهمة…", text: $title)
                .font(MFont.text(14))
                .focused($focused)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(MTheme.paper))
                .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.saffron, lineWidth: 1))
                .onSubmit { add() }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(app.sections) { section in
                        let active = sectionId == section.id
                        Button {
                            sectionId = section.id
                        } label: {
                            Text(section.title)
                                .font(MFont.text(11.5, .bold))
                                .foregroundStyle(active ? MTheme.saffron : MTheme.muted)
                                .padding(.horizontal, 13)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(active ? MTheme.saffronSoft : .clear))
                                .overlay(Capsule().stroke(active ? MTheme.saffron : MTheme.line, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Button {
                add()
            } label: {
                Text("إضافة")
                    .font(MFont.text(14, .bold))
                    .foregroundStyle(Color(hex: "#F7F3EB"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(Color(hex: "#1E2735")))
            }
            .opacity(title.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)

            Spacer()
        }
        .padding(.horizontal, 18)
        .background(MTheme.surface)
        .environment(\.layoutDirection, .rightToLeft)
        .onAppear {
            focused = true
            sectionId = app.sections.first(where: { $0.isDefault })?.id ?? app.sections.first?.id
        }
    }

    private func add() {
        let text = title.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        app.quickAdd(title: text, sectionId: sectionId)
        dismiss()
    }
}

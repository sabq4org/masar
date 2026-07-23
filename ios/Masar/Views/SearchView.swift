import SwiftUI

struct SearchView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    @Binding var path: NavigationPath

    @State private var q = ""
    @State private var results: SearchPayload?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(MTheme.muted)
                    TextField("ابحث في المهام والمشاريع والأشخاص…", text: $q)
                        .font(MFont.text(13))
                        .focused($focused)
                        .onChange(of: q) { _, newValue in
                            Task { await search(newValue) }
                        }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Capsule().fill(MTheme.surface))
                .overlay(Capsule().stroke(MTheme.line, lineWidth: 1))
                Button { dismiss() } label: {
                    Text("إلغاء")
                        .font(MFont.text(13, .semibold))
                        .foregroundStyle(MTheme.saffron)
                }
            }
            .padding(16)

            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    if let r = results {
                        if !r.tasks.isEmpty {
                            Text("المهام")
                                .font(MFont.text(11, .bold))
                                .foregroundStyle(MTheme.muted)
                                .padding(.top, 6)
                            VStack(spacing: 0) {
                                ForEach(r.tasks) { t in
                                    Button {
                                        open(.task(t.id))
                                    } label: {
                                        HStack(spacing: 9) {
                                            Circle()
                                                .stroke(t.isCompleted ? MTheme.success : MTheme.muted.opacity(0.6), lineWidth: 1.5)
                                                .background(Circle().fill(t.isCompleted ? MTheme.success : .clear))
                                                .frame(width: 17, height: 17)
                                            Text(t.title)
                                                .font(MFont.text(13, .semibold))
                                                .foregroundStyle(t.isCompleted ? MTheme.muted : MTheme.ink)
                                                .lineLimit(1)
                                            Spacer()
                                            DueLabel(dueAt: t.dueAt, done: t.isCompleted, size: 10.5)
                                        }
                                        .padding(.horizontal, 13)
                                        .frame(minHeight: 46)
                                    }
                                    .buttonStyle(.plain)
                                    Divider().overlay(MTheme.lineSoft)
                                }
                            }
                            .surfaceCard(radius: 12)
                        }
                        if !r.projects.isEmpty {
                            Text("المشاريع")
                                .font(MFont.text(11, .bold))
                                .foregroundStyle(MTheme.muted)
                                .padding(.top, 10)
                            VStack(spacing: 0) {
                                ForEach(r.projects) { p in
                                    Button {
                                        open(.project(p.id))
                                    } label: {
                                        HStack(spacing: 10) {
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(Color(hex: p.color))
                                                .frame(width: 28, height: 28)
                                                .overlay(
                                                    Text(String(p.name.prefix(1)))
                                                        .font(MFont.text(12, .bold))
                                                        .foregroundStyle(Color(hex: "#F7F3EB"))
                                                )
                                            Text(p.name)
                                                .font(MFont.text(13, .semibold))
                                                .foregroundStyle(MTheme.ink)
                                            Spacer()
                                        }
                                        .padding(.horizontal, 13)
                                        .frame(minHeight: 48)
                                    }
                                    .buttonStyle(.plain)
                                    Divider().overlay(MTheme.lineSoft)
                                }
                            }
                            .surfaceCard(radius: 12)
                        }
                        if !q.trimmingCharacters(in: .whitespaces).isEmpty
                            && r.tasks.isEmpty && r.projects.isEmpty {
                            Text("لا نتائج")
                                .font(MFont.text(12.5))
                                .foregroundStyle(MTheme.muted)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 44)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 40)
            }
        }
        .background(MTheme.paper)
        .environment(\.layoutDirection, .rightToLeft)
        .onAppear { focused = true }
    }

    private func open(_ route: Route) {
        dismiss()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            path.append(route)
        }
    }

    private func search(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            results = nil
            return
        }
        results = try? await API.shared.search(trimmed)
    }
}

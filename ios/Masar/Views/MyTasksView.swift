import SwiftUI

struct MyTasksView: View {
    @EnvironmentObject var app: AppState
    @State private var board = false

    var body: some View {
        VStack(spacing: 0) {
            header
            if board { boardView } else { listView }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                AvatarView(name: app.me?.name ?? "؟", colorHex: app.me?.avatarColor, size: 34)
                Text("مهامي")
                    .font(MFont.display(20, 700))
                    .foregroundStyle(MTheme.ink)
            }
            HStack(spacing: 2) {
                viewTab(false, "قائمة", icon: "line.3.horizontal")
                viewTab(true, "لوحة", icon: "square.grid.2x2")
                Spacer()
                Text("اسحب المهمة لإكمالها ›")
                    .font(MFont.text(10))
                    .foregroundStyle(MTheme.muted)
            }
            .overlay(alignment: .bottom) { MTheme.line.frame(height: 1).offset(y: 0) }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func viewTab(_ isBoard: Bool, _ label: String, icon: String) -> some View {
        Button {
            withAnimation(.masar) { board = isBoard }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(label).font(MFont.text(12, .semibold))
            }
            .foregroundStyle(board == isBoard ? MTheme.ink : MTheme.muted)
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) {
                (board == isBoard ? MTheme.saffron : .clear).frame(height: 2)
            }
        }
        .buttonStyle(.plain)
    }

    // ─── القائمة: أقسام شخصية + سحب لليمين = إكمال ───
    private var listView: some View {
        List {
            ForEach(app.sections) { section in
                let rows = app.sectionTasks(section.id, includeCompleted: section.isDefault)
                Section {
                    ForEach(rows) { task in
                        NavigationLink(value: Route.task(task.id)) {
                            TaskRowView(task: task)
                                .padding(.horizontal, -14)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(MTheme.surface)
                        .listRowSeparatorTint(MTheme.lineSoft)
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            if !task.isMilestone {
                                Button {
                                    app.toggleComplete(task)
                                } label: {
                                    Image(systemName: task.isCompleted ? "arrow.uturn.backward" : "checkmark")
                                }
                                .tint(MTheme.success)
                            }
                        }
                    }
                } header: {
                    HStack(spacing: 7) {
                        Text(section.title)
                            .font(MFont.text(13, .bold))
                            .foregroundStyle(MTheme.ink)
                        Text("\(rows.count)")
                            .font(MFont.text(11))
                            .foregroundStyle(MTheme.muted)
                    }
                    .textCase(nil)
                }
            }
            Color.clear.frame(height: 110).listRowBackground(Color.clear)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await app.refreshAll() }
    }

    // ─── اللوحة: أعمدة أفقية ───
    private var boardView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(app.sections) { section in
                    let rows = app.sectionTasks(section.id, includeCompleted: false)
                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Text(section.title).font(MFont.text(13, .bold))
                            Spacer()
                            Text("\(rows.count)")
                                .font(MFont.text(11))
                                .foregroundStyle(MTheme.muted)
                        }
                        .padding(.horizontal, 6)
                        ScrollView {
                            VStack(spacing: 8) {
                                ForEach(rows) { task in
                                    NavigationLink(value: Route.task(task.id)) {
                                        boardCard(task)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(8)
                    .frame(width: 240)
                    .background(
                        RoundedRectangle(cornerRadius: MTheme.rCard)
                            .fill(MTheme.paper.opacity(0.85))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: MTheme.rCard)
                            .stroke(MTheme.line, lineWidth: 1)
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    private func boardCard(_ task: TaskRow) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                if task.isMilestone {
                    MilestoneDiamond().frame(width: 22, height: 22)
                } else {
                    CheckCircle(done: task.isCompleted, size: 17) { app.toggleComplete(task) }
                        .frame(width: 22, height: 22)
                }
                Text(task.title)
                    .font(MFont.text(12.5, .semibold))
                    .foregroundStyle(task.isCompleted ? MTheme.muted : MTheme.ink)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            HStack(spacing: 7) {
                PriorityChip(priority: task.priority)
                DueLabel(dueAt: task.dueAt, done: task.isCompleted, size: 10)
                Spacer()
                if let p = task.project {
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill(Color(hex: p.color))
                        .frame(width: 7, height: 7)
                }
            }
            .padding(.leading, 26)
        }
        .padding(11)
        .surfaceCard(radius: 10)
    }
}

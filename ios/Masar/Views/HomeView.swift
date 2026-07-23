import SwiftUI

struct HomeView: View {
    @EnvironmentObject var app: AppState
    @Binding var showSearch: Bool
    let goTab: (MTab) -> Void
    @State private var homeTab = 0 // 0 قادمة 1 متأخرة 2 مكتملة

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                header
                greeting
                myTasksCard
                projectsCard
                peopleCard
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 130)
        }
        .refreshable { await app.refreshAll() }
    }

    private var header: some View {
        HStack {
            MasarLogoView(size: 22)
            Spacer()
            Button { showSearch = true } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MTheme.muted)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(MTheme.surface))
                    .overlay(Circle().stroke(MTheme.line, lineWidth: 1))
            }
        }
        .padding(.top, 8)
    }

    private var greeting: some View {
        VStack(spacing: 4) {
            Text(MDate.today())
                .font(MFont.text(12))
                .foregroundStyle(MTheme.muted)
            Text(greetText)
                .font(MFont.display(22, 700))
                .foregroundStyle(MTheme.ink)
            HStack(spacing: 12) {
                HStack(spacing: 5) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundStyle(MTheme.success)
                    Text("\(app.completedMine.count) مهام أنهيتها")
                }
                MTheme.line.frame(width: 1, height: 14)
                HStack(spacing: 5) {
                    Image(systemName: "person.2")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(MTheme.review)
                    Text("\(app.users.count) أعضاء في المساحة")
                }
            }
            .font(MFont.text(11, .semibold))
            .foregroundStyle(MTheme.ink2)
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .background(Capsule().fill(MTheme.surface))
            .overlay(Capsule().stroke(MTheme.line, lineWidth: 1))
            .padding(.top, 8)
        }
        .padding(.vertical, 6)
    }

    private var greetText: String {
        let first = app.me?.name.split(separator: " ").first.map(String.init) ?? ""
        let h = Calendar.current.component(.hour, from: Date())
        return (h < 12 ? "صباح الخير، " : "مساء الخير، ") + first
    }

    private var lists: [[TaskRow]] { [app.upcoming, app.overdue, app.completedMine] }

    private var myTasksCard: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                AvatarView(name: app.me?.name ?? "؟", colorHex: app.me?.avatarColor)
                VStack(alignment: .leading, spacing: 6) {
                    Text("مهامي").font(MFont.text(14, .bold))
                    HStack(spacing: 16) {
                        homeTabButton(0, "قادمة")
                        homeTabButton(1, "متأخرة", badge: app.overdue.count)
                        homeTabButton(2, "مكتملة")
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            Divider().overlay(MTheme.lineSoft)

            let rows = Array(lists[homeTab].prefix(6))
            if rows.isEmpty {
                Text(homeTab == 1 ? "لا مهام متأخرة — ممتاز" : "لا مهام هنا")
                    .font(MFont.text(12))
                    .foregroundStyle(MTheme.muted)
                    .padding(.vertical, 34)
            } else {
                ForEach(rows) { task in
                    NavigationLink(value: Route.task(task.id)) {
                        TaskRowView(task: task)
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(MTheme.lineSoft).padding(.leading, 14)
                }
            }

            Button { goTab(.my) } label: {
                Text("عرض كل مهامي ‹")
                    .font(MFont.text(12, .semibold))
                    .foregroundStyle(MTheme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
            }
        }
        .surfaceCard()
    }

    private func homeTabButton(_ index: Int, _ label: String, badge: Int = 0) -> some View {
        Button {
            withAnimation(.masar) { homeTab = index }
        } label: {
            HStack(spacing: 5) {
                Text(label).font(MFont.text(12, .semibold))
                if index == 1 && badge > 0 {
                    Text("\(badge)")
                        .font(MFont.text(10, .bold))
                        .foregroundStyle(MTheme.danger)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(MTheme.danger.opacity(0.1)))
                }
            }
            .foregroundStyle(homeTab == index ? MTheme.ink : MTheme.muted)
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) {
                (homeTab == index ? MTheme.saffron : .clear).frame(height: 2)
            }
        }
        .buttonStyle(.plain)
    }

    private var projectsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("المشاريع").font(MFont.text(14, .bold))
                Spacer()
                Button { goTab(.projects) } label: {
                    Text("عرض الكل")
                        .font(MFont.text(11, .semibold))
                        .foregroundStyle(MTheme.muted)
                }
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(app.projects.prefix(4)) { p in
                    NavigationLink(value: Route.project(p.id)) {
                        HStack(spacing: 9) {
                            RoundedRectangle(cornerRadius: 9)
                                .fill(Color(hex: p.color))
                                .frame(width: 34, height: 34)
                                .overlay(
                                    Text(String(p.name.prefix(1)))
                                        .font(MFont.text(14, .bold))
                                        .foregroundStyle(Color(hex: "#F7F3EB"))
                                )
                            VStack(alignment: .leading, spacing: 1) {
                                Text(p.name)
                                    .font(MFont.text(12, .bold))
                                    .foregroundStyle(MTheme.ink)
                                    .lineLimit(1)
                                let s = app.projectSummary(p)
                                Text("\(s.total) مهمة · \(s.done) مكتملة")
                                    .font(MFont.text(10.5))
                                    .foregroundStyle(MTheme.muted)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(8)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .surfaceCard()
    }

    private var peopleCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("الأشخاص").font(MFont.text(14, .bold))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(app.users) { u in
                        VStack(spacing: 4) {
                            AvatarView(name: u.name, colorHex: u.avatarColor, size: 38)
                            Text(u.name)
                                .font(MFont.text(10.5, .semibold))
                                .foregroundStyle(MTheme.ink)
                                .lineLimit(1)
                            Text(u.roleLabel ?? u.role)
                                .font(MFont.text(9.5))
                                .foregroundStyle(MTheme.muted)
                        }
                        .frame(width: 76)
                    }
                }
            }
        }
        .padding(14)
        .surfaceCard()
    }
}

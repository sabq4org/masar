import SwiftUI

struct ProjectsView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("المشاريع")
                    .font(MFont.display(20, 700))
                    .foregroundStyle(MTheme.ink)
                    .padding(.top, 12)

                ForEach(app.projects) { p in
                    NavigationLink(value: Route.project(p.id)) {
                        ProjectCard(project: p)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 130)
        }
        .refreshable { await app.refreshAll() }
    }
}

struct ProjectCard: View {
    @EnvironmentObject var app: AppState
    let project: ProjectRow

    var body: some View {
        let s = app.projectSummary(project)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                RoundedRectangle(cornerRadius: 9)
                    .fill(Color(hex: project.color))
                    .frame(width: 40, height: 40)
                    .overlay(
                        Text(String(project.name.prefix(1)))
                            .font(MFont.text(16, .bold))
                            .foregroundStyle(Color(hex: "#F7F3EB"))
                    )
                VStack(alignment: .leading, spacing: 3) {
                    Text(project.name)
                        .font(MFont.text(14, .bold))
                        .foregroundStyle(MTheme.ink)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        Text("\(s.total) مهمة")
                            .font(MFont.text(11))
                            .foregroundStyle(MTheme.muted)
                        ProjectStatusChip(status: project.currentStatus)
                    }
                }
                Spacer()
                Button {
                    app.toggleStar(project)
                } label: {
                    Image(systemName: (project.isStarred ?? false) ? "star.fill" : "star")
                        .font(.system(size: 15))
                        .foregroundStyle((project.isStarred ?? false) ? MTheme.saffron : MTheme.muted)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
            }
            SariLine(progress: Double(s.pct) / 100, color: Color(hex: project.color), height: 3)
            Text("\(s.pct)٪ مكتمل")
                .font(MFont.text(10))
                .foregroundStyle(MTheme.muted)
        }
        .padding(14)
        .surfaceCard()
    }
}

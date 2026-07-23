import SwiftUI

enum MTab: String, CaseIterable {
    case home, my, inbox, projects

    var label: String {
        switch self {
        case .home: "الرئيسية"
        case .my: "مهامي"
        case .inbox: "الوارد"
        case .projects: "المشاريع"
        }
    }

    var icon: String {
        switch self {
        case .home: "house"
        case .my: "checkmark.circle"
        case .inbox: "bell"
        case .projects: "square.grid.2x2"
        }
    }
}

struct RootView: View {
    @EnvironmentObject var app: AppState
    @State private var tab: MTab = .home
    @State private var path = NavigationPath()
    @State private var showCreate = false
    @State private var showSearch = false

    var body: some View {
        NavigationStack(path: $path) {
            ZStack(alignment: .bottom) {
                MTheme.paper.ignoresSafeArea()

                Group {
                    switch tab {
                    case .home: HomeView(showSearch: $showSearch, goTab: { tab = $0 })
                    case .my: MyTasksView()
                    case .inbox: InboxView()
                    case .projects: ProjectsView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

                tabBar
            }
            .overlay(alignment: .bottomLeading) {
                fab
            }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .task(let id): TaskDetailView(taskId: id)
                case .project(let id): ProjectDetailView(projectId: id)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $showCreate) {
            QuickCreateSheet()
                .presentationDetents([.height(320)])
                .presentationDragIndicator(.hidden)
        }
        .fullScreenCover(isPresented: $showSearch) {
            SearchView(path: $path)
        }
        .refreshableTask(app)
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(MTab.allCases, id: \.self) { item in
                Button {
                    withAnimation(.masar) { tab = item }
                } label: {
                    VStack(spacing: 3) {
                        ZStack {
                            Capsule()
                                .fill(tab == item ? MTheme.saffronSoft : .clear)
                                .frame(width: 52, height: 30)
                            Image(systemName: item.icon)
                                .font(.system(size: 18, weight: .medium))
                            if item == .inbox && app.unread > 0 {
                                Text("\(app.unread)")
                                    .font(MFont.text(9.5, .bold))
                                    .foregroundStyle(Color(hex: "#F7F3EB"))
                                    .padding(.horizontal, 4)
                                    .frame(minWidth: 16, minHeight: 16)
                                    .background(Circle().fill(MTheme.saffron))
                                    .offset(x: -14, y: -12)
                            }
                        }
                        Text(item.label).font(MFont.text(10, .semibold))
                    }
                    .foregroundStyle(tab == item ? MTheme.ink : MTheme.muted)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(
            MTheme.surface.opacity(0.94)
                .background(.ultraThinMaterial)
                .overlay(alignment: .top) { MTheme.line.frame(height: 1) }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var fab: some View {
        Button {
            showCreate = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color(hex: "#F7F3EB"))
                .frame(width: 52, height: 52)
                .background(Circle().fill(Color(hex: "#1E2735")))
                .shadow(color: Color(hex: "#1E2735").opacity(0.32), radius: 11, y: 8)
        }
        .padding(.leading, 18)
        .padding(.bottom, 88)
    }
}

private extension View {
    func refreshableTask(_ app: AppState) -> some View {
        task {
            // تحديث دوري خفيف بدل SSE في النسخة الأولى
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                await app.refreshAll()
            }
        }
    }
}

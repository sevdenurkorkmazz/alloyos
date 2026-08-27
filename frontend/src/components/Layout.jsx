import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  LayoutDashboard, Box, Users, Bot, FolderKanban, ListChecks,
  CalendarClock, MessagesSquare, Activity as ActivityIcon, Settings as SettingsIcon, LogOut, Languages
} from "lucide-react";

const NAV = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard, end: true, tid: "dashboard" },
  { to: "/office", key: "nav.office", icon: Box, hero: true, tid: "office" },
  { to: "/employees", key: "nav.employees", icon: Users, tid: "employees" },
  { to: "/agents", key: "nav.agents", icon: Bot, tid: "ai-agents" },
  { to: "/projects", key: "nav.projects", icon: FolderKanban, tid: "projects" },
  { to: "/tasks", key: "nav.tasks", icon: ListChecks, tid: "tasks" },
  { to: "/meetings", key: "nav.meetings", icon: CalendarClock, tid: "meetings" },
  { to: "/messages", key: "nav.messages", icon: MessagesSquare, tid: "messages" },
  { to: "/activity", key: "nav.activity", icon: ActivityIcon, tid: "activity" },
  { to: "/settings", key: "nav.settings", icon: SettingsIcon, tid: "settings" },
];

export default function Layout() {
  const { user, company, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const isOffice = location.pathname === "/office";

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden">
      <aside className="w-[236px] shrink-0 border-r border-border bg-card/40 flex flex-col" data-testid="sidebar">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-ai/15 border border-ai/40 flex items-center justify-center">
              <div className="h-3.5 w-3.5 rounded-sm bg-ai shadow-[0_0_12px_#00E599]" />
            </div>
            <div className="leading-none">
              <div className="font-display font-extrabold text-[17px] tracking-tight">AlloyOS</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{t("app.tagline")}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, key, icon: Icon, end, hero, tid }) => (
            <NavLink key={to} to={to} end={end} data-testid={`nav-${tid}`}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}>
              <Icon size={17} strokeWidth={1.8} className={hero ? "text-ai" : ""} />
              <span className="font-medium">{t(key)}</span>
              {hero && <span className="ml-auto font-mono text-[9px] text-ai/70">3D</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          {/* language switcher */}
          <div className="flex items-center gap-1 mb-2 px-1">
            <Languages size={14} className="text-muted-foreground" />
            {["tr", "en"].map((l) => (
              <button key={l} onClick={() => setLang(l)} data-testid={`lang-${l}`}
                className={`px-2 py-1 rounded text-xs font-mono uppercase transition-colors ${lang === l ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="px-2 py-2 mb-1">
            <div className="text-sm font-medium truncate">{company?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button onClick={logout} data-testid="logout-button"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <LogOut size={16} strokeWidth={1.8} /> {t("nav.signout")}
          </button>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 ${isOffice ? "" : "overflow-y-auto"}`}>
        <Outlet />
      </main>
    </div>
  );
}

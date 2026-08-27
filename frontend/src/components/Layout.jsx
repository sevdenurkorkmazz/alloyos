import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Box, Users, Bot, FolderKanban, ListChecks,
  MessagesSquare, Activity as ActivityIcon, Settings as SettingsIcon, LogOut
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/office", label: "Office", icon: Box, hero: true },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/agents", label: "AI Agents", icon: Bot },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/messages", label: "Messages", icon: MessagesSquare },
  { to: "/activity", label: "Activity", icon: ActivityIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Layout() {
  const { user, company, logout } = useAuth();
  const location = useLocation();
  const isOffice = location.pathname === "/office";

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[236px] shrink-0 border-r border-border bg-card/40 flex flex-col" data-testid="sidebar">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-ai/15 border border-ai/40 flex items-center justify-center">
              <div className="h-3.5 w-3.5 rounded-sm bg-ai shadow-[0_0_12px_#00E599]" />
            </div>
            <div className="leading-none">
              <div className="font-display font-extrabold text-[17px] tracking-tight">AlloyOS</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">AI COMPANY OS</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end, hero }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`
              }
            >
              <Icon size={17} strokeWidth={1.8} className={hero ? "text-ai" : ""} />
              <span className="font-medium">{label}</span>
              {hero && <span className="ml-auto font-mono text-[9px] text-ai/70">3D</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="px-2 py-2 mb-1">
            <div className="text-sm font-medium truncate">{company?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            data-testid="logout-button"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut size={16} strokeWidth={1.8} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={`flex-1 min-w-0 ${isOffice ? "" : "overflow-y-auto"}`}>
        <Outlet />
      </main>
    </div>
  );
}

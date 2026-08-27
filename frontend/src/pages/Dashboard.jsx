import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Bot, User, ListChecks, FolderKanban, ArrowUpRight, Sparkles, Send } from "lucide-react";

function Stat({ label, value, sub, accent, testid }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card/40" data-testid={testid}>
      <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{label}</div>
      <div className="mt-2 font-display font-extrabold text-3xl tracking-tight" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const KIND_COLOR = {
  message: "#3B82F6", task: "#F59E0B", working: "#F59E0B", review: "#8B5CF6",
  completed: "#10B981", hire: "#00E599", project: "#00E599", error: "#EF4444", info: "#71717A",
};

export default function Dashboard() {
  const { company } = useAuth();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const nav = useNavigate();

  const load = async () => {
    const [s, a] = await Promise.all([api.get("/dashboard/stats"), api.get("/activity")]);
    setStats(s.data); setActivity(a.data);
  };
  useEffect(() => { load(); const iv = setInterval(load, 4000); return () => clearInterval(iv); }, []);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="dashboard-page">
      <div className="flex items-end justify-between mb-7">
        <div>
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-wide">{company?.name}</div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight mt-1">Command Center</h1>
        </div>
        <button onClick={() => nav("/office")} data-testid="dashboard-open-office"
          className="flex items-center gap-2 bg-ai text-black font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-ai/90 transition-colors">
          <Sparkles size={16} /> Enter 3D Office
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Stat testid="stat-employees" label="Employees" value={stats?.employees.total ?? "—"}
          sub={`${stats?.employees.human ?? 0} human · ${stats?.employees.ai ?? 0} AI`} />
        <Stat testid="stat-tasks" label="Tasks" value={stats?.tasks.total ?? "—"}
          sub={`${stats?.tasks.completed ?? 0} completed · ${stats?.tasks.working ?? 0} working`} accent="#F59E0B" />
        <Stat testid="stat-projects" label="Projects" value={stats?.projects.active ?? "—"} sub="active" accent="#00E599" />
        <Stat testid="stat-agents" label="AI Agents" value={stats?.agents.total ?? "—"}
          sub={`${stats?.agents.active ?? 0} active · ${stats?.agents.waiting ?? 0} waiting`} accent="#00E599" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* activity feed */}
        <div className="col-span-2 border border-border rounded-lg bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm">Live Activity</span>
            <span className="font-mono text-[10px] text-ai flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse-glow" /> LIVE</span>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto" data-testid="activity-feed">
            {activity.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No activity yet. Create an agent and assign a task.</div>}
            {activity.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: KIND_COLOR[a.kind] || "#71717A" }} />
                <div className="min-w-0">
                  <div className="text-sm">{a.text}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* quick actions */}
        <div className="space-y-3">
          {[
            { label: "Create AI Agent", to: "/agents", icon: Bot, c: "#00E599" },
            { label: "Invite Employee", to: "/employees", icon: User, c: "#FF6B35" },
            { label: "New Task", to: "/tasks", icon: ListChecks, c: "#F59E0B" },
            { label: "New Project", to: "/projects", icon: FolderKanban, c: "#8B5CF6" },
          ].map(({ label, to, icon: Icon, c }) => (
            <button key={to} onClick={() => nav(to)} data-testid={`quick-${label.toLowerCase().replace(/\s/g, "-")}`}
              className="w-full group flex items-center gap-3 border border-border rounded-lg p-4 bg-card/40 hover:bg-secondary/50 transition-colors text-left">
              <div className="h-9 w-9 rounded-md flex items-center justify-center border" style={{ borderColor: c + "55", background: c + "1a" }}>
                <Icon size={18} style={{ color: c }} />
              </div>
              <span className="font-medium text-sm flex-1">{label}</span>
              <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

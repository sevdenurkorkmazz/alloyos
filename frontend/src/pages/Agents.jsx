import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import CreateAgentDialog from "../components/CreateAgentDialog";
import { STATUS_COLORS, STATUS_LABEL } from "../lib/office";
import { Bot, Plus, X, Play, Send, Zap, CheckCircle2, Clock, MessageSquare } from "lucide-react";

export default function Agents() {
  const { me } = useAuth();
  const { t } = useI18n();
  const [agents, setAgents] = useState([]);
  const [allEmps, setAllEmps] = useState([]);
  const [depts, setDepts] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [task, setTask] = useState("");
  const [delegateTo, setDelegateTo] = useState("");
  const [delegateMsg, setDelegateMsg] = useState("");

  const load = useCallback(async () => {
    const [e, d] = await Promise.all([api.get("/employees"), api.get("/departments")]);
    setAllEmps(e.data);
    setAgents(e.data.filter((x) => x.type === "ai"));
    setDepts(d.data);
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 3000); return () => clearInterval(iv); }, [load]);

  const openPanel = async (a) => {
    setSel(a);
    const { data } = await api.get(`/employees/${a.id}`);
    setDetail(data);
  };
  useEffect(() => {
    if (!sel) return;
    const iv = setInterval(async () => {
      const { data } = await api.get(`/employees/${sel.id}`);
      setDetail(data);
    }, 2500);
    return () => clearInterval(iv);
  }, [sel]);

  const giveTask = async (e) => {
    e.preventDefault();
    if (!task.trim()) return;
    try {
      await api.post("/tasks", { title: task, assigned_to: sel.id, priority: "high" });
      toast.success(`Task sent to ${sel.name} — watch the office!`);
      setTask("");
    } catch (err) { toast.error("Failed"); }
  };

  const delegate = async (e) => {
    e.preventDefault();
    if (!delegateTo || !delegateMsg.trim()) return;
    try {
      await api.post("/messages", { from_employee: sel.id, to_employee: delegateTo, body: delegateMsg, kind: "task" });
      await api.post("/tasks", { title: delegateMsg, assigned_to: delegateTo, priority: "medium" });
      const target = allEmps.find((x) => x.id === delegateTo);
      toast.success(`${sel.name} delegated to ${target?.name}`);
      setDelegateMsg(""); setDelegateTo("");
    } catch (err) { toast.error("Failed"); }
  };

  const accentOf = (a) => a.avatar?.bodyColor || "#00E599";

  return (
    <div className="p-8 max-w-[1400px]" data-testid="agents-page">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight">{t("agents.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("agents.sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="create-agent-button"
          className="flex items-center gap-2 bg-ai text-black font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-ai/90 transition-colors">
          <Plus size={16} /> {t("agents.create")}
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center" data-testid="agents-empty">
          <Bot size={40} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold">{t("agents.emptyT")}</div>
          <p className="text-sm text-muted-foreground mt-1">{t("agents.emptyS")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4" data-testid="agents-grid">
          {agents.map((a) => {
            const accent = accentOf(a);
            return (
              <button key={a.id} onClick={() => openPanel(a)} data-testid={`agent-card-${a.id}`}
                className="text-left border border-border rounded-lg p-4 bg-card/40 hover:border-ai/40 transition-colors relative overflow-hidden">
                {a.status === "working" && <div className="absolute top-0 right-0 h-full w-1" style={{ background: accent, boxShadow: `0 0 16px ${accent}` }} />}
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-md flex items-center justify-center border" style={{ borderColor: accent + "55", background: accent + "1a" }}>
                    <Bot size={20} style={{ color: accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.role}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px]" style={{ color: STATUS_COLORS[a.status] }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[a.status] }} />
                  {STATUS_LABEL[a.status]}
                  {a.current_activity && <span className="text-muted-foreground truncate">· {a.current_activity}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(a.skills || []).slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border">{s}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateAgentDialog open={open} onClose={() => setOpen(false)} onCreated={load} depts={depts} />

      {/* Agent work panel */}
      {sel && (
        <div className="fixed inset-0 z-40 flex justify-end" data-testid="agent-panel">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSel(null); setDetail(null); }} />
          <div className="relative w-[440px] h-full glass border-l border-border overflow-y-auto animate-fade-up">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-md flex items-center justify-center border" style={{ borderColor: accentOf(sel) + "55", background: accentOf(sel) + "1a" }}>
                    <Bot size={22} style={{ color: accentOf(sel) }} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-lg tracking-tight">{sel.name}</div>
                    <div className="text-sm text-muted-foreground">{sel.role}</div>
                  </div>
                </div>
                <button onClick={() => { setSel(null); setDetail(null); }} className="text-muted-foreground hover:text-foreground" data-testid="close-agent-panel"><X size={18} /></button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[detail?.status || sel.status] }} />
                <span className="font-mono text-xs" style={{ color: STATUS_COLORS[detail?.status || sel.status] }}>{STATUS_LABEL[detail?.status || sel.status]}</span>
                {detail?.current_activity && <span className="text-xs text-muted-foreground italic truncate">"{detail.current_activity}"</span>}
              </div>

              {/* stats */}
              <div className="grid grid-cols-3 gap-2 mt-5">
                {[
                  { icon: CheckCircle2, label: "Completed", value: detail?.task_summary?.completed ?? 0, c: "#10B981" },
                  { icon: Zap, label: "Active", value: detail?.task_summary?.active ?? 0, c: "#F59E0B" },
                  { icon: Clock, label: "Waiting", value: detail?.task_summary?.waiting ?? 0, c: "#8B5CF6" },
                ].map((s) => (
                  <div key={s.label} className="border border-border rounded-md p-2.5 bg-secondary/30">
                    <s.icon size={14} style={{ color: s.c }} />
                    <div className="font-display font-bold text-xl mt-1">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{s.label}</div>
                  </div>
                ))}
              </div>

              {sel.personality && <p className="text-sm text-muted-foreground mt-4">{sel.personality}</p>}
              {sel.skills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sel.skills.map((s) => <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border">{s}</span>)}
                </div>
              )}

              <label className="mt-4 flex items-center justify-between gap-3 border border-border rounded-md px-3 py-2.5 bg-secondary/40 cursor-pointer">
                <div>
                  <div className="text-sm font-medium">{t("agents.autoApprove")}</div>
                  <div className="text-xs text-muted-foreground">{t("agents.autoApproveHint")}</div>
                </div>
                <input type="checkbox" data-testid="panel-auto-approve"
                  checked={!!(detail?.auto_approve ?? sel.auto_approve)}
                  onChange={async (e) => {
                    const v = e.target.checked;
                    setDetail((d) => d ? { ...d, auto_approve: v } : d);
                    setSel((s) => ({ ...s, auto_approve: v }));
                    try { await api.put(`/employees/${sel.id}`, { auto_approve: v }); } catch { toast.error("Failed"); }
                  }}
                  className="accent-[#00E599] h-4 w-4" />
              </label>

              {/* give task */}
              <form onSubmit={giveTask} className="mt-6 border-t border-border pt-5" data-testid="give-task-form">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Play size={13} /> {t("agents.giveTask")}</div>
                <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={2} placeholder="Research our top 3 competitors' latest campaigns…" data-testid="give-task-input"
                  className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
                <button type="submit" className="mt-2 w-full flex items-center justify-center gap-2 bg-ai text-black font-semibold rounded-md py-2 text-sm hover:bg-ai/90 transition-colors" data-testid="give-task-submit">
                  <Play size={14} /> {t("agents.assignRun")}
                </button>
              </form>

              {/* delegate */}
              <form onSubmit={delegate} className="mt-5 border-t border-border pt-5" data-testid="delegate-form">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Send size={13} /> {t("agents.delegate")}</div>
                <select value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} data-testid="delegate-target"
                  className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60 mb-2">
                  <option value="">{t("agents.chooseEmp")}</option>
                  {allEmps.filter((x) => x.id !== sel.id).map((x) => (
                    <option key={x.id} value={x.id}>{`${x.name} · ${x.role}${x.type === "ai" ? " (AI)" : ""}`}</option>
                  ))}
                </select>
                <input value={delegateMsg} onChange={(e) => setDelegateMsg(e.target.value)} placeholder={t("agents.taskForThem")} data-testid="delegate-input"
                  className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
                <button type="submit" className="mt-2 w-full flex items-center justify-center gap-2 bg-secondary border border-border rounded-md py-2 text-sm hover:bg-accent transition-colors" data-testid="delegate-submit">
                  <Send size={14} /> {t("agents.sendEnvelope")}
                </button>
              </form>

              <div className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare size={13} /> {detail?.message_count ?? 0} messages
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import Modal from "../components/Modal";
import { TASK_STATUS, TASK_STATUS_COLORS } from "../lib/office";
import { useI18n } from "../context/I18nContext";
import { Plus, Bot, User, Check, X, Pencil, Terminal } from "lucide-react";

const LABEL = { backlog: "Backlog", assigned: "Assigned", working: "Working", review: "Review", completed: "Completed" };
const PRIORITY_C = { low: "#52525B", medium: "#3B82F6", high: "#F59E0B", urgent: "#EF4444" };

export default function Tasks() {
  const { t } = useI18n();
  const [tasks, setTasks] = useState([]);
  const [emps, setEmps] = useState([]);
  const [projects, setProjects] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", project_id: "", priority: "medium" });
  const [review, setReview] = useState(null);       // approval being viewed/edited
  const [edited, setEdited] = useState("");

  const load = useCallback(async () => {
    const [t, e, p, a] = await Promise.all([
      api.get("/tasks"), api.get("/employees"), api.get("/projects"), api.get("/approvals"),
    ]);
    setTasks(t.data); setEmps(e.data); setProjects(p.data); setApprovals(a.data);
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 3000); return () => clearInterval(iv); }, [load]);

  const empById = (id) => emps.find((e) => e.id === id);
  const pendingApproval = (taskId) => approvals.find((a) => a.task_id === taskId && a.status === "pending");

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/tasks", { ...form, assigned_to: form.assigned_to || null, project_id: form.project_id || null });
      toast.success("Task created");
      setOpen(false); setForm({ title: "", description: "", assigned_to: "", project_id: "", priority: "medium" });
      load();
    } catch { toast.error("Failed"); }
  };

  const decide = async (approvalId, decision, output) => {
    try {
      await api.post(`/approvals/${approvalId}/decision`, { decision, edited_output: output });
      const label = decision === "approve" ? "approved" : decision === "edit" ? "saved & approved" : "rejected";
      toast.success(`Task ${label}`);
      setReview(null); load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="p-8" data-testid="tasks-page">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight">{t("tasks.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("tasks.sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-task-button"
          className="flex items-center gap-2 bg-ai text-black font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-ai/90 transition-colors">
          <Plus size={16} /> {t("tasks.new")}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3" data-testid="kanban-board">
        {TASK_STATUS.map((status) => {
          const col = tasks.filter((tk) => tk.status === status);
          return (
            <div key={status} data-testid={`kanban-col-${status}`}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS_COLORS[status] }} />
                <span className="text-sm font-medium">{t(`taskstatus.${status}`)}</span>
                <span className="font-mono text-xs text-muted-foreground">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((tk) => {
                  const assignee = empById(tk.assigned_to);
                  const appr = status === "review" ? pendingApproval(tk.id) : null;
                  return (
                    <div key={tk.id} className="border border-border rounded-md p-3 bg-card/40" data-testid={`task-card-${tk.id}`}>
                      <div className="text-sm font-medium leading-snug">{tk.title}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_C[tk.priority] }} />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{tk.priority}</span>
                        {assignee && (
                          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                            {assignee.type === "ai" ? <Bot size={11} className="text-ai" /> : <User size={11} className="text-human" />}
                            {assignee.name.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      {appr && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <button onClick={() => { setReview(appr); setEdited(appr.output); }} data-testid={`review-task-${tk.id}`}
                            className="w-full text-xs bg-status-review/15 text-status-review border border-status-review/40 rounded py-1.5 hover:bg-status-review/25 transition-colors font-medium">
                            {t("tasks.review")}
                          </button>
                        </div>
                      )}
                      {status === "working" && (
                        <div className="mt-2 font-mono text-[10px] text-status-working animate-pulse-glow">● {t("tasks.running")}</div>
                      )}
                    </div>
                  );
                })}
                {col.length === 0 && <div className="text-xs text-muted-foreground/50 px-1 py-3">{t("tasks.empty")}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* New task modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Task" subtitle="Assign to an AI agent to run it automatically." testid="new-task-modal">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="task-title"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} data-testid="task-description"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign to</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} data-testid="task-assignee"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60">
                <option value="">Unassigned (backlog)</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{`${e.name} · ${e.role}${e.type === "ai" ? " (AI)" : ""}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} data-testid="task-priority"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60">
                {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Project</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} data-testid="task-project"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60">
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" data-testid="task-submit"
            className="w-full bg-ai text-black font-semibold rounded-md py-2.5 text-sm hover:bg-ai/90 transition-colors">
            Create task
          </button>
        </form>
      </Modal>

      {/* Approval / review modal (terminal style) */}
      <Modal open={!!review} onClose={() => setReview(null)} width="max-w-2xl" testid="approval-modal"
        title={review?.title} subtitle={`Output from ${review?.agent_name} · human-in-the-loop review`}>
        {review && (
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-ai mb-2"><Terminal size={13} /> AGENT OUTPUT</div>
            <textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={12} data-testid="approval-output"
              className="w-full bg-black/50 border border-border rounded-md px-3 py-2.5 text-sm font-mono outline-none focus:border-ai/60 leading-relaxed" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => decide(review.id, "approve")} data-testid="approve-button"
                className="flex-1 flex items-center justify-center gap-2 bg-status-completed text-black font-semibold rounded-md py-2.5 text-sm hover:opacity-90 transition-opacity">
                <Check size={16} /> Approve
              </button>
              <button onClick={() => decide(review.id, "edit", edited)} data-testid="edit-approve-button"
                className="flex-1 flex items-center justify-center gap-2 bg-secondary border border-border rounded-md py-2.5 text-sm hover:bg-accent transition-colors">
                <Pencil size={16} /> Save & Approve
              </button>
              <button onClick={() => decide(review.id, "reject")} data-testid="reject-button"
                className="flex items-center justify-center gap-2 bg-destructive/20 text-destructive border border-destructive/40 rounded-md px-4 py-2.5 text-sm hover:bg-destructive/30 transition-colors">
                <X size={16} /> Reject
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import Modal from "../components/Modal";
import { Plus, FolderKanban } from "lucide-react";

const COLORS = ["#00E599", "#FF6B35", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#00E599" });

  const load = async () => setProjects((await api.get("/projects")).data);
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/projects", form);
      toast.success("Project created");
      setOpen(false); setForm({ name: "", description: "", color: "#00E599" }); load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="p-8 max-w-[1400px]" data-testid="projects-page">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Group tasks and assign humans + AI together.</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-project-button"
          className="flex items-center gap-2 bg-ai text-black font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-ai/90 transition-colors">
          <Plus size={16} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center">
          <FolderKanban size={40} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold">No projects yet</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4" data-testid="projects-grid">
          {projects.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-5 bg-card/40 relative overflow-hidden" data-testid={`project-card-${p.id}`}>
              <div className="absolute top-0 left-0 h-1 w-full" style={{ background: p.color }} />
              <div className="font-semibold">{p.name}</div>
              <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description || "No description"}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="font-mono text-xs text-muted-foreground">{p.task_count} tasks</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: p.color, border: `1px solid ${p.color}55` }}>ACTIVE</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Project" testid="new-project-modal">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="project-name"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} data-testid="project-description"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-md border-2 ${form.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <button type="submit" data-testid="project-submit"
            className="w-full bg-ai text-black font-semibold rounded-md py-2.5 text-sm hover:bg-ai/90 transition-colors">Create project</button>
        </form>
      </Modal>
    </div>
  );
}

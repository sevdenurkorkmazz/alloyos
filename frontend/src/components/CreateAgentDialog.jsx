import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import Modal from "./Modal";
import { AI_BODY_COLORS } from "../lib/office";
import { Sparkles } from "lucide-react";

const MODELS = [
  { provider: "gemini", model: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { provider: "gemini", model: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { provider: "openai", model: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
];

const empty = {
  name: "", role: "", department_id: "", description: "", personality: "",
  skills: "", responsibilities: "", system_instructions: "",
  ai_provider: "gemini", ai_model: "gemini-3-flash-preview", bodyColor: "#00E599",
};

export default function CreateAgentDialog({ open, onClose, onCreated, depts }) {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { if (open) api.get("/agent-templates").then(({ data }) => setTemplates(data)); }, [open]);

  const applyTemplate = (t) => setForm({
    ...form, name: t.name, role: t.role, description: t.responsibilities,
    personality: t.personality, skills: t.skills.join(", "), responsibilities: t.responsibilities,
    system_instructions: t.system_instructions, bodyColor: t.accent,
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/employees/ai", {
        name: form.name, role: form.role, department_id: form.department_id || null,
        description: form.description, personality: form.personality,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        responsibilities: form.responsibilities, system_instructions: form.system_instructions,
        ai_provider: form.ai_provider, ai_model: form.ai_model,
        avatar: { bodyColor: form.bodyColor, visorColor: "#0b1220", accent: form.bodyColor, antenna: true },
      });
      toast.success(`${form.name} created`);
      setForm(empty); onClose(); onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  const input = "w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60";

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" testid="create-agent-modal"
      title="Create AI Employee" subtitle="Design an autonomous agent that lives in your office.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Start from a template</label>
          <div className="flex flex-wrap gap-2" data-testid="agent-templates">
            {templates.map((t) => (
              <button key={t.key} type="button" onClick={() => applyTemplate(t)} data-testid={`template-${t.key}`}
                className="px-3 py-1.5 rounded-md text-xs border border-border bg-secondary/50 hover:border-ai/50 transition-colors flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: t.accent }} /> {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
            <input value={form.name} onChange={upd("name")} required placeholder="Alex" className={input} data-testid="agent-name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role</label>
            <input value={form.role} onChange={upd("role")} required placeholder="Marketing Manager" className={input} data-testid="agent-role" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Department</label>
            <select value={form.department_id} onChange={upd("department_id")} className={input} data-testid="agent-department">
              <option value="">Unassigned</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">AI Model</label>
            <select value={form.ai_model} onChange={(e) => {
              const m = MODELS.find((x) => x.model === e.target.value);
              setForm({ ...form, ai_model: m.model, ai_provider: m.provider });
            }} className={input} data-testid="agent-model">
              {MODELS.map((m) => <option key={m.model} value={m.model}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Personality</label>
          <input value={form.personality} onChange={upd("personality")} placeholder="Energetic, creative, data-informed." className={input} data-testid="agent-personality" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Skills (comma separated)</label>
          <input value={form.skills} onChange={upd("skills")} placeholder="Marketing, Research, Content" className={input} data-testid="agent-skills" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">System instructions</label>
          <textarea value={form.system_instructions} onChange={upd("system_instructions")} rows={3}
            placeholder="You are a senior marketing specialist…" className={input} data-testid="agent-instructions" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Avatar color</label>
          <div className="flex gap-2">
            {AI_BODY_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, bodyColor: c })}
                className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-110 ${form.bodyColor === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} data-testid="agent-submit"
          className="w-full flex items-center justify-center gap-2 bg-ai text-black font-semibold rounded-md py-2.5 text-sm hover:bg-ai/90 transition-colors disabled:opacity-60">
          <Sparkles size={16} /> {saving ? "Creating…" : "Create AI Employee"}
        </button>
      </form>
    </Modal>
  );
}

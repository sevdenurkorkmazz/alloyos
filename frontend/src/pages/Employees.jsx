import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import Modal from "../components/Modal";
import AvatarCustomizer from "../components/AvatarCustomizer";
import { defaultHumanAvatar, STATUS_COLORS, STATUS_LABEL } from "../lib/office";
import { useI18n } from "../context/I18nContext";
import { Bot, User, UserPlus, Mail } from "lucide-react";

export default function Employees() {
  const { t } = useI18n();
  const [emps, setEmps] = useState([]);
  const [depts, setDepts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "", department_id: "" });
  const [avatar, setAvatar] = useState(defaultHumanAvatar());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [e, d] = await Promise.all([api.get("/employees"), api.get("/departments")]);
    setEmps(e.data); setDepts(d.data);
  };
  useEffect(() => { load(); }, []);

  const deptName = (id) => depts.find((d) => d.id === id)?.name || "—";
  const shown = emps.filter((e) => filter === "all" ? true : e.type === filter);

  const invite = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/employees/human", { ...form, avatar });
      toast.success(`${form.name} invited`);
      setOpen(false);
      setForm({ name: "", email: "", role: "", department_id: "" });
      setAvatar(defaultHumanAvatar());
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="p-8 max-w-[1400px]" data-testid="employees-page">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight">{t("emp.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("emp.sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="invite-employee-button"
          className="flex items-center gap-2 bg-human text-white font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-human/90 transition-colors">
          <UserPlus size={16} /> {t("emp.invite")}
        </button>
      </div>

      <div className="flex gap-1 mb-5 border border-border rounded-lg p-1 w-fit bg-card/40">
        {["all", "human", "ai"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
            className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {f === "ai" ? "AI" : f} <span className="font-mono text-xs text-muted-foreground">
              {f === "all" ? emps.length : emps.filter((e) => e.type === f).length}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4" data-testid="employees-grid">
        {shown.map((emp) => {
          const isAi = emp.type === "ai";
          const accent = isAi ? (emp.avatar?.bodyColor || "#00E599") : (emp.avatar?.shirtColor || "#FF6B35");
          return (
            <div key={emp.id} className="border border-border rounded-lg p-4 bg-card/40 hover:border-white/20 transition-colors" data-testid={`employee-card-${emp.id}`}>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-md flex items-center justify-center border" style={{ borderColor: accent + "55", background: accent + "1a" }}>
                  {isAi ? <Bot size={20} style={{ color: accent }} /> : <User size={20} style={{ color: accent }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{emp.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{emp.role}</div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: accent, borderColor: accent + "55" }}>
                  {isAi ? "AI" : "HUMAN"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">{deptName(emp.department_id)}</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: STATUS_COLORS[emp.status] }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[emp.status] }} />
                  {STATUS_LABEL[emp.status]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} width="max-w-2xl" testid="invite-modal"
        title="Invite Employee" subtitle="Create a real teammate with their own 3D character.">
        <form onSubmit={invite} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="invite-name"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email (optional)</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" data-testid="invite-email"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role</label>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required placeholder="e.g. UI Designer" data-testid="invite-role"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Department</label>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} data-testid="invite-department"
                className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60">
                <option value="">Unassigned</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Character</label>
            <AvatarCustomizer avatar={avatar} onChange={setAvatar} />
          </div>
          <button type="submit" disabled={saving} data-testid="invite-submit"
            className="w-full flex items-center justify-center gap-2 bg-human text-white font-semibold rounded-md py-2.5 text-sm hover:bg-human/90 transition-colors disabled:opacity-60">
            <Mail size={16} /> {saving ? "Inviting…" : "Invite to company"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

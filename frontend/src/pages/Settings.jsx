import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { Plus, Building2, Languages } from "lucide-react";

const COLORS = ["#00E599", "#FF6B35", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];

export default function Settings() {
  const { company, user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [depts, setDepts] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");

  const load = async () => setDepts((await api.get("/departments")).data);
  useEffect(() => { load(); }, []);

  const addDept = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/departments", { name, color });
      toast.success("Department added");
      setName(""); load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="p-8 max-w-[800px]" data-testid="settings-page">
      <h1 className="font-display font-extrabold text-4xl tracking-tight mb-6">{t("set.title")}</h1>

      <div className="border border-border rounded-lg bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-2 mb-4"><Languages size={16} className="text-ai" /><span className="font-semibold text-sm">{t("set.language")}</span></div>
        <div className="flex gap-2">
          {[["tr", "Türkçe"], ["en", "English"]].map(([l, name]) => (
            <button key={l} onClick={() => setLang(l)} data-testid={`settings-lang-${l}`}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${lang === l ? "bg-ai text-black border-ai font-semibold" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-2 mb-4"><Building2 size={16} className="text-ai" /><span className="font-semibold text-sm">{t("set.company")}</span></div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground mb-1">{t("set.name")}</div><div className="font-medium">{company?.name}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">{t("set.owner")}</div><div className="font-medium">{user?.name} · {user?.email}</div></div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card/40 p-5">
        <div className="font-semibold text-sm mb-4">{t("set.departments")}</div>
        <div className="flex flex-wrap gap-2 mb-4" data-testid="department-list">
          {depts.map((d) => (
            <span key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-secondary/40 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.name}
            </span>
          ))}
        </div>
        <form onSubmit={addDept} className="flex gap-2 items-center" data-testid="add-department-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("set.newDept")} data-testid="department-name"
            className="flex-1 bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`h-6 w-6 rounded border-2 ${color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
          <button type="submit" data-testid="add-department-submit"
            className="flex items-center gap-1.5 bg-ai text-black font-semibold rounded-md px-3 py-2 text-sm hover:bg-ai/90 transition-colors"><Plus size={15} /> {t("set.add")}</button>
        </form>
      </div>
    </div>
  );
}

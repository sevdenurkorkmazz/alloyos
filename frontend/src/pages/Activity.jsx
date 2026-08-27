import { useEffect, useState } from "react";
import api from "../lib/api";
import { useI18n } from "../context/I18nContext";

const KIND_COLOR = {
  message: "#3B82F6", task: "#F59E0B", working: "#F59E0B", review: "#8B5CF6",
  completed: "#10B981", hire: "#00E599", project: "#00E599", error: "#EF4444", info: "#71717A", meeting: "#8B5CF6",
};

export default function Activity() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const load = async () => setItems((await api.get("/activity")).data);
  useEffect(() => { load(); const iv = setInterval(load, 3000); return () => clearInterval(iv); }, []);

  return (
    <div className="p-8 max-w-[900px]" data-testid="activity-page">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display font-extrabold text-4xl tracking-tight">{t("act.title")}</h1>
        <span className="font-mono text-[10px] text-ai flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse-glow" /> LIVE</span>
      </div>
      <div className="border border-border rounded-lg bg-card/40 divide-y divide-border" data-testid="activity-list">
        {items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">{t("act.empty")}</div>}
        {items.map((a) => (
          <div key={a.id} className="px-5 py-3.5 flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: KIND_COLOR[a.kind] || "#71717A" }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{a.text}</div>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

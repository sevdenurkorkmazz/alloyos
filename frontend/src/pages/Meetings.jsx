import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import Modal from "../components/Modal";
import { useI18n } from "../context/I18nContext";
import { Plus, CalendarClock, Play, Square, Bot, User, Users } from "lucide-react";

const STATUS_C = { scheduled: "#3B82F6", active: "#8B5CF6", done: "#52525B" };

export default function Meetings() {
  const { t } = useI18n();
  const [meetings, setMeetings] = useState([]);
  const [emps, setEmps] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState([]);
  const [now, setNow] = useState(true);
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(90);

  const load = useCallback(async () => {
    const [m, e] = await Promise.all([api.get("/meetings"), api.get("/employees")]);
    setMeetings(m.data); setEmps(e.data);
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 3000); return () => clearInterval(iv); }, [load]);

  const empById = (id) => emps.find((e) => e.id === id);
  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length < 6 ? [...p, id] : p));

  const create = async (e) => {
    e.preventDefault();
    if (picked.length === 0) { toast.error(t("meet.pickP")); return; }
    try {
      await api.post("/meetings", {
        title, participants: picked, duration_seconds: Number(duration) || 90,
        start_time: now ? null : (when ? new Date(when).toISOString() : null),
      });
      toast.success(now ? "Meeting started — open the Office!" : "Meeting scheduled");
      setOpen(false); setTitle(""); setPicked([]); setNow(true); setWhen(""); load();
    } catch { toast.error("Failed"); }
  };

  const startNow = async (id) => { await api.post(`/meetings/${id}/start`); toast.success("Started"); load(); };
  const endNow = async (id) => { await api.post(`/meetings/${id}/end`); load(); };

  return (
    <div className="p-8 max-w-[1100px]" data-testid="meetings-page">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-4xl tracking-tight">{t("meet.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("meet.sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-meeting-button"
          className="flex items-center gap-2 bg-status-review text-white font-semibold rounded-md px-4 py-2.5 text-sm hover:opacity-90 transition-opacity">
          <Plus size={16} /> {t("meet.new")}
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-16 text-center">
          <CalendarClock size={40} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold">{t("meet.emptyT")}</div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="meetings-list">
          {meetings.map((m) => (
            <div key={m.id} className="border border-border rounded-lg p-4 bg-card/40 flex items-center gap-4" data-testid={`meeting-${m.id}`}>
              <div className="h-10 w-10 rounded-md flex items-center justify-center border shrink-0"
                style={{ borderColor: STATUS_C[m.status] + "55", background: STATUS_C[m.status] + "1a" }}>
                <Users size={18} style={{ color: STATUS_C[m.status] }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{m.title}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  {m.participants.map((pid) => {
                    const e = empById(pid); if (!e) return null;
                    const isAi = e.type === "ai";
                    return <span key={pid} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5">
                      {isAi ? <Bot size={11} className="text-ai" /> : <User size={11} className="text-human" />}{e.name.split(" ")[0]}</span>;
                  })}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded uppercase" style={{ color: STATUS_C[m.status], border: `1px solid ${STATUS_C[m.status]}55` }}>
                {m.status === "scheduled" ? t("meet.scheduled") : m.status === "active" ? t("meet.activeS") : t("meet.done")}
              </span>
              {m.status !== "active" && m.status !== "done" && (
                <button onClick={() => startNow(m.id)} data-testid={`start-meeting-${m.id}`}
                  className="flex items-center gap-1.5 bg-status-review/20 text-status-review border border-status-review/40 rounded-md px-3 py-1.5 text-xs hover:bg-status-review/30 transition-colors">
                  <Play size={13} /> {t("meet.startNow")}
                </button>
              )}
              {m.status === "active" && (
                <button onClick={() => endNow(m.id)} data-testid={`end-meeting-${m.id}`}
                  className="flex items-center gap-1.5 bg-destructive/20 text-destructive border border-destructive/40 rounded-md px-3 py-1.5 text-xs hover:bg-destructive/30 transition-colors">
                  <Square size={13} /> {t("meet.end")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} width="max-w-lg" testid="new-meeting-modal"
        title={t("meet.schedule")} subtitle={t("meet.sub")}>
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("common.title")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="meeting-title"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("meet.participants")} ({picked.length}/6)</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto" data-testid="participant-list">
              {emps.map((e) => {
                const on = picked.includes(e.id);
                const isAi = e.type === "ai";
                return (
                  <button key={e.id} type="button" onClick={() => toggle(e.id)} data-testid={`participant-${e.id}`}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-colors ${on ? "border-status-review bg-status-review/15" : "border-border bg-secondary/40 hover:bg-secondary"}`}>
                    {isAi ? <Bot size={14} className="text-ai" /> : <User size={14} className="text-human" />}
                    <span className="text-xs truncate">{e.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} data-testid="meeting-now" className="accent-[#8B5CF6]" />
              {t("meet.now")}
            </label>
            {!now && (
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="meeting-when"
                className="flex-1 bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-ai/60" />
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("meet.duration")}</span>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={20} max={600} data-testid="meeting-duration"
                className="w-20 bg-secondary/60 border border-border rounded-md px-2 py-2 text-sm outline-none focus:border-ai/60" />
            </div>
          </div>
          <button type="submit" data-testid="meeting-submit"
            className="w-full bg-status-review text-white font-semibold rounded-md py-2.5 text-sm hover:opacity-90 transition-opacity">
            {t("meet.create")}
          </button>
        </form>
      </Modal>
    </div>
  );
}

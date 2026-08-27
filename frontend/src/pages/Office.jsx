import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import OfficeScene from "../components/three/OfficeScene";
import { STATUS_COLORS, STATUS_LABEL, deskPosition } from "../lib/office";
import { useI18n } from "../context/I18nContext";
import { Bot, User, X, ExternalLink, Loader2 } from "lucide-react";

export default function Office() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState([]);
  const [envelopes, setEnvelopes] = useState([]);
  const [meetingSeats, setMeetingSeats] = useState({});
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const sinceRef = useRef(0);
  const empRef = useRef([]);
  const nav = useNavigate();

  const load = useCallback(async () => {
    const [e, m] = await Promise.all([api.get("/employees"), api.get("/meetings")]);
    setEmployees(e.data);
    empRef.current = e.data;
    const activeM = m.data.find((x) => x.status === "active");
    setMeetingSeats(activeM?.seat_map || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      const ev = await api.get("/events", { params: { since: 0 } });
      sinceRef.current = ev.data.now;
    })();
  }, [load]);

  useEffect(() => {
    const posOf = (id) => empRef.current.find((x) => x.id === id)?.desk || { x: 0, z: 0 };
    const typeColor = (id) => {
      const e = empRef.current.find((x) => x.id === id);
      if (!e) return "#00E599";
      return e.type === "ai" ? (e.avatar?.bodyColor || "#00E599") : (e.avatar?.shirtColor || "#FF6B35");
    };
    const statusOf = (id) => empRef.current.find((x) => x.id === id)?.status;

    const tick = async () => {
      try {
        const { data } = await api.get("/events", { params: { since: sinceRef.current } });
        sinceRef.current = data.now;
        for (const evt of data.events) {
          if (evt.type === "envelope") {
            const from = posOf(evt.payload.from), to = posOf(evt.payload.to);
            setEnvelopes((prev) => [...prev, { key: evt.id, from, to, color: typeColor(evt.payload.from) }]);
            // trigger a short walk-and-talk if both are free
            const sf = statusOf(evt.payload.from), st = statusOf(evt.payload.to);
            if (evt.payload.from !== evt.payload.to && !["working", "meeting"].includes(sf) && !["working", "meeting"].includes(st)) {
              const mid = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 + 0.9 };
              const conv = { key: evt.id, a: evt.payload.from, b: evt.payload.to, mid };
              setConversations((prev) => [...prev.filter((c) => c.a !== conv.a && c.b !== conv.b), conv]);
              setTimeout(() => setConversations((prev) => prev.filter((c) => c.key !== conv.key)), 5200);
            }
          } else if (evt.type === "status") {
            setEmployees((prev) => {
              const next = prev.map((e) => e.id === evt.payload.employee_id
                ? { ...e, status: evt.payload.status, current_activity: evt.payload.activity } : e);
              empRef.current = next;
              return next;
            });
            setSelected((s) => (s && s.id === evt.payload.employee_id ? { ...s, status: evt.payload.status, current_activity: evt.payload.activity } : s));
          } else if (evt.type === "meeting") {
            if (evt.payload.action === "start") setMeetingSeats(evt.payload.seat_map || {});
            else if (evt.payload.action === "end") setMeetingSeats({});
          }
        }
      } catch { /* ignore */ }
    };
    const iv = setInterval(tick, 2000);
    return () => clearInterval(iv);
  }, []);

  const removeEnvelope = useCallback((key) => setEnvelopes((prev) => prev.filter((e) => e.key !== key)), []);

  const aiCount = employees.filter((e) => e.type === "ai").length;
  const humanCount = employees.filter((e) => e.type === "human").length;
  const workingCount = employees.filter((e) => e.status === "working").length;
  const meetingCount = Object.keys(meetingSeats).length;

  return (
    <div className="relative h-screen w-full" data-testid="office-page">
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={16} /> {t("office.rendering")}
          </div>
        </div>
      )}

      <div className="absolute inset-0">
        <OfficeScene employees={employees} envelopes={envelopes} onRemoveEnvelope={removeEnvelope}
          selectedId={selected?.id} onSelect={setSelected} meetingSeats={meetingSeats} conversations={conversations} />
      </div>

      <div className="absolute top-5 left-5 z-10 glass rounded-lg px-4 py-3" data-testid="office-hud">
        <div className="font-display font-extrabold text-lg tracking-tight leading-none">{t("office.title")}</div>
        <div className="font-mono text-[11px] text-muted-foreground mt-1.5 flex gap-3">
          <span><span className="text-ai">{aiCount}</span> AI</span>
          <span><span className="text-human">{humanCount}</span> {t("dash.human")}</span>
          <span><span className="text-status-working">{workingCount}</span> {t("office.working")}</span>
          {meetingCount > 0 && <span><span className="text-status-review">{meetingCount}</span> meeting</span>}
        </div>
      </div>

      <div className="absolute bottom-5 left-5 z-10 glass rounded-lg px-3 py-2.5" data-testid="office-legend">
        <div className="font-mono text-[10px] text-muted-foreground mb-1.5">{t("office.status")}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {["idle", "working", "waiting", "meeting", "talking", "completed"].map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[k] }} />
              <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[k]}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-2">{t("office.controls")}</div>
      </div>

      {selected && (
        <div className="absolute top-5 right-5 z-10 w-[300px] glass rounded-lg p-4 animate-fade-up" data-testid="office-inspector">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-md flex items-center justify-center border"
                style={{ borderColor: (selected.type === "ai" ? "#00E599" : "#FF6B35") + "66", background: (selected.type === "ai" ? "#00E599" : "#FF6B35") + "1a" }}>
                {selected.type === "ai" ? <Bot size={18} className="text-ai" /> : <User size={18} className="text-human" />}
              </div>
              <div>
                <div className="font-semibold text-sm leading-tight">{selected.name}</div>
                <div className="text-xs text-muted-foreground">{selected.role}</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground" data-testid="close-inspector"><X size={16} /></button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[selected.status] }} />
            <span className="font-mono text-xs" style={{ color: STATUS_COLORS[selected.status] }}>{STATUS_LABEL[selected.status]}</span>
          </div>
          {selected.current_activity && <div className="mt-2 text-xs text-muted-foreground italic">"{selected.current_activity}"</div>}
          {selected.skills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.skills.map((s) => <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border">{s}</span>)}
            </div>
          )}
          {selected.type === "ai" && (
            <button onClick={() => nav("/agents")} data-testid="inspector-open-agent"
              className="mt-4 w-full flex items-center justify-center gap-1.5 bg-secondary hover:bg-accent border border-border rounded-md py-2 text-xs font-medium transition-colors">
              {t("office.openAgent")} <ExternalLink size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

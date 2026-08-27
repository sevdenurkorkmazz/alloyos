import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { STATUS_COLORS } from "../lib/office";
import { Bot, User, Send } from "lucide-react";

export default function Messages() {
  const { me } = useAuth();
  const { t } = useI18n();
  const [emps, setEmps] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef();

  useEffect(() => { api.get("/employees").then(({ data }) => setEmps(data)); }, []);

  const loadConv = async (other) => {
    if (!me) return;
    const { data } = await api.get("/messages", { params: { with_employee: other.id, employee: me.id } });
    setMsgs(data);
    setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 50);
  };

  useEffect(() => {
    if (!active) return;
    loadConv(active);
    const iv = setInterval(() => loadConv(active), 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line
  }, [active, me]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !me || !active) return;
    try {
      await api.post("/messages", { from_employee: me.id, to_employee: active.id, body: text, kind: "message" });
      setText(""); loadConv(active);
    } catch { toast.error("Failed to send"); }
  };

  const others = emps.filter((e) => e.id !== me?.id);

  return (
    <div className="h-screen flex" data-testid="messages-page">
      {/* conversation list */}
      <div className="w-[300px] border-r border-border flex flex-col">
        <div className="p-5 border-b border-border">
          <h1 className="font-display font-extrabold text-2xl tracking-tight">{t("msg.title")}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("msg.sub")}</p>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="conversation-list">
          {others.map((e) => {
            const isAi = e.type === "ai";
            const accent = isAi ? (e.avatar?.bodyColor || "#00E599") : (e.avatar?.shirtColor || "#FF6B35");
            return (
              <button key={e.id} onClick={() => setActive(e)} data-testid={`conversation-${e.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 text-left transition-colors ${active?.id === e.id ? "bg-secondary" : "hover:bg-secondary/40"}`}>
                <div className="h-9 w-9 rounded-md flex items-center justify-center border shrink-0" style={{ borderColor: accent + "55", background: accent + "1a" }}>
                  {isAi ? <Bot size={17} style={{ color: accent }} /> : <User size={17} style={{ color: accent }} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.role}</div>
                </div>
                <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[e.status] }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* thread */}
      <div className="flex-1 flex flex-col">
        {active ? (
          <>
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="h-9 w-9 rounded-md flex items-center justify-center border"
                style={{ borderColor: (active.type === "ai" ? "#00E599" : "#FF6B35") + "55", background: (active.type === "ai" ? "#00E599" : "#FF6B35") + "1a" }}>
                {active.type === "ai" ? <Bot size={17} className="text-ai" /> : <User size={17} className="text-human" />}
              </div>
              <div>
                <div className="font-semibold text-sm">{active.name}</div>
                <div className="text-xs text-muted-foreground">{active.role}</div>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3" data-testid="message-thread">
              {msgs.length === 0 && <div className="text-sm text-muted-foreground text-center mt-10">{t("msg.none")}</div>}
              {msgs.map((m) => {
                const mine = m.from_employee === me?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-3.5 py-2 text-sm ${mine ? "bg-ai text-black" : "bg-secondary border border-border"}`}>
                      {m.kind !== "message" && <div className="text-[9px] font-mono uppercase opacity-70 mb-0.5">{m.kind}</div>}
                      {m.body}
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={send} className="p-4 border-t border-border flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${active.name}…`} data-testid="message-input"
                className="flex-1 bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60" />
              <button type="submit" data-testid="message-send"
                className="bg-ai text-black rounded-md px-4 hover:bg-ai/90 transition-colors"><Send size={16} /></button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t("msg.select")}</div>
        )}
      </div>
    </div>
  );
}

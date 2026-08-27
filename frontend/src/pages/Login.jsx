import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

function BrandPanel() {
  const { t } = useI18n();
  return (
    <div className="hidden lg:flex flex-col justify-between w-[46%] bg-card/40 border-r border-border p-12 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-ai/10 blur-3xl" />
      <div className="flex items-center gap-3 relative">
        <div className="h-9 w-9 rounded-md bg-ai/15 border border-ai/40 flex items-center justify-center">
          <div className="h-4 w-4 rounded-sm bg-ai shadow-[0_0_14px_#00E599]" />
        </div>
        <span className="font-display font-extrabold text-xl tracking-tight">AlloyOS</span>
      </div>
      <div className="relative">
        <h1 className="font-display font-extrabold text-5xl leading-[1.05] tracking-tight">
          {t("auth.headline1")}<br />
          <span className="text-ai">{t("auth.headline2")}</span>
        </h1>
        <p className="text-muted-foreground mt-5 max-w-sm leading-relaxed">{t("auth.brandSub")}</p>
        <div className="flex gap-6 mt-8 font-mono text-xs text-muted-foreground">
          <div><span className="text-ai text-lg font-sans font-bold">AI</span> agents</div>
          <div><span className="text-human text-lg font-sans font-bold">Human</span> teams</div>
          <div><span className="text-foreground text-lg font-sans font-bold">3D</span> office</div>
        </div>
      </div>
      <div className="relative font-mono text-[11px] text-muted-foreground">Human + AI · one workspace</div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="h-screen w-screen flex bg-background">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-fade-up" data-testid="login-form">
          <h2 className="font-display font-bold text-2xl tracking-tight">{t("auth.welcome")}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-7">{t("auth.signinSub")}</p>

          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("auth.email")}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
            data-testid="login-email"
            className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60 transition-colors mb-4" />

          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("auth.password")}</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
            data-testid="login-password"
            className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60 transition-colors mb-6" />

          <button type="submit" disabled={loading} data-testid="login-submit"
            className="w-full bg-ai text-black font-semibold rounded-md py-2.5 text-sm hover:bg-ai/90 transition-colors disabled:opacity-60">
            {loading ? t("auth.signingin") : t("auth.signin")}
          </button>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {t("auth.noCompany")}{" "}
            <Link to="/register" className="text-ai hover:underline" data-testid="go-register">{t("auth.createOne")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

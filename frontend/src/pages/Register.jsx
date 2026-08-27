import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", company_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Company created — welcome to AlloyOS");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 h-96 w-96 rounded-full bg-ai/8 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-human/8 blur-3xl" />
      <form onSubmit={submit} className="w-full max-w-md glass rounded-xl p-8 relative animate-fade-up" data-testid="register-form">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-8 w-8 rounded-md bg-ai/15 border border-ai/40 flex items-center justify-center">
            <div className="h-3.5 w-3.5 rounded-sm bg-ai shadow-[0_0_12px_#00E599]" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight">AlloyOS</span>
        </div>
        <h2 className="font-display font-bold text-2xl tracking-tight">Found your company</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">Spin up your virtual office in seconds.</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your name</label>
            <input value={form.name} onChange={upd("name")} required data-testid="register-name"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company</label>
            <input value={form.company_name} onChange={upd("company_name")} required data-testid="register-company"
              className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60" />
          </div>
        </div>

        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
        <input value={form.email} onChange={upd("email")} type="email" required data-testid="register-email"
          className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60 mb-3" />

        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
        <input value={form.password} onChange={upd("password")} type="password" required minLength={6} data-testid="register-password"
          className="w-full bg-secondary/60 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-ai/60 mb-6" />

        <button type="submit" disabled={loading} data-testid="register-submit"
          className="w-full bg-ai text-black font-semibold rounded-md py-2.5 text-sm hover:bg-ai/90 transition-colors disabled:opacity-60">
          {loading ? "Creating…" : "Create company"}
        </button>
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have one?{" "}
          <Link to="/login" className="text-ai hover:underline" data-testid="go-login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

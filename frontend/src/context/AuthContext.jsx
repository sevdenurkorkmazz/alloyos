import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // null=checking, false=guest, object=user
  const [company, setCompany] = useState(null);
  const [me, setMe] = useState(null);           // owner's employee record

  const loadMe = async () => {
    const token = localStorage.getItem("alloy_token");
    if (!token) { setUser(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setCompany(data.company);
    } catch {
      localStorage.removeItem("alloy_token");
      setUser(false);
    }
  };

  useEffect(() => { loadMe(); }, []);

  // resolve the current user's employee record (the CEO/owner)
  useEffect(() => {
    if (!user) return;
    api.get("/employees").then(({ data }) => {
      const mine = data.find((e) => e.user_id === user.id) || data.find((e) => e.role === "CEO");
      setMe(mine || null);
    }).catch(() => {});
  }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("alloy_token", data.token);
    setUser(data.user); setCompany(data.company);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("alloy_token", data.token);
    setUser(data.user); setCompany(data.company);
  };

  const logout = () => {
    localStorage.removeItem("alloy_token");
    setUser(false); setCompany(null); setMe(null);
  };

  return (
    <AuthContext.Provider value={{ user, company, me, login, register, logout, refreshMe: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

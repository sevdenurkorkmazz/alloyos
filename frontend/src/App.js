import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Office from "./pages/Office";
import Employees from "./pages/Employees";
import Agents from "./pages/Agents";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Messages from "./pages/Messages";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="font-mono text-sm text-muted-foreground animate-pulse-glow">Loading AlloyOS…</div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Toaster theme="dark" position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="office" element={<Office />} />
            <Route path="employees" element={<Employees />} />
            <Route path="agents" element={<Agents />} />
            <Route path="projects" element={<Projects />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="messages" element={<Messages />} />
            <Route path="activity" element={<Activity />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

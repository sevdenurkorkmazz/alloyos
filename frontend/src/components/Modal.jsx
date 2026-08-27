import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({ open, onClose, title, subtitle, children, width = "max-w-lg", testid }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testid}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} glass rounded-xl p-6 max-h-[90vh] overflow-y-auto animate-fade-up`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display font-bold text-xl tracking-tight">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="modal-close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

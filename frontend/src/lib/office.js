// Shared office / avatar constants + helpers (original AlloyOS assets, procedural)

export const STATUS_COLORS = {
  idle: "#52525B",
  working: "#F59E0B",
  waiting: "#8B5CF6",
  talking: "#3B82F6",
  meeting: "#3B82F6",
  completed: "#10B981",
  error: "#EF4444",
};

export const STATUS_LABEL = {
  idle: "Idle",
  working: "Working",
  waiting: "Waiting",
  talking: "Talking",
  meeting: "Meeting",
  completed: "Completed",
  error: "Error",
};

export const TASK_STATUS = ["backlog", "assigned", "working", "review", "completed"];
export const TASK_STATUS_COLORS = {
  backlog: "#52525B",
  assigned: "#3B82F6",
  working: "#F59E0B",
  review: "#8B5CF6",
  completed: "#10B981",
};

// Human avatar option sets
export const SKIN_TONES = ["#f4d0b0", "#e8b58f", "#c68642", "#8d5524", "#5c3a21"];
export const HAIR_COLORS = ["#2b2b2b", "#5a3825", "#a5673f", "#d9c17a", "#c0c0c0", "#e14b4b"];
export const HAIR_STYLES = ["short", "long", "curly", "bald"];
export const FACIAL_HAIR = ["clean", "beard", "mustache"];
export const SHIRT_COLORS = ["#FF6B35", "#3B82F6", "#00E599", "#8B5CF6", "#F59E0B", "#e5e5e5", "#1f2937"];
export const ACCESSORIES = ["none", "glasses", "headphones", "coffee"];

export const AI_BODY_COLORS = ["#00E599", "#3B82F6", "#8B5CF6", "#F59E0B", "#FF6B35", "#e14b4b"];

export function defaultHumanAvatar() {
  return { skinTone: "#e8b58f", hairColor: "#2b2b2b", hairStyle: "short",
    facialHair: "clean", shirtColor: "#3B82F6", accessory: "none" };
}
export function defaultAiAvatar(color = "#00E599") {
  return { bodyColor: color, visorColor: "#0b1220", accent: color, antenna: true };
}

// deterministic desk position matching backend desk_position()
export function deskPosition(index) {
  const cols = 4;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const x = (col - (cols - 1) / 2) * 3.2;
  const z = row * 3.0 - 4.0;
  return { x, z };
}

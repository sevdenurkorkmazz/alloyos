import { SKIN_TONES, HAIR_COLORS, HAIR_STYLES, FACIAL_HAIR, SHIRT_COLORS, ACCESSORIES } from "../lib/office";

function Swatches({ label, options, value, onChange, testid }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5" data-testid={testid}>
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-110 ${value === o ? "border-white" : "border-transparent"}`}
            style={{ background: o }} title={o} />
        ))}
      </div>
    </div>
  );
}

function Options({ label, options, value, onChange }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`px-2.5 py-1 rounded-md text-xs capitalize border transition-colors ${value === o ? "bg-ai text-black border-ai" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function AvatarPreview({ a }) {
  return (
    <div className="relative h-40 w-32 mx-auto flex items-end justify-center">
      <div className="absolute bottom-2 h-3 w-20 rounded-full bg-black/40 blur-sm" />
      {/* body */}
      <div className="relative">
        <div className="mx-auto rounded-t-2xl rounded-b-md" style={{ width: 60, height: 58, background: a.shirtColor }} />
        {/* head */}
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 42, height: 42, background: a.skinTone }}>
          {a.hairStyle !== "bald" && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-t-full"
              style={{ width: a.hairStyle === "curly" ? 48 : 44, height: a.hairStyle === "long" ? 34 : 20, background: a.hairColor }} />
          )}
          {a.facialHair === "beard" && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-b-full" style={{ width: 34, height: 14, background: a.hairColor }} />
          )}
          {a.accessory === "glasses" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded" style={{ width: 30, height: 6, background: "#111" }} />
          )}
        </div>
        {a.accessory === "coffee" && <div className="absolute bottom-2 -right-4 h-4 w-3 rounded-sm bg-human" />}
      </div>
    </div>
  );
}

export default function AvatarCustomizer({ avatar, onChange }) {
  const set = (k, v) => onChange({ ...avatar, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="border border-border rounded-lg bg-secondary/30 p-4 flex flex-col justify-center">
        <AvatarPreview a={avatar} />
        <div className="text-center font-mono text-[10px] text-muted-foreground mt-2">LIVE PREVIEW</div>
      </div>
      <div className="space-y-3">
        <Swatches label="Skin tone" options={SKIN_TONES} value={avatar.skinTone} onChange={(v) => set("skinTone", v)} testid="avatar-skin" />
        <Swatches label="Hair color" options={HAIR_COLORS} value={avatar.hairColor} onChange={(v) => set("hairColor", v)} testid="avatar-haircolor" />
        <Options label="Hair style" options={HAIR_STYLES} value={avatar.hairStyle} onChange={(v) => set("hairStyle", v)} />
        <Options label="Facial hair" options={FACIAL_HAIR} value={avatar.facialHair} onChange={(v) => set("facialHair", v)} />
        <Swatches label="Shirt" options={SHIRT_COLORS} value={avatar.shirtColor} onChange={(v) => set("shirtColor", v)} testid="avatar-shirt" />
        <Options label="Accessory" options={ACCESSORIES} value={avatar.accessory} onChange={(v) => set("accessory", v)} />
      </div>
    </div>
  );
}

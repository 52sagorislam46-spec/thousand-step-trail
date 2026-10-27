import { useState } from "react";
import { Mail, Music, Share2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { getSettings, setSetting } from "@/lib/game-settings";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState(getSettings());
  const toggle = (k: "sound" | "music") => {
    setSetting(k, !s[k]);
    setS(getSettings());
  };
  const share = async () => {
    const data = { title: "বাবল শুটার — ১০০০ লেভেল", url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        toast.success("লিংক কপি হয়েছে");
      }
    } catch {
      /* cancelled */
    }
  };
  const btn =
    "flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-black/40 text-white shadow-[inset_0_-6px_0_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.3)] transition-transform active:scale-95";
  const blue = "bg-gradient-to-b from-[hsl(230_80%_75%)] to-[hsl(235_70%_55%)]";
  const gold = "bg-gradient-to-b from-[hsl(45_100%_60%)] to-[hsl(35_95%_50%)]";
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="relative w-full max-w-xs rounded-3xl border-4 border-[hsl(255_50%_45%)] bg-[hsl(240_60%_94%)] px-6 pb-8 pt-12" onClick={(e) => e.stopPropagation()}>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-2xl border-2 border-[hsl(255_50%_35%)] bg-gradient-to-b from-[hsl(260_70%_70%)] to-[hsl(258_60%_50%)] px-8 py-2 text-xl font-extrabold tracking-wide text-white shadow-lg">
          সেটিংস
        </div>
        <button onClick={onClose} aria-label="বন্ধ" className="absolute -right-4 -top-4 flex h-11 w-11 items-center justify-center rounded-full border-4 border-[hsl(255_50%_35%)] bg-[hsl(258_55%_50%)] text-white shadow-lg">
          <X className="h-6 w-6" strokeWidth={3} />
        </button>
        <div className="grid grid-cols-2 place-items-center gap-6">
          <button aria-label="সাউন্ড" onClick={() => toggle("sound")} className={`${btn} ${blue} ${s.sound ? "" : "opacity-50"}`}>
            {s.sound ? <Volume2 className="h-10 w-10" /> : <VolumeX className="h-10 w-10" />}
          </button>
          <button aria-label="মিউজিক" onClick={() => toggle("music")} className={`${btn} ${blue} relative ${s.music ? "" : "opacity-50"}`}>
            <Music className="h-10 w-10" />
            {!s.music && <span className="absolute h-1 w-14 rotate-45 rounded bg-white" />}
          </button>
          <button aria-label="শেয়ার" onClick={share} className={`${btn} ${gold}`}>
            <Share2 className="h-10 w-10" />
          </button>
          <a aria-label="মেইল" href="mailto:?subject=বাবল শুটার গেম" className={`${btn} ${gold}`}>
            <Mail className="h-10 w-10" />
          </a>
        </div>
      </div>
    </div>
  );
}

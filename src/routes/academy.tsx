import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { askAcademy } from "@/lib/academy/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ASPECTS,
  GLOSSARY,
  HOUSES,
  LESSONS,
  PLANETS,
  QUIZZES,
  SIGNS,
  type QuizQuestion,
} from "@/lib/academy/content";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "Cosmic Blueprint Academy — Learn Astrology From Zero" },
      { name: "description", content: "A free, interactive crash course in reading natal charts. Planets, signs, houses, aspects, and how to interpret your Cosmic Blueprint report." },
      { property: "og:title", content: "Cosmic Blueprint Academy" },
      { property: "og:description", content: "Learn to read your natal chart — no prior knowledge required." },
    ],
  }),
  component: Academy,
});

const PROGRESS_KEY = "cb-academy-progress-v1";
const BOOKMARK_KEY = "cb-academy-bookmarks-v1";

function useLocalSet(key: string) {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setSet(new Set(JSON.parse(raw) as string[]));
    } catch { /* noop */ }
  }, [key]);
  const update = (next: Set<string>) => {
    setSet(new Set(next));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(Array.from(next)));
    }
  };
  return [set, update] as const;
}

function Academy() {
  const [completed, setCompleted] = useLocalSet(PROGRESS_KEY);
  const [bookmarks, setBookmarks] = useLocalSet(BOOKMARK_KEY);
  const [openLesson, setOpenLesson] = useState<string | null>("what-is-natal");
  const [search, setSearch] = useState("");

  const pct = Math.round((completed.size / LESSONS.length) * 100);

  const markDone = (id: string) => {
    const n = new Set(completed); n.add(id); setCompleted(n);
  };
  const toggleBookmark = (id: string) => {
    const n = new Set(bookmarks);
    if (n.has(id)) n.delete(id); else n.add(id);
    setBookmarks(n);
  };

  const filteredGlossary = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return GLOSSARY;
    return GLOSSARY.filter((g) =>
      g.term.toLowerCase().includes(s) || g.def.toLowerCase().includes(s),
    );
  }, [search]);

  return (
    <div className="starfield relative min-h-screen">
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-20">
        <header className="flex items-center justify-between mb-10">
          <Link to="/" className="text-xs uppercase tracking-[0.4em] text-gold hover:text-foreground transition">
            ← Cosmic Blueprint
          </Link>
          <Link to="/" className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-gold/40 transition">
            Calculate my chart →
          </Link>
        </header>

        <section className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.4em] text-gold mb-3">Cosmic Blueprint Academy</p>
          <h1 className="font-display text-5xl md:text-7xl text-gradient-gold leading-tight mb-6">
            Learn to read<br />your natal chart
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg leading-relaxed">
            Ten short lessons. Zero prior knowledge required. By the end you'll understand every
            symbol in your Cosmic Blueprint report and feel confident interpreting your own chart.
          </p>

          <div className="max-w-md mx-auto mt-10">
            <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground mb-2">
              <span>Your progress</span>
              <span>{completed.size} / {LESSONS.length} lessons</span>
            </div>
            <div className="h-2 rounded-full bg-card/60 overflow-hidden border border-border/40">
              <div className="h-full bg-gradient-to-r from-gold to-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && (
              <p className="mt-4 text-gold text-sm">🏆 Academy complete — you've earned the Cosmic Blueprint badge.</p>
            )}
          </div>
        </section>

        {/* Lesson nav */}
        <nav className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-12">
          {LESSONS.map((l) => {
            const done = completed.has(l.id);
            const bookmarked = bookmarks.has(l.id);
            const active = openLesson === l.id;
            return (
              <button
                key={l.id}
                onClick={() => {
                  setOpenLesson(l.id);
                  requestAnimationFrame(() => {
                    document.getElementById(`lesson-${l.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                className={`text-left p-3 rounded-xl border transition ${
                  active ? "border-gold/60 bg-card/80" : "border-border/40 bg-card/40 hover:border-gold/40"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Lesson {l.number}</span>
                  <span className="flex items-center gap-1">
                    {bookmarked && <span className="text-gold">★</span>}
                    {done && <span className="text-emerald-400">✓</span>}
                  </span>
                </div>
                <div className="mt-1 text-sm text-foreground font-medium leading-tight">{l.title}</div>
              </button>
            );
          })}
        </nav>

        {/* Lessons */}
        <div className="space-y-6">
          {LESSONS.map((l) => (
            <Lesson
              key={l.id}
              meta={l}
              isOpen={openLesson === l.id}
              onToggle={() => setOpenLesson((cur) => (cur === l.id ? null : l.id))}
              done={completed.has(l.id)}
              bookmarked={bookmarks.has(l.id)}
              onMarkDone={() => markDone(l.id)}
              onToggleBookmark={() => toggleBookmark(l.id)}
            />
          ))}
        </div>

        {/* Glossary */}
        <section className="mt-20 glass rounded-2xl p-6 md:p-8 shadow-deep">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold">Interactive Glossary</p>
              <h2 className="font-display text-2xl text-gradient-gold mt-1">Every term, defined</h2>
            </div>
            <input
              type="search"
              placeholder="Search terms — try 'square' or 'rising'"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cosmic-input w-full sm:w-80"
            />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredGlossary.map((g) => (
              <div key={g.term} className="rounded-lg border border-border/40 bg-card/50 p-3">
                <div className="text-gold text-sm font-medium">{g.term}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.def}</div>
              </div>
            ))}
            {filteredGlossary.length === 0 && (
              <div className="text-sm text-muted-foreground col-span-full text-center py-6">
                No matches. Try a different word.
              </div>
            )}
          </div>
        </section>

        <AssistantChat />

        <footer className="mt-20 pt-8 border-t border-border/40 text-center text-xs text-muted-foreground">
          Academy progress saved in your browser. Ready when you are —{" "}
          <Link to="/" className="text-gold hover:underline">calculate your chart</Link>.
        </footer>
      </div>
    </div>
  );
}

/* ----------------------------- Lesson container ---------------------------- */

interface LessonProps {
  meta: typeof LESSONS[number];
  isOpen: boolean;
  onToggle: () => void;
  done: boolean;
  bookmarked: boolean;
  onMarkDone: () => void;
  onToggleBookmark: () => void;
}

function Lesson({ meta, isOpen, onToggle, done, bookmarked, onMarkDone, onToggleBookmark }: LessonProps) {
  return (
    <section id={`lesson-${meta.id}`} className="glass rounded-2xl shadow-deep overflow-hidden border border-border/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left hover:bg-card/40 transition"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-accent/30 border border-gold/40 flex items-center justify-center text-gold font-display">
            {meta.number}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{meta.minutes} min read</div>
            <h3 className="font-display text-xl md:text-2xl text-gradient-gold">{meta.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{meta.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {done && <span className="text-emerald-400 text-xs">✓ Done</span>}
          {bookmarked && <span className="text-gold text-xs">★</span>}
          <span className="text-gold text-xl">{isOpen ? "−" : "+"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 md:px-8 pb-8 space-y-8">
          <LessonBody id={meta.id} />
          <Quiz id={meta.id} questions={QUIZZES[meta.id] ?? []} />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/40">
            <button
              onClick={onToggleBookmark}
              className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-md border border-border/50 text-muted-foreground hover:text-gold hover:border-gold/40 transition"
            >
              {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
            </button>
            <button
              onClick={onMarkDone}
              disabled={done}
              className="text-xs uppercase tracking-wider px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
            >
              {done ? "✓ Lesson complete" : "Mark lesson complete"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Lesson bodies ------------------------------ */

function LessonBody({ id }: { id: string }) {
  switch (id) {
    case "what-is-natal": return <LessonWhat />;
    case "planets": return <LessonPlanets />;
    case "signs": return <LessonSigns />;
    case "houses": return <LessonHouses />;
    case "combinations": return <LessonCombinations />;
    case "aspects": return <LessonAspects />;
    case "angles": return <LessonAngles />;
    case "special": return <LessonSpecial />;
    case "putting-together": return <LessonPutTogether />;
    case "reading-reports": return <LessonReadingReports />;
    default: return null;
  }
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 text-foreground/90 leading-relaxed">{children}</div>;
}

function LessonWhat() {
  return (
    <Prose>
      <p>
        A <strong className="text-gold">natal chart</strong> is a map of the sky at the exact moment
        and place you were born. Imagine pausing time, freezing every planet where it was, and
        drawing a circle of the sky overhead from your hospital room. That circle is your chart.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        <InfoCard title="Birth date" body="Tells us which sign each planet was in. The Sun moves through one sign per month." />
        <InfoCard title="Birth time" body="Determines your Ascendant (rising sign) and house placements. The sky shifts about one degree every four minutes — so even 15 minutes can change houses." />
        <InfoCard title="Birth place" body="Houses depend on your latitude and longitude. The same moment looks different from Tokyo vs Toronto." />
      </div>
      <p>
        <strong className="text-gold">Astrology vs astronomy.</strong> Astronomy is the science of
        celestial mechanics — it measures where planets are. Astrology is the symbolic language
        built on top, interpreting what those positions mean for human experience. Cosmic Blueprint
        uses real astronomy (Swiss Ephemeris) to power the symbolism — no estimates, no shortcuts.
      </p>
      <p className="text-sm text-muted-foreground">
        <strong>Why precision matters:</strong> If your time is off by an hour, your Ascendant and
        house placements may be wrong. The interpretation that follows would then describe someone
        else's life. Check your birth certificate when possible.
      </p>
      <SampleChartIllustration />
    </Prose>
  );
}

function LessonPlanets() {
  const [open, setOpen] = useState<string | null>(PLANETS[0].name);
  const current = PLANETS.find((p) => p.name === open) ?? PLANETS[0];
  return (
    <Prose>
      <p>
        Astrologers use ten <strong className="text-gold">planetary bodies</strong> (the Sun and Moon
        count, even though they're technically a star and a satellite). Think of each as a different
        character living inside you. Click any planet to meet them.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {PLANETS.map((p) => (
          <button
            key={p.name}
            onClick={() => setOpen(p.name)}
            className={`p-3 rounded-xl border transition text-center ${
              open === p.name ? "border-gold/70 bg-gold/10" : "border-border/40 bg-card/50 hover:border-gold/40"
            }`}
          >
            <div className="text-2xl text-gold">{p.glyph}</div>
            <div className="text-xs mt-1">{p.name}</div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-gold/30 bg-card/60 p-5">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl text-gold">{current.glyph}</span>
          <div>
            <h4 className="font-display text-xl text-gradient-gold">{current.name}</h4>
            <p className="text-sm text-muted-foreground">{current.tagline}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-5 text-sm">
          <KV k="Represents" v={current.represents} />
          <KV k="Personality" v={current.traits} />
          <KV k="Strengths" v={current.strengths} />
          <KV k="Challenges" v={current.challenges} />
          <KV k="Everyday example" v={current.everyday} />
          <KV k="In your report" v={current.inReport} />
        </div>
      </div>
    </Prose>
  );
}

function LessonSigns() {
  const [open, setOpen] = useState<string | null>(SIGNS[0].name);
  const current = SIGNS.find((s) => s.name === open) ?? SIGNS[0];
  const elementColor: Record<string, string> = {
    Fire: "text-rose-300", Earth: "text-emerald-300", Air: "text-sky-300", Water: "text-cyan-300",
  };
  return (
    <Prose>
      <p>
        Each planet expresses itself through one of <strong className="text-gold">12 zodiac signs</strong>.
        Signs are <em>how</em> a planet acts. They're grouped by <strong>element</strong> (Fire/Earth/Air/Water)
        and <strong>modality</strong> (Cardinal/Fixed/Mutable).
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {SIGNS.map((s) => (
          <button key={s.name} onClick={() => setOpen(s.name)}
            className={`p-3 rounded-xl border transition text-center ${
              open === s.name ? "border-gold/70 bg-gold/10" : "border-border/40 bg-card/50 hover:border-gold/40"
            }`}>
            <div className={`text-2xl ${elementColor[s.element]}`}>{s.glyph}</div>
            <div className="text-xs mt-1">{s.name}</div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-gold/30 bg-card/60 p-5">
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl ${elementColor[current.element]}`}>{current.glyph}</span>
          <div>
            <h4 className="font-display text-xl text-gradient-gold">{current.name}</h4>
            <p className="text-sm text-muted-foreground">{current.dates}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-5 text-sm">
          <KV k="Element" v={current.element} />
          <KV k="Modality" v={current.modality} />
          <KV k="Keywords" v={current.keywords} />
          <KV k="Strengths" v={current.strengths} />
          <KV k="Weaknesses" v={current.weaknesses} />
          <KV k="Famous for" v={current.famous} />
        </div>
      </div>
    </Prose>
  );
}

function LessonHouses() {
  return (
    <Prose>
      <p>
        Houses answer <strong className="text-gold">where</strong> in life a planet shows up.
        Your chart is sliced into 12 wedges, each one a different department of life — money, love,
        career, secrets. A planet's <em>house</em> tells you the arena it plays in.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {HOUSES.map((h) => (
          <div key={h.number} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-gold font-display">{h.number}</span>
              <span className="text-sm font-medium">{h.name}</span>
            </div>
            <div className="mt-2 text-xs space-y-1 text-muted-foreground">
              <div><span className="text-foreground/80">Rules:</span> {h.rules}</div>
              <div><span className="text-foreground/80">Asks:</span> {h.questions}</div>
              <div><span className="text-foreground/80">Example:</span> {h.example}</div>
              <div className="text-gold/80">{h.why}</div>
            </div>
          </div>
        ))}
      </div>
    </Prose>
  );
}

function LessonCombinations() {
  return (
    <Prose>
      <p>
        Here's the secret: every interpretation in your report is built from the same simple formula:
      </p>
      <div className="rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 to-accent/10 p-5 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-gold">The Formula</div>
        <div className="font-display text-2xl md:text-3xl mt-2">
          <span className="text-gold">Planet</span> <span className="text-muted-foreground">(what)</span>
          {" + "}
          <span className="text-gold">Sign</span> <span className="text-muted-foreground">(how)</span>
          {" + "}
          <span className="text-gold">House</span> <span className="text-muted-foreground">(where)</span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <ComboExample p="Sun" s="Scorpio" h="8th House"
          reading="Identity (Sun) expressed through intensity and depth (Scorpio) in the arena of transformation and intimacy (8th). You find yourself by surviving rebirth." />
        <ComboExample p="Moon" s="Pisces" h="4th House"
          reading="Emotions (Moon) dreamy and boundary-less (Pisces) at home and with family (4th). You feel things in your kitchen that others miss entirely." />
        <ComboExample p="Venus" s="Leo" h="5th House"
          reading="Love (Venus) dramatic and generous (Leo) in romance and play (5th). When you're smitten, the whole room knows." />
        <ComboExample p="Mars" s="Capricorn" h="10th House"
          reading="Drive (Mars) disciplined and strategic (Capricorn) aimed at career (10th). You climb. Slowly. And you arrive." />
      </div>
      <p className="text-sm text-muted-foreground">
        Once you can read one placement, you can read the whole chart. Just stack them.
      </p>
    </Prose>
  );
}

function LessonAspects() {
  return (
    <Prose>
      <p>
        Planets in your chart talk to each other through <strong className="text-gold">aspects</strong> —
        specific angles between them. Aspects are how your inner planets argue, agree, or collaborate.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {ASPECTS.map((a) => (
          <div key={a.name} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl text-gold">{a.glyph}</span>
                <span className="font-display text-lg">{a.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{a.angle}°</span>
            </div>
            <div className={`text-xs mt-1 uppercase tracking-wider ${
              a.vibe === "harmony" ? "text-emerald-300" : a.vibe === "tension" ? "text-rose-300" : "text-muted-foreground"
            }`}>{a.vibe}</div>
            <p className="text-sm mt-2 text-foreground/90">{a.meaning}</p>
            <p className="text-xs mt-2 text-muted-foreground italic">{a.example}</p>
            <AspectDiagram angle={a.angle} />
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Tight aspects (small <strong>orb</strong>, meaning very close to the exact angle) are
        strongest. A 0.5° conjunction is louder than a 7° one.
      </p>
    </Prose>
  );
}

function LessonAngles() {
  const angles = [
    { name: "Ascendant (Rising)", code: "ASC", body: "The sign rising on the eastern horizon at your birth. Your social mask, first impressions, your body's vibe. People meet your Rising before they meet your Sun." },
    { name: "Midheaven (MC)", code: "MC", body: "The highest point in your chart. Public reputation, vocation, what you're known for, your long-term life direction." },
    { name: "Descendant (DSC)", code: "DSC", body: "Opposite the Ascendant. The qualities you outsource to partners — what you're attracted to, the mirror you keep meeting." },
    { name: "IC (Imum Coeli)", code: "IC", body: "The bottom of the chart, opposite the Midheaven. Your private foundation: roots, ancestry, the home you return to when no one is watching." },
  ];
  return (
    <Prose>
      <p>
        The four <strong className="text-gold">angles</strong> are the most personal points in your
        chart. They're determined entirely by your exact birth time and location — which is why
        precision matters so much.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {angles.map((a) => (
          <div key={a.code} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-gold font-display text-xl">{a.code}</span>
              <span className="font-medium">{a.name}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.body}</p>
          </div>
        ))}
      </div>
    </Prose>
  );
}

function LessonSpecial() {
  const points = [
    { n: "North Node", body: "Your growth edge in this lifetime — qualities your soul is here to develop. Often uncomfortable at first, then liberating." },
    { n: "South Node", body: "Familiar territory from the past. Easy to lean on, but limiting if overused." },
    { n: "Chiron", body: "The wounded healer. A wound — often inherited — that becomes your medicine for others." },
    { n: "Black Moon Lilith", body: "The wild, unapologetic feminine. What gets shamed or exiled and refuses to be tamed." },
    { n: "Part of Fortune", body: "A calculated point (Asc + Moon − Sun) showing where joy, ease, and well-being flow most naturally." },
    { n: "Vertex", body: "A 'fate point' — often activated by pivotal meetings and turning points you didn't see coming." },
  ];
  return (
    <Prose>
      <p>
        Beyond the planets, astrologers track <strong className="text-gold">special points</strong> that
        add psychological and spiritual nuance.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {points.map((p) => (
          <div key={p.n} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <div className="text-gold font-medium">{p.n}</div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </Prose>
  );
}

function LessonPutTogether() {
  return (
    <Prose>
      <p>
        Let's walk through a real sample chart, one placement at a time. Notice how each layer
        sharpens the picture.
      </p>
      <div className="rounded-xl border border-border/40 bg-card/50 p-5 space-y-3">
        <h4 className="font-display text-lg text-gradient-gold">Sample: "Alex" — Oct 25, 1984, 4:30 PM, Boulder CO</h4>
        <ul className="space-y-2 text-sm">
          <li><span className="text-gold">☉ Sun in Scorpio (8th House):</span> Identity forged through depth, taboo, and rebirth.</li>
          <li><span className="text-gold">☽ Moon in Aquarius (11th House):</span> Emotional life finds safety in groups, causes, and unconventional friendships.</li>
          <li><span className="text-gold">↑ Aries Ascendant:</span> First impression is bold, direct, a little impatient.</li>
          <li><span className="text-gold">♀ Venus in Sagittarius (9th House):</span> Loves freedom, foreign cultures, philosophy in their romance.</li>
          <li><span className="text-gold">♂ Mars in Capricorn (10th House):</span> Channels drive into long-haul career ambition.</li>
          <li><span className="text-gold">Sun ☌ Pluto:</span> Identity and personal power are fused — intense presence, can't fake it.</li>
          <li><span className="text-gold">Moon □ Saturn:</span> Emotional restraint, fear of being too much; matures into deep steadiness.</li>
        </ul>
        <p className="text-sm text-muted-foreground italic mt-2">
          Synthesis: Alex is a deep Scorpio soul wearing an Aries mask — bold on the outside,
          excavating on the inside. Their friends are their chosen family (Moon 11th), they build
          career like a Capricorn ant (Mars 10th), and their love for adventure (Venus Sag 9th) keeps
          life from getting too heavy. The Sun-Pluto conjunction gives gravitas; the Moon-Saturn
          square makes the gravitas hard-won.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        That's it. Layer by layer, the chart starts to feel like a person. When you read your own,
        do the same thing — one placement, then the next, then how they relate.
      </p>
    </Prose>
  );
}

function LessonReadingReports() {
  return (
    <Prose>
      <p>
        Every Cosmic Blueprint report is built from your actual chart data. Here's how to get the
        most from each one.
      </p>
      <div className="space-y-3 text-sm">
        <Tip n="1" t="Notice the placements named in each paragraph"
          body="When you see 'your Moon in Cancer in the 4th House,' that's the planet + sign + house formula in action. The interpretation around it is unique to you." />
        <Tip n="2" t="Read symbols as shorthand"
          body="☉ Sun · ☽ Moon · ☿ Mercury · ♀ Venus · ♂ Mars · ♃ Jupiter · ♄ Saturn · ♅ Uranus · ♆ Neptune · ♇ Pluto. ☌ conjunction, ☍ opposition, □ square, △ trine, ✱ sextile." />
        <Tip n="3" t="Houses shift the meaning"
          body="The same planet/sign reads differently depending on the house. Saturn in the 7th = lessons through partnership. Saturn in the 10th = lessons through career." />
        <Tip n="4" t="Aspects modify everything"
          body="A harmonious trine softens a tough placement. A square gives it teeth. Read placements with their aspects, not in isolation." />
        <Tip n="5" t="Hold the contradictions"
          body="Real charts contain tension. If two sections seem to disagree, you probably contain both. That's not a bug — that's a human." />
        <Tip n="6" t="Use it as a mirror, not a verdict"
          body="Astrology describes potentials and patterns. You always have choice." />
      </div>
      <div className="rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 to-accent/10 p-4 text-center">
        <p className="text-sm">You've got the toolkit. Ready to generate your first report?</p>
        <Link to="/" className="inline-block mt-3 text-xs uppercase tracking-wider px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition">
          Calculate my chart →
        </Link>
      </div>
    </Prose>
  );
}

/* ----------------------------- Small primitives --------------------------- */

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4">
      <div className="text-gold text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-foreground/90">{v}</div>
    </div>
  );
}

function ComboExample({ p, s, h, reading }: { p: string; s: string; h: string; reading: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4">
      <div className="text-sm">
        <span className="text-gold">{p}</span> in <span className="text-gold">{s}</span> in the{" "}
        <span className="text-gold">{h}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{reading}</p>
    </div>
  );
}

function Tip({ n, t, body }: { n: string; t: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/40 bg-card/50 p-3">
      <div className="w-7 h-7 shrink-0 rounded-full bg-gold/20 border border-gold/40 text-gold flex items-center justify-center text-sm font-display">{n}</div>
      <div>
        <div className="text-sm font-medium text-foreground">{t}</div>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

function AspectDiagram({ angle }: { angle: number }) {
  const cx = 40, cy = 40, r = 30;
  const a1 = (-90 * Math.PI) / 180;
  const a2 = ((-90 + angle) * Math.PI) / 180;
  const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  const p2 = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20 mt-3 mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="currentColor" className="text-gold" strokeWidth="1.2" />
      <circle cx={p1.x} cy={p1.y} r="2.5" className="fill-gold" />
      <circle cx={p2.x} cy={p2.y} r="2.5" className="fill-gold" />
    </svg>
  );
}

function SampleChartIllustration() {
  // Decorative 12-spoke wheel
  return (
    <div className="flex justify-center pt-2">
      <svg viewBox="0 0 200 200" className="w-56 h-56 text-gold/80">
        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeOpacity="0.5" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeOpacity="0.3" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 - 90) * Math.PI / 180;
          return (
            <line key={i}
              x1={100 + 60 * Math.cos(a)} y1={100 + 60 * Math.sin(a)}
              x2={100 + 90 * Math.cos(a)} y2={100 + 90 * Math.sin(a)}
              stroke="currentColor" strokeOpacity="0.5" />
          );
        })}
        {SIGNS.map((s, i) => {
          const a = (i * 30 + 15 - 90) * Math.PI / 180;
          return (
            <text key={s.name} x={100 + 75 * Math.cos(a)} y={100 + 75 * Math.sin(a)}
              textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="currentColor">
              {s.glyph}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ----------------------------- Quiz --------------------------------------- */

function Quiz({ id, questions }: { id: string; questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  if (questions.length === 0) return null;
  const score = Object.entries(answers).filter(([i, a]) => questions[Number(i)].answer === a).length;
  const all = Object.keys(answers).length === questions.length;
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h4 className="font-display text-lg text-gradient-gold">Knowledge check</h4>
        <span className="text-xs text-muted-foreground">{Object.keys(answers).length} / {questions.length} answered</span>
      </div>
      <div className="space-y-5">
        {questions.map((q, i) => {
          const picked = answers[i];
          const correct = picked !== undefined && picked === q.answer;
          return (
            <div key={i}>
              <div className="text-sm font-medium mb-2">{i + 1}. {q.q}</div>
              <div className="grid gap-1.5">
                {q.choices.map((c, ci) => {
                  const isPick = picked === ci;
                  const isAns = q.answer === ci;
                  const show = picked !== undefined;
                  return (
                    <button key={ci}
                      onClick={() => setAnswers((p) => ({ ...p, [i]: ci }))}
                      disabled={picked !== undefined}
                      className={`text-left text-sm px-3 py-2 rounded-md border transition ${
                        show && isAns ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100" :
                        show && isPick && !correct ? "border-rose-400/60 bg-rose-400/10 text-rose-100" :
                        "border-border/40 bg-card/40 hover:border-gold/40"
                      }`}>
                      {c}
                    </button>
                  );
                })}
              </div>
              {picked !== undefined && (
                <div className={`text-xs mt-2 ${correct ? "text-emerald-300" : "text-rose-300"}`}>
                  {correct ? "Correct — " : "Not quite. "} <span className="text-muted-foreground">{q.explain}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {all && (
        <div className="mt-5 text-center text-sm">
          <span className="text-gold">Score: {score} / {questions.length}</span>
          {score === questions.length && <span className="ml-2">🏅 Perfect — lesson mastered.</span>}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- AI Assistant ------------------------------- */

interface ChatMsg { role: "user" | "assistant"; content: string; }

function AssistantChat() {
  const ask = useServerFn(askAcademy);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi! I'm your astrology tutor. Ask me anything — 'What does my Moon sign mean?', 'Why is my Rising Sign important?', 'What is a square aspect?'" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = [
    "What does my Moon sign mean?",
    "Why is my Rising Sign important?",
    "What is a square aspect?",
    "What are the houses?",
    "Why do I need my exact birth time?",
  ];

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session || sessionData.session.user.is_anonymous) {
        throw new Error("Please sign in with Google to chat with the tutor.");
      }
      const history = messages.slice(-8);
      const res = await ask({ data: { question, history } });
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-20 glass rounded-2xl p-6 md:p-8 shadow-deep">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">AI Astrology Tutor</p>
          <h2 className="font-display text-2xl text-gradient-gold mt-1">Ask anything</h2>
        </div>
        <span className="text-xs text-muted-foreground">Beginner-friendly answers</span>
      </div>

      <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-card/70 border border-border/40 text-foreground"
            }`}>
              {m.role === "assistant"
                ? <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                : m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-card/70 border border-border/40 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-gold hover:border-gold/40 transition">
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          className="cosmic-input flex-1"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="px-5 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60 text-sm uppercase tracking-wider">
          Ask
        </button>
      </form>
    </section>
  );
}
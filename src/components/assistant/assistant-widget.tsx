"use client";
import * as React from "react";
import { MessageCircleQuestion, Send, X, Info } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

interface Turn {
  role: "user" | "assistant";
  text: string;
  source?: "AI" | "RULES";
  links?: { label: string; href: string }[];
}

const SUGGESTIONS = ["How do I donate surplus food?", "What is the handover code?", "Can you tell if food is safe from a photo?"];

/** Contextual help. Answers come from the server: AI when configured, otherwise a curated guide. */
export function AssistantWidget() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  async function ask(message: string) {
    const text = message.trim();
    if (text.length < 2 || pending) return;
    setError(null);
    setInput("");
    setTurns((t) => [...t, { role: "user", text }]);
    setPending(true);
    const res = await api<{ source: "AI" | "RULES"; answer: string; links: { label: string; href: string }[] }>("POST", "/api/ai/assistant", { message: text });
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setTurns((t) => [...t, { role: "assistant", text: res.data.answer, source: res.data.source, links: res.data.links }]);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <section
          aria-label="LastPlate assistant"
          className="flex h-[min(70dvh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift"
        >
          <header className="flex items-center justify-between border-b border-line bg-sage-light px-4 py-3">
            <div>
              <p className="font-display text-sm font-bold text-deep">LastPlate assistant</p>
              <p className="text-xs text-muted">Platform questions and how-tos</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-full text-deep hover:bg-white" aria-label="Close assistant">
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {turns.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">Ask about donations, claims, pickups or your account.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-forest/25 bg-white px-3 py-1.5 text-left text-xs font-medium text-forest hover:bg-forest-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "ml-8 rounded-2xl rounded-br-md bg-forest px-3.5 py-2.5 text-sm text-white" : "mr-6 space-y-2 rounded-2xl rounded-bl-md bg-cream px-3.5 py-2.5 text-sm text-ink"}>
                <p>{t.text}</p>
                {t.role === "assistant" ? (
                  <>
                    {t.links?.length ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {t.links.map((l) => (
                          <a key={l.href} href={l.href} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-forest underline-offset-2 hover:underline">
                            {l.label}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <p className="flex items-center gap-1 text-[11px] text-muted">
                      <Info className="size-3" aria-hidden /> {t.source === "AI" ? "AI-generated. Check important details in the guide." : "From the LastPlate guide."}
                    </p>
                  </>
                ) : null}
              </div>
            ))}
            {pending ? <p className="mr-6 rounded-2xl bg-cream px-3.5 py-2.5 text-sm text-muted">Thinking…</p> : null}
            {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
          </div>
          <form
            className="flex items-center gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">Ask a question</label>
            <input
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Ask a question…"
              className="h-10 flex-1 rounded-full border border-input bg-white px-4 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/25"
            />
            <Button type="submit" size="icon" aria-label="Send question" disabled={input.trim().length < 2} loading={pending}>
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-12 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-forest-700"
      >
        <MessageCircleQuestion className="size-5" aria-hidden />
        {open ? "Close" : "Ask LastPlate"}
      </button>
    </div>
  );
}

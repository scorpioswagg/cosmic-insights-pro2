import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onDismiss: () => void;
}

export function WelcomeModal({ open, onDismiss }: Props) {
  // Never leave a portal/overlay mounted when closed — residual blur layers
  // read as a "white film" over the entire site.
  if (!open) return null;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:pointer-events-none" />
        <DialogPrimitive.Content
          aria-describedby="welcome-description"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const primary = document.getElementById("welcome-begin-btn");
            primary?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[101] w-[min(100%,42rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto outline-none p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:pointer-events-none"
        >
          <div className="relative w-full max-w-2xl glass rounded-3xl shadow-deep border border-gold/20 my-auto">
            <DialogPrimitive.Close
              aria-label="Close welcome message"
              className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-background/40 text-gold transition hover:bg-background/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Close welcome message</span>
            </DialogPrimitive.Close>
            <div className="p-8 md:p-12 space-y-6 max-h-[85vh] overflow-y-auto">
              <div className="text-center space-y-3">
                <div className="inline-block text-4xl md:text-5xl text-gold animate-pulse" aria-hidden="true">
                  ✦
                </div>
                <DialogPrimitive.Title className="font-display text-3xl md:text-4xl text-gradient-gold">
                  Welcome to The Cosmic Blueprint
                </DialogPrimitive.Title>
              </div>

              <DialogPrimitive.Description
                id="welcome-description"
                className="space-y-4 text-sm md:text-base leading-relaxed text-muted-foreground"
              >
                <div className="space-y-3">
                  <p className="text-foreground/90">
                    Hello and welcome — I am truly honored that you are here.
                  </p>
                  <p>
                    My name is Kyle Merritt, and I created The Cosmic Blueprint with one simple mission:
                    to help people understand themselves more deeply, recognize their strengths, and step
                    into the life they are capable of living.
                  </p>
                  <p>
                    For as long as I can remember, I have been fascinated by the patterns of the cosmos
                    and the way planetary cycles mirror the chapters of our lives. Astrology, when grounded
                    in precise calculation, is not about prediction for its own sake — it is a language of
                    timing, temperament, and potential.
                  </p>
                  <p>
                    Every report on this platform is generated from real Swiss Ephemeris astronomy. No
                    guesswork. No placeholders. Just your chart, interpreted with care.
                  </p>
                  <p className="text-foreground/90">
                    Astrology doesn't replace your free will—it empowers it.
                  </p>
                  <p className="text-foreground/90">
                    The stars may reveal possibilities, but your choices create your future.
                  </p>
                  <p>
                    No matter where you are in life right now, you possess incredible potential waiting to be
                    awakened. Every challenge can become wisdom. Every ending creates the space for a new
                    beginning. Every chapter of your story has meaning.
                  </p>
                  <p>
                    I sincerely hope these reports inspire you, encourage you, and help you discover something
                    extraordinary about yourself.
                  </p>
                  <p>Thank you again for allowing me to be a small part of your journey.</p>
                  <p>May your path be filled with purpose, confidence, growth, and endless possibilities.</p>
                  <p className="text-gold/90">The universe has always been speaking.</p>
                  <p className="text-gold/90">Now it's your turn to listen.</p>
                  <div className="pt-2">
                    <p className="text-muted-foreground">With gratitude,</p>
                    <p className="font-display text-xl text-gradient-gold mt-1">Kyle Merritt</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Founder, The Cosmic Blueprint
                    </p>
                  </div>
                </div>
              </DialogPrimitive.Description>

              <div className="pt-4 border-t border-border/40 text-center">
                <p className="italic font-display text-gold/90 text-base md:text-lg leading-relaxed">
                  "Every chart tells a story. Thank you for allowing The Cosmic Blueprint to help you discover yours."
                </p>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  id="welcome-begin-btn"
                  type="button"
                  onClick={onDismiss}
                  className="min-h-11 px-8 py-3 rounded-xl bg-gold text-primary-foreground font-display tracking-[0.2em] uppercase text-sm shadow-gold hover:opacity-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Begin My Journey
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

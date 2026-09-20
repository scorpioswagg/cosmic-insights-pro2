import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  question: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(12)
    .optional(),
});

export const askAcademy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    if ((context.claims as { is_anonymous?: boolean })?.is_anonymous) {
      throw new Error("Unauthorized: please sign in with Google to use the tutor.");
    }
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are the Cosmic Blueprint Academy assistant — a warm, plainspoken astrology tutor for absolute beginners.

RULES:
- Always answer in plain English. Define any astrology term the first time you use it.
- Keep answers under 180 words unless asked for depth. Short paragraphs or a tight bulleted list.
- Tropical zodiac, Placidus houses, geocentric Western astrology.
- Never invent a user's chart placements. If asked about "my" chart and you don't have it, say so and point them to the natal calculator on the home page.
- Never give medical, legal, or financial directives. Astrology describes patterns, not prescriptions.
- No emojis. Use markdown sparingly (bold for key terms only).`;

    const history = (data.history ?? [])
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
    const prompt = history
      ? `${history}\n\nUSER: ${data.question}\n\nASSISTANT:`
      : `USER: ${data.question}\n\nASSISTANT:`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
    });
    return { answer: text };
  });
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Send, Sparkles, User, X } from "lucide-react";
import stylysIcon from "@/assets/stylys-icon.png";
import { getCustomerToken } from "@/lib/widgetAuth";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-styling-chat`;
const WIDGET_AUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-customer-auth`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatProduct {
  name: string;
  price: number;
  handle?: string;
  image?: string;
  variantId?: string;
  category?: string;
}

interface StyleProfile {
  style_preferences?: string[];
  preferred_colors?: string[];
  avoided_colors?: string[];
  body_shape?: string;
  size_info?: Record<string, string>;
  occasions?: string[];
  budget_range?: { min?: number; max?: number };
  quiz_completed_at?: string;
}

interface QuizAnswers {
  occasion?: string;
  budget?: string;
  colors?: string;
  size?: string;
}

interface CustomerContext {
  occasion?: string;
  budget?: string;
  preferred_colors?: string[];
  avoided_colors?: string[];
  body_shape?: string;
  size_info?: Record<string, string>;
}

const QUIZ_STEPS: Array<{
  id: number;
  field: keyof QuizAnswers;
  question: string;
  options: string[];
}> = [
  {
    id: 0,
    field: "occasion",
    question: "What are you shopping for today?",
    options: ["Casual Day Out", "Date Night", "Work / Office", "Special Occasion", "Weekend Casual", "Beach / Vacation"],
  },
  {
    id: 1,
    field: "budget",
    question: "What's your budget for this look?",
    options: ["Under $50", "$50 – $100", "$100 – $200", "$200+"],
  },
  {
    id: 2,
    field: "colors",
    question: "Any color preferences?",
    options: ["Neutrals", "Earth tones", "Bold & bright", "Pastels", "Dark & moody", "No preference"],
  },
  {
    id: 3,
    field: "size",
    question: "What sizes do you usually wear?",
    options: ["XS / S", "M", "L", "XL / XXL"],
  },
];

function parseMessageContent(
  content: string
): Array<{ type: "text"; text: string } | { type: "product"; product: ChatProduct }> {
  const parts: Array<{ type: "text"; text: string } | { type: "product"; product: ChatProduct }> =
    [];
  const regex = /```product\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", text });
    }
    try {
      parts.push({ type: "product", product: JSON.parse(match[1].trim()) });
    } catch {
      parts.push({ type: "text", text: match[0] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: "text", text });
  }
  return parts.length ? parts : [{ type: "text", text: content }];
}

function ProductCard({ product, shop }: { product: ChatProduct; shop: string }) {
  const url =
    product.handle && shop ? `https://${shop}/products/${product.handle}` : undefined;
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background text-sm w-48 flex-shrink-0 inline-block">
      {product.image && (
        <img src={product.image} alt={product.name} className="w-full h-32 object-cover" />
      )}
      <div className="p-2 space-y-1">
        <p className="font-medium leading-tight line-clamp-2">{product.name}</p>
        <p className="text-muted-foreground">${product.price.toFixed(2)}</p>
        {url && (
          <a
            href={url}
            target="_parent"
            className="block text-center text-xs bg-primary text-primary-foreground rounded px-2 py-1 mt-1 hover:bg-primary/90 transition-colors"
          >
            View Product
          </a>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-2">
      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
        <img src={stylysIcon} alt="STYLYS" className="h-3 w-3 object-contain" />
      </div>
      <div className="bg-muted rounded-lg px-3 py-2">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const WidgetChat = () => {
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get("brand_id") || "";
  const shop = searchParams.get("shop") || "";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your personal styling assistant. Let me ask a few quick questions so I can find the perfect pieces for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [planError, setPlanError] = useState(false);

  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [stepsToShow, setStepsToShow] = useState<number[]>([]);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeSelection, setActiveSelection] = useState<string | null>(null);
  const [showFreeText, setShowFreeText] = useState(false);
  const [freeTextValue, setFreeTextValue] = useState("");

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
    const timer = setTimeout(
      () => scrollEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    const startQuiz = (profile: StyleProfile | null, steps: number[]) => {
      setStyleProfile(profile);
      setStepsToShow(steps);
      setQuizStep(0);
      setProfileLoaded(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: QUIZ_STEPS[steps[0]].question },
      ]);
    };

    const token = getCustomerToken();
    if (!token) {
      startQuiz(null, [0, 1, 2, 3]);
      return;
    }

    fetch(`${WIDGET_AUTH_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const profile: StyleProfile | null = data?.user?.styleProfile ?? null;
        const steps = [0, 1];
        if (!profile?.preferred_colors?.length) steps.push(2);
        if (!profile?.size_info || !Object.keys(profile.size_info).length) steps.push(3);

        if (profile) {
          const skips: string[] = [];
          if (profile.preferred_colors?.length)
            skips.push(
              `color preferences (${profile.preferred_colors.slice(0, 2).join(", ")})`
            );
          if (profile.size_info && Object.keys(profile.size_info).length)
            skips.push("size info");
          if (skips.length) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `I have your ${skips.join(" and ")} saved — I'll skip those questions.`,
              },
            ]);
          }
        }

        startQuiz(profile, steps);
      })
      .catch(() => {
        startQuiz(null, [0, 1, 2, 3]);
      });
  }, []); // runs once on mount

  function handleQuizSelect(value: string) {
    if (activeSelection !== null) return;
    setActiveSelection(value);

    const stepId = stepsToShow[quizStep];
    const field = QUIZ_STEPS[stepId].field;
    const newAnswers: QuizAnswers = { ...quizAnswers, [field]: value };
    setQuizAnswers(newAnswers);

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "user", content: value }]);
      setIsTransitioning(true);

      setTimeout(() => {
        const nextIndex = quizStep + 1;

        if (nextIndex >= stepsToShow.length) {
          const ctx: CustomerContext = {};
          if (newAnswers.occasion) ctx.occasion = newAnswers.occasion;
          if (newAnswers.budget) ctx.budget = newAnswers.budget;
          if (stepsToShow.includes(2) && newAnswers.colors) {
            ctx.preferred_colors = [newAnswers.colors];
          } else if (styleProfile?.preferred_colors?.length) {
            ctx.preferred_colors = styleProfile.preferred_colors;
          }
          if (stepsToShow.includes(3) && newAnswers.size) {
            ctx.size_info = { general: newAnswers.size };
          } else if (styleProfile?.size_info) {
            ctx.size_info = styleProfile.size_info;
          }
          if (styleProfile?.avoided_colors?.length)
            ctx.avoided_colors = styleProfile.avoided_colors;
          if (styleProfile?.body_shape) ctx.body_shape = styleProfile.body_shape;

          setCustomerContext(ctx);
          setQuizStep(stepsToShow.length);
          fireMessage(
            "Please suggest some outfit options based on my style preferences",
            ctx
          );
        } else {
          const nextStepId = stepsToShow[nextIndex];
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: QUIZ_STEPS[nextStepId].question },
          ]);
          setQuizStep(nextIndex);
        }

        setActiveSelection(null);
        setShowFreeText(false);
        setFreeTextValue("");
        setIsTransitioning(false);
      }, 180);
    }, 350);
  }

  function handleFreeTextSubmit() {
    const val = freeTextValue.trim();
    if (!val) return;
    handleQuizSelect(val);
  }

  const fireMessage = useCallback(
    async (text: string, ctx: CustomerContext | null) => {
      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      let assistantContent = "";
      const updateAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last?.role === "assistant" &&
            prev.length > 1 &&
            prev[prev.length - 2].role === "user"
          ) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantContent }];
        });
      };

      try {
        const history = [...messagesRef.current, userMessage].filter(
          (m, i) => !(m.role === "assistant" && i === 0)
        );

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            brand_id: brandId,
            messages: history,
            ...(ctx ? { customer_context: ctx } : {}),
          }),
        });

        if (resp.status === 403) {
          setPlanError(true);
          setIsLoading(false);
          return;
        }
        if (!resp.ok || !resp.body) {
          const err = await resp.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to get response");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) updateAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I'm having trouble connecting right now. Please try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [brandId]
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await fireMessage(text, customerContext);
  }, [input, isLoading, customerContext, fireMessage]);

  const quizComplete = profileLoaded && quizStep >= stepsToShow.length;
  const activeStepDef =
    profileLoaded && !quizComplete && quizStep < stepsToShow.length
      ? QUIZ_STEPS[stepsToShow[quizStep]]
      : null;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-4 border-b bg-primary text-primary-foreground flex items-center gap-3 flex-shrink-0">
        <div className="h-8 w-8 rounded-full flex items-center justify-center">
          <img src={stylysIcon} alt="STYLYS" className="h-4 w-4 object-contain" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">STYLYS</p>
          <p className="text-xs opacity-70">Personal Styling Assistant</p>
        </div>
        <button
          onClick={() => window.parent.postMessage({ type: "stylys-chat-close" }, "*")}
          className="opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {planError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
          <Sparkles className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold text-foreground">Professional Plan Required</p>
          <p className="text-sm text-muted-foreground">
            AI styling chat is available on the Professional plan.
          </p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "assistant"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <img src={stylysIcon} alt="STYLYS" className="h-3 w-3 object-contain" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] space-y-2 ${
                      msg.role === "user" ? "flex flex-col items-end" : ""
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      parseMessageContent(msg.content).map((part, j) =>
                        part.type === "text" ? (
                          <div key={j} className="bg-muted rounded-lg px-3 py-2">
                            <p className="text-sm whitespace-pre-wrap">{part.text}</p>
                          </div>
                        ) : (
                          <ProductCard key={j} product={part.product} shop={shop} />
                        )
                      )
                    ) : (
                      <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {!profileLoaded && <LoadingDots />}

              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <LoadingDots />
              )}

              <div ref={scrollEndRef} />
            </div>
          </ScrollArea>

          {activeStepDef && (
            <div
              className={`p-4 border-t flex-shrink-0 transition-all duration-300 ease-out ${
                isTransitioning ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
              }`}
            >
              <div className="grid grid-cols-2 gap-2 mb-2">
                {activeStepDef.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleQuizSelect(opt)}
                    disabled={activeSelection !== null}
                    className={`p-3 rounded-lg border text-left transition-all duration-200 hover:scale-[1.02] ${
                      activeSelection === opt
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {activeSelection === opt && <Check className="h-3 w-3 inline mr-1" />}
                    <span className="text-sm">{opt}</span>
                  </button>
                ))}
              </div>
              {!showFreeText ? (
                <button
                  onClick={() => setShowFreeText(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  Something else...
                </button>
              ) : (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={freeTextValue}
                    onChange={(e) => setFreeTextValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFreeTextSubmit()}
                    placeholder="Type your answer..."
                    className="flex-1 text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleFreeTextSubmit}
                    disabled={!freeTextValue.trim() || activeSelection !== null}
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {quizComplete && (
            <div className="p-4 border-t flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about styling..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WidgetChat;

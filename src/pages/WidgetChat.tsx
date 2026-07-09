import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, User, X } from "lucide-react";
import stylysIcon from "@/assets/stylys-icon.png";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-styling-chat`;
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

interface ShopifyProduct {
  title: string;
  handle: string;
  product_type: string;
  variants: Array<{ id: number; price: string }>;
  images: Array<{ src: string }>;
}

function parseMessageContent(
  content: string
): Array<{ type: "text"; text: string } | { type: "product"; product: ChatProduct }> {
  const parts: Array<
    { type: "text"; text: string } | { type: "product"; product: ChatProduct }
  > = [];
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

const WidgetChat = () => {
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get("brand_id") || "";
  const shop = searchParams.get("shop") || "";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your personal styling assistant. What are you looking for today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [planError, setPlanError] = useState(false);
  const [products, setProducts] = useState<ChatProduct[]>([]);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shop) return;
    fetch(`https://${shop}/products.json?limit=250`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.products) return;
        setProducts(
          data.products.map((p: ShopifyProduct) => ({
            name: p.title,
            price: parseFloat(p.variants[0]?.price ?? "0"),
            category: p.product_type || undefined,
            handle: p.handle,
            image: p.images[0]?.src || "",
            variantId: p.variants[0]
              ? `gid://shopify/ProductVariant/${p.variants[0].id}`
              : "",
          }))
        );
      })
      .catch(() => {});
  }, [shop]);

  useEffect(() => {
    const timer = setTimeout(
      () => scrollEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
      const history = [...messages, userMessage].filter(
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
          products: products.slice(0, 50),
        }),
      });

      if (resp.status === 403) {
        setPlanError(true);
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to get response");
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
  }, [input, isLoading, messages, products, brandId]);

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

              {isLoading && messages[messages.length - 1]?.role === "user" && (
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
              )}

              <div ref={scrollEndRef} />
            </div>
          </ScrollArea>

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
        </>
      )}
    </div>
  );
};

export default WidgetChat;

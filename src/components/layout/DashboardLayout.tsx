import { ReactNode, useState, useRef, useEffect } from "react";
import stylysIcon from "@/assets/stylys-icon.png";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Settings2, Menu, Settings, BookOpen, HelpCircle, MessageCircle, X, Send, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature } from "@/lib/tiers";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Catalog", href: "/catalog", icon: Package },
  { name: "Rules", href: "/rules", icon: Settings2 },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Docs", href: "/docs", icon: BookOpen },
  { name: "Support", href: "/support", icon: HelpCircle },
];

type ChatMsg = { role: "user" | "assistant"; content: string };

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const location = useLocation();
  const { tierName } = useSubscription();
  const hasChatbot = hasFeature(tierName, "styling_chatbot");

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setChatLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/styling-chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <img src={stylysIcon} alt="STYLYS" className="w-8 h-8 rounded-sm object-cover" />
            <span className="font-display text-lg font-semibold">STYLYS</span>
          </Link>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Brand</p>
            <p className="text-sm font-medium">Demo Store</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={stylysIcon} alt="STYLYS" className="w-7 h-7 rounded-sm object-cover" />
            <span className="font-display text-lg font-semibold">STYLYS</span>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-6 border-b border-border">
                <Link to="/" className="flex items-center gap-2">
                  <img src={stylysIcon} alt="STYLYS" className="w-8 h-8 rounded-sm object-cover" />
                  <span className="font-display text-lg font-semibold">STYLYS</span>
                </Link>
              </div>
              <nav className="p-4">
                <ul className="space-y-1">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                            isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                          )}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:overflow-auto">
        <div className="pt-14 lg:pt-0">
          <header className="border-b border-border bg-background/50 backdrop-blur-sm sticky top-14 lg:top-0 z-40">
            <div className="px-6 lg:px-8 py-6">
              <h1 className="font-display text-2xl lg:text-3xl font-medium">{title}</h1>
              {description && <p className="text-muted-foreground mt-1">{description}</p>}
            </div>
          </header>
          <div className="p-6 lg:p-8">{children}</div>
        </div>
      </main>

      {/* Floating Chatbot Button */}
      {hasChatbot ? (
        <>
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
          )}

          {chatOpen && (
            <div className="fixed bottom-6 right-6 z-50 w-80 h-[28rem] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
                <span className="font-semibold text-sm">AI Styling Assistant</span>
                <button onClick={() => setChatOpen(false)} className="hover:bg-primary-foreground/10 rounded-full p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Ask me anything about styling, outfits, or fashion trends!
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-xs max-w-[85%] ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      {msg.content}
                    </span>
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-left">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-border p-2 flex gap-1.5 shrink-0">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about styling..."
                  className="text-xs h-8"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={chatLoading}
                />
                <Button size="sm" className="h-8 w-8 p-0" onClick={sendMessage} disabled={chatLoading || !input.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : tierName === "starter" ? (
        <>
          {!showUpgradePrompt && (
            <button
              onClick={() => setShowUpgradePrompt(true)}
              className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-muted text-muted-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
          )}
          {showUpgradePrompt && (
            <div className="fixed bottom-6 right-6 z-50 w-72 bg-background border border-border rounded-2xl shadow-2xl p-5">
              <button onClick={() => setShowUpgradePrompt(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <Crown className="h-8 w-8 text-amber-500 mb-3" />
              <h3 className="font-semibold text-sm mb-1">AI Styling Chatbot</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Upgrade to Professional to unlock the AI styling chatbot for your dashboard and your customers' widget.
              </p>
              <Link to="/settings">
                <Button size="sm" className="w-full text-xs">Upgrade to Professional</Button>
              </Link>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

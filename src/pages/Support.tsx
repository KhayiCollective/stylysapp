import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, BookOpen, MessageCircle, Mail, Bot, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature } from "@/lib/tiers";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function Support() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tierName } = useSubscription();
  const hasPrioritySupport = hasFeature(tierName, "priority_support");

  // Live chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let brandId = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("brand_id")
          .eq("id", user.id)
          .maybeSingle();
        brandId = profile?.brand_id;
      }

      const { error } = await supabase.from("support_tickets").insert({
        brand_id: brandId,
        email: email || user?.email,
        subject,
        message,
        priority: hasPrioritySupport ? "priority" : "standard",
      });

      if (error) throw error;

      toast({
        title: "Support request submitted",
        description: hasPrioritySupport
          ? "Priority ticket created. We'll get back to you within 4 hours."
          : "We'll get back to you within 24-48 hours.",
      });

      setSubject("");
      setMessage("");
      if (!user) setEmail("");
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      toast({
        title: "Error",
        description: "Failed to submit support request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() };
    const allMessages = [...chatMessages, userMsg];
    setChatMessages(allMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setChatMessages((prev) => {
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

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
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
      console.error("Support chat error:", err);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again or submit a support ticket." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-medium mb-4">How can we help?</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get support for STYLYS, browse our documentation, or contact our team directly.
          </p>
          {hasPrioritySupport && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <Crown className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Priority Support Active</span>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Link to="/docs">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <BookOpen className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Documentation</CardTitle>
                <CardDescription>Browse guides, tutorials, and API reference</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/docs/faq">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <MessageCircle className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">FAQ</CardTitle>
                <CardDescription>Find answers to common questions</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {hasPrioritySupport ? (
            <Card
              className="h-full hover:border-amber-500/50 transition-colors cursor-pointer border-amber-500/20"
              onClick={() => setChatOpen(true)}
            >
              <CardHeader>
                <Bot className="w-8 h-8 text-amber-600 mb-2" />
                <CardTitle className="text-lg">Live AI Support</CardTitle>
                <CardDescription>
                  Chat with our AI support assistant now
                  <span className="block text-xs text-amber-600 mt-1">Professional Plan</span>
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card className="h-full">
              <CardHeader>
                <Mail className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Email Support</CardTitle>
                <CardDescription>
                  support@stylysapp.com<br />
                  Response within 24-48 hours
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Live Chat Panel */}
        {chatOpen && hasPrioritySupport && (
          <Card className="max-w-2xl mx-auto mb-12 border-amber-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-amber-600" />
                  AI Support Chat
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setChatOpen(false)}>Close</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80 mb-4 border rounded-lg p-4">
                {chatMessages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Hi! I'm your STYLYS support assistant. How can I help you today?
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <span
                      className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.content}
                    </span>
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-left mb-3">
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your question..."
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  disabled={chatLoading}
                />
                <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Contact Support</CardTitle>
            <CardDescription>
              Fill out the form below and we'll get back to you as soon as possible.
              {hasPrioritySupport && (
                <span className="block text-amber-600 mt-1">🎯 Priority tickets — response within 4 hours</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!user && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Please describe your issue or question in detail..."
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Submit {hasPrioritySupport ? "Priority " : ""}Request
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* System Status */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-600 dark:text-green-400">All systems operational</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <span>•</span>
            <Link to="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

export function CodeBlock({ code, language = "javascript", title, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg overflow-hidden border bg-muted/50", className)}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/80">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground uppercase">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm">
          <code className={`language-${language}`}>{code}</code>
        </pre>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

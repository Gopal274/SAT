'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Bot, User, Loader2, Minimize2 } from 'lucide-react';
import { trustChat } from '@/ai/flows/chat-flow';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

type Message = {
  role: 'user' | 'model';
  text: string;
};

export function ChatAssistant() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'model', text: 'Jai Sachidanand! How can I help you with the Trust records today?' }
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!user) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Map current state to Genkit history format
      const history = messages.map(m => ({
        role: m.role,
        content: [{ text: m.text }]
      }));

      const response = await trustChat({
        message: userMessage,
        history: history as any
      });

      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'I encountered an error while fetching the data. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 animate-bounce hover:animate-none"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-6 right-6 w-[350px] sm:w-[400px] shadow-2xl z-50 flex flex-col transition-all duration-300",
      isMinimized ? "h-[60px]" : "h-[500px] max-h-[80vh]"
    )}>
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-primary text-primary-foreground rounded-t-lg">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4" /> Trust AI Assistant
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={() => setIsMinimized(!isMinimized)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      {!isMinimized && (
        <>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex gap-3", m.role === 'user' ? "justify-end" : "justify-start")}>
                    {m.role === 'model' && <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-primary" /></div>}
                    <div className={cn(
                      "rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed",
                      m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}>
                      {m.text}
                    </div>
                    {m.role === 'user' && <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><User className="h-4 w-4 text-primary" /></div>}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Bot className="h-4 w-4 text-primary animate-pulse" /></div>
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
              className="flex w-full gap-2"
            >
              <Input
                placeholder="Ask about rates or pending items..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </>
      )}
    </Card>
  );
}

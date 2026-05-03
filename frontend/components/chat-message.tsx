import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { PDFDocument } from '@/types/graphTypes';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    sources?: PDFDocument[];
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const isLoading = message.role === 'assistant' && message.content === '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const showSources =
    message.role === 'assistant' &&
    message.sources &&
    message.sources.length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div
        className={`max-w-[85%] px-5 py-3 shadow-sm ${
          isUser 
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none' 
            : 'glass rounded-2xl rounded-tl-none'
        }`}
      >
        {isLoading ? (
          <div className="flex space-x-2 h-6 items-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-[loading_1s_ease-in-out_infinite]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-[loading_1s_ease-in-out_0.2s_infinite]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-[loading_1s_ease-in-out_0.4s_infinite]" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-0 ${isUser ? 'prose-p:text-primary-foreground' : 'prose-p:text-foreground/90'}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            
            {!isUser && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/5 mt-3">
                {showSources && message.sources && (
                  <Accordion type="single" collapsible defaultValue="sources" className="flex-1">
                    <AccordionItem value="sources" className="border-b-0">
                      <AccordionTrigger className="text-xs py-1 justify-start gap-1.5 opacity-60 hover:opacity-100 transition-opacity hover:no-underline">
                        Sources ({message.sources.length})
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {message.sources?.map((source, index) => (
                            <Card
                              key={index}
                              className="glass-card transition-all duration-200 hover:bg-white/[0.08] hover:scale-[1.02] cursor-pointer"
                            >
                              <CardContent className="p-2.5">
                                <p className="text-[11px] font-semibold truncate opacity-90">
                                  {source.metadata?.source || source.metadata?.filename || 'N/A'}
                                </p>
                                <p className="text-[10px] opacity-50 mt-0.5">
                                  Page {source.metadata?.loc?.pageNumber || 'N/A'}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-40 hover:opacity-100 transition-opacity"
                  onClick={handleCopy}
                >
                  <Copy className={`h-3.5 w-3.5 ${copied ? 'text-green-500' : ''}`} />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

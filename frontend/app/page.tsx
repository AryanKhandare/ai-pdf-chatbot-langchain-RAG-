'use client';

import type React from 'react';

import { useToast } from '@/hooks/use-toast';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, ArrowUp, Loader2 } from 'lucide-react';
import { ExamplePrompts } from '@/components/example-prompts';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import DarkVeil from '@/components/dark-veil';
import { client } from '@/lib/langgraph-client';
import {
  AgentState,
  documentType,
  PDFDocument,
  RetrieveDocumentsNodeUpdates,
} from '@/types/graphTypes';
import { Card, CardContent } from '@/components/ui/card';
export default function Home() {
  const { toast } = useToast(); // Add this hook
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sources?: PDFDocument[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // Track the AbortController
  const messagesEndRef = useRef<HTMLDivElement>(null); // Add this ref
  const lastRetrievedDocsRef = useRef<PDFDocument[]>([]); // useRef to store the last retrieved documents

  useEffect(() => {
    // Create a thread when the component mounts
    const initThread = () => {
      if (threadId) return;
      setThreadId(crypto.randomUUID());
    };
    initThread();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, sources: undefined }, // Clear sources for new user message
      { role: 'assistant', content: '', sources: undefined }, // Clear sources for new assistant message
    ]);
    setInput('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    lastRetrievedDocsRef.current = []; // Clear the last retrieved documents

    try {
      const currentMessages = [...messages, { role: 'user', content: userMessage }];
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          messages: currentMessages,
          threadId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const sseString = line.slice('data: '.length);
          let sseEvent: any;
          try {
            sseEvent = JSON.parse(sseString);
          } catch (err) {
            console.error('Error parsing SSE line:', err, line);
            continue;
          }

          const { event, data } = sseEvent;

          if (event === 'messages/partial') {
            if (Array.isArray(data)) {
              const lastObj = data[data.length - 1];
              if (lastObj?.type === 'ai') {
                const partialContent = lastObj.content ?? '';

                // Only display if content is a string message
                if (
                  typeof partialContent === 'string' &&
                  !partialContent.startsWith('{')
                ) {
                  setMessages((prev) => {
                    const newArr = [...prev];
                    if (
                      newArr.length > 0 &&
                      newArr[newArr.length - 1].role === 'assistant'
                    ) {
                      newArr[newArr.length - 1].content = partialContent;
                      newArr[newArr.length - 1].sources =
                        lastRetrievedDocsRef.current;
                    }

                    return newArr;
                  });
                }
              }
            }
          } else if (event === 'updates' && data) {
            // Find any node update that contains a 'documents' array
            const nodeUpdate = Object.values(data).find(
              (v: any) => v && typeof v === 'object' && Array.isArray(v.documents)
            ) as any;

            if (nodeUpdate && Array.isArray(nodeUpdate.documents)) {
              const retrievedDocs = nodeUpdate.documents as PDFDocument[];

              // Handle documents here
              lastRetrievedDocsRef.current = retrievedDocs;
              console.log('Retrieved documents:', retrievedDocs);

              // Update the current assistant message with sources immediately
              setMessages((prev) => {
                const newArr = [...prev];
                if (
                  newArr.length > 0 &&
                  newArr[newArr.length - 1].role === 'assistant'
                ) {
                  newArr[newArr.length - 1].sources = retrievedDocs;
                }
                return newArr;
              });
            }
          } else {
            console.log('Unknown SSE event:', event, data);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description:
          'Failed to send message. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
      setMessages((prev) => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content =
          'Sorry, there was an error processing your message.';
        return newArr;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const nonPdfFiles = selectedFiles.filter(
      (file) => file.type !== 'application/pdf',
    );
    if (nonPdfFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF files only',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload files');
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      toast({
        title: 'Success',
        description: `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded successfully`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload failed',
        description:
          'Failed to upload files. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(files.filter((file) => file !== fileToRemove));
    toast({
      title: 'File removed',
      description: `${fileToRemove.name} has been removed`,
      variant: 'default',
    });
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center selection:bg-primary/20">
      {/* Background Animation */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.7] z-[-1]">
        <DarkVeil
          hueShift={280}
          noiseIntensity={0.05}
          scanlineIntensity={0.1}
          speed={0.3}
          scanlineFrequency={1}
          warpAmount={0.3}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 pt-12 pb-32">
        {messages.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-black tracking-tighter bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
                How can I help you <br />with your documents?
              </h2>
              <p className="text-muted-foreground text-sm max-w-[400px] mx-auto leading-relaxed">
                Upload your research papers, reports, or assignments to start an intelligent conversation.
              </p>
            </div>
            
            <div className="w-full max-w-xl mx-auto">
              <ExamplePrompts onPromptSelect={setInput} />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Input Area */}
      <div className="fixed bottom-8 left-0 right-0 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto">
          <div className="glass-card rounded-[2rem] p-2 pr-3 flex flex-col gap-2 shadow-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20">
            {files.length > 0 && (
              <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar border-b border-white/5 pb-3">
                {files.map((file, index) => (
                  <FilePreview
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={() => handleRemoveFile(file)}
                  />
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full h-11 w-11 hover:bg-white/10 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Paperclip className="h-5 w-5 opacity-60" />
              </Button>
              
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isUploading ? 'Uploading and indexing...' : 'Ask anything about your documents...'}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11 bg-transparent text-sm"
                disabled={isUploading || isLoading || !threadId}
              />
              
              <Button
                type="submit"
                size="icon"
                className="rounded-full h-10 w-10 shrink-0 shadow-lg"
                disabled={!input.trim() || isUploading || isLoading || !threadId}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

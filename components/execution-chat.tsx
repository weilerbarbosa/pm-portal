"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SkillDefinition } from "@/lib/skills/registry";

function getTextContent(message: {
  parts: Array<{ type: string; text?: string }>;
}): string {
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

export function ExecutionChat({ skill }: { skill: SkillDefinition }) {
  const [started, setStarted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const input of skill.inputs) {
      if (input.default) defaults[input.name] = input.default;
    }
    return defaults;
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/run",
        body: { skillId: skill.id },
      }),
    [skill.id]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const isLoading = status === "streaming" || status === "submitted";

  function startExecution() {
    const parts = skill.inputs
      .map((i) => {
        const val = inputs[i.name];
        if (!val && i.required) return null;
        if (!val) return null;
        return `${i.label}: ${val}`;
      })
      .filter(Boolean);

    const missing = skill.inputs.filter(
      (i) => i.required && !inputs[i.name]
    );
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    const userMessage =
      parts.length > 0 ? parts.join("\n") : `Run ${skill.name}`;

    setStarted(true);
    sendMessage({ text: userMessage });
  }

  function handleSend() {
    if (!inputText.trim() || isLoading) return;
    sendMessage({ text: inputText });
    setInputText("");
  }

  if (!started) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          {skill.inputs.map((inp) => (
            <div key={inp.name} className="space-y-2">
              <label className="text-sm font-medium">
                {inp.label}
                {inp.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              {inp.type === "select" && inp.options ? (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={inputs[inp.name] || ""}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [inp.name]: e.target.value,
                    }))
                  }
                >
                  <option value="">Select...</option>
                  {inp.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : inp.name === "document" ? (
                <Textarea
                  placeholder={inp.placeholder}
                  rows={8}
                  value={inputs[inp.name] || ""}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [inp.name]: e.target.value,
                    }))
                  }
                />
              ) : (
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={inp.placeholder}
                  value={inputs[inp.name] || ""}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [inp.name]: e.target.value,
                    }))
                  }
                />
              )}
            </div>
          ))}
        </div>
        <Button onClick={startExecution} size="lg" className="cursor-pointer">
          Run {skill.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-3xl mx-auto w-full">
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.map((message) => {
            const text = getTextContent(
              message as unknown as {
                parts: Array<{ type: string; text?: string }>;
              }
            );
            if (!text) return null;
            return (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-900"
                  }`}
                >
                  {text}
                </div>
              </div>
            );
          })}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 rounded-lg px-4 py-3 text-sm text-zinc-500">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
        </div>
      </ScrollArea>

      <div className="flex gap-2 pt-4 border-t">
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 min-h-[2.5rem] max-h-32 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !inputText.trim()}
          className="cursor-pointer self-end"
        >
          Send
        </Button>
      </div>
    </div>
  );
}

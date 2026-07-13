"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, Paperclip, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { addTicketMessage, refreshTickets } from "@/lib/support-store";
import { apiEnabled } from "@/lib/api";
import { ticketSocket } from "@/lib/api/ws";
import { cn, formatDateTime } from "@/lib/utils";
import type { SupportTicket } from "@/types";

export interface TicketThreadProps {
  ticket: SupportTicket;
  side: "merchant" | "admin"; // whose view this is — their messages align right
  senderName: string;
}

// Message thread + reply composer, shared by the merchant and admin ticket
// detail pages. Messages from `side` align right; the other party aligns left.
export default function TicketThread({ ticket, side, senderName }: TicketThreadProps) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live updates: subscribe to this ticket's WebSocket; on any push, refetch
  // the thread so new messages appear without a manual refresh.
  useEffect(() => {
    if (!apiEnabled()) return;
    const sock = ticketSocket(ticket.id);
    if (!sock) return;
    sock.onmessage = () => refreshTickets();
    return () => sock.close();
  }, [ticket.id]);

  const pickFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment(reader.result as string);
    reader.readAsDataURL(file);
  };

  const send = async () => {
    if (!body.trim() && !attachment) {
      toast.error("Write a message first");
      return;
    }
    try {
      await addTicketMessage(ticket.id, side, senderName, body.trim(), attachment ?? undefined);
      setBody("");
      setAttachment(null);
    } catch {
      toast.error("Could not send your message. Please try again.");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-4 p-1">
        {ticket.messages.map((m) => {
          const mine = m.sender === side;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%]", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-white"
                      : "rounded-bl-sm bg-brown-100 text-brown-800",
                  )}
                >
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  {m.attachment && (
                    <Image
                      src={m.attachment}
                      alt="Attachment"
                      width={220}
                      height={160}
                      unoptimized
                      className={cn(
                        "mt-2 h-auto w-auto max-w-full rounded-lg",
                        m.body ? "" : "mt-0",
                      )}
                    />
                  )}
                </div>
                <p
                  className={cn(
                    "mt-1 px-1 text-[11px] text-brown-500",
                    mine ? "text-right" : "text-left",
                  )}
                >
                  {m.senderName} · {formatDateTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="mt-4 border-t border-brown-100 pt-3">
        {attachment && (
          <div className="relative mb-2 inline-block">
            <Image
              src={attachment}
              alt="Attachment"
              width={110}
              height={80}
              unoptimized
              className="h-16 w-auto rounded-lg border border-brown-100 object-cover"
            />
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mb-0.5 rounded-lg p-2 text-brown-500 hover:bg-brown-100 hover:text-primary"
            aria-label="Attach image"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <Textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your reply…"
            className="min-h-[40px] flex-1 resize-none"
          />
          <Button onClick={send} className="mb-0.5">
            <Send className="h-4 w-4" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}

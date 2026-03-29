"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface Message {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  categoryLabel: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface MessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  async function loadMessages(p = 1) {
    setIsLoading(true);
    const { data } = await adminFetch<MessagesResponse>(`/contact/messages?page=${p}&limit=20`);
    if (data) {
      setMessages(data.messages);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadMessages();
  }, []);

  async function markAsRead(msg: Message) {
    setSelected(msg);
    if (!msg.isRead) {
      await adminFetch(`/contact/messages/${msg.id}/read`, { method: "PUT" });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/contact/messages/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setSelected(null);
    loadMessages(page);
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Messages ({total})</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-blanc rounded-xl shadow-card p-4">
          {messages.length === 0 ? (
            <p className="text-gris py-8 text-center">Aucun message</p>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => markAsRead(msg)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selected?.id === msg.id
                      ? "border-malachite bg-malachite/5"
                      : msg.isRead
                        ? "border-gris/20 bg-blanc hover:bg-blanc-casse"
                        : "border-gris/20 bg-blanc hover:bg-blanc-casse"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${msg.isRead ? "text-gris" : "text-noir font-bold"}`}>
                      {msg.firstName} {msg.lastName}
                    </span>
                    <span className="text-xs text-gris">{new Date(msg.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <p className="text-xs text-gris mt-1 truncate">{msg.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {!msg.isRead && <StatusBadge status="Non lu" variant="orange" />}
                    {msg.categoryLabel && <StatusBadge status={msg.categoryLabel} variant="blue" />}
                  </div>
                </button>
              ))}

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => loadMessages(p)} className={`px-3 py-1 rounded text-sm ${p === page ? "bg-malachite text-blanc" : "bg-blanc text-gris hover:bg-blanc-casse"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <div className="bg-blanc rounded-xl shadow-card p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-noir">{selected.firstName} {selected.lastName}</h3>
                <button onClick={() => setDeleteTarget(selected)} className="text-terre-cuite hover:underline text-sm">Supprimer</button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-gris">Email:</span> <a href={`mailto:${selected.email}`} className="text-bleu hover:underline">{selected.email}</a></p>
                {selected.phone && <p><span className="text-gris">Tel:</span> {selected.phone}</p>}
                {selected.categoryLabel && <p><span className="text-gris">Categorie:</span> {selected.categoryLabel}</p>}
                <p className="text-gris text-xs">{new Date(selected.createdAt).toLocaleString("fr-FR")}</p>
              </div>
              <div className="mt-4 p-4 bg-blanc-casse rounded-lg">
                <p className="text-sm text-noir whitespace-pre-wrap">{selected.message}</p>
              </div>
            </div>
          ) : (
            <div className="bg-blanc rounded-xl shadow-card p-6 text-center text-gris">
              Selectionnez un message
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="Supprimer le message" message="Supprimer ce message ?" confirmLabel="Supprimer" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

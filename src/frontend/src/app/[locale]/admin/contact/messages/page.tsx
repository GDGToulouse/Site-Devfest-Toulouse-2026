"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import ContactCategories from "@/components/admin/ContactCategories";

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
  const [activeTab, setActiveTab] = useState<"messages" | "categories">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  // Filters
  const [filterEmail, setFilterEmail] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Forward
  const [showForward, setShowForward] = useState(false);
  const [forwardEmails, setForwardEmails] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSuccess, setForwardSuccess] = useState(false);

  async function loadMessages(p = 1) {
    setIsLoading(true);
    const { data } = await adminFetch<MessagesResponse>(`/contact/messages?page=${p}&limit=50`);
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
    setShowForward(false);
    setForwardSuccess(false);
    if (!msg.isRead) {
      await adminFetch(`/contact/messages/${msg.id}/read`, { method: "PUT" });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/contact/messages/${deleteTarget.id}`, { method: "DELETE" });
    if (selected?.id === deleteTarget.id) setSelected(null);
    setDeleteTarget(null);
    loadMessages(page);
  }

  async function handleForward() {
    if (!selected || !forwardEmails.trim()) return;
    setIsForwarding(true);
    const { status } = await adminFetch(`/contact/messages/${selected.id}/forward`, {
      method: "POST",
      body: JSON.stringify({ emails: forwardEmails }),
    });
    setIsForwarding(false);
    if (status === 200) {
      setForwardSuccess(true);
      setForwardEmails("");
      setShowForward(false);
    }
  }

  // Client-side filtering
  const filtered = messages.filter((msg) => {
    if (filterEmail && !msg.email.toLowerCase().includes(filterEmail.toLowerCase())) return false;
    if (filterCategory && msg.categoryLabel !== filterCategory) return false;
    if (filterDate && !msg.createdAt.startsWith(filterDate)) return false;
    return true;
  });

  const categories = [...new Set(messages.map((m) => m.categoryLabel).filter(Boolean))] as string[];

  if (isLoading && activeTab === "messages") return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-noir">Contact</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gris/20 mb-6">
        <button
          onClick={() => setActiveTab("messages")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeTab === "messages"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Messages ({total})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeTab === "categories"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Categories
        </button>
      </div>

      {activeTab === "categories" && <ContactCategories />}

      {activeTab === "messages" && <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          title="Filtrer par date"
        />
        <input
          type="text"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          placeholder="Filtrer par email..."
          className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 w-48"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
        >
          <option value="">Toutes categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {(filterEmail || filterCategory || filterDate) && (
          <button
            onClick={() => { setFilterEmail(""); setFilterCategory(""); setFilterDate(""); }}
            className="text-sm text-gris hover:text-noir"
          >
            Effacer filtres
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message list — 1 col */}
        <div className="bg-blanc rounded-xl shadow-card p-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {filtered.length === 0 ? (
            <p className="text-gris py-8 text-center">Aucun message</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    selected?.id === msg.id
                      ? "bg-malachite/5 border border-malachite"
                      : "hover:bg-blanc-casse border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => markAsRead(msg)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${msg.isRead ? "text-gris" : "text-noir font-bold"}`}>
                        {msg.firstName} {msg.lastName}
                      </span>
                      <span className="text-xs text-gris shrink-0">
                        {new Date(msg.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-xs text-gris mt-0.5 truncate">{msg.email}</p>
                    <p className="text-xs text-gris/70 mt-1 truncate">
                      {msg.message.substring(0, 50)}{msg.message.length > 50 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {!msg.isRead && <StatusBadge status="Non lu" variant="orange" />}
                      {msg.categoryLabel && <StatusBadge status={msg.categoryLabel} variant="blue" />}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(msg); }}
                    className="text-gris/40 hover:text-terre-cuite shrink-0 p-1"
                    title="Supprimer"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pt-3 border-t border-gris/20">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => loadMessages(p)} className={`px-3 py-1 rounded text-sm ${p === page ? "bg-malachite text-blanc" : "bg-blanc text-gris hover:bg-blanc-casse"}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message detail — 2 cols */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-blanc rounded-xl shadow-card p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-noir">{selected.firstName} {selected.lastName}</h3>
                <div className="flex gap-3">
                  <button onClick={() => setShowForward(!showForward)} className="text-sm text-bleu hover:underline">
                    Transferer
                  </button>
                  <button onClick={() => setDeleteTarget(selected)} className="text-sm text-terre-cuite hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <p><span className="text-gris">Email :</span> <a href={`mailto:${selected.email}`} className="text-bleu hover:underline">{selected.email}</a></p>
                {selected.phone && <p><span className="text-gris">Telephone :</span> {selected.phone}</p>}
                {selected.categoryLabel && <p><span className="text-gris">Categorie :</span> <StatusBadge status={selected.categoryLabel} variant="blue" /></p>}
                <p><span className="text-gris">Date :</span> {new Date(selected.createdAt).toLocaleString("fr-FR")}</p>
              </div>

              {showForward && (
                <div className="mb-4 p-4 bg-blanc-casse rounded-lg">
                  <p className="text-sm font-medium text-noir mb-2">Transferer a :</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={forwardEmails}
                      onChange={(e) => setForwardEmails(e.target.value)}
                      placeholder="email1@example.com, email2@example.com"
                      className="flex-1 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                    />
                    <button
                      onClick={handleForward}
                      disabled={isForwarding || !forwardEmails.trim()}
                      className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
                    >
                      {isForwarding ? "Envoi..." : "Envoyer"}
                    </button>
                  </div>
                </div>
              )}

              {forwardSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-malachite/10 text-malachite text-sm">
                  Message transfere avec succes.
                </div>
              )}

              <div className="p-4 bg-blanc-casse rounded-lg">
                <p className="text-sm text-noir whitespace-pre-wrap leading-relaxed">{selected.message}</p>
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
      </>}
    </div>
  );
}

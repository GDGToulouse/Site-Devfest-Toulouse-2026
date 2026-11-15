"use client";

import { useState, useEffect } from "react";
import { adminFetch, getAdminSession } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";
import ListPagination from "@/components/admin/ListPagination";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import ContactCategories from "@/components/admin/ContactCategories";
import { useListParams } from "@/lib/use-list-params";

type WebhookStatus = "not_attempted" | "success" | "failed" | "skipped";

interface Message {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string;
  jobTitle: string;
  categorySlug: string | null;
  categoryLabel: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  brochureDownloadCount: number;
  brochureDownloadedAt: string | null;
  webhookStatus: WebhookStatus;
  webhookAttemptedAt: string | null;
  webhookError: string | null;
  quarantinedAt: string | null;
  releasedAt: string | null;
  spamScore: number;
  spamReasons: string[];
}

interface MessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
  quarantineCount: number;
}

const PAGE_SIZE = 50;

// What each code of lib/contact-spam.ts means, for whoever decides to release
// or bin a held message (#767).
function reasonLabel(reason: string): string {
  if (reason.startsWith("risky_tld:")) return `Domaine en ${reason.slice("risky_tld:".length)}`;
  const labels: Record<string, string> = {
    link_in_identity: "Lien dans le nom, la société ou le poste",
    external_link: "Lien vers un site extérieur",
    disposable_email: "Adresse e-mail jetable",
    site_pitch: "Reprend la description du DevFest",
  };
  return labels[reason] ?? reason;
}

export default function ContactMessagesPage() {
  const [activeTab, setActiveTab] = useState<"messages" | "categories">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quarantineCount, setQuarantineCount] = useState(0);
  // In the URL so the quarantine alert can link straight to the held messages.
  const { params, update } = useListParams(["filtre"] as const);
  const isQuarantine = params.filtre === "quarantaine";
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession().then((session) => {
      if (session?.role === "ADMIN") setIsAdmin(true);
    });
  }, []);

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
    const filter = isQuarantine ? "&filter=quarantine" : "";
    const { data } = await adminFetch<MessagesResponse>(`/contact/messages?page=${p}&limit=${PAGE_SIZE}${filter}`);
    if (data) {
      setMessages(data.messages);
      setPage(data.page);
      setTotal(data.total);
      setQuarantineCount(data.quarantineCount);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    setSelected(null);
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the view changes, nothing else
  }, [isQuarantine]);

  async function markAsRead(msg: Message) {
    setSelected(msg);
    setShowForward(false);
    setForwardSuccess(false);
    setWebhookRetryFeedback(null);
    setReleaseError(null);
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
    // The last message of a page gone: step back rather than show an empty page.
    loadMessages(messages.length === 1 && page > 1 ? page - 1 : page);
  }

  // Sends the team mail, the confirmation and the webhook, as on submission.
  // A failure stays on screen: a fading error would read as a release.
  async function handleRelease() {
    if (!selected) return;
    setIsReleasing(true);
    setReleaseError(null);
    const { status } = await adminFetch(`/contact/messages/${selected.id}/release`, { method: "POST" });
    setIsReleasing(false);
    if (status !== 200) {
      setReleaseError(
        status === 409
          ? "Ce message a déjà été libéré. Rechargez la page."
          : "La libération a échoué. Réessayez dans un instant.",
      );
      return;
    }
    setSelected(null);
    loadMessages(messages.length === 1 && page > 1 ? page - 1 : page);
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

  const [isRetryingWebhook, setIsRetryingWebhook] = useState(false);
  const [webhookRetryFeedback, setWebhookRetryFeedback] = useState<string | null>(null);

  async function handleRetryWebhook() {
    if (!selected) return;
    setIsRetryingWebhook(true);
    setWebhookRetryFeedback(null);
    const { data, status } = await adminFetch<{ status: WebhookStatus; error: string | null; httpStatus?: number }>(
      `/contact/messages/${selected.id}/retry-webhook`,
      { method: "POST" },
    );
    if (status !== 200 || !data) {
      setWebhookRetryFeedback("Erreur réseau lors de la relance.");
    } else if (data.status === "success") {
      setWebhookRetryFeedback("Webhook relancé avec succès.");
    } else {
      setWebhookRetryFeedback(`Échec : ${data.error ?? "raison inconnue"}`);
    }
    setIsRetryingWebhook(false);
    // Refresh the list to update the badge.
    await loadMessages(page);
    // Re-pick the selected message from the refreshed list.
    setSelected((prev) => (prev ? { ...prev, ...data } as Message : prev));
  }

  // Client-side filtering
  const filtered = messages.filter((msg) => {
    if (filterEmail && !msg.email.toLowerCase().includes(filterEmail.toLowerCase())) return false;
    if (filterCategory && msg.categoryLabel !== filterCategory) return false;
    if (filterDate && !msg.createdAt.startsWith(filterDate)) return false;
    return true;
  });

  const categories = [...new Set(messages.map((m) => m.categoryLabel).filter(Boolean))] as string[];

  if (isLoading && activeTab === "messages") return <p className="text-gris">Chargement…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-noir">Contact</h1>
      </div>

      {/* Tabs — see #233: confine overflow so the bar scrolls, not the page. */}
      <div className="flex gap-1 border-b border-gris/20 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          Catégories
        </button>
      </div>

      {activeTab === "categories" && <ContactCategories />}

      {activeTab === "messages" && <>
      {/* Held messages (#767) apart from the inbox: nothing of theirs has left. */}
      <div className="flex gap-2 mb-4" role="group" aria-label="Boîte affichée">
        <button
          type="button"
          onClick={() => update({ filtre: "" })}
          aria-pressed={!isQuarantine}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
            !isQuarantine ? "bg-noir text-blanc border-noir" : "border-gris/30 text-gris hover:text-noir"
          }`}
        >
          Reçus
        </button>
        <button
          type="button"
          onClick={() => update({ filtre: "quarantaine" })}
          aria-pressed={isQuarantine}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
            isQuarantine ? "bg-terre-cuite text-blanc border-terre-cuite" : "border-gris/30 text-gris hover:text-noir"
          }`}
        >
          Quarantaine ({quarantineCount})
        </button>
      </div>
      {isQuarantine && (
        <p className="mb-4 text-sm text-gris">
          Messages jugés suspects (liens douteux, adresse jetable…). Rien n&apos;est parti : ni e-mail à l&apos;équipe, ni
          confirmation, ni webhook. Libérez un message légitime, mettez les autres à la corbeille.
        </p>
      )}

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
          <option value="">Toutes catégories</option>
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
                      {msg.quarantinedAt && <StatusBadge status="Suspect" variant="red" />}
                      {!msg.isRead && <StatusBadge status="Non lu" variant="orange" />}
                      {msg.categoryLabel && <StatusBadge status={msg.categoryLabel} variant="blue" />}
                    </div>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(msg); }}
                      className="text-gris/40 hover:text-terre-cuite shrink-0 p-1"
                      title="Supprimer"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* "51–100 sur 327" rather than one button per page (#416). */}
          <ListPagination page={page} limit={PAGE_SIZE} total={total} onPageChange={(next) => loadMessages(next)} />
        </div>

        {/* Message detail — 2 cols */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-blanc rounded-xl shadow-card p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-noir">{selected.firstName} {selected.lastName}</h3>
                {selected.quarantinedAt ? (
                  isAdmin && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleRelease}
                        disabled={isReleasing}
                        className="text-sm px-3 py-1.5 rounded border border-malachite text-malachite hover:bg-malachite/10 disabled:opacity-50"
                      >
                        {isReleasing ? "Libération…" : "Libérer"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(selected)}
                        className="text-sm px-3 py-1.5 rounded border border-terre-cuite text-terre-cuite hover:bg-terre-cuite/10"
                      >
                        Confirmer spam
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setShowForward(!showForward)} className="text-sm text-bleu hover:underline">
                      Transférer
                    </button>
                    {isAdmin && (
                      <button onClick={() => setDeleteTarget(selected)} className="text-sm text-terre-cuite hover:underline">
                        Supprimer
                      </button>
                    )}
                  </div>
                )}
              </div>

              {selected.quarantinedAt && (
                <div className="mb-4 p-4 rounded-lg bg-terre-cuite/10 text-sm">
                  <p className="font-medium text-noir">Message suspect · score {selected.spamScore}</p>
                  <ul className="mt-1 list-disc pl-5 text-noir">
                    {selected.spamReasons.map((reason) => (
                      <li key={reason}>{reasonLabel(reason)}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-gris">
                    Libérer envoie l&apos;e-mail à l&apos;équipe, la confirmation à l&apos;expéditeur et le webhook, comme pour un
                    message normal.
                    {!isAdmin && " Seul un administrateur peut libérer ou supprimer ce message."}
                  </p>
                  {releaseError && (
                    <p role="alert" className="mt-2 font-medium text-rouge">{releaseError}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                {/* A held message's address stays plain text: no click on a phisher's address. */}
                <p>
                  <span className="text-gris">Email :</span>{" "}
                  {selected.quarantinedAt ? (
                    <span className="text-noir">{selected.email}</span>
                  ) : (
                    <a href={`mailto:${selected.email}`} className="text-bleu hover:underline">{selected.email}</a>
                  )}
                </p>
                {selected.phone && <p><span className="text-gris">Téléphone :</span> {selected.phone}</p>}
                {selected.company && <p><span className="text-gris">Entreprise :</span> {selected.company}</p>}
                {selected.jobTitle && <p><span className="text-gris">Poste :</span> {selected.jobTitle}</p>}
                {selected.categoryLabel && <p><span className="text-gris">Catégorie :</span> <StatusBadge status={selected.categoryLabel} variant="blue" /></p>}
                <p><span className="text-gris">Date :</span> {new Date(selected.createdAt).toLocaleString("fr-FR")}</p>
                {selected.categorySlug === "sponsor-brochure" && (
                  <p>
                    <span className="text-gris">Plaquette :</span>{" "}
                    {selected.brochureDownloadCount > 0 ? (
                      <span className="text-noir">
                        {selected.brochureDownloadCount} téléchargement{selected.brochureDownloadCount > 1 ? "s" : ""}
                        {selected.brochureDownloadedAt && (
                          <span className="text-gris"> · dernier le {new Date(selected.brochureDownloadedAt).toLocaleDateString("fr-FR")}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gris">Pas encore téléchargée</span>
                    )}
                  </p>
                )}
                {!selected.quarantinedAt && <>
                <p className="sm:col-span-2">
                  <span className="text-gris">Webhook :</span>{" "}
                  {selected.webhookStatus === "success" && (
                    <span className="text-malachite font-medium">
                      Envoyé avec succès
                      {selected.webhookAttemptedAt && (
                        <span className="text-gris font-normal"> · le {new Date(selected.webhookAttemptedAt).toLocaleString("fr-FR")}</span>
                      )}
                    </span>
                  )}
                  {selected.webhookStatus === "failed" && (
                    <>
                      <span className="text-rouge font-medium">
                        Échec
                        {selected.webhookAttemptedAt && (
                          <span className="text-gris font-normal"> · le {new Date(selected.webhookAttemptedAt).toLocaleString("fr-FR")}</span>
                        )}
                      </span>
                      {selected.webhookError && (
                        <span className="block text-xs text-gris mt-0.5">{selected.webhookError}</span>
                      )}
                    </>
                  )}
                  {selected.webhookStatus === "skipped" && (
                    <>
                      <span className="text-gris font-medium">Ignoré</span>
                      {selected.webhookError && (
                        <span className="block text-xs text-gris mt-0.5">{selected.webhookError}</span>
                      )}
                    </>
                  )}
                  {selected.webhookStatus === "not_attempted" && (
                    <span className="text-gris">Pas encore tenté</span>
                  )}
                </p>
                {(selected.webhookStatus === "failed" || selected.webhookStatus === "skipped" || selected.webhookStatus === "not_attempted") && (
                  <p className="sm:col-span-2 -mt-2">
                    <button
                      type="button"
                      onClick={handleRetryWebhook}
                      disabled={isRetryingWebhook}
                      className="text-sm px-3 py-1.5 rounded border border-bleu text-bleu hover:bg-bleu/10 disabled:opacity-50"
                    >
                      {isRetryingWebhook ? "Relance en cours…" : "Relancer le webhook"}
                    </button>
                    {webhookRetryFeedback && (
                      <span className={`ml-3 text-xs ${webhookRetryFeedback.startsWith("Échec") || webhookRetryFeedback.startsWith("Erreur") ? "text-rouge" : "text-malachite"}`}>
                        {webhookRetryFeedback}
                      </span>
                    )}
                  </p>
                )}
                </>}
              </div>

              {showForward && !selected.quarantinedAt && (
                <div className="mb-4 p-4 bg-blanc-casse rounded-lg">
                  <p className="text-sm font-medium text-noir mb-2">Transférer à :</p>
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
                      {isForwarding ? "Envoi…" : "Envoyer"}
                    </button>
                  </div>
                </div>
              )}

              {forwardSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-malachite/10 text-malachite text-sm">
                  Message transféré avec succès.
                </div>
              )}

              <div className="p-4 bg-blanc-casse rounded-lg">
                <p className="text-sm text-noir whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>
            </div>
          ) : (
            <div className="bg-blanc rounded-xl shadow-card p-6 text-center text-gris">
              Sélectionnez un message
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.quarantinedAt ? "Confirmer le spam" : "Supprimer le message"}
        message={
          deleteTarget?.quarantinedAt
            ? "Le message part à la corbeille sans rien envoyer, et sera effacé au bout de 30 jours."
            : "Supprimer ce message ?"
        }
        confirmLabel={deleteTarget?.quarantinedAt ? "Mettre à la corbeille" : "Supprimer"}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      </>}
    </div>
  );
}

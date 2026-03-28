"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { localizedField } from "@/lib/i18n-helpers";
import type { ContactCategory } from "@/lib/types";

interface ContactFormProps {
  categories: ContactCategory[];
  locale: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function ContactForm({ categories, locale }: ContactFormProps) {
  const t = useTranslations("contact.form");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    categoryId: "",
    message: "",
    website: "", // honeypot
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = t("firstNameError");
    if (!formData.lastName.trim()) errs.lastName = t("lastNameError");
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = t("emailError");
    if (categories.length > 0 && !formData.categoryId) errs.categoryId = t("categoryError");
    if (!formData.message.trim() || formData.message.trim().length < 10)
      errs.message = t("messageError");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
          message: formData.message,
          website: formData.website, // honeypot
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.errors) setErrors(data.errors);
        setStatus("error");
        return;
      }

      setStatus("success");
      setFormData({ firstName: "", lastName: "", email: "", phone: "", categoryId: "", message: "", website: "" });
      setErrors({});
    } catch {
      setStatus("error");
    }
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Honeypot — hidden from users */}
      <div aria-hidden="true" className="absolute -left-[9999px] opacity-0">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={formData.website}
          onChange={(e) => handleChange("website", e.target.value)}
        />
      </div>

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-bold text-noir mb-1">
            {t("firstName")} *
          </label>
          <input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            placeholder={t("firstNamePlaceholder")}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            className={`w-full px-4 py-3 rounded-m border ${errors.firstName ? "border-rouge" : "border-gris-clair"} text-noir focus:outline-none focus:ring-2 focus:ring-bleu`}
          />
          {errors.firstName && (
            <p id="firstName-error" className="mt-1 text-sm text-rouge">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-bold text-noir mb-1">
            {t("lastName")} *
          </label>
          <input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            placeholder={t("lastNamePlaceholder")}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            className={`w-full px-4 py-3 rounded-m border ${errors.lastName ? "border-rouge" : "border-gris-clair"} text-noir focus:outline-none focus:ring-2 focus:ring-bleu`}
          />
          {errors.lastName && (
            <p id="lastName-error" className="mt-1 text-sm text-rouge">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-bold text-noir mb-1">
          {t("email")} *
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={`w-full px-4 py-3 rounded-m border ${errors.email ? "border-rouge" : "border-gris-clair"} text-noir focus:outline-none focus:ring-2 focus:ring-bleu`}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-rouge">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-bold text-noir mb-1">
          {t("phone")}
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder={t("phonePlaceholder")}
          className="w-full px-4 py-3 rounded-m border border-gris-clair text-noir focus:outline-none focus:ring-2 focus:ring-bleu"
        />
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <label htmlFor="categoryId" className="block text-sm font-bold text-noir mb-1">
            {t("category")} *
          </label>
          <select
            id="categoryId"
            value={formData.categoryId}
            onChange={(e) => handleChange("categoryId", e.target.value)}
            aria-invalid={!!errors.categoryId}
            aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
            className={`w-full px-4 py-3 rounded-m border ${errors.categoryId ? "border-rouge" : "border-gris-clair"} text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-bleu`}
          >
            <option value="">{t("categoryPlaceholder")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {localizedField(cat, "name", locale)}
              </option>
            ))}
            <option value="other">{t("categoryOther")}</option>
          </select>
          {errors.categoryId && (
            <p id="categoryId-error" className="mt-1 text-sm text-rouge">{errors.categoryId}</p>
          )}
        </div>
      )}

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-bold text-noir mb-1">
          {t("message")} *
        </label>
        <textarea
          id="message"
          rows={8}
          value={formData.message}
          onChange={(e) => handleChange("message", e.target.value)}
          placeholder={t("messagePlaceholder")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          className={`w-full px-4 py-3 rounded-m border ${errors.message ? "border-rouge" : "border-gris-clair"} text-noir focus:outline-none focus:ring-2 focus:ring-bleu resize-vertical`}
        />
        {errors.message && (
          <p id="message-error" className="mt-1 text-sm text-rouge">{errors.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "sending"}
        className="px-8 py-3 rounded-l bg-bleu text-blanc font-bold text-lg hover:bg-bleu/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? t("sending") : t("submit")}
      </button>

      {/* Status messages */}
      {status === "success" && (
        <p role="alert" className="mt-4 p-4 rounded-m bg-malachite/10 text-malachite font-bold">
          {t("success")}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="mt-4 p-4 rounded-m bg-rouge/10 text-rouge font-bold">
          {t("error")}
        </p>
      )}
    </form>
  );
}

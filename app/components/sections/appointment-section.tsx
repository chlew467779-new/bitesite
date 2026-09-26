/* bitesite/app/components/sections/appointment-section.tsx */

"use client";

import { useId, useRef, useState } from "react";
import { FadeIn } from "@/app/components/animations";
import {
  Calendar, Clock, Users, MessageSquare, Phone, User, Send,
} from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import type { LayoutVariant } from "./gallery-section";
import { getLayoutTheme } from "@/lib/layout-theme.mjs";
import { getBookingUrl, normalizeBookingWhatsApp } from "@/lib/merchant-booking-target.mjs";
import { getMytToday } from "@/lib/myt-date";

interface AppointmentSectionProps {
  merchantName: string;
  /** The restaurant's own WhatsApp number. Without a valid one the section renders nothing. */
  whatsapp?: string | null;
  title?: string;
  variant?: LayoutVariant;
  id?: string;
  slug?: string;
}

type BookingField = "name" | "phone" | "date" | "time" | "guests" | "notes";
type FieldErrors = Partial<Record<BookingField, string>>;

const REQUIRED_ORDER: BookingField[] = ["name", "phone", "date", "time"];

const inputBase = "w-full px-4 py-3 rounded-xl border outline-none transition-all duration-200 text-base";
export function AppointmentSection({
  merchantName,
  whatsapp,
  title = "Book a Table",
  variant = "classic",
  id,
  slug,
}: AppointmentSectionProps) {
  const theme = getLayoutTheme(variant).appointment;
  const inputStyles = `${inputBase} ${theme.input}`;
  const uid = useId();
  const fieldId = (field: BookingField) => `${uid}-${field}`;
  const errorId = (field: BookingField) => `${uid}-${field}-error`;
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState<Record<BookingField, string>>({
    name: "",
    phone: "",
    date: "",
    time: "",
    guests: "2",
    notes: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  // The prefilled WhatsApp link for the last valid submission. Kept so the visitor can open it by
  // hand if the browser blocked the new tab.
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);

  // Only the restaurant's own valid WhatsApp number. No phone or platform fallback.
  if (!normalizeBookingWhatsApp(whatsapp)) return null;

  // Malaysia local date, so the earliest bookable day does not shift around UTC midnight.
  const today = getMytToday();

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!formData.name.trim()) next.name = "Enter your name.";
    if (!formData.phone.trim()) next.phone = "Enter a phone number the restaurant can reach you on.";
    if (!formData.date) next.date = "Choose a date.";
    else if (formData.date < today) next.date = "Choose today or a later date.";
    if (!formData.time) next.time = "Choose a time.";
    return next;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    const firstInvalid = REQUIRED_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      const target = formRef.current?.elements.namedItem(firstInvalid);
      if (target instanceof HTMLElement) target.focus();
      return;
    }

    const message = [
      `*New Reservation Request via BiteSite*`,
      ``,
      `*Restaurant:* ${merchantName}`,
      `*Name:* ${formData.name}`,
      `*Phone:* ${formData.phone}`,
      `*Date:* ${formData.date}`,
      `*Time:* ${formData.time}`,
      `*Guests:* ${formData.guests}`,
      formData.notes ? `*Notes:* ${formData.notes}` : "",
    ].filter(Boolean).join("\n");

    // Re-check the destination at the moment of sending rather than trusting the render.
    const url = getBookingUrl(whatsapp, message);
    if (!url) return;

    // Opened synchronously inside the click, so the browser still treats it as user-initiated.
    window.open(url, "_blank", "noopener,noreferrer");
    setBookingUrl(url);

    // Only that the WhatsApp hand-off was opened; no name, phone or notes are recorded.
    trackEvent('booking_submit', {
      pageType: 'merchant',
      slug,
      detail: merchantName,
    });
  };

  const updateField = (field: BookingField, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const fieldA11y = (field: BookingField) => ({
    id: fieldId(field),
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });

  const fieldError = (field: BookingField) =>
    errors[field] ? (
      <p id={errorId(field)} className="mt-1.5 text-sm text-red-600">{errors[field]}</p>
    ) : null;

  const labelClass = `block text-sm font-medium mb-1.5 ${theme.text}`;

  if (bookingUrl) {
    return (
      <FadeIn>
        <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${theme.sectionBg}`}>
          <div className="max-w-md mx-auto">
            <div className={`p-8 rounded-2xl border text-center ${theme.card}`} role="status">
              <Send size={44} className={`mx-auto mb-4 ${theme.successIcon}`} aria-hidden="true" />
              <h3 className={`text-2xl font-bold mb-3 ${theme.text}`}>Continue in WhatsApp</h3>
              <p className={`opacity-70 leading-relaxed mb-6 ${theme.text}`}>
                Please send the message in WhatsApp. Your booking is not confirmed until{" "}
                {merchantName} replies.
              </p>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-all active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Open WhatsApp
              </a>
              <p className={`mt-4 text-sm opacity-60 ${theme.text}`}>
                If WhatsApp did not open, use the button above.
              </p>
              <button
                type="button"
                onClick={() => setBookingUrl(null)}
                className={`mt-4 text-sm underline underline-offset-2 ${theme.text}`}
              >
                Edit booking details
              </button>
            </div>
          </div>
        </section>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${theme.sectionBg}`}>
        <div className="max-w-2xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-3 ${theme.text}`}>{title}</h2>
          <p className={`text-center mb-10 opacity-60 ${theme.text}`}>
            Fill in your details and send the request to the restaurant in WhatsApp
          </p>
          <div className={`p-6 sm:p-8 rounded-2xl border ${theme.card}`}>
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor={fieldId("name")} className={labelClass}>
                    <User size={14} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden="true" />Name
                  </label>
                  <input type="text" required autoComplete="name" {...fieldA11y("name")} value={formData.name} onChange={(e) => updateField("name", e.target.value)} className={inputStyles} placeholder="Your name" />
                  {fieldError("name")}
                </div>
                <div>
                  <label htmlFor={fieldId("phone")} className={labelClass}>
                    <Phone size={14} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden="true" />Phone
                  </label>
                  <input type="tel" required autoComplete="tel" {...fieldA11y("phone")} value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputStyles} placeholder="+60 12-345 6789" />
                  {fieldError("phone")}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor={fieldId("date")} className={labelClass}>
                    <Calendar size={14} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden="true" />Date
                  </label>
                  <input type="date" required {...fieldA11y("date")} value={formData.date} onChange={(e) => updateField("date", e.target.value)} className={inputStyles} min={today} />
                  {fieldError("date")}
                </div>
                <div>
                  <label htmlFor={fieldId("time")} className={labelClass}>
                    <Clock size={14} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden="true" />Time
                  </label>
                  <input type="time" required {...fieldA11y("time")} value={formData.time} onChange={(e) => updateField("time", e.target.value)} className={inputStyles} />
                  {fieldError("time")}
                </div>
              </div>
              <div>
                <label htmlFor={fieldId("guests")} className={labelClass}>
                  <Users size={14} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden="true" />Number of Guests
                </label>
                <select {...fieldA11y("guests")} value={formData.guests} onChange={(e) => updateField("guests", e.target.value)} className={inputStyles}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={fieldId("notes")} className={labelClass}>
                  <MessageSquare size={14} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden="true" />Special Requests
                </label>
                <textarea {...fieldA11y("notes")} value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} className={`${inputStyles} resize-none`} rows={3} placeholder="Any dietary requirements or special occasions?" />
              </div>
              <button
                type="submit"
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${theme.buttonPrimary}`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Send size={18} aria-hidden="true" />Continue in WhatsApp
              </button>
            </form>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

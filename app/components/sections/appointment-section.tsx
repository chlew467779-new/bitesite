/* bitesite/app/components/sections/appointment-section.tsx */

"use client";

import { useState } from "react";
import { FadeIn } from "@/app/components/animations";
import {
  Calendar, Clock, Users, MessageSquare, Phone, User, CheckCircle2, Send,
} from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import type { LayoutVariant } from "./gallery-section";
import { getLayoutTheme } from "@/lib/layout-theme.mjs";

interface AppointmentSectionProps {
  merchantName: string;
  phone?: string;
  whatsapp?: string;
  title?: string;
  variant?: LayoutVariant;
  id?: string;
  slug?: string;
}

const inputBase = "w-full px-4 py-3 rounded-xl border outline-none transition-all duration-200 text-base";
export function AppointmentSection({
  merchantName,
  phone,
  whatsapp,
  title = "Book a Table",
  variant = "classic",
  id,
  slug,
}: AppointmentSectionProps) {
  const theme = getLayoutTheme(variant).appointment;
  const inputStyles = `${inputBase} ${theme.input}`;
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    guests: "2",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 优先用商家自己的 WhatsApp，没有才用 BiteSite 默认号码
  const waNumber = (whatsapp || "60165660239").replace(/\D/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

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

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${waNumber}?text=${encoded}`;

    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);

    trackEvent('booking_submit', {
      pageType: 'merchant',
      slug,
      detail: merchantName,
    });

    window.open(waUrl, "_blank");
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (submitted) {
    return (
      <FadeIn>
        <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${theme.sectionBg}`}>
          <div className="max-w-md mx-auto">
            <div className={`p-8 rounded-2xl border text-center ${theme.card}`}>
              <CheckCircle2 size={48} className={`mx-auto mb-4 ${theme.successIcon}`} />
              <h3 className={`text-2xl font-bold mb-3 ${theme.text}`}>Request Sent!</h3>
              <p className={`opacity-70 leading-relaxed mb-6 ${theme.text}`}>
                We&apos;ve opened WhatsApp for you.<br />
                Please send the pre-filled message to confirm your reservation.
              </p>
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-all active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Open WhatsApp Again
              </a>
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
            Fill in your details and we&apos;ll send your request via WhatsApp
          </p>
          <div className={`p-6 sm:p-8 rounded-2xl border ${theme.card}`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
                    <User size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Name
                  </label>
                  <input type="text" required value={formData.name} onChange={(e) => updateField("name", e.target.value)} className={inputStyles} placeholder="Your name" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
                    <Phone size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Phone
                  </label>
                  <input type="tel" required value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputStyles} placeholder="+60 12-345 6789" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
                    <Calendar size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Date
                  </label>
                  <input type="date" required value={formData.date} onChange={(e) => updateField("date", e.target.value)} className={inputStyles} min={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
                    <Clock size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Time
                  </label>
                  <input type="time" required value={formData.time} onChange={(e) => updateField("time", e.target.value)} className={inputStyles} />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
                  <Users size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Number of Guests
                </label>
                <select value={formData.guests} onChange={(e) => updateField("guests", e.target.value)} className={inputStyles}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
                  <MessageSquare size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Special Requests
                </label>
                <textarea value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} className={`${inputStyles} resize-none`} rows={3} placeholder="Any dietary requirements or special occasions?" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2 ${theme.buttonPrimary}`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {submitting ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                ) : (
                  <><Send size={18} />Send Request via WhatsApp</>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

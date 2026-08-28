/* bitesite/app/components/sections/appointment-section.tsx */

"use client";

import { useState } from "react";
import { FadeIn } from "@/app/components/animations";
import {
  Calendar, Clock, Users, MessageSquare, Phone, User, CheckCircle2, Send,
} from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import type { LayoutVariant } from "./gallery-section";

interface AppointmentSectionProps {
  merchantName: string;
  phone?: string;
  whatsapp?: string;
  title?: string;
  variant?: LayoutVariant;
  id?: string;
  slug?: string;
}

const sectionBg: Record<LayoutVariant, string> = {
  classic: "bg-amber-50",
  elegant: "bg-slate-950",
  minimal: "bg-white",
  modern:  "bg-slate-50",
  rustic:  "bg-orange-50",
};

const cardBg: Record<LayoutVariant, string> = {
  classic: "bg-white border-amber-200",
  elegant: "bg-slate-900 border-slate-700",
  minimal: "bg-stone-50 border-stone-200",
  modern:  "bg-white border-slate-200 shadow-lg",
  rustic:  "bg-white border-orange-200",
};

const textColor: Record<LayoutVariant, string> = {
  classic: "text-amber-900",
  elegant: "text-slate-100",
  minimal: "text-stone-800",
  modern:  "text-slate-800",
  rustic:  "text-orange-900",
};

const inputBase = "w-full px-4 py-3 rounded-xl border outline-none transition-all duration-200 text-base";
const inputStyles: Record<LayoutVariant, string> = {
  classic: `${inputBase} bg-white border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20`,
  elegant:   `${inputBase} bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20`,
  minimal:   `${inputBase} bg-white border-stone-200 focus:border-stone-400 focus:ring-2 focus:ring-stone-400/20`,
  modern:    `${inputBase} bg-white border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20`,
  rustic:    `${inputBase} bg-white border-orange-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20`,
};

const btnPrimary: Record<LayoutVariant, string> = {
  classic: "bg-amber-700 hover:bg-amber-800",
  elegant: "bg-amber-600 hover:bg-amber-700",
  minimal: "bg-stone-800 hover:bg-stone-900",
  modern:  "bg-slate-900 hover:bg-slate-800",
  rustic:  "bg-orange-700 hover:bg-orange-800",
};

const BITESITE_WHATSAPP = "60165660239";

export function AppointmentSection({
  merchantName,
  title = "Book a Table",
  variant = "classic",
  id,
  slug,
}: AppointmentSectionProps) {
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
    const waUrl = `https://wa.me/${BITESITE_WHATSAPP}?text=${encoded}`;

    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);

    // FIX: 发送 booking_submit 事件
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
        <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
          <div className="max-w-md mx-auto">
            <div className={`p-8 rounded-2xl border text-center ${cardBg[variant]}`}>
              <CheckCircle2 size={48} className={`mx-auto mb-4 ${variant === "elegant" ? "text-amber-400" : "text-green-500"}`} />
              <h3 className={`text-2xl font-bold mb-3 ${textColor[variant]}`}>Request Sent!</h3>
              <p className={`opacity-70 leading-relaxed mb-6 ${textColor[variant]}`}>
                We&apos;ve opened WhatsApp for you.<br />
                Please send the pre-filled message to confirm your reservation.
              </p>
              <a
                href={`https://wa.me/${BITESITE_WHATSAPP}`}
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
      <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${sectionBg[variant]}`}>
        <div className="max-w-2xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-3 ${textColor[variant]}`}>{title}</h2>
          <p className={`text-center mb-10 opacity-60 ${textColor[variant]}`}>
            Fill in your details and we&apos;ll send your request via WhatsApp
          </p>
          <div className={`p-6 sm:p-8 rounded-2xl border ${cardBg[variant]}`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                    <User size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Name
                  </label>
                  <input type="text" required value={formData.name} onChange={(e) => updateField("name", e.target.value)} className={inputStyles[variant]} placeholder="Your name" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                    <Phone size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Phone
                  </label>
                  <input type="tel" required value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputStyles[variant]} placeholder="+60 12-345 6789" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                    <Calendar size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Date
                  </label>
                  <input type="date" required value={formData.date} onChange={(e) => updateField("date", e.target.value)} className={inputStyles[variant]} min={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                    <Clock size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Time
                  </label>
                  <input type="time" required value={formData.time} onChange={(e) => updateField("time", e.target.value)} className={inputStyles[variant]} />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                  <Users size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Number of Guests
                </label>
                <select value={formData.guests} onChange={(e) => updateField("guests", e.target.value)} className={inputStyles[variant]}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${textColor[variant]}`}>
                  <MessageSquare size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />Special Requests
                </label>
                <textarea value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} className={`${inputStyles[variant]} resize-none`} rows={3} placeholder="Any dietary requirements or special occasions?" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2 ${btnPrimary[variant]}`}
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

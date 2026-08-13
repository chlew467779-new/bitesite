"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Clock, Shirt, Instagram, Facebook, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Merchant } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface InfoAccordionProps {
  merchant: Merchant;
  style: StyleConfig;
}

interface AccordionItemProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  style: StyleConfig;
}

function AccordionItem({ icon, title, children, defaultOpen = false, style }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b" style={{ borderColor: style.border }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left transition-colors"
        style={{ color: style.text }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: style.muted }}>{icon}</span>
          <span className="text-sm font-medium uppercase tracking-wider" style={{ color: style.text }}>
            {title}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
          style={{ color: style.muted }}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-96 pb-4" : "max-h-0"
        )}
      >
        <div className="pl-8 text-sm" style={{ color: style.text2 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function InfoAccordion({ merchant, style }: InfoAccordionProps) {
  const hours = merchant.operating_hours;
  const hasHours = hours && Object.keys(hours).length > 0;

  // 获取今天是星期几
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayLower = today.toLowerCase();

  // 按正确顺序排列星期
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const socials = [];
  if (merchant.instagram) socials.push({ icon: <Instagram className="h-4 w-4" />, label: 'Instagram', url: merchant.instagram });
  if (merchant.facebook) socials.push({ icon: <Facebook className="h-4 w-4" />, label: 'Facebook', url: merchant.facebook });
  if (merchant.website) socials.push({ icon: <Globe className="h-4 w-4" />, label: 'Website', url: merchant.website });

  return (
    <section className="px-4 py-12 md:py-16" style={{ backgroundColor: style.bg2 }}>
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-8 text-center text-2xl font-medium md:text-3xl" style={{ fontFamily: style.fontSerif, color: style.text }}>
          Information
        </h2>

        <div className="rounded-xl border p-2 shadow-sm" style={{ backgroundColor: style.bg, borderColor: style.border }}>
          {merchant.address && (
            <AccordionItem icon={<MapPin className="h-4 w-4" />} title="Location" defaultOpen style={style}>
              <p>{merchant.address}</p>
              {merchant.phone && (
                <p className="mt-2">
                  <span style={{ color: style.muted }}>Phone: </span>
                  <a href={`tel:${merchant.phone}`} style={{ color: style.accent }} className="hover:underline">{merchant.phone}</a>
                </p>
              )}
            </AccordionItem>
          )}

          {hasHours && (
            <AccordionItem icon={<Clock className="h-4 w-4" />} title="Operating Hours" defaultOpen style={style}>
              <div className="space-y-1">
                {dayOrder.map((day) => {
                  const time = hours[day];
                  const isToday = day === todayLower;
                  return (
                    <div 
                      key={day} 
                      className="flex justify-between py-1 px-2 rounded"
                      style={isToday ? { backgroundColor: style.accent + "20", color: style.accent } : {}}
                    >
                      <span className="capitalize font-medium">{day}</span>
                      <span>{time || "Closed"}</span>
                    </div>
                  );
                })}
              </div>
            </AccordionItem>
          )}

          {merchant.dress_code && (
            <AccordionItem icon={<Shirt className="h-4 w-4" />} title="Dress Code" style={style}>
              <p>{merchant.dress_code}</p>
            </AccordionItem>
          )}

          {socials.length > 0 && (
            <AccordionItem icon={<Globe className="h-4 w-4" />} title="Social Links" style={style}>
              <div className="flex flex-wrap gap-4">
                {socials.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline" style={{ color: style.accent }}>
                    {s.icon}
                    {s.label}
                  </a>
                ))}
              </div>
            </AccordionItem>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { StaggerItem } from "@/app/components/animations";
import { ClipboardPenLine, FileText, Megaphone, Store } from "lucide-react";

const steps = [
  {
    icon: <ClipboardPenLine size={32} strokeWidth={1.5} />,
    title: "Tell us about you",
    description: "Share your restaurant details, menu, and best contact links.",
  },
  {
    icon: <Store size={32} strokeWidth={1.5} />,
    title: "Get listed for free",
    description: "We help your BiteSite page become useful to local diners.",
  },
  {
    icon: <FileText size={32} strokeWidth={1.5} />,
    title: "Share Stories regularly",
    description: "Send updates, launches, offers, or behind-the-scenes moments.",
  },
  {
    icon: <Megaphone size={32} strokeWidth={1.5} />,
    title: "We help amplify",
    description: "Suitable Stories may be reshared on BiteSite social channels.",
  },
];

export function HowItWorks() {
  return (
    <section
      className="px-4 py-20 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#FAFBF7" }}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center font-serif text-2xl font-bold text-[#2C3E2D] md:text-3xl">
          How It Works
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <StaggerItem key={step.title} index={index}>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#5A8F6E]/10 text-[#5A8F6E]">
                  {step.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#2C3E2D]">
                  {step.title}
                </h3>
                <p className="text-sm text-[#6B6560]">{step.description}</p>
              </div>
            </StaggerItem>
          ))}
        </div>
      </div>
    </section>
  );
}

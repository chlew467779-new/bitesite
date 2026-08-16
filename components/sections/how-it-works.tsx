"use client";

import { StaggerItem } from "@/app/components/animations";
import { Camera, PenTool, Share2 } from "lucide-react";

const steps = [
  {
    icon: <Camera size={32} strokeWidth={1.5} />,
    title: "We Shoot",
    description: "Professional food photos",
  },
  {
    icon: <PenTool size={32} strokeWidth={1.5} />,
    title: "We Build",
    description: "Your menu goes live",
  },
  {
    icon: <Share2 size={32} strokeWidth={1.5} />,
    title: "You Share",
    description: "QR / link",
  },
];

export function HowItWorks() {
  return (
    <section
      className="px-4 py-20 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#FAFBF7" }}
    >
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center font-serif text-2xl font-bold text-[#2C3E2D] md:text-3xl">
          How It Works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
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

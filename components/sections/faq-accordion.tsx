"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StaggerItem } from "@/app/components/animations";
import Image from "next/image";

interface AccordionItemProps {
  question: string;
  answer: React.ReactNode;
  defaultOpen?: boolean;
  index: number;
}

function AccordionItem({
  question,
  answer,
  defaultOpen = false,
  index,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <StaggerItem index={index}>
      <div className="border-b border-[#DDE5DC]">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`faq-answer-${index}`}
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between py-5 text-left transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <span className="pr-4 text-base font-medium text-[#2C3E2D]">
            {question}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-[#8A968B] transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <div
          id={`faq-answer-${index}`}
          className={`overflow-hidden transition-all duration-300 ${
            isOpen ? "max-h-[800px] pb-5" : "max-h-0"
          }`}
        >
          <div className="text-sm leading-relaxed text-[#6B6560]">
            {answer}
          </div>
        </div>
      </div>
    </StaggerItem>
  );
}

const faqs = [
  {
    question: "Is it really free?",
    answer:
      "Yes. There is no setup fee, monthly fee, or commission for the BiteSite partner programme. Partners agree to keep their listing useful by sharing Stories regularly.",
  },
  {
    question: "What do partners need to contribute?",
    answer:
      "Partners should share useful restaurant updates regularly, such as new menus, launches, offers, events, behind-the-scenes moments, or founder stories. Original information and image rights remain important.",
  },
  {
    question: "Will BiteSite promote my Stories?",
    answer:
      "BiteSite may reshare suitable Stories on our Facebook, Instagram, and other social channels. We will choose content that fits the channel and cannot guarantee that every Story will be reshared.",
  },
  {
    question: "Do I need to download an app?",
    answer:
      "No. Customers simply open your BiteSite link. Partners can work with us through the web and WhatsApp.",
  },
  {
    question: "Can I update my listing?",
    answer:
      "Yes. Merchants can update approved listing details from the Merchant dashboard. Name, address, slug, and business status changes go through a review request.",
  },
  {
    question: "How do I join?",
    answer:
      "Send us a WhatsApp message with your restaurant name, area, and best contact email. We will explain the next steps and invite you when ready.",
  },
];

export function FaqAccordion() {
  return (
    <section
      className="px-4 py-20 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#FAFBF7" }}
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-12 text-center font-serif text-2xl font-bold text-[#2C3E2D] md:text-3xl">
          FAQ
        </h2>
        <div>
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              defaultOpen={index === 0}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

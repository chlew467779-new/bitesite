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
    question: "Can I update my menu?",
    answer:
      "Yes — monthly content updates are included in your plan. Just send us your new menu items, photos, or changes via WhatsApp and we will update your page within 48 hours. Easy! ✨",
  },
  {
    question: "Do I need to download an app?",
    answer:
      "Nope! Your customers simply open a link or scan a QR code. No app downloads, no sign-ups, no friction. Just tap and go! 👆",
  },
  {
    question: "Any hidden cost?",
    answer: (
      <>
        Zero hidden costs! You pay exactly RM599 one-time setup + RM149/month.
        That is it. No commission, no transaction fees, no surprises. 🎉
        <div className="mt-4 flex justify-center">
          <div className="relative w-full max-w-[280px] overflow-hidden rounded-xl">
            <Image
              src="/images/memes/sus-cat-meme.png"
              alt="Sus cat meme"
              width={280}
              height={280}
              className="h-auto w-full"
            />
          </div>
        </div>
      </>
    ),
  },
  {
    question: "Can I customize my restaurant page?",
    answer:
      "Absolutely! You can choose from 5 beautiful layout styles: Classic, Elegant, Minimal, Modern, and Rustic. Want something extra unique? Advanced customization is available with an additional fee. ✨",
  },
  {
    question: "How long does it take to go live?",
    answer:
      "Typically 3–5 business days after we receive your menu, photos, and business details. Then boom — you are live! 🚀",
  },
  {
    question: "What if I want to cancel?",
    answer:
      "No worries! You can cancel anytime with 30 days notice. There is no lock-in contract. We are here when you need us. 🤝",
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

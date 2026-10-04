import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = {
  title: "Feedback | BiteSite",
  description: "Tell the BiteSite team what you think: ideas, design comments or something that is not working.",
};

export default function FeedbackPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFBF7] text-[#2C3E2D]">
      <main className="flex-1 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl">
          <div className="text-center">
            <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-[#5A8F6E] underline underline-offset-4">Back to BiteSite</Link>
            <h1 className="mt-6 font-serif text-4xl font-semibold sm:text-5xl">Tell us what you think</h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#6B6560]">
              Ideas, design comments or something that is not working. Every message is read by the BiteSite team.
            </p>
          </div>
          <div className="relative mt-10">
            <FeedbackForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

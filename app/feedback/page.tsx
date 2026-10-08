import type { Metadata } from "next";
import { Footer } from "@/components/sections/footer";
import { FeedbackForm, FeedbackHeading } from "./feedback-form";

export const metadata: Metadata = {
  title: "Feedback | BiteSite",
  description: "Tell the BiteSite team what you think: ideas, design comments or something that is not working.",
};

export default function FeedbackPage() {
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <main className="flex-1 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl">
          <FeedbackHeading />
          <div className="relative mt-10">
            <FeedbackForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

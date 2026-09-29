import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";

export const metadata: Metadata = {
  title: "Support us | BiteSite",
  description: "Help BiteSite become more complete and useful for local food discovery.",
};

export default function SupportUsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFBF7] text-[#2C3E2D]">
      <main className="flex-1 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <Link href="/" className="text-sm font-medium text-[#5A8F6E] underline underline-offset-4">Back to BiteSite</Link>
          <h1 className="mt-6 font-serif text-4xl font-semibold sm:text-5xl">Support us</h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[#6B6560]">
            Your support helps us make BiteSite more complete and easier to use, so more people can discover local restaurants and their stories.
          </p>
          <section aria-labelledby="support-qr-heading" className="mt-10 rounded-2xl border border-[#DDE5DC] bg-white p-5 shadow-sm sm:p-8">
            <h2 id="support-qr-heading" className="text-xl font-semibold">Touch &apos;n Go</h2>
            <p className="mt-2 text-sm text-[#6B6560]">The official QR image is coming soon.</p>
            {/* Replace public/support/tng-qr.png with CH's official Touch 'n Go QR screenshot before release. */}
            <Image
              src="/support/tng-qr.png"
              alt="Placeholder image: the official Touch 'n Go support QR is coming soon"
              width={512}
              height={512}
              className="mx-auto mt-6 h-auto w-full max-w-xs rounded-xl border border-[#DDE5DC]"
              priority
            />
            <p className="mt-4 text-sm text-[#6B6560]">This image is a placeholder. Please wait for the official QR before sending support.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* bitesite/components/sections/footer.tsx */

export function Footer() {
  return (
    <footer className="border-t border-[#DDE5DC] bg-[#FAFBF7]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <h4 className="font-serif text-lg font-medium tracking-wide text-[#2C3E2D]">
              BiteSite
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-[#8A968B]">
              Beautiful Menus for Local Restaurants
            </p>
          </div>
          <div className="flex gap-6 text-sm text-[#6B6560]">
            <a
              href="/"
              className="transition-colors duration-200 active:text-[#5A8F6E]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Home
            </a>
            <a
              href="/join-us"
              className="transition-colors duration-200 active:text-[#5A8F6E]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Join Us
            </a>
            <span className="text-[#DDE5DC]">|</span>
            <span className="text-[#8A968B]" suppressHydrationWarning>
              © {new Date().getFullYear()} BiteSite
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

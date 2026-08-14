"use client";

import Image from "next/image";
import { MapPin, Phone, Clock, MessageCircle, Instagram } from "lucide-react";

interface ElegantLayoutProps {
  merchant: any;
  categories: any[];
  products: any[];
}

export default function ElegantLayout({ merchant, categories, products }: ElegantLayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const handleWhatsApp = () => {
    if (merchant.whatsapp) {
      window.open(`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-200">
      {/* Full-screen Hero */}
      <div className="relative h-screen w-full overflow-hidden">
        <Image
          src={merchant.cover_image || "/placeholder.svg"}
          alt={merchant.name}
          fill
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
        
        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16">
          <div className="max-w-5xl mx-auto w-full">
            <div className="w-20 h-[1px] bg-amber-500 mb-6" />
            <span className="text-amber-500 tracking-[0.3em] text-sm uppercase mb-4 block">
              {merchant.cuisine_type}
            </span>
            <h1 className="text-5xl md:text-8xl font-light text-white mb-6 tracking-tight">
              {merchant.name}
            </h1>
            <p className="text-stone-300 text-lg md:text-xl max-w-2xl leading-relaxed font-light">
              {merchant.description}
            </p>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-[#111] border-t border-stone-800">
        <div className="max-w-5xl mx-auto px-8 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-amber-500 text-xs tracking-[0.2em] uppercase mb-3">Location</h3>
            <div className="flex items-start gap-2 text-stone-400">
              <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
              <span className="text-sm">{merchant.address}</span>
            </div>
          </div>
          <div>
            <h3 className="text-amber-500 text-xs tracking-[0.2em] uppercase mb-3">Contact</h3>
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Phone className="w-4 h-4" />
              <span className="text-sm">{merchant.phone}</span>
            </div>
            {merchant.instagram && (
              <a
                href={merchant.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-stone-400 hover:text-amber-500 transition-colors"
              >
                <Instagram className="w-4 h-4" />
                <span className="text-sm">Instagram</span>
              </a>
            )}
          </div>
          <div>
            <h3 className="text-amber-500 text-xs tracking-[0.2em] uppercase mb-3">Reservations</h3>
            {merchant.whatsapp && (
              <button
                onClick={handleWhatsApp}
                className="px-6 py-2 border border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black transition-all text-sm tracking-wider uppercase"
              >
                WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-5xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <span className="text-amber-500 tracking-[0.3em] text-sm uppercase">Menu</span>
          <h2 className="text-4xl md:text-5xl font-light text-white mt-4">Signature Dishes</h2>
        </div>

        <div className="space-y-16">
          {categories.map((category) => {
            const categoryProducts = getProductsByCategory(category.id);
            if (categoryProducts.length === 0) return null;

            return (
              <section key={category.id}>
                <h3 className="text-2xl font-light text-amber-500 mb-8 pb-4 border-b border-stone-800">
                  {category.name}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {categoryProducts.map((product) => (
                    <div
                      key={product.id}
                      className="group flex gap-4 p-4 hover:bg-stone-900/50 transition-colors rounded-lg"
                    >
                      {product.image_url && (
                        <div className="relative w-28 h-28 flex-shrink-0 overflow-hidden rounded-lg">
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-baseline mb-2">
                            <h4 className="text-lg text-white font-light">{product.name}</h4>
                            {product.price && (
                              <span className="text-amber-500 font-medium">RM {product.price}</span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-sm text-stone-500 line-clamp-2">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black border-t border-stone-900 py-12 text-center">
        <p className="text-stone-600 text-sm">BiteSite</p>
        <p className="text-stone-700 text-xs mt-2">Discover more restaurants</p>
      </footer>
    </div>
  );
}

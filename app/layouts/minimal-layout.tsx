"use client";

import Image from "next/image";
import { MapPin, Phone, MessageCircle } from "lucide-react";

interface MinimalLayoutProps {
  merchant: any;
  categories: any[];
  products: any[];
}

export default function MinimalLayout({ merchant, categories, products }: MinimalLayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const handleWhatsApp = () => {
    if (merchant.whatsapp) {
      window.open(`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#fefefe] text-stone-700">
      {/* Minimal Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-8 text-center">
        <span className="text-stone-400 text-xs tracking-[0.4em] uppercase block mb-6">
          {merchant.cuisine_type}
        </span>
        <h1 className="text-3xl md:text-5xl font-light text-stone-800 mb-6 tracking-wide">
          {merchant.name}
        </h1>
        <div className="w-12 h-[1px] bg-stone-300 mx-auto mb-6" />
        <p className="text-stone-500 leading-relaxed max-w-lg mx-auto text-sm md:text-base">
          {merchant.description}
        </p>
      </div>

      {/* Cover Image - Floating */}
      <div className="max-w-4xl mx-auto px-6 mb-12">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
          <Image
            src={merchant.cover_image || "/placeholder.svg"}
            alt={merchant.name}
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Info */}
      <div className="max-w-3xl mx-auto px-6 pb-12 flex flex-wrap justify-center gap-6 text-sm text-stone-500">
        {merchant.address && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{merchant.address}</span>
          </div>
        )}
        {merchant.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>{merchant.phone}</span>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      {merchant.whatsapp && (
        <div className="max-w-3xl mx-auto px-6 pb-16 text-center">
          <button
            onClick={handleWhatsApp}
            className="px-8 py-3 border border-stone-300 text-stone-600 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all text-sm tracking-widest uppercase"
          >
            WhatsApp
          </button>
        </div>
      )}

      {/* Menu - Clean List */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        {categories.map((category) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <section key={category.id} className="mb-16">
              <h2 className="text-center text-xs tracking-[0.4em] uppercase text-stone-400 mb-8">
                {category.name}
              </h2>
              <div className="space-y-8">
                {categoryProducts.map((product) => (
                  <div key={product.id} className="text-center group">
                    {product.image_url && (
                      <div className="relative w-full aspect-[4/3] mb-4 overflow-hidden rounded-sm">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-[1.02] transition-transform duration-700"
                        />
                      </div>
                    )}
                    <h3 className="text-lg text-stone-700 font-light mb-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-stone-400 mb-2 max-w-md mx-auto">{product.description}</p>
                    )}
                    {product.price && (
                      <span className="text-stone-500 text-sm">RM {product.price}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="py-12 text-center border-t border-stone-100">
        <p className="text-stone-300 text-xs tracking-widest uppercase">BiteSite</p>
      </footer>
    </div>
  );
}

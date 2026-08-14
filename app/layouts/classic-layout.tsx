"use client";

import Image from "next/image";
import { MapPin, Phone, Clock, MessageCircle } from "lucide-react";

interface ClassicLayoutProps {
  merchant: any;
  categories: any[];
  products: any[];
}

export default function ClassicLayout({ merchant, categories, products }: ClassicLayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const handleWhatsApp = () => {
    if (merchant.whatsapp) {
      window.open(`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-800">
      {/* Hero */}
      <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden">
        <Image
          src={merchant.cover_image || "/placeholder.svg"}
          alt={merchant.name}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block px-3 py-1 bg-amber-500/90 text-white text-xs font-medium rounded-full mb-3">
              {merchant.cuisine_type}
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">{merchant.name}</h1>
            <p className="text-white/80 text-lg max-w-xl">{merchant.description}</p>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap gap-4 text-sm text-stone-600">
          {merchant.address && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600" />
              <span>{merchant.address}</span>
            </div>
          )}
          {merchant.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-600" />
              <span>{merchant.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Open Today</span>
          </div>
        </div>
      </div>

      {/* WhatsApp CTA */}
      {merchant.whatsapp && (
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button
            onClick={handleWhatsApp}
            className="w-full md:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Message on WhatsApp
          </button>
        </div>
      )}

      {/* Menu Sections */}
      <div className="max-w-4xl mx-auto px-6 pb-16 space-y-12">
        {categories.map((category) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <section key={category.id}>
              <h2 className="text-2xl font-bold text-stone-800 mb-6 pb-2 border-b-2 border-amber-500 inline-block">
                {category.name}
              </h2>
              <div className="grid gap-4">
                {categoryProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl p-4 flex gap-4 shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
                  >
                    {product.image_url && (
                      <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-stone-800">{product.name}</h3>
                        {product.price && (
                          <span className="text-amber-700 font-bold">RM {product.price}</span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-8 text-center text-sm">
        <a href="/" className="block hover:text-stone-300 transition-colors">
          <p>Powered by BiteSite</p>
          <p className="mt-1 text-stone-500">Discover more restaurants</p>
        </a>
      </footer>
    </div>
  );
}

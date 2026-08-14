"use client";

import Image from "next/image";
import { MapPin, Phone, MessageCircle, Clock } from "lucide-react";

interface RusticLayoutProps {
  merchant: any;
  categories: any[];
  products: any[];
}

export default function RusticLayout({ merchant, categories, products }: RusticLayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const handleWhatsApp = () => {
    if (merchant.whatsapp) {
      window.open(`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[#3d3229]">
      {/* Warm Hero */}
      <div className="relative h-[60vh] w-full overflow-hidden">
        <Image
          src={merchant.cover_image || "/placeholder.svg"}
          alt={merchant.name}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[#3d3229]/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-6">
            <span className="text-[#d4a574] text-sm tracking-[0.3em] uppercase block mb-4">
              {merchant.cuisine_type}
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4" style={{ fontFamily: 'serif' }}>
              {merchant.name}
            </h1>
            <p className="text-white/80 max-w-md mx-auto">{merchant.description}</p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="max-w-5xl mx-auto px-6 -mt-16 relative z-10">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <MapPin className="w-6 h-6 text-[#8b6914] mx-auto mb-3" />
            <h3 className="font-semibold text-[#3d3229] mb-1">Visit Us</h3>
            <p className="text-sm text-stone-500">{merchant.address}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <Phone className="w-6 h-6 text-[#8b6914] mx-auto mb-3" />
            <h3 className="font-semibold text-[#3d3229] mb-1">Call</h3>
            <p className="text-sm text-stone-500">{merchant.phone}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <Clock className="w-6 h-6 text-[#8b6914] mx-auto mb-3" />
            <h3 className="font-semibold text-[#3d3229] mb-1">Hours</h3>
            <p className="text-sm text-stone-500">Open Daily</p>
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      {merchant.whatsapp && (
        <div className="max-w-5xl mx-auto px-6 py-10 text-center">
          <button
            onClick={handleWhatsApp}
            className="px-8 py-3 bg-[#8b6914] hover:bg-[#6b5010] text-white rounded-full font-medium inline-flex items-center gap-2 transition-colors shadow-md"
          >
            <MessageCircle className="w-5 h-5" />
            Message on WhatsApp
          </button>
        </div>
      )}

      {/* Menu - Warm Cards */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {categories.map((category) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <section key={category.id} className="mb-16">
              <h2 className="text-3xl font-bold text-[#3d3229] mb-8 text-center" style={{ fontFamily: 'serif' }}>
                {category.name}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {categoryProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                  >
                    {product.image_url && (
                      <div className="relative h-48 w-full">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-[#3d3229] text-lg">{product.name}</h3>
                        {product.price && (
                          <span className="text-[#8b6914] font-bold text-lg">RM {product.price}</span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-sm text-stone-500">{product.description}</p>
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
      <footer className="bg-[#3d3229] text-[#d4a574] py-10 text-center">
        <p className="font-medium">BiteSite</p>
        <p className="text-sm mt-1 text-[#a08060]">Discover more restaurants</p>
      </footer>
    </div>
  );
}

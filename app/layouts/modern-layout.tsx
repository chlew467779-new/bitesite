"use client";

import Image from "next/image";
import { MapPin, Phone, MessageCircle, ArrowRight } from "lucide-react";

interface ModernLayoutProps {
  merchant: any;
  categories: any[];
  products: any[];
}

export default function ModernLayout({ merchant, categories, products }: ModernLayoutProps) {
  const getProductsByCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId);
  };

  const handleWhatsApp = () => {
    if (merchant.whatsapp) {
      window.open(`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Asymmetric Hero */}
      <div className="grid md:grid-cols-2 min-h-[70vh]">
        <div className="relative h-[50vh] md:h-auto">
          <Image
            src={merchant.cover_image || "/placeholder.svg"}
            alt={merchant.name}
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="flex flex-col justify-center p-8 md:p-16 bg-gray-50">
          <span className="text-indigo-600 font-medium text-sm tracking-wider uppercase mb-4">
            {merchant.cuisine_type}
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            {merchant.name}
          </h1>
          <p className="text-gray-600 text-lg mb-8 max-w-md leading-relaxed">
            {merchant.description}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            {merchant.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>{merchant.address}</span>
              </div>
            )}
            {merchant.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-600" />
                <span>{merchant.phone}</span>
              </div>
            )}
          </div>
          {merchant.whatsapp && (
            <button
              onClick={handleWhatsApp}
              className="mt-8 w-fit px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              WhatsApp <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Menu - Magazine Grid */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <span className="text-indigo-600 text-sm font-medium uppercase tracking-wider">Menu</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Our Selection</h2>
          </div>
        </div>

        <div className="space-y-20">
          {categories.map((category, catIndex) => {
            const categoryProducts = getProductsByCategory(category.id);
            if (categoryProducts.length === 0) return null;

            return (
              <section key={category.id}>
                <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-indigo-600" />
                  {category.name}
                </h3>
                <div className={`grid gap-6 ${catIndex % 2 === 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {categoryProducts.map((product, idx) => (
                    <div
                      key={product.id}
                      className={`group ${idx === 0 && catIndex % 2 === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
                    >
                      {product.image_url && (
                        <div className={`relative overflow-hidden rounded-xl mb-4 ${idx === 0 && catIndex % 2 === 0 ? 'aspect-[4/3]' : 'aspect-square'}`}>
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-900">{product.name}</h4>
                          {product.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                          )}
                        </div>
                        {product.price && (
                          <span className="text-indigo-600 font-bold whitespace-nowrap ml-4">RM {product.price}</span>
                        )}
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
      <footer className="bg-gray-900 text-gray-400 py-12 text-center">
        <a href="/" className="block hover:text-white transition-colors">
          <p className="font-medium">BiteSite</p>
          <p className="text-sm mt-1 text-gray-600">Discover more restaurants</p>
        </a>
     </footer>
    </div>
  );
}

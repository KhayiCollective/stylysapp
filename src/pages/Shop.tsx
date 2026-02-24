import { useEffect, useState } from "react";
import { fetchProducts, ShopifyProduct } from "@/lib/shopify";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { ShopLayout } from "@/components/shop/ShopLayout";

const Shop = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const data = await fetchProducts(20);
        setProducts(data);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  return (
    <ShopLayout products={products.map(p => ({
      id: p.node.id,
      name: p.node.title,
      price: parseFloat(p.node.priceRange.minVariantPrice.amount),
      category: "",
      handle: p.node.handle,
      image: p.node.images.edges[0]?.node.url || "",
      variantId: p.node.variants.edges[0]?.node.id || "",
    }))}>
      <div className="min-h-screen bg-background">
        <ShopHeader />
        
        <main className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <section className="mb-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              New Arrivals
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Discover the latest collection from Khayi Collective. 
              Premium quality, timeless style.
            </p>
          </section>
          
          {/* Products Grid */}
          <section>
            <ProductGrid products={products} isLoading={isLoading} />
          </section>
        </main>
        
        {/* Footer */}
        <footer className="border-t py-8 mt-16">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>© 2024 Khayi Collective. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </ShopLayout>
  );
};

export default Shop;

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BulkActions } from "@/components/catalog/BulkActions";
import { ImportProductsDialog } from "@/components/catalog/ImportProductsDialog";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
  color: string | null;
  fit: string | null;
  price: number;
  inventory_status: string;
  tags?: string[];
}

const categories = ["tops", "bottoms", "outerwear", "footwear", "accessories", "dresses", "uncategorized"];
const colors = ["white", "black", "blue", "brown", "camel", "cream", "navy", "grey", "red", "green", "pink"];
const fits = ["fitted", "relaxed", "oversized", "regular"];

const Catalog = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    image_url: "",
    category: "",
    color: "",
    fit: "",
    price: "",
  });

  useEffect(() => {
    const fetchBrandAndProducts = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("brand_id")
          .eq("id", user.id)
          .single();

        if (profile?.brand_id) {
          setBrandId(profile.brand_id);
          
          // Check Shopify connection
          const { data: brand } = await supabase
            .from("brands")
            .select("shopify_store_domain")
            .eq("id", profile.brand_id)
            .single();
          setShopifyConnected(!!brand?.shopify_store_domain);
          
          await fetchProducts(profile.brand_id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBrandAndProducts();
  }, [user]);

  const fetchProducts = async (bid: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("brand_id", bid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
      return;
    }

    setProducts(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) return;

    const productData = {
      brand_id: brandId,
      name: formData.name,
      image_url: formData.image_url || null,
      category: formData.category || "uncategorized",
      color: formData.color || null,
      fit: formData.fit || null,
      price: parseFloat(formData.price) || 0,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update product", variant: "destructive" });
        return;
      }
      toast({ title: "Product updated", description: `${formData.name} has been updated.` });
    } else {
      const { error } = await supabase
        .from("products")
        .insert(productData);

      if (error) {
        toast({ title: "Error", description: "Failed to add product", variant: "destructive" });
        return;
      }
      toast({ title: "Product added", description: `${formData.name} has been added to your catalog.` });
    }

    setFormData({ name: "", image_url: "", category: "", color: "", fit: "", price: "" });
    setEditingProduct(null);
    setIsAddDialogOpen(false);
    await fetchProducts(brandId);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      image_url: product.image_url || "",
      category: product.category,
      color: product.color || "",
      fit: product.fit || "",
      price: product.price.toString(),
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
      return;
    }

    setProducts(products.filter(p => p.id !== productId));
    setSelectedIds(selectedIds.filter(id => id !== productId));
    toast({ title: "Product deleted", description: "The product has been removed from your catalog." });
  };

  const toggleSelection = (productId: string) => {
    if (selectedIds.includes(productId)) {
      setSelectedIds(selectedIds.filter(id => id !== productId));
    } else {
      setSelectedIds([...selectedIds, productId]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_stock": return "bg-success/10 text-success border-success/20";
      case "low_stock": return "bg-warning/10 text-warning border-warning/20";
      case "out_of_stock": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Catalog Manager" description="Upload and manage your product catalog">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Catalog Manager" 
      description="Upload and manage your product catalog"
    >
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted-foreground">
          {products.length} products in catalog
        </p>
        <div className="flex gap-2">
          {brandId && (
            <ImportProductsDialog
              brandId={brandId}
              shopifyConnected={shopifyConnected}
              onImportComplete={() => brandId && fetchProducts(brandId)}
            />
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="editorial" onClick={() => {
                setEditingProduct(null);
                setFormData({ name: "", image_url: "", category: "", color: "", fit: "", price: "" });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Classic White Tee"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input 
                  id="image_url" 
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Select value={formData.color} onValueChange={(v) => setFormData({ ...formData, color: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {colors.map(color => (
                        <SelectItem key={color} value={color} className="capitalize">{color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fit</Label>
                  <Select value={formData.fit} onValueChange={(v) => setFormData({ ...formData, fit: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {fits.map(fit => (
                        <SelectItem key={fit} value={fit} className="capitalize">{fit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input 
                    id="price" 
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="editorial" className="flex-1">
                  {editingProduct ? "Save Changes" : "Add Product"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Bulk Actions */}
      <BulkActions
        products={products}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onUpdate={() => brandId && fetchProducts(brandId)}
        categories={categories}
      />

      {/* Products Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
        {products.map((product) => (
          <Card key={product.id} className="card-editorial overflow-hidden group relative">
            {/* Selection Checkbox */}
            <div className="absolute top-3 left-3 z-10">
              <Checkbox
                checked={selectedIds.includes(product.id)}
                onCheckedChange={() => toggleSelection(product.id)}
                className="bg-background/80 backdrop-blur"
              />
            </div>

            <div className="aspect-[4/5] relative overflow-hidden bg-muted">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImagePlus className="h-12 w-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  size="icon-sm" 
                  variant="secondary"
                  onClick={() => handleEdit(product)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  size="icon-sm" 
                  variant="destructive"
                  onClick={() => handleDelete(product.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium leading-tight line-clamp-2">{product.name}</h3>
                <Badge variant="outline" className={getStatusColor(product.inventory_status)}>
                  {product.inventory_status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{product.category}</span>
                  {product.color && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{product.color}</span>
                    </>
                  )}
                  {product.fit && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{product.fit}</span>
                    </>
                  )}
                </div>
                <span className="font-medium">${product.price.toFixed(2)}</span>
              </div>
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {product.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {product.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{product.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add Product Card */}
        <Card 
          className="card-editorial border-dashed cursor-pointer hover:border-foreground/30 transition-colors"
          onClick={() => {
            setEditingProduct(null);
            setFormData({ name: "", image_url: "", category: "", color: "", fit: "", price: "" });
            setIsAddDialogOpen(true);
          }}
        >
          <div className="aspect-[4/5] flex flex-col items-center justify-center text-muted-foreground">
            <ImagePlus className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">Add Product</p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Catalog;

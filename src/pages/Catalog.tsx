import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ImagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  color: string;
  fit: string;
  price: number;
  inventoryStatus: "in_stock" | "low_stock" | "out_of_stock";
}

// Mock products for demonstration
const mockProducts: Product[] = [
  {
    id: "1",
    name: "Classic White Tee",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop",
    category: "tops",
    color: "white",
    fit: "relaxed",
    price: 29.00,
    inventoryStatus: "in_stock"
  },
  {
    id: "2",
    name: "High-Waisted Jeans",
    imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop",
    category: "bottoms",
    color: "blue",
    fit: "fitted",
    price: 89.00,
    inventoryStatus: "in_stock"
  },
  {
    id: "3",
    name: "Wool Overcoat",
    imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400&h=500&fit=crop",
    category: "outerwear",
    color: "camel",
    fit: "oversized",
    price: 249.00,
    inventoryStatus: "low_stock"
  },
  {
    id: "4",
    name: "Leather Boots",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop",
    category: "footwear",
    color: "brown",
    fit: "fitted",
    price: 179.00,
    inventoryStatus: "in_stock"
  },
  {
    id: "5",
    name: "Silk Blouse",
    imageUrl: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&h=500&fit=crop",
    category: "tops",
    color: "cream",
    fit: "relaxed",
    price: 129.00,
    inventoryStatus: "in_stock"
  },
  {
    id: "6",
    name: "Tailored Trousers",
    imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop",
    category: "bottoms",
    color: "black",
    fit: "fitted",
    price: 119.00,
    inventoryStatus: "in_stock"
  },
];

const categories = ["tops", "bottoms", "outerwear", "footwear", "accessories"];
const colors = ["white", "black", "blue", "brown", "camel", "cream", "navy", "grey"];
const fits = ["fitted", "relaxed", "oversized"];

const Catalog = () => {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    imageUrl: "",
    category: "",
    color: "",
    fit: "",
    price: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      setProducts(products.map(p => 
        p.id === editingProduct.id 
          ? { ...p, ...formData, price: parseFloat(formData.price) }
          : p
      ));
      toast({ title: "Product updated", description: `${formData.name} has been updated.` });
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name: formData.name,
        imageUrl: formData.imageUrl || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=500&fit=crop",
        category: formData.category,
        color: formData.color,
        fit: formData.fit,
        price: parseFloat(formData.price),
        inventoryStatus: "in_stock",
      };
      setProducts([...products, newProduct]);
      toast({ title: "Product added", description: `${formData.name} has been added to your catalog.` });
    }

    setFormData({ name: "", imageUrl: "", category: "", color: "", fit: "", price: "" });
    setEditingProduct(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      imageUrl: product.imageUrl,
      category: product.category,
      color: product.color,
      fit: product.fit,
      price: product.price.toString(),
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId));
    toast({ title: "Product deleted", description: "The product has been removed from your catalog." });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_stock": return "bg-success/10 text-success border-success/20";
      case "low_stock": return "bg-warning/10 text-warning border-warning/20";
      case "out_of_stock": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  return (
    <DashboardLayout 
      title="Catalog Manager" 
      description="Upload and manage your product catalog"
    >
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-8">
        <p className="text-muted-foreground">
          {products.length} products in catalog
        </p>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="editorial" onClick={() => {
              setEditingProduct(null);
              setFormData({ name: "", imageUrl: "", category: "", color: "", fit: "", price: "" });
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
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input 
                  id="imageUrl" 
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
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

      {/* Products Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <Card key={product.id} className="card-editorial overflow-hidden group">
            <div className="aspect-[4/5] relative overflow-hidden bg-muted">
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
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
                <h3 className="font-medium leading-tight">{product.name}</h3>
                <Badge variant="outline" className={getStatusColor(product.inventoryStatus)}>
                  {product.inventoryStatus.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{product.category}</span>
                  <span>•</span>
                  <span className="capitalize">{product.color}</span>
                  <span>•</span>
                  <span className="capitalize">{product.fit}</span>
                </div>
                <span className="font-medium">${product.price.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Product Card */}
        <Card 
          className="card-editorial border-dashed cursor-pointer hover:border-foreground/30 transition-colors"
          onClick={() => {
            setEditingProduct(null);
            setFormData({ name: "", imageUrl: "", category: "", color: "", fit: "", price: "" });
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

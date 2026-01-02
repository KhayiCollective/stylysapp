import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tags, FolderOpen, Loader2, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  category: string;
  tags?: string[];
}

interface BulkActionsProps {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdate: () => void;
  categories: string[];
}

export function BulkActions({ products, selectedIds, onSelectionChange, onUpdate, categories }: BulkActionsProps) {
  const { toast } = useToast();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedProducts = products.filter(p => selectedIds.includes(p.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(products.map(p => p.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (!selectedCategory || selectedIds.length === 0) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({ category: selectedCategory })
        .in('id', selectedIds);

      if (error) throw error;

      toast({
        title: 'Categories updated',
        description: `Updated category for ${selectedIds.length} products`,
      });

      setCategoryDialogOpen(false);
      setSelectedCategory('');
      onUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update categories',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    if (!tagsToAdd.includes(tag)) {
      setTagsToAdd([...tagsToAdd, tag]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setTagsToAdd(tagsToAdd.filter(t => t !== tag));
  };

  const handleBulkTagUpdate = async () => {
    if (tagsToAdd.length === 0 || selectedIds.length === 0) return;
    setLoading(true);

    try {
      // Get current tags for selected products
      const { data: currentProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, tags')
        .in('id', selectedIds);

      if (fetchError) throw fetchError;

      // Update each product with merged tags
      const updates = (currentProducts || []).map(async (product) => {
        const existingTags = (product.tags as string[]) || [];
        const mergedTags = [...new Set([...existingTags, ...tagsToAdd])];
        
        return supabase
          .from('products')
          .update({ tags: mergedTags })
          .eq('id', product.id);
      });

      await Promise.all(updates);

      toast({
        title: 'Tags added',
        description: `Added ${tagsToAdd.length} tag(s) to ${selectedIds.length} products`,
      });

      setTagDialogOpen(false);
      setTagsToAdd([]);
      onUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update tags',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedIds.length === products.length && products.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.length === 0
              ? 'Select products for bulk actions'
              : `${selectedIds.length} of ${products.length} selected`}
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Assign Category
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagDialogOpen(true)}
            >
              <Tags className="h-4 w-4 mr-2" />
              Add Tags
            </Button>
          </div>
        )}
      </div>

      {/* Category Assignment Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Category</DialogTitle>
            <DialogDescription>
              Update the category for {selectedIds.length} selected product(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Selected Products</Label>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted rounded">
                {selectedProducts.map(p => (
                  <div key={p.id} className="text-sm flex items-center justify-between">
                    <span>{p.name}</span>
                    <Badge variant="outline" className="text-xs">{p.category}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCategoryUpdate} disabled={!selectedCategory || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Assignment Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tags</DialogTitle>
            <DialogDescription>
              Add tags to {selectedIds.length} selected product(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Add Tag</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Enter tag name"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button variant="outline" size="icon" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {tagsToAdd.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Tags to Add</Label>
                <div className="flex flex-wrap gap-2">
                  {tagsToAdd.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground">Selected Products</Label>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted rounded">
                {selectedProducts.map(p => (
                  <div key={p.id} className="text-sm">{p.name}</div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkTagUpdate} disabled={tagsToAdd.length === 0 || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

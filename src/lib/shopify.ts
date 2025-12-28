import { toast } from "sonner";

// Types
export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    priceRange: {
      minVariantPrice: {
        amount: string;
        currencyCode: string;
      };
    };
    images: {
      edges: Array<{
        node: {
          url: string;
          altText: string | null;
        };
      }>;
    };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: {
            amount: string;
            currencyCode: string;
          };
          availableForSale: boolean;
          selectedOptions: Array<{
            name: string;
            value: string;
          }>;
        };
      }>;
    };
    options: Array<{
      name: string;
      values: string[];
    }>;
  };
}

export interface CartItem {
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

// GraphQL Queries
const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      handle
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 20) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            availableForSale
            selectedOptions {
              name
              value
            }
          }
        }
      }
      options {
        name
        values
      }
    }
  }
`;

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Storefront API Helper - Uses edge function proxy for multi-tenant support
export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}, brandId?: string): Promise<any | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
        brandId,
      }),
    });

    if (response.status === 402) {
      toast.error("Shopify: Payment required", {
        description: "Your Shopify store needs an active subscription to use the API."
      });
      return null;
    }

    if (response.status === 400) {
      const errorData = await response.json();
      if (errorData.error === "Shopify not connected for this brand") {
        toast.error("Shopify not connected", {
          description: "Please connect your Shopify store in settings."
        });
        return null;
      }
      return null;
    }

    if (!response.ok) {
      console.error('Shopify proxy error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('Shopify GraphQL errors:', data.errors);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Storefront API request failed:', error);
    return null;
  }
}

// Fetch Products
export async function fetchProducts(first: number = 20, query?: string, brandId?: string): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(PRODUCTS_QUERY, { first, query }, brandId);
  if (!data?.data?.products?.edges) return [];
  return data.data.products.edges;
}

// Fetch Single Product by Handle
export async function fetchProductByHandle(handle: string, brandId?: string): Promise<ShopifyProduct['node'] | null> {
  const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle }, brandId);
  if (!data?.data?.productByHandle) return null;
  return data.data.productByHandle;
}

// Create Storefront Checkout
export async function createStorefrontCheckout(items: CartItem[], brandId?: string): Promise<string> {
  try {
    const lines = items.map(item => ({
      quantity: item.quantity,
      merchandiseId: item.variantId,
    }));

    const cartData = await storefrontApiRequest(CART_CREATE_MUTATION, {
      input: { lines },
    }, brandId);

    if (!cartData) {
      throw new Error('Failed to create cart');
    }

    if (cartData.data.cartCreate.userErrors.length > 0) {
      throw new Error(`Cart creation failed: ${cartData.data.cartCreate.userErrors.map((e: { message: string }) => e.message).join(', ')}`);
    }

    const cart = cartData.data.cartCreate.cart;
    
    if (!cart.checkoutUrl) {
      throw new Error('No checkout URL returned from Shopify');
    }

    const url = new URL(cart.checkoutUrl);
    url.searchParams.set('channel', 'online_store');
    return url.toString();
  } catch (error) {
    console.error('Error creating storefront checkout:', error);
    throw error;
  }
}

// Format price helper
export function formatPrice(amount: string, currencyCode: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(parseFloat(amount));
}

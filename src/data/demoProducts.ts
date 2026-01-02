// Demo products using Haus of Khayi imagery for onboarding and demo mode
export const demoProducts = [
  {
    id: "demo-1",
    title: "High-Slit Maxi Skirt",
    price: 34.05,
    image: "https://cdn.shopify.com/s/files/1/0648/5137/8384/files/b88cb4cecec14cc4b3cfcd42cc3f8e46-Max-Origin.webp",
    category: "Bottoms",
    color: "Black",
    fit: "Relaxed",
  },
  {
    id: "demo-2",
    title: "Turtleneck Long Sleeve Maxi Dress",
    price: 65.05,
    image: "https://cdn.shopify.com/s/files/1/0648/5137/8384/files/7e68446e-a346-45f7-a676-759b7ec23d66-Max-Origin.webp",
    category: "Dresses",
    color: "Neutral",
    fit: "Slim",
  },
  {
    id: "demo-3",
    title: "Classic Tote Bag",
    price: 29.99,
    image: "https://cdn.shopify.com/s/files/1/0648/5137/8384/files/4fce1c867a7e470898274fc9b7735694-Max-Origin.webp",
    category: "Accessories",
    color: "Brown",
    fit: "One Size",
  },
  {
    id: "demo-4",
    title: "Elegant Evening Gown",
    price: 89.99,
    image: "https://cdn.shopify.com/s/files/1/0648/5137/8384/files/de24eca19ee84c66a48d46b5ad46a95d-Max-Origin.webp",
    category: "Dresses",
    color: "Black",
    fit: "Fitted",
  },
  {
    id: "demo-5",
    title: "Casual Wrap Top",
    price: 42.00,
    image: "https://cdn.shopify.com/s/files/1/0648/5137/8384/files/1ecea8b1-8faf-4c7f-ba64-7ef56f2e7d54-Max-Origin.webp",
    category: "Tops",
    color: "White",
    fit: "Regular",
  },
  {
    id: "demo-6",
    title: "Statement Earrings",
    price: 18.50,
    image: "https://cdn.shopify.com/s/files/1/0648/5137/8384/files/3a46f47d-4b1e-4e3f-9c8d-1234567890ab-Max-Origin.webp",
    category: "Accessories",
    color: "Gold",
    fit: "One Size",
  },
];

// Demo outfit combinations for widget preview
export const demoOutfits = [
  {
    id: "outfit-1",
    name: "Evening Elegance",
    products: [demoProducts[3], demoProducts[2]], // Gown + Tote
    occasion: "Evening",
    totalPrice: 119.98,
  },
  {
    id: "outfit-2",
    name: "Casual Chic",
    products: [demoProducts[4], demoProducts[0]], // Wrap Top + Maxi Skirt
    occasion: "Casual",
    totalPrice: 76.05,
  },
  {
    id: "outfit-3",
    name: "Minimalist Monday",
    products: [demoProducts[1]], // Turtleneck Dress
    occasion: "Work",
    totalPrice: 65.05,
  },
];

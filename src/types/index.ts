export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  images: string;
  categoryId?: string | null;
  category?: Category | null;
  stock: number;
  minStock: number;
  unit: string;
  active: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  products?: Product[];
  _count?: { products: number };
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  link?: string | null;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryEntry {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  type: string;
  notes?: string | null;
  userId?: string | null;
  createdAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  type: string;
  reason?: string | null;
  reference?: string | null;
  userId?: string | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  lowStockProducts: number;
  totalInventory: number;
  pageviews7d: number;
  visitors7d: number;
  newOrders: number;
}

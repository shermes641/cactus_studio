export interface Product {
  id: number;
  name: string;
  price_cents: number;
  image_url: string;
  scientific?: string;
  class?: string;
  quantity?: number;
  notes?: string;
  sku?: string;
}

export interface PageCacheEntry {
  products: Product[];
  total: number;
}

export interface Translations {
    [lang: string]: {
        [key: string]: string;
    }
}

export interface Discount {
    code: string;
    type: 'percent' | 'shipping';
    value: number;
    active: boolean;
}

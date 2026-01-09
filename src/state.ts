import { Product, PageCacheEntry } from './types.js';
import { calculateMaxImgCache } from './utils.js';

export const state = {
    cart: [] as Product[],
    isAdmin: false,
    editingProductId: null as number | null,
    currentUser: null as string | null,
        currentUserData: null as any,
    defaultProducts: [] as Product[],
    products: [] as Product[],
    allProducts: [] as Product[],
    useDB: false,
    pageCache: {} as { [key: number]: PageCacheEntry },
    imageCache: {} as { [key: string]: string },
    totalItems: 0,
    currentPage: 1,
    itemsPerPage: 10,
    hiddenProductIds: new Set<number>(),
    currentFilter: 'All',
    currentLang: localStorage.getItem('cactusLang') || 'en',
    MAX_IMG_CACHE: calculateMaxImgCache()
};

console.log(`Max Image Cache Size: ${state.MAX_IMG_CACHE} images`);



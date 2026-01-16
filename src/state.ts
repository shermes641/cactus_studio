import { Product, PageCacheEntry, Discount } from './types.js';
import { calculateMaxImgCache } from './utils.js';
import { PLANT_CLASSES } from './constants.js';

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
    searchQuery: '',
    currentLang: localStorage.getItem('cactusLang') || 'en',
    MAX_IMG_CACHE: calculateMaxImgCache(),
    pendingUploadFile: null as File | null,
    plantClasses: ['All', ...PLANT_CLASSES],
    activeDiscount: null as Discount | null,
};

console.log(`Max Image Cache Size: ${state.MAX_IMG_CACHE} images`);

import api from '../axios';

let filenameToCategory = null;
let loadPromise = null;

function normalizeCategory(category) {
    const map = {
        standard: 'standard',
        common: 'standard',
        rare: 'rare',
        special: 'special',
        epic: 'epic',
        legendary: 'legendary'
    };
    const key = String(category || '').toLowerCase();
    return map[key] || 'standard';
}

async function ensureLoaded() {
    if (filenameToCategory) return filenameToCategory;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        try {
            const res = await api.get('/api/users/preloaded-avatars');
            const list = (res.data && res.data.avatars) || [];
            const map = {};
            for (const it of list) {
                map[it.filename] = normalizeCategory(it.category);
            }
            filenameToCategory = map;
            return filenameToCategory;
        } catch (e) {
            filenameToCategory = {};
            return filenameToCategory;
        } finally {
            loadPromise = null;
        }
    })();
    return loadPromise;
}

function extractPreloadedFilename(avatarUrl) {
    if (!avatarUrl) return null;
    try {
        const url = avatarUrl.startsWith('http') ? new URL(avatarUrl) : { pathname: avatarUrl };
        const p = url.pathname || '';
        if (!p.startsWith('/uploads/avatars/preloaded/')) return null;
        const parts = p.split('/');
        return parts[parts.length - 1] || null;
    } catch (_) {
        return null;
    }
}

export function getAvatarCategoryByUrl(avatarUrl) {
    if (!filenameToCategory) {
        // fire and forget
        void ensureLoaded();
        return null;
    }
    const filename = extractPreloadedFilename(avatarUrl);
    if (!filename) return null;
    return filenameToCategory[filename] || 'standard';
}

export function getAvatarCategoryClass(avatarUrl) {
    const cat = getAvatarCategoryByUrl(avatarUrl);
    return cat ? `avatar-cat-${cat}` : '';
}

export async function preloadAvatarCategories() {
    await ensureLoaded();
}

export function __resetAvatarCategoryCacheForTests() {
    filenameToCategory = null;
    loadPromise = null;
}



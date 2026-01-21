export const genSku = (productClass: any, id: any,) => { 
          const cleanClass = (productClass || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
             //const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
             const sku = `${cleanClass}-${id}`;
             return sku
        }
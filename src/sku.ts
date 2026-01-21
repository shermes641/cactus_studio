export const genSku = (productClass: any, name: any, id: any) => {
  const cleanClass = (productClass || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  const cleanName = (name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
  return `${id}-${cleanClass}-${cleanName}`;
}
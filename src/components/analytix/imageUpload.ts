/**
 * Redimensiona uma imagem no navegador (máx. 128px) e devolve um data URL leve
 * (webp com fallback png). Mesmo padrão do cadastro de bookmakers do admin.
 */
export const processImage = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = document.createElement('img');
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const MAX = 128;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        else if (height >= width && height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const webp = canvas.toDataURL('image/webp', 0.9);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

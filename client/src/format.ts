export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-AR')}`;

export const CATEGORY_LABEL: Record<string, string> = { bebida: 'Bebidas', pasteleria: 'Pastelería', sandwich: 'Salado' };

// Emojis: solo se usan en las tarjetas del menú y en el logo.
const EMOJI: Record<string, string> = {
  Espresso: '☕', Cortado: '🥃', Latte: '🥛', Capuchino: '☁️', Té: '🍵',
  Medialuna: '🥐', Brownie: '🍫', Cheesecake: '🍰', Tostado: '🥪',
};
const CATEGORY_EMOJI: Record<string, string> = { bebida: '☕', pasteleria: '🥐', sandwich: '🥪' };
export const emojiFor = (name: string, category: string) => EMOJI[name] ?? CATEGORY_EMOJI[category] ?? '🍽️';

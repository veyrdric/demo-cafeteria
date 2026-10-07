// Carga el menú inicial. Es idempotente: solo inserta si la tabla de productos está vacía.
import { prisma } from '../src/core/prisma';

const MENU = [
  { name: 'Espresso', category: 'bebida', price: 2500 },
  { name: 'Cortado', category: 'bebida', price: 2800 },
  { name: 'Latte', category: 'bebida', price: 3500 },
  { name: 'Capuchino', category: 'bebida', price: 3600 },
  { name: 'Té', category: 'bebida', price: 2200 },
  { name: 'Medialuna', category: 'pasteleria', price: 1200 },
  { name: 'Brownie', category: 'pasteleria', price: 3000 },
  { name: 'Cheesecake', category: 'pasteleria', price: 4800 },
  { name: 'Tostado', category: 'sandwich', price: 4200 },
] as const;

if ((await prisma.product.count()) === 0) {
  await prisma.product.createMany({ data: [...MENU] });
  console.log(`Seed: ${MENU.length} productos cargados`);
} else {
  console.log('Seed: el menú ya existe, no se modifica');
}
await prisma.$disconnect();

import * as presentation from './ui/seed.mjs';
import { lifecycle } from './local.mjs';
export function createSeed() {
 return { product: presentation.product.name, features: presentation.features, setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs', theme: 'public/rer-theme.css', ...lifecycle };
}

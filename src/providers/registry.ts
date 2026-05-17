import type { ProviderId } from '../schema/entry.js';
import { ConjugareProvider } from './conjugare/index.js';
import { DexonlineProvider } from './dexonline/index.js';
import { DlrProvider } from './dlr/index.js';
import { DoomProvider } from './doom/index.js';
import { ForvoProvider } from './forvo/index.js';
import { MdexProvider } from './mdex/index.js';
import { PluralRoProvider } from './pluralro/index.js';
import type { Provider } from './types.js';
import { WiktionaryProvider } from './wiktionary/index.js';

let registry: Map<ProviderId, Provider> | undefined;

export function getRegistry(): Map<ProviderId, Provider> {
  if (registry) return registry;
  registry = new Map<ProviderId, Provider>();
  for (const p of [
    new DoomProvider(),
    new DexonlineProvider(),
    new MdexProvider(),
    new WiktionaryProvider(),
    new ForvoProvider(),
    new DlrProvider(),
    new ConjugareProvider(),
    new PluralRoProvider(),
  ]) {
    registry.set(p.meta.id, p);
  }
  return registry;
}

export function listProviders(): Provider[] {
  return Array.from(getRegistry().values());
}

export function getProvider(id: ProviderId): Provider | undefined {
  return getRegistry().get(id);
}

export function resetRegistryForTests(): void {
  registry = undefined;
}

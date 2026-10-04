import type { JobSourceInfo } from '@applyai/shared/types';
import { env } from '../env';
import { normalizeLocation } from './normalize';
import {
  createArbeitnowProvider,
  createRemoteOkProvider,
  createRemotiveProvider,
} from './providers/aggregators';
import { createAshbyProvider } from './providers/ashby';
import { createGreenhouseProvider } from './providers/greenhouse';
import { createLeverProvider } from './providers/lever';
import type { JobProvider } from './types';

export interface DiscoveryConfig {
  greenhouseBoards: string[];
  leverCompanies: string[];
  ashbyBoards: string[];
  disabledSources: string[];
}

export function defaultDiscoveryConfig(): DiscoveryConfig {
  return {
    greenhouseBoards: env.discovery.greenhouseBoards,
    leverCompanies: env.discovery.leverCompanies,
    ashbyBoards: env.discovery.ashbyBoards,
    disabledSources: env.discovery.disabledSources,
  };
}

export function buildProviders(config: DiscoveryConfig = defaultDiscoveryConfig()): JobProvider[] {
  const providers: JobProvider[] = [
    createGreenhouseProvider({ boards: config.greenhouseBoards }),
    createLeverProvider({ companies: config.leverCompanies }),
    createAshbyProvider({ boards: config.ashbyBoards }),
    createRemotiveProvider(),
    createRemoteOkProvider(),
    createArbeitnowProvider(),
  ];
  const disabled = new Set(config.disabledSources.map((source) => source.toLowerCase()));
  return providers.filter((provider) => !disabled.has(provider.id));
}

export function listSources(config: DiscoveryConfig = defaultDiscoveryConfig()): JobSourceInfo[] {
  return buildProviders(config).map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    kind: provider.kind,
    configured: provider.isConfigured(),
    boardCount: provider.boardCount,
  }));
}

export { normalizeLocation };

import { Injectable, signal } from '@angular/core';
import { copMoney } from '../../model/cop-money';

import { PRICING_CATALOG_FIXTURES } from '../data/pricing-catalog.mock';
import {
  CreateProcedurePriceRequest,
  ProcedurePrice,
  ProcedurePriceStatus,
} from '../model/procedure-price.model';

@Injectable({
  providedIn: 'root',
})
export class PricingCatalogService {
  // Application-scoped fictional state; never persistent owner records.
  readonly demoPrices = signal(this.getFixtures());
  private mockSequence = 0;

  getFixtures(): ProcedurePrice[] {
    return PRICING_CATALOG_FIXTURES.map((price) => ({ ...price }));
  }

  normalizeCode(procedureCode: string): string {
    return procedureCode.trim().toUpperCase();
  }

  hasProcedure(prices: ProcedurePrice[], procedureCode: string): boolean {
    const code = this.normalizeCode(procedureCode);
    return prices.some((price) => price.procedureCode === code);
  }

  /** Registers a procedure that does not exist yet as its first price version. */
  createProcedure(
    currentPrices: ProcedurePrice[],
    request: CreateProcedurePriceRequest,
  ): ProcedurePrice[] {
    if (this.hasProcedure(currentPrices, request.procedureCode)) {
      throw new Error('Procedure code already exists');
    }
    return [
      this.buildPrice(this.normalizeCode(request.procedureCode), request.procedureName.trim(), request, 1),
      ...currentPrices,
    ];
  }

  /** Adds a dated price version to an existing procedure, closing the previous validity. */
  createNewVersion(
    currentPrices: ProcedurePrice[],
    request: CreateProcedurePriceRequest,
  ): ProcedurePrice[] {
    const code = this.normalizeCode(request.procedureCode);
    const latest = this.latestVersion(currentPrices, code);
    if (!latest) throw new Error('Unknown procedure code');
    if (request.validFrom < this.minVersionDate(currentPrices, code)) {
      throw new Error('Version validity overlaps the latest version');
    }

    const closedPrices = currentPrices.map((price) =>
      price.id === latest.id
        ? { ...price, validTo: addDays(request.validFrom, -1) }
        : price,
    );

    return [
      this.buildPrice(code, latest.procedureName, request, latest.version + 1),
      ...closedPrices,
    ];
  }

  latestVersion(prices: ProcedurePrice[], procedureCode: string): ProcedurePrice | undefined {
    const code = this.normalizeCode(procedureCode);
    return prices
      .filter((price) => price.procedureCode === code)
      .reduce<ProcedurePrice | undefined>(
        (latest, price) => (!latest || price.version > latest.version ? price : latest),
        undefined,
      );
  }

  /** Earliest start date that does not overlap the latest version. */
  minVersionDate(prices: ProcedurePrice[], procedureCode: string): string {
    const latest = this.latestVersion(prices, procedureCode);
    return latest ? addDays(latest.validFrom, 1) : '';
  }

  priceStatus(price: ProcedurePrice, today: string): ProcedurePriceStatus {
    if (price.validFrom > today) return 'SCHEDULED';
    if (price.validTo !== null && price.validTo < today) return 'HISTORICAL';
    return 'CURRENT';
  }

  filterPrices(
    prices: ProcedurePrice[],
    searchTerm: string,
  ): ProcedurePrice[] {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return prices;
    }

    return prices.filter((price) =>
      price.procedureName.toLowerCase().includes(term) ||
      price.procedureCode.toLowerCase().includes(term),
    );
  }

  private buildPrice(
    procedureCode: string,
    procedureName: string,
    request: CreateProcedurePriceRequest,
    version: number,
  ): ProcedurePrice {
    const amount = copMoney(request.amount);
    if (BigInt(amount.replace('.', '')) <= 0n) throw new Error('Price must be positive');

    return {
      id: `mock-${Date.now()}-${++this.mockSequence}`,
      procedureCode,
      procedureName,
      amount,
      currency: 'COP',
      validFrom: request.validFrom,
      validTo: null,
      version,
    };
  }
}

/** Calendar arithmetic on ISO dates (YYYY-MM-DD) without local time-zone drift. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localIsoDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

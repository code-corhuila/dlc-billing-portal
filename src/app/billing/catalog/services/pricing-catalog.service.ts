import { Injectable, signal } from '@angular/core';
import { copMoney } from '../../model/cop-money';

import { PRICING_CATALOG_FIXTURES } from '../data/pricing-catalog.mock';
import {
  CreateProcedurePriceRequest,
  ProcedurePrice,
} from '../model/procedure-price.model';

@Injectable({
  providedIn: 'root',
})
export class PricingCatalogService {
  // Application-scoped fictional state; never persistent owner records.
  readonly demoPrices = signal(this.getFixtures());
  getFixtures(): ProcedurePrice[] {
    return PRICING_CATALOG_FIXTURES.map((price) => ({ ...price }));
  }

  createNewVersion(
    currentPrices: ProcedurePrice[],
    request: CreateProcedurePriceRequest,
  ): ProcedurePrice[] {
    const amount = copMoney(request.amount);
    if (BigInt(amount.replace('.', '')) <= 0n) throw new Error('Price must be positive');
    const normalizedCode = request.procedureCode.trim();
    const normalizedName = request.procedureName.trim();

    const latestVersion = this.getLatestVersion(
      currentPrices,
      normalizedCode,
    );

    const historicalPrices = this.deactivateCurrentVersion(
      currentPrices,
      normalizedCode,
    );

    const newPrice: ProcedurePrice = {
      id: this.generateMockId(),
      procedureCode: normalizedCode,
      procedureName: normalizedName,
      amount,
      currency: 'COP',
      validFrom: request.validFrom,
      version: latestVersion + 1,
      active: true,
    };

    return [
      newPrice,
      ...historicalPrices,
    ];
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

  private getLatestVersion(
    prices: ProcedurePrice[],
    procedureCode: string,
  ): number {
    return prices
      .filter((price) => price.procedureCode === procedureCode)
      .reduce(
        (latest, price) => Math.max(latest, price.version),
        0,
      );
  }

  private deactivateCurrentVersion(
    prices: ProcedurePrice[],
    procedureCode: string,
  ): ProcedurePrice[] {
    return prices.map((price) => {
      if (
        price.procedureCode === procedureCode &&
        price.active
      ) {
        return {
          ...price,
          active: false,
        };
      }

      return price;
    });
  }

  private generateMockId(): string {
    return `mock-${Date.now()}`;
  }
}

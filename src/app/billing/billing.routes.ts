import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'prices',
    pathMatch: 'full',
  },
  {
    path: 'prices',
    loadComponent: () =>
      import(
        './catalog/pages/pricing-catalog/pricing-catalog.component'
      ).then(
        (m) => m.PricingCatalogComponent,
      ),
  },
  {
    path: 'prices/rules',
    loadComponent: () =>
      import(
        './catalog/pages/extra-charge-rules/extra-charge-rules.component'
      ).then(
        (m) => m.ExtraChargeRulesComponent,
      ),
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import(
        './pages/billing-page.component'
      ).then(
        (m) => m.BillingPageComponent,
      ),
  },
];

export default BILLING_ROUTES;
import type { TableBuildType } from '../data/buildYourOwnTableData';
import type { PresetConfig } from '../data/bowlConfigurations';
import type { DraftCartLine } from '../data/cartDraft';

export interface AuthRedirectState {
  from?: string;
}

export interface ResetPasswordLocationState {
  resetToken?: string;
}

export interface HomeScrollLocationState {
  scrollTo?: string;
  scrollOffset?: number;
}

export interface HomeOrderLaunchState {
  openOrder?: boolean;
  categorySlug?: string;
  reorderCartLines?: DraftCartLine[];
  reorderSourceOrderId?: string;
}

export interface OrdersSuccessLocationState {
  orderPlaced?: boolean;
  orderId?: string;
  fulfillmentWindow?: string;
  orderType?: 'pickup' | 'walk-in';
}

export interface OrderPageLocationState {
  categorySlug?: string;
  openCustomize?: boolean;
  presetConfig?: PresetConfig;
  tableOrder?: boolean;
  buildType?: TableBuildType;
  reorderCartLines?: DraftCartLine[];
  reorderSourceOrderId?: string;
}

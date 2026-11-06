/**
 * Broker Execution Adapter Interface & Implementations
 */
import { TradePlan } from '../bz/trade-plan.js';

export interface BrokerOrderResult {
  orderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  sl: number;
  tp: number;
  status: 'FILLED' | 'REJECTED' | 'SIMULATED';
  message: string;
}

export interface BrokerAdapter {
  name: string;
  connect(): Promise<boolean>;
  executeOrder(
    symbol: string,
    action: 'BUY' | 'SELL',
    plan: TradePlan,
    lots: number
  ): Promise<BrokerOrderResult>;
}

export class PaperBrokerAdapter implements BrokerAdapter {
  name = 'Simulateur Interne BZ (Paper)';

  async connect(): Promise<boolean> {
    return true;
  }

  async executeOrder(
    symbol: string,
    action: 'BUY' | 'SELL',
    plan: TradePlan,
    lots: number
  ): Promise<BrokerOrderResult> {
    return {
      orderId: 'SIM_' + Math.floor(Math.random() * 1000000),
      symbol,
      action,
      lots,
      openPrice: plan.entryA,
      sl: plan.sl,
      tp: plan.tp1,
      status: 'SIMULATED',
      message: 'Ordre de simulation démo exécuté avec succès'
    };
  }
}

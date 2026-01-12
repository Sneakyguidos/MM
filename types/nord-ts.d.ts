declare module '@n1xyz/nord-ts' {
  export enum Side {
    Bid = 0,
    Ask = 1,
  }

  export enum FillMode {
    Limit = 0,
    Market = 1,
    ImmediateOrCancel = 2,
    FillOrKill = 3,
  }

  export interface Balance {
    mint: string;
    amount: number;
    availableAmount: number;
  }

  export interface Position {
    marketId: number;
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
  }

  export interface Order {
    orderId: string;
    marketId: number;
    side: Side;
    price: number;
    size: number;
    fillMode: FillMode;
    isReduceOnly: boolean;
    timestamp: number;
  }

  export interface OrderbookLevel {
    price: number;
    size: number;
  }

  export interface Orderbook {
    marketId: number;
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    timestamp: number;
  }

  export interface Market {
    marketId: number;
    symbol: string;
    baseToken: string;
    quoteToken: string;
    tickSize: number;
    minSize: number;
    maxLeverage: number;
  }

  export interface PlaceOrderParams {
    marketId: number;
    side: Side;
    fillMode: FillMode;
    isReduceOnly: boolean;
    size: number;
    price?: number;
  }

  export class Nord {
    constructor(config: { rpcEndpoint: string; webServerUrl: string });
    
    getAllMarkets(): Promise<Market[]>;
    subscribeOrderbook(marketId: number): Promise<void>;
    unsubscribeOrderbook(marketId: number): Promise<void>;
    onOrderbookUpdate(callback: (orderbook: Orderbook) => void): void;
  }

  export class NordUser {
    balances: Record<number, Balance>;
    positions: Record<number, Position>;
    orders: Record<string, Order>;

    static fromPrivateKey(nord: Nord, privateKey: string): NordUser;
    
    updateAccountId(): Promise<void>;
    fetchInfo(): Promise<void>;
    getLeverage(): Promise<number>;
    
    placeOrder(params: PlaceOrderParams): Promise<string>;
    cancelOrder(orderId: string): Promise<void>;
    cancelAllOrders(marketId?: number): Promise<void>;
  }
}
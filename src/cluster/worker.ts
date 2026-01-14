import dotenv from 'dotenv';
import bs58 from 'bs58';
import { Nord, NordUser } from '@n1xyz/nord-ts';
import { MarketMakerLive } from '../live/mmLive';
import { logger } from '../logger';

dotenv.config();

/**
 * Worker process for handling a subset of markets
 * Run by ProcessManager in cluster mode
 */
class Worker {
  private workerId: number;
  private markets: number[];
  private marketMaker: MarketMakerLive | null = null;

  constructor() {
    this.workerId = parseInt(process.env.WORKER_ID || '0');
    this.markets = JSON.parse(process.env.MARKETS || '[]');

    logger.info('Worker initialized', {
      workerId: this.workerId,
      markets: this.markets,
      pid: process.pid,
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    try {
      logger.info('Worker starting', { workerId: this.workerId });

      // Get credentials
      const privateKeyBase58 = process.env.PRIVATE_KEY_BASE58;
      const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
      const webServerUrl = process.env.WEB_SERVER_URL || 'wss://trade.01.xyz';

      if (!privateKeyBase58) {
        throw new Error('PRIVATE_KEY_BASE58 not set');
      }

      // Initialize Nord
      const nord = new Nord({
        rpcEndpoint,
        webServerUrl,
      });

      // Create user
      const user = NordUser.fromPrivateKey(nord, privateKeyBase58);
      await user.updateAccountId();
      await user.fetchInfo();

      logger.info('Worker user initialized', {
        workerId: this.workerId,
        balance: user.balances[0]?.amount || 0,
      });

      // Create market maker
      this.marketMaker = new MarketMakerLive(nord, user);

      // Start trading on assigned markets
      await this.startMarketMaking();

      // Send ready message to parent
      this.sendMessage({
        type: 'status',
        status: 'running',
        markets: this.markets,
      });

      // Setup periodic status updates
      this.setupStatusReporting();

    } catch (error) {
      logger.error('Worker failed to start', {
        workerId: this.workerId,
        error: (error as Error).message,
      });

      this.sendMessage({
        type: 'error',
        error: (error as Error).message,
      });

      process.exit(1);
    }
  }

  /**
   * Start market making on assigned markets
   */
  private async startMarketMaking(): Promise<void> {
    if (!this.marketMaker) {
      throw new Error('Market maker not initialized');
    }

    // Start on each assigned market sequentially
    for (const marketId of this.markets) {
      logger.info('Worker starting market', {
        workerId: this.workerId,
        marketId,
      });

      try {
        await this.marketMaker.start(marketId);
      } catch (error) {
        logger.error('Failed to start market', {
          workerId: this.workerId,
          marketId,
          error,
        });
      }
    }

    logger.info('Worker market making started', {
      workerId: this.workerId,
      markets: this.markets,
    });
  }

  /**
   * Setup periodic status reporting to parent
   */
  private setupStatusReporting(): void {
    setInterval(() => {
      if (this.marketMaker) {
        this.marketMaker.getStatus().then(status => {
          this.sendMessage({
            type: 'metrics',
            metrics: {
              workerId: this.workerId,
              ...status,
            },
          });
        }).catch(error => {
          logger.error('Failed to get status', {
            workerId: this.workerId,
            error,
          });
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Send message to parent process
   */
  private sendMessage(message: any): void {
    if (process.send) {
      process.send(message);
    }
  }

  /**
   * Handle messages from parent
   */
  private setupMessageHandler(): void {
    process.on('message', async (msg: any) => {
      logger.debug('Worker received message', {
        workerId: this.workerId,
        msg,
      });

      if (msg.type === 'shutdown') {
        await this.shutdown();
      }

      if (msg.type === 'status_request') {
        const status = await this.marketMaker?.getStatus();
        this.sendMessage({
          type: 'status',
          status,
        });
      }
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    logger.info('Worker shutting down', { workerId: this.workerId });

    try {
      if (this.marketMaker) {
        await this.marketMaker.stop();
      }

      this.sendMessage({
        type: 'status',
        status: 'stopped',
      });

      logger.info('Worker shutdown complete', { workerId: this.workerId });
      
      process.exit(0);
    } catch (error) {
      logger.error('Worker shutdown error', {
        workerId: this.workerId,
        error,
      });
      
      process.exit(1);
    }
  }

  /**
   * Setup signal handlers
   */
  private setupSignalHandlers(): void {
    process.on('SIGINT', async () => {
      logger.info('Worker received SIGINT', { workerId: this.workerId });
      await this.shutdown();
    });

    process.on('SIGTERM', async () => {
      logger.info('Worker received SIGTERM', { workerId: this.workerId });
      await this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      logger.error('Worker uncaught exception', {
        workerId: this.workerId,
        error: error.message,
        stack: error.stack,
      });

      this.sendMessage({
        type: 'error',
        error: error.message,
      });

      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Worker unhandled rejection', {
        workerId: this.workerId,
        reason,
      });

      this.sendMessage({
        type: 'error',
        error: String(reason),
      });

      process.exit(1);
    });
  }
}

// Start worker if running as child process
if (process.env.IS_WORKER === 'true') {
  const worker = new Worker();
  
  worker['setupSignalHandlers']();
  worker['setupMessageHandler']();
  
  worker.start().catch(error => {
    logger.error('Worker startup failed', { error });
    process.exit(1);
  });
}
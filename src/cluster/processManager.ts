import { fork, ChildProcess } from 'child_process';
import { CONFIG } from '../config';
import { logger } from '../logger';

interface WorkerInfo {
  process: ChildProcess;
  markets: number[];
  startTime: number;
  restarts: number;
}

export class ProcessManager {
  private workers: Map<number, WorkerInfo> = new Map();
  private isShuttingDown: boolean = false;

  /**
   * Start cluster of workers, each handling a group of markets
   */
  async startCluster(): Promise<void> {
    if (!CONFIG.cluster.enabled) {
      logger.info('Multi-process clustering disabled');
      return;
    }

    if (CONFIG.cluster.processGroups.length === 0) {
      logger.warn('No process groups configured');
      return;
    }

    logger.info('Starting market maker cluster', {
      workers: CONFIG.cluster.processGroups.length,
      groups: CONFIG.cluster.processGroups,
      maxRestarts: CONFIG.cluster.maxRestarts,
    });

    for (const [index, markets] of CONFIG.cluster.processGroups.entries()) {
      await this.startWorker(index, markets);
      
      // Small delay between worker starts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('All workers started successfully');
  }

  /**
   * Start a single worker process
   */
  private async startWorker(workerId: number, markets: number[]): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    logger.info('Starting worker', { workerId, markets });

    const workerProcess = fork('./dist/cluster/worker.js', [], {
      env: {
        ...process.env,
        WORKER_ID: String(workerId),
        MARKETS: JSON.stringify(markets),
        IS_WORKER: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    const workerInfo: WorkerInfo = {
      process: workerProcess,
      markets,
      startTime: Date.now(),
      restarts: 0,
    };

    // Setup event handlers
    this.setupWorkerHandlers(workerId, workerInfo);

    this.workers.set(workerId, workerInfo);

    logger.info('Worker started', { 
      workerId, 
      pid: workerProcess.pid,
      markets,
    });
  }

  /**
   * Setup event handlers for a worker
   */
  private setupWorkerHandlers(workerId: number, workerInfo: WorkerInfo): void {
    const { process: workerProcess } = workerInfo;

    // Handle messages from worker
    workerProcess.on('message', (msg: any) => {
      if (msg.type === 'status') {
        logger.info('Worker status', { 
          workerId, 
          status: msg.status,
          markets: msg.markets,
        });
      }

      if (msg.type === 'error') {
        logger.error('Worker error', { 
          workerId, 
          error: msg.error,
        });
      }

      if (msg.type === 'metrics') {
        logger.debug('Worker metrics', { 
          workerId, 
          metrics: msg.metrics,
        });
      }
    });

    // Handle worker errors
    workerProcess.on('error', (error) => {
      logger.error('Worker process error', { 
        workerId, 
        error: error.message,
        stack: error.stack,
      });
    });

    // Handle worker exit
    workerProcess.on('exit', (code, signal) => {
      logger.warn('Worker exited', { 
        workerId, 
        code, 
        signal,
        uptime: Date.now() - workerInfo.startTime,
      });

      // Remove from workers map
      this.workers.delete(workerId);

      // Attempt restart if not shutting down
      if (!this.isShuttingDown && code !== 0) {
        this.scheduleWorkerRestart(workerId, workerInfo.markets, workerInfo.restarts);
      }
    });

    // Forward stdout/stderr
    if (workerProcess.stdout) {
      workerProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          logger.debug(`Worker ${workerId} stdout: ${output}`);
        }
      });
    }

    if (workerProcess.stderr) {
      workerProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          logger.error(`Worker ${workerId} stderr: ${output}`);
        }
      });
    }
  }

  /**
   * Schedule worker restart after delay
   */
  private scheduleWorkerRestart(workerId: number, markets: number[], currentRestarts: number): void {
    const restarts = currentRestarts + 1;
    
    if (restarts > CONFIG.cluster.maxRestarts) {
      logger.error('Worker exceeded max restarts, not restarting', { 
        workerId,
        restarts,
        maxRestarts: CONFIG.cluster.maxRestarts,
      });
      return;
    }

    const delay = CONFIG.cluster.workerRestartDelay;
    
    logger.info('Scheduling worker restart', { 
      workerId, 
      markets,
      delay,
      attempt: restarts,
    });

    setTimeout(() => {
      this.startWorker(workerId, markets);
    }, delay);
  }

  /**
   * Send message to specific worker
   */
  sendToWorker(workerId: number, message: any): boolean {
    const worker = this.workers.get(workerId);
    
    if (!worker || !worker.process.connected) {
      logger.warn('Cannot send to worker', { workerId });
      return false;
    }

    worker.process.send(message);
    return true;
  }

  /**
   * Broadcast message to all workers
   */
  broadcast(message: any): void {
    for (const [workerId, worker] of this.workers) {
      if (worker.process.connected) {
        worker.process.send(message);
      }
    }
  }

  /**
   * Get worker status
   */
  getWorkerStatus(workerId: number): any {
    const worker = this.workers.get(workerId);
    
    if (!worker) {
      return null;
    }

    return {
      workerId,
      pid: worker.process.pid,
      markets: worker.markets,
      uptime: Date.now() - worker.startTime,
      restarts: worker.restarts,
      connected: worker.process.connected,
    };
  }

  /**
   * Get status of all workers
   */
  getAllWorkersStatus(): any[] {
    const statuses = [];
    
    for (const [workerId] of this.workers) {
      const status = this.getWorkerStatus(workerId);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Graceful shutdown of all workers
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    logger.info('Shutting down all workers', { 
      count: this.workers.size,
    });

    // Send shutdown signal to all workers
    this.broadcast({ type: 'shutdown' });

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Force kill any remaining workers
    for (const [workerId, worker] of this.workers) {
      if (worker.process.connected) {
        logger.warn('Force killing worker', { workerId });
        worker.process.kill('SIGKILL');
      }
    }

    this.workers.clear();
    
    logger.info('All workers shut down');
  }

  /**
   * Restart specific worker
   */
  async restartWorker(workerId: number): Promise<void> {
    const worker = this.workers.get(workerId);
    
    if (!worker) {
      logger.warn('Worker not found', { workerId });
      return;
    }

    logger.info('Restarting worker', { workerId });

    const markets = worker.markets;
    
    // Kill existing worker
    worker.process.kill('SIGTERM');
    this.workers.delete(workerId);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start new worker
    await this.startWorker(workerId, markets);
  }

  /**
   * Restart all workers (rolling restart)
   */
  async restartAll(): Promise<void> {
    logger.info('Performing rolling restart of all workers');

    const workerIds = Array.from(this.workers.keys());

    for (const workerId of workerIds) {
      await this.restartWorker(workerId);
      
      // Wait between restarts to avoid downtime
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    logger.info('Rolling restart completed');
  }
}
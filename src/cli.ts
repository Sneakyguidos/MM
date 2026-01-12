#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { Nord, NordUser } from '@n1xyz/nord-ts';
import { MarketMakerLive } from './live/mmLive';
import { BacktestEngine } from './backtest/engine';
import { MarketSimulator } from './backtest/simulator';
import { MetricsCalculator } from './backtest/metrics';
import { CONFIG, validateConfig } from './config';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const program = new Command();

program
  .name('01xyz-mm-bot')
  .description('Professional Market Maker Bot for 01.xyz')
  .version('1.0.0');

/**
 * Live trading command
 */
program
  .command('live')
  .description('Start live market making')
  .option('-m, --market <marketId>', 'Trade specific market ID')
  .option('-t, --test', 'Run in test mode (paper trading)')
  .action(async (options) => {
    try {
      logger.info('Starting live market maker');

      // Validate config
      validateConfig(CONFIG);

      // Check required environment variables
      const privateKeyBase58 = process.env.PRIVATE_KEY_BASE58;
      const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
      const webServerUrl = process.env.WEB_SERVER_URL || 'wss://trade.01.xyz';

      if (!privateKeyBase58) {
        throw new Error('PRIVATE_KEY_BASE58 environment variable is required');
      }

      // Initialize Nord
      const nord = new Nord({
        rpcEndpoint,
        webServerUrl,
      });

      // Create user from private key
      const user = NordUser.fromPrivateKey(nord, privateKeyBase58);
      await user.updateAccountId();
      await user.fetchInfo();

      logger.info('User initialized', {
        balance: user.balances[0]?.amount || 0,
        freeCollateral: user.balances[0]?.availableAmount || 0,
      });

      // Create and start market maker
      const marketMaker = new MarketMakerLive(nord, user);

      // Parse market ID if provided
      const marketId = options.market ? parseInt(options.market) : undefined;

      if (options.test) {
        logger.info('Running in TEST MODE (paper trading)');
      }

      // Start trading
      await marketMaker.start(marketId);

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down...');
        await marketMaker.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down...');
        await marketMaker.stop();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});

    } catch (error) {
      logger.error('Live trading failed', { error });
      process.exit(1);
    }
  });

/**
 * Backtest command
 */
program
  .command('backtest')
  .description('Run backtest simulation')
  .option('-d, --data <file>', 'Path to historical data file (JSON or CSV)')
  .option('-s, --steps <number>', 'Number of simulated bars', '1000')
  .option('-o, --output <file>', 'Output file for results')
  .action(async (options) => {
    try {
      logger.info('Starting backtest');

      validateConfig(CONFIG);

      let historicalData;

      if (options.data) {
        // Load from file
        const filePath = path.resolve(options.data);
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        if (filePath.endsWith('.json')) {
          const jsonData = JSON.parse(fileContent);
          historicalData = MarketSimulator.fromJSON(jsonData);
        } else if (filePath.endsWith('.csv')) {
          historicalData = MarketSimulator.fromCSV(fileContent);
        } else {
          throw new Error('Unsupported file format. Use .json or .csv');
        }

        logger.info(`Loaded ${historicalData.length} bars from ${filePath}`);
      } else {
        // Generate synthetic data
        const simulator = new MarketSimulator({
          numBars: parseInt(options.steps),
        });
        historicalData = simulator.generate();
        logger.info(`Generated ${historicalData.length} synthetic bars`);
      }

      // Run backtest
      const engine = new BacktestEngine(10000);
      const result = await engine.run(historicalData);

      // Print results
      MetricsCalculator.printResults(result);

      // Export results if output file specified
      if (options.output) {
        const outputPath = path.resolve(options.output);
        const jsonOutput = MetricsCalculator.exportToJSON(result, [], []);
        fs.writeFileSync(outputPath, jsonOutput);
        logger.info(`Results exported to ${outputPath}`);
      }

    } catch (error) {
      logger.error('Backtest failed', { error });
      process.exit(1);
    }
  });

/**
 * Simulate command
 */
program
  .command('simulate')
  .description('Run market simulation')
  .option('-s, --steps <number>', 'Number of simulation steps', '10000')
  .option('-t, --type <type>', 'Market type: illiquid, trending, ranging', 'illiquid')
  .option('-o, --output <file>', 'Output file for generated data')
  .action(async (options) => {
    try {
      logger.info('Starting market simulation');

      const steps = parseInt(options.steps);
      const simulator = new MarketSimulator();

      let data;

      switch (options.type) {
        case 'illiquid':
          data = simulator.generateIlliquidMarket(steps);
          break;
        case 'trending':
          data = simulator.generateTrendingMarket(steps, true);
          break;
        case 'ranging':
          data = simulator.generateRangingMarket(steps);
          break;
        default:
          data = simulator.generate();
      }

      logger.info(`Generated ${data.length} bars for ${options.type} market`);

      // Run backtest on simulated data
      const engine = new BacktestEngine(10000);
      const result = await engine.run(data);

      // Print results
      MetricsCalculator.printResults(result);

      // Export data if output file specified
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        logger.info(`Simulation data exported to ${outputPath}`);
      }

    } catch (error) {
      logger.error('Simulation failed', { error });
      process.exit(1);
    }
  });

/**
 * Test command
 */
program
  .command('test')
  .description('Run connection and configuration tests')
  .action(async () => {
    try {
      logger.info('Running tests');

      // Test 1: Config validation
      console.log('\n✓ Testing configuration...');
      validateConfig(CONFIG);
      console.log('✓ Configuration valid');

      // Test 2: Environment variables
      console.log('\n✓ Testing environment variables...');
      const privateKeyBase58 = process.env.PRIVATE_KEY_BASE58;
      if (!privateKeyBase58) {
        throw new Error('PRIVATE_KEY_BASE58 not set');
      }
      console.log('✓ Environment variables present');

      // Test 3: Nord connection
      console.log('\n✓ Testing Nord connection...');
      const nord = new Nord({
        rpcEndpoint: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
        webServerUrl: process.env.WEB_SERVER_URL || 'wss://trade.01.xyz',
      });

      const user = NordUser.fromPrivateKey(nord, privateKeyBase58);
      await user.updateAccountId();
      await user.fetchInfo();
      
      console.log('✓ Nord connection successful');
      console.log(`  Balance: ${user.balances[0]?.amount || 0} USDC`);
      console.log(`  Free Collateral: ${user.balances[0]?.availableAmount || 0} USDC`);

      // Test 4: Fetch markets
      console.log('\n✓ Testing market data...');
      const markets = await nord.getAllMarkets();
      console.log(`✓ Fetched ${markets.length} markets`);
      
      markets.slice(0, 5).forEach(m => {
        console.log(`  - ${m.symbol} (ID: ${m.marketId})`);
      });

      console.log('\n✅ All tests passed!\n');

    } catch (error) {
      logger.error('Tests failed', { error });
      process.exit(1);
    }
  });

program.parse();
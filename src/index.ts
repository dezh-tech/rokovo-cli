#!/usr/bin/env node

import { RokovoCLI } from "./cli/commands";


async function main(): Promise<void> {
  const cli = new RokovoCLI();
  await cli.run(process.argv);
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

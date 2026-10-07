import { EventEmitter } from 'node:events';

export interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  source: string; // "core" o el nombre del plugin
  message: string;
}

/** Canal interno: registro del Core + avisos para el front (SSE). */
class Bus extends EventEmitter {
  readonly history: LogEntry[] = [];

  log(source: string, message: string, level: LogEntry['level'] = 'info') {
    const entry: LogEntry = { time: new Date().toLocaleTimeString('es-AR'), level, source, message };
    this.history.push(entry);
    if (this.history.length > 100) this.history.shift();
    console.log(`[${entry.time}] [${source}] ${message}`);
    this.emit('log', entry);
  }

  clearHistory() {
    this.history.length = 0;
    this.emit('cleared');
  }

  notify(type: 'orders' | 'plugins') {
    this.emit('event', type);
  }
}

export const bus = new Bus();

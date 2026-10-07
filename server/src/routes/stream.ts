import { Router } from 'express';
import { bus, type LogEntry } from '../core/bus';

/** Tiempo real para el front (Server-Sent Events) y manejo del registro. */
export function streamRouter() {
  const router = Router();

  router.get('/stream', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    send('history', bus.history);
    const onLog = (entry: LogEntry) => send('log', entry);
    const onChange = (type: string) => send('change', type);
    const onCleared = () => send('history', []);
    bus.on('log', onLog).on('event', onChange).on('cleared', onCleared);

    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      bus.off('log', onLog).off('event', onChange).off('cleared', onCleared);
    });
  });

  router.delete('/log', (_req, res) => {
    bus.clearHistory();
    res.json({ ok: true });
  });

  return router;
}

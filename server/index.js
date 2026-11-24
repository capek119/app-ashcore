import express from 'express';
import companiesRouter from './routes/companies.js';
import snapshotsRouter from './routes/snapshots.js';

const app = express();
app.use(express.json({ limit: '25mb' }));

app.use('/api/companies', companiesRouter);
app.use('/api/companies/:id/snapshots', snapshotsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ashcore server listening on http://localhost:${port}`);
});

import express from 'express';
import { statements } from '../db.js';

const router = express.Router({ mergeParams: true });

router.get('/', (req, res) => {
  const companyId = Number(req.params.id);
  res.json(statements.listSnapshots.all(companyId));
});

router.get('/:snapId', (req, res) => {
  const companyId = Number(req.params.id);
  const row = statements.getSnapshot.get(companyId, req.params.snapId);
  if (!row) return res.status(404).json({ error: 'snapshot not found' });
  res.json({ ...row, payload: JSON.parse(row.payload) });
});

router.post('/', (req, res) => {
  const companyId = Number(req.params.id);
  const company = statements.getCompany.get(companyId);
  if (!company) return res.status(404).json({ error: 'company not found' });

  const {
    id,
    periodLabel,
    periodType,
    version,
    createdAt,
    createdBy,
    note,
    previousVersionId,
    snapshotRes,
    snapshotMeta,
    inputsHash,
  } = req.body || {};

  if (!id || !periodLabel || !periodType || !version) {
    return res.status(400).json({ error: 'id, periodLabel, periodType and version are required' });
  }

  const payload = JSON.stringify({ snapshotRes, snapshotMeta, inputsHash });

  statements.insertSnapshot.run(
    id,
    companyId,
    periodLabel,
    periodType,
    version,
    createdAt || new Date().toISOString(),
    createdBy || null,
    note || null,
    previousVersionId || null,
    payload
  );

  res.status(201).json({
    id,
    companyId,
    periodLabel,
    periodType,
    version,
    createdAt,
    createdBy,
    note,
    previousVersionId,
  });
});

router.delete('/:snapId', (req, res) => {
  statements.deleteSnapshot.run(Number(req.params.id), req.params.snapId);
  res.status(204).end();
});

export default router;

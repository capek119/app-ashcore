import express from 'express';
import { statements } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(statements.listCompanies.all());
});

router.post('/', (req, res) => {
  const { name, regNo } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const now = new Date().toISOString();
  const state = JSON.stringify({});
  const info = statements.insertCompany.run(name.trim(), regNo || null, now, now, state);
  const company = statements.getCompany.get(Number(info.lastInsertRowid));
  res.status(201).json({ ...company, state: JSON.parse(company.state) });
});

router.get('/:id', (req, res) => {
  const company = statements.getCompany.get(Number(req.params.id));
  if (!company) return res.status(404).json({ error: 'company not found' });
  res.json({ ...company, state: JSON.parse(company.state) });
});

router.put('/:id/state', (req, res) => {
  const id = Number(req.params.id);
  const existing = statements.getCompany.get(id);
  if (!existing) return res.status(404).json({ error: 'company not found' });

  const state = req.body || {};
  const name = (state.companyName && state.companyName.trim()) || existing.name;
  const regNo = state.companyRegNo || existing.regNo;
  const updatedAt = new Date().toISOString();

  statements.updateCompanyState.run(JSON.stringify(state), updatedAt, name, regNo, id);
  res.json({ updatedAt });
});

router.delete('/:id', (req, res) => {
  statements.deleteCompany.run(Number(req.params.id));
  res.status(204).end();
});

export default router;

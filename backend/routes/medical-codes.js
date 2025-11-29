const express = require('express');
const router = express.Router();
const { searchCodes, ICD10_CODES, CPT_CODES } = require('../data/medical-codes');

// Search medical codes (ICD-10 and CPT)
router.get('/search', (req, res) => {
  try {
    const { query, type } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const results = searchCodes(query, type || 'all');
    res.json(results);
  } catch (error) {
    console.error('Error searching medical codes:', error);
    res.status(500).json({ error: 'Failed to search medical codes' });
  }
});

// Get all ICD-10 codes
router.get('/icd10', (req, res) => {
  try {
    const { limit } = req.query;
    const codes = limit ? ICD10_CODES.slice(0, parseInt(limit)) : ICD10_CODES;
    res.json(codes.map(item => ({ ...item, type: 'ICD-10' })));
  } catch (error) {
    console.error('Error fetching ICD-10 codes:', error);
    res.status(500).json({ error: 'Failed to fetch ICD-10 codes' });
  }
});

// Get all CPT codes
router.get('/cpt', (req, res) => {
  try {
    const { limit } = req.query;
    const codes = limit ? CPT_CODES.slice(0, parseInt(limit)) : CPT_CODES;
    res.json(codes.map(item => ({ ...item, type: 'CPT' })));
  } catch (error) {
    console.error('Error fetching CPT codes:', error);
    res.status(500).json({ error: 'Failed to fetch CPT codes' });
  }
});

// Get code by exact code value
router.get('/code/:code', (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();

    const icdMatch = ICD10_CODES.find(item => item.code === upperCode);
    if (icdMatch) {
      return res.json({ ...icdMatch, type: 'ICD-10' });
    }

    const cptMatch = CPT_CODES.find(item => item.code === upperCode);
    if (cptMatch) {
      return res.json({ ...cptMatch, type: 'CPT' });
    }

    res.status(404).json({ error: 'Code not found' });
  } catch (error) {
    console.error('Error fetching code:', error);
    res.status(500).json({ error: 'Failed to fetch code' });
  }
});

module.exports = router;

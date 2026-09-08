const express = require('express');
const router = express.Router();
const db = require('../db');
const { STAGES, CANCELED, stageIndex, stageInfo } = require('../stages');
const { asyncHandler } = require('../asyncHandler');

router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  return res.redirect('/login');
});

router.get(
  '/acompanhar/:id',
  asyncHandler(async (req, res) => {
    const order = await db.getOrder(req.params.id);
    const settings = await db.getSettings();

    if (!order) {
      return res.status(404).render('track-not-found', { settings });
    }

    const isCanceled = order.status === CANCELED;
    const currentIndex = isCanceled ? -1 : stageIndex(order.status);
    const isFinalStage = order.status === 'pronto';

    const steps = STAGES.map((stage, i) => {
      const historyEntry = order.history.find((h) => h.status === stage.key);
      let state = 'upcoming';
      if (!isCanceled) {
        if (i < currentIndex || (i === currentIndex && isFinalStage)) state = 'done';
        else if (i === currentIndex) state = 'current';
      }
      return {
        ...stage,
        state,
        at: historyEntry ? historyEntry.at : null,
      };
    });

    let daysLeft = null;
    if (order.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(order.deadline + 'T00:00:00');
      daysLeft = Math.round((deadlineDate - today) / (1000 * 60 * 60 * 24));
    }

    res.render('track', {
      order,
      settings,
      steps,
      isCanceled,
      currentStage: isCanceled ? null : stageInfo(order.status),
      daysLeft,
    });
  })
);

module.exports = router;

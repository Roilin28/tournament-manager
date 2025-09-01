import { Router } from 'express';
import { Tournament } from '../models/Tournament';
import { sendToKafka } from '../kafka';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, year } = req.body || {};
    if (!name || !year) {
      return res.status(400).json({ error: 'Faltan campos: name, year' });
    }

    // 1) Guardar en Mongo
    const doc = await Tournament.create({ name, year });

    // 2) Enviar a Kafka
    await sendToKafka('torneo', doc.toObject());

    return res.status(201).json({ ok: true, data: doc });
  } catch (err: any) {
    console.error('Error en /registrar:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

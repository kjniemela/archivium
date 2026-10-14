import { post } from 'axios';
import express from 'express';
import { RECAPTCHA_KEY } from '../config';
import logger from '../logger';
import { render } from '../templates';

export async function verifyReCaptcha(req: express.Request, res: express.Response, next: express.NextFunction) {
  const reCaptchaResponse = req.body && req.body['g-recaptcha-response'];
  const response = await post('https://www.google.com/recaptcha/api/siteverify', null, {
    params: {
      secret: RECAPTCHA_KEY,
      response: reCaptchaResponse,
      remoteip: req.clientIp,
    }
  });
  const score = response.data.success ? response.data.score : 0;
  logger.info(`reCAPTCHA SCORE: ${score}`);
  if (score > 0.5) {
    next();
  } else {
    logger.warn(`Likely bot detected! IP: ${req.clientIp}`);
    if (req.body && req.body.hp) {
      logger.warn('Bot also failed honeypot challenge.');
    }
    res.status(400);
    res.end(await render(req, 'spamblock'));
  }
}

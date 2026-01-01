import { post } from 'axios';
import { ADDR_PREFIX, RECAPTCHA_KEY } from '../config';
import { render } from '../templates';
import { info, warn } from '../logger';

export async function verifyReCaptcha(req, res, next) {
  const reCaptchaResponse = req.body && req.body['g-recaptcha-response'];
  const response = await post('https://www.google.com/recaptcha/api/siteverify', null, {
    params: {
      secret: RECAPTCHA_KEY,
      response: reCaptchaResponse,
      remoteip: req.clientIp,
    }
  });
  const score = response.data.success ? response.data.score : 0;
  info(`reCAPTCHA SCORE: ${score}`);
  if (score > 0.5) {
    next();
  } else {
    warn(`Likely bot detected! IP: ${req.clientIp}`);
    if (req.body && req.body.hp) {
      warn('Bot also failed honeypot challenge.');
    }
    res.status(400);
    res.end(await render(req, 'spamblock'));
  }
}

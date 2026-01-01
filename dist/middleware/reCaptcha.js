"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyReCaptcha = verifyReCaptcha;
const axios_1 = require("axios");
const config_1 = require("../config");
const templates_1 = require("../templates");
const logger_1 = require("../logger");
async function verifyReCaptcha(req, res, next) {
    const reCaptchaResponse = req.body && req.body['g-recaptcha-response'];
    const response = await (0, axios_1.post)('https://www.google.com/recaptcha/api/siteverify', null, {
        params: {
            secret: config_1.RECAPTCHA_KEY,
            response: reCaptchaResponse,
            remoteip: req.clientIp,
        }
    });
    const score = response.data.success ? response.data.score : 0;
    (0, logger_1.info)(`reCAPTCHA SCORE: ${score}`);
    if (score > 0.5) {
        next();
    }
    else {
        (0, logger_1.warn)(`Likely bot detected! IP: ${req.clientIp}`);
        if (req.body && req.body.hp) {
            (0, logger_1.warn)('Bot also failed honeypot challenge.');
        }
        res.status(400);
        res.end(await (0, templates_1.render)(req, 'spamblock'));
    }
}

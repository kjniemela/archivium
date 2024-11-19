const express = require('express');
const path = require('path');
const api = require('./api');
const { render } = require('./templates');

const CookieParser = require('./middleware/cookieParser');
const multer = require('multer');
// const bodyParser = require('body-parser');
const Auth = require('./middleware/auth');

const cron = require('node-cron');
const backup = require('./db/backup');

const { PORT, ADDR_PREFIX, DEV_MODE } = require('./config');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(CookieParser);
app.use(Auth.createSession);

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// Logging
const logger = require('./logger');
logger.info('Server starting...');


// Cron Jobs
cron.schedule('0 0 * * *', () => {
    logger.info('Running daily DB export...');
    backup();
});


// Timer if in Dev Mode
if (DEV_MODE) {
  app.use('/', (req, res, next) => {
    req.startTime = new Date();
    next();
  });
}


// Serve static assets
app.use(`${ADDR_PREFIX}/static`, express.static(path.join(__dirname, 'static/')));

// Make static assets available in display mode
app.use(`${ADDR_PREFIX}/display/*/static`, express.static(path.join(__dirname, 'static/')));

// Load view routes
require('./views')(app);

// Load api routes
require('./api/routes')(app, upload);


/* 
  ACCOUNT ROUTES
*/
async function logout(req, res, next) {
  await api.session.delete({ id: req.session.id })
  res.clearCookie('archiviumuid', req.session.id);
}

app.get(`${ADDR_PREFIX}/login`, async (req, res, next) => {
  if (req.session.user) {
    try {
      await logout(req, res, next);
    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  }
  res.end(render(req, 'login'));
  next();
});

app.get(`${ADDR_PREFIX}/signup`, (req, res, next) => {
  res.end(render(req, 'signup'));
  next();
});

app.get(`${ADDR_PREFIX}/logout`, async (req, res, next) => {
  try {
    await logout(req, res, next);
    res.redirect(`${ADDR_PREFIX}/`);
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }
  next();
});

app.post(`${ADDR_PREFIX}/login`, async (req, res, next) => {
  try {  
    const [errCode, user] = await api.user.getOne({ username: req.body.username }, true);
    if (user) {
      req.loginId = user.id;
      const isCorrectLogin = api.user.validatePassword(req.body.password, user.password, user.salt);
      if (isCorrectLogin) {
        await api.session.put({ id: req.session.id }, { user_id: req.loginId });
        // // Atypical use of user.put, normally the first argument should be req.session.user.id
        // await api.user.put(user.id, user.id, { updated_at: new Date() });
        res.status(200);
        res.redirect(`${ADDR_PREFIX}${req.query.page || '/'}${req.query.search ? `?${req.query.search}` : ''}`);
      } else {
        res.status(401);
        res.end(render(req, 'login', { error: 'Username or password incorrect.' }));
      }
    } else {
      res.status(401);
      res.end(render(req, 'login', { error: 'Username or password incorrect.' }));
    }
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }
  next();
});

app.post(`${ADDR_PREFIX}/signup`, async (req, res, next) => {
  try {
    const data = await api.user.post( req.body );
    try {
      await api.session.put({ id: req.session.id }, { user_id: data.insertId });
      res.status(201);
      res.redirect(`${ADDR_PREFIX}${req.query.page || '/'}${req.query.search ? `?${req.query.search}` : ''}`);
    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  } catch (err) {
    logger.error(err);
    res.redirect(`${ADDR_PREFIX}/signup`);
  }
  next();
});

// 404 errors
app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404);
    if (req.isApiRequest) res.json({ error: 'Not Found.', code: 404 });
    else res.send(render(req, 'error', { code: 404 }));
  }
  next();
});

// Logger if in Dev Mode
if (DEV_MODE) {
  app.use('/', (req, res, next) => {
    const endTime = new Date();
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    // If the IP is in IPv6-mapped IPv4 format, extract the IPv4 part
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.split(':').pop();
    }
    const { method, path, query, session, startTime } = req;
    const user = session.user?.username ?? 'anonymous';
    logger.info(`${method} ${path} ${res.statusCode}${query ? ` ${JSON.stringify(query)}` : ''} ${user} ${clientIp} ${endTime - startTime}ms`);
    next();
  });
}

app.listen(PORT, () => {
  logger.info(`Example app listening at http://localhost:${PORT}`);
});

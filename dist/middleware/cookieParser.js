const parseCookies = (req, res, next) => {
    req.cookies = {};
    if ('cookie' in req.headers) {
        for (let cookie of req.headers.cookie.split('; ')) {
            let [key, value] = cookie.split('=');
            req.cookies[key] = value;
        }
    }
    next();
};
module.exports = parseCookies;
